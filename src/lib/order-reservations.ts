import { randomUUID } from 'node:crypto'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import type { PoolConnection } from 'mysql2/promise'
import { getPool } from '@/lib/db'

type SchemaRow = RowDataPacket & { column_name: string }
type TriggerRow = RowDataPacket & { trigger_name: string }
type ProductRow = RowDataPacket & {
  code: string
  name: string
  price: number
  purchase_cost: number
  stock_status: 'qc_pending' | 'available' | 'sold' | 'archived'
  inspection_status: 'pending' | 'passed' | 'failed'
  cleaning_status: 'pending' | 'cleaned'
  reserved_by_transaction_id: string | null
}
type ExistingOrderRow = RowDataPacket & {
  id: string
  status: 'pending' | 'paid' | 'cancelled' | 'expired'
  total_amount: number
  reservation_expires_at: Date | string | null
  expires_epoch: number | null
  reservation_expired?: number
  payment_method: 'transfer' | 'cod' | null
  delivery_fee: number
}
type ExistingOrderItemRow = RowDataPacket & {
  product_code: string
  product_name: string
  unit_price: number
}
type SaleLockRow = ExistingOrderRow & { origin: 'pos' | 'website' }
type SaleItemRow = RowDataPacket & {
  product_code: string
  product_name: string
  unit_price: number
  unit_cost: number
}
type ReservationOrderRow = RowDataPacket & {
  id: string
  status: 'pending' | 'paid' | 'cancelled' | 'expired'
  expired: number
}

export type PublicOrderResult = {
  id: string
  productCode: string
  productName: string
  items: Array<{
    productCode: string
    productName: string
    unitPrice: number
  }>
  status: ExistingOrderRow['status']
  totalAmount: number
  deliveryFee: number
  paymentMethod: 'transfer' | 'cod'
  reservationExpiresAt: string | null
}

export type PublicOrderCustomer = {
  name: string
  whatsapp: string
  email: string | null
  note: string
  deliveryDistrict: string
  deliveryAddress: string
  paymentMethod: 'transfer' | 'cod'
}

export class OrderConflictError extends Error {}
export class OrderSchemaUnavailableError extends Error {}

export async function isPublicOrderSchemaReady() {
  const [columns] = await getPool().execute<SchemaRow[]>(
    `SELECT COLUMN_NAME AS column_name
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND (
         (TABLE_NAME = 'sale_transactions' AND COLUMN_NAME IN ('origin', 'reservation_expires_at', 'public_request_key'))
         OR (TABLE_NAME = 'products' AND COLUMN_NAME = 'reserved_by_transaction_id')
       )`,
  )
  if (columns.length !== 4) return false
  const [triggers] = await getPool().execute<TriggerRow[]>(
    `SELECT TRIGGER_NAME AS trigger_name
     FROM information_schema.TRIGGERS
     WHERE TRIGGER_SCHEMA = DATABASE()
       AND TRIGGER_NAME IN ('trg_sales_origin_creator_insert', 'trg_sales_origin_creator_update')`,
  )
  return triggers.length === 2
}

export async function isPublicOrderCustomerSchemaReady() {
  if (!(await isPublicOrderSchemaReady())) return false
  const [columns] = await getPool().execute<SchemaRow[]>(
    `SELECT COLUMN_NAME AS column_name
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'sale_transactions'
       AND COLUMN_NAME IN (
         'customer_name', 'customer_whatsapp', 'customer_email', 'customer_note',
         'delivery_district', 'delivery_address', 'payment_method', 'delivery_fee'
       )`,
  )
  return columns.length === 8
}

function asIso(epoch: number | null) {
  return epoch === null ? null : new Date(Number(epoch) * 1000).toISOString()
}

export function getDeliveryFee() {
  const configuredFee = process.env.THRIFTHUB_DELIVERY_FEE
  if (configuredFee === undefined) return 5000
  if (!/^\d+$/.test(configuredFee)) {
    throw new Error('THRIFTHUB_DELIVERY_FEE must be a non-negative integer.')
  }
  const fee = Number(configuredFee)
  if (!Number.isSafeInteger(fee) || fee > 100_000_000) {
    throw new Error('THRIFTHUB_DELIVERY_FEE is outside the supported range.')
  }
  return fee
}

async function getExistingOrder(connection: PoolConnection, key: string) {
  const [rows] = await connection.execute<ExistingOrderRow[]>(
    `SELECT id, status, total_amount, reservation_expires_at,
            payment_method, delivery_fee,
            UNIX_TIMESTAMP(reservation_expires_at) AS expires_epoch,
            (reservation_expires_at IS NOT NULL AND reservation_expires_at <= CURRENT_TIMESTAMP) AS reservation_expired
     FROM sale_transactions
     WHERE public_request_key = ?
     LIMIT 1`,
    [key],
  )
  return rows[0]
}

async function getExistingOrderItems(connection: PoolConnection, id: string) {
  const [items] = await connection.execute<ExistingOrderItemRow[]>(
    `SELECT product_code, product_name, unit_price
     FROM sale_items WHERE transaction_id = ? ORDER BY product_code`,
    [id],
  )
  return items
}

function sameProductCodes(
  items: Array<Pick<ExistingOrderItemRow, 'product_code'>>,
  productCodes: string[],
) {
  return items.length === productCodes.length &&
    items.every((item, index) => item.product_code === productCodes[index])
}

function mapPublicOrder(
  sale: ExistingOrderRow,
  orderItems: Array<Pick<ExistingOrderItemRow, 'product_code' | 'product_name' | 'unit_price'>>,
): PublicOrderResult {
  const items = orderItems.map((item) => ({
    productCode: item.product_code,
    productName: item.product_name,
    unitPrice: Number(item.unit_price),
  }))
  const firstItem = items[0]
  if (!firstItem) throw new OrderConflictError('Transaksi tidak memiliki barang.')

  return {
    id: sale.id,
    productCode: firstItem.productCode,
    productName: firstItem.productName,
    items,
    status: sale.status,
    totalAmount: Number(sale.total_amount),
    deliveryFee: Number(sale.delivery_fee),
    paymentMethod: sale.payment_method ?? 'transfer',
    reservationExpiresAt: asIso(sale.expires_epoch),
  }
}

export async function releaseOrExpireProductReservation(
  connection: PoolConnection,
  product: Pick<ProductRow, 'code' | 'stock_status' | 'reserved_by_transaction_id'>,
) {
  const reservationId = product.reserved_by_transaction_id
  if (!reservationId) return false

  const [reservations] = await connection.execute<ReservationOrderRow[]>(
    `SELECT id, status,
            (reservation_expires_at IS NOT NULL AND reservation_expires_at <= CURRENT_TIMESTAMP) AS expired
     FROM sale_transactions
     WHERE id = ?
     FOR UPDATE`,
    [reservationId],
  )
  const reservation = reservations[0]
  if (!reservation) {
    await connection.execute(
      `UPDATE products SET reserved_by_transaction_id = NULL
       WHERE code = ? AND reserved_by_transaction_id = ?`,
      [product.code, reservationId],
    )
    product.reserved_by_transaction_id = null
    return false
  }

  if (reservation.status === 'pending' && !Number(reservation.expired)) return true

  if (reservation.status === 'pending' && Number(reservation.expired)) {
    await connection.execute(
      `UPDATE sale_transactions SET status = 'expired'
       WHERE id = ? AND status = 'pending'`,
      [reservationId],
    )
  }
  if (reservation.status === 'paid') {
    await connection.execute(
      `UPDATE products SET stock_status = 'sold', reserved_by_transaction_id = NULL
       WHERE code = ? AND reserved_by_transaction_id = ?`,
      [product.code, reservationId],
    )
  } else {
    await connection.execute(
      `UPDATE products SET reserved_by_transaction_id = NULL
       WHERE code = ? AND reserved_by_transaction_id = ?`,
      [product.code, reservationId],
    )
  }
  product.reserved_by_transaction_id = null
  if (reservation.status === 'paid') product.stock_status = 'sold'
  return false
}

async function readIdempotentOrder(
  connection: PoolConnection,
  key: string,
  productCodes: string[],
  lockedProducts?: ProductRow[],
): Promise<PublicOrderResult | null> {
  const existing = await getExistingOrder(connection, key)
  if (!existing) return null
  const existingItems = await getExistingOrderItems(connection, existing.id)
  if (!sameProductCodes(existingItems, productCodes)) {
    throw new OrderConflictError('Kunci permintaan ini sudah digunakan untuk produk lain.')
  }

  const products = lockedProducts ?? await lockProducts(connection, productCodes)
  if (products.length !== productCodes.length) {
    throw new OrderConflictError('Satu atau beberapa produk tidak ditemukan atau tidak tersedia.')
  }
  const [lockedRows] = await connection.execute<ExistingOrderRow[]>(
    `SELECT id, status, total_amount, reservation_expires_at,
            payment_method, delivery_fee,
            UNIX_TIMESTAMP(reservation_expires_at) AS expires_epoch,
            (reservation_expires_at IS NOT NULL AND reservation_expires_at <= CURRENT_TIMESTAMP) AS reservation_expired
     FROM sale_transactions WHERE id = ? FOR UPDATE`,
    [existing.id],
  )
  const lockedSale = lockedRows[0]
  if (!lockedSale) throw new OrderConflictError('Status pesanan berubah. Silakan muat ulang.')

  if (lockedSale.status === 'pending' && Number(lockedSale.reservation_expired)) {
    await connection.execute(
      `UPDATE sale_transactions SET status = 'expired'
       WHERE id = ? AND status = 'pending'`,
      [existing.id],
    )
    await connection.execute(
      `UPDATE products SET reserved_by_transaction_id = NULL
       WHERE reserved_by_transaction_id = ?`,
      [existing.id],
    )
    lockedSale.status = 'expired'
  }
  if (lockedSale.status === 'pending' &&
    products.some((product) => product.reserved_by_transaction_id !== lockedSale.id)) {
    throw new OrderConflictError('Reservasi pesanan tidak lagi aktif.')
  }
  return mapPublicOrder(lockedSale, existingItems)
}

async function lockProducts(connection: PoolConnection, codes: string[]) {
  const sorted = [...new Set(codes)].sort()
  if (!sorted.length) return []
  const placeholders = sorted.map(() => '?').join(', ')
  const [products] = await connection.execute<ProductRow[]>(
    `SELECT code, name, price, purchase_cost, stock_status,
            inspection_status, cleaning_status, reserved_by_transaction_id
     FROM products
     WHERE code IN (${placeholders})
     ORDER BY code
     FOR UPDATE`,
    sorted,
  )
  return products
}

export async function createPublicOrder(
  productCodes: string[],
  idempotencyKey: string,
  customer: PublicOrderCustomer,
) {
  const sortedProductCodes = [...new Set(productCodes)].sort()
  if (!sortedProductCodes.length || sortedProductCodes.length !== productCodes.length) {
    throw new OrderConflictError('Daftar produk tidak valid.')
  }
  if (!(await isPublicOrderCustomerSchemaReady())) throw new OrderSchemaUnavailableError()

  const connection = await getPool().getConnection()
  let transactionStarted = false
  try {
    await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED')
    await connection.beginTransaction()
    transactionStarted = true

    const previous = await getExistingOrder(connection, idempotencyKey)
    if (previous) {
      const existing = await readIdempotentOrder(connection, idempotencyKey, sortedProductCodes)
      if (existing) {
        await connection.commit()
        return existing
      }
    }

    const products = await lockProducts(connection, sortedProductCodes)
    if (products.length !== sortedProductCodes.length) {
      throw new OrderConflictError('Satu atau beberapa produk sudah terjual atau tidak lagi tersedia.')
    }
    if (products.some((product) =>
      product.stock_status !== 'available' ||
      product.inspection_status !== 'passed' ||
      product.cleaning_status !== 'cleaned',
    )) {
      throw new OrderConflictError('Satu atau beberapa produk sudah terjual atau tidak lagi tersedia.')
    }

    const concurrentDuplicate = await readIdempotentOrder(
      connection,
      idempotencyKey,
      sortedProductCodes,
      products,
    )
    if (concurrentDuplicate) {
      await connection.commit()
      return concurrentDuplicate
    }

    for (const product of products) {
      const isReserved = await releaseOrExpireProductReservation(connection, product)
      if (isReserved) {
        throw new OrderConflictError('Satu atau beberapa produk sedang dipesan pembeli lain. Perbarui keranjang.')
      }
      if (product.stock_status !== 'available') {
        throw new OrderConflictError('Satu atau beberapa produk sudah terjual atau tidak lagi tersedia.')
      }
    }

    const transactionId = randomUUID()
    const deliveryFee = getDeliveryFee()
    const subtotal = products.reduce((total, product) => total + Number(product.price), 0)
    await connection.execute(
      `INSERT INTO sale_transactions (
        id, source, origin, status, total_amount, created_by,
        reservation_expires_at, public_request_key, customer_name,
        customer_whatsapp, customer_email, customer_note,
        delivery_district, delivery_address, payment_method, delivery_fee
      ) VALUES (?, 'website', 'website', 'pending', ?, NULL,
        CASE WHEN ? = 'cod' THEN NULL
          ELSE DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 15 MINUTE) END,
        ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        transactionId,
        subtotal + deliveryFee,
        customer.paymentMethod,
        idempotencyKey,
        customer.name,
        customer.whatsapp,
        customer.email,
        customer.note,
        customer.deliveryDistrict,
        customer.deliveryAddress,
        customer.paymentMethod,
        deliveryFee,
      ],
    )
    for (const product of products) {
      await connection.execute(
        `INSERT INTO sale_items (
          transaction_id, product_code, product_name, unit_price, unit_cost
        ) VALUES (?, ?, ?, ?, ?)`,
        [transactionId, product.code, product.name, product.price, product.purchase_cost],
      )
      const [reserved] = await connection.execute<ResultSetHeader>(
        `UPDATE products
         SET reserved_by_transaction_id = ?
         WHERE code = ? AND stock_status = 'available'
           AND reserved_by_transaction_id IS NULL`,
        [transactionId, product.code],
      )
      if (reserved.affectedRows !== 1) {
        throw new OrderConflictError('Produk baru saja dipesan. Perbarui keranjang.')
      }
    }

    const [[created]] = await connection.execute<ExistingOrderRow[]>(
      `SELECT id, status, total_amount, reservation_expires_at,
              payment_method, delivery_fee,
              UNIX_TIMESTAMP(reservation_expires_at) AS expires_epoch,
              (reservation_expires_at IS NOT NULL AND reservation_expires_at <= CURRENT_TIMESTAMP) AS reservation_expired
       FROM sale_transactions WHERE id = ?`,
      [transactionId],
    )
    await connection.commit()
    const createdItems = products.map((product) => ({
      product_code: product.code,
      product_name: product.name,
      unit_price: product.price,
    }))
    return mapPublicOrder(created, createdItems)
  } catch (error) {
    if (transactionStarted) await connection.rollback()
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY') {
      const existing = await getExistingOrder(connection, idempotencyKey).catch(() => undefined)
      const existingItems = existing
        ? await getExistingOrderItems(connection, existing.id).catch(() => [])
        : []
      if (existing) {
        if (sameProductCodes(existingItems, sortedProductCodes)) {
          return mapPublicOrder(existing, existingItems)
        }
        throw new OrderConflictError('Kunci permintaan ini sudah digunakan untuk produk lain.')
      }
    }
    throw error
  } finally {
    connection.release()
  }
}

export async function expirePublicOrders(batchSize = 100) {
  if (!(await isPublicOrderSchemaReady())) throw new OrderSchemaUnavailableError()
  const [candidates] = await getPool().execute<(RowDataPacket & { id: string })[]>(
    `SELECT id
     FROM sale_transactions
     WHERE origin = 'website' AND status = 'pending'
       AND reservation_expires_at <= CURRENT_TIMESTAMP
     ORDER BY reservation_expires_at, id
     LIMIT ?`,
    [batchSize],
  )

  let expiredCount = 0
  for (const candidate of candidates) {
    const connection = await getPool().getConnection()
    let transactionStarted = false
    try {
      await connection.beginTransaction()
      transactionStarted = true
      const [items] = await connection.execute<ExistingOrderItemRow[]>(
        `SELECT product_code FROM sale_items
         WHERE transaction_id = ? ORDER BY product_code`,
        [candidate.id],
      )
      const products = await lockProducts(connection, items.map((item) => item.product_code))
      const [sales] = await connection.execute<SaleLockRow[]>(
        `SELECT id, origin, status, total_amount, reservation_expires_at,
                UNIX_TIMESTAMP(reservation_expires_at) AS expires_epoch,
                (reservation_expires_at IS NOT NULL AND reservation_expires_at <= CURRENT_TIMESTAMP) AS reservation_expired
         FROM sale_transactions WHERE id = ? FOR UPDATE`,
        [candidate.id],
      )
      const sale = sales[0]
      if (sale?.origin === 'website' && sale.status === 'pending' &&
        Number(sale.reservation_expired)) {
        await connection.execute(
          `UPDATE sale_transactions SET status = 'expired'
           WHERE id = ? AND status = 'pending'`,
          [sale.id],
        )
        for (const product of products) {
          await connection.execute(
            `UPDATE products SET reserved_by_transaction_id = NULL
             WHERE code = ? AND reserved_by_transaction_id = ?`,
            [product.code, sale.id],
          )
        }
        expiredCount += 1
      }
      await connection.commit()
    } catch (error) {
      if (transactionStarted) await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }
  return expiredCount
}

export async function settleSaleTransaction(
  id: string,
  staffId: string,
  paymentFlow: 'staff' | 'logistics_cod' = 'staff',
) {
  if (!(await isPublicOrderSchemaReady())) throw new OrderSchemaUnavailableError()
  const customerSchemaReady = await isPublicOrderCustomerSchemaReady()
  if (paymentFlow === 'logistics_cod' && !customerSchemaReady) {
    throw new OrderSchemaUnavailableError()
  }
  const connection = await getPool().getConnection()
  let transactionStarted = false
  try {
    await connection.beginTransaction()
    transactionStarted = true
    const [initialSales] = await connection.execute<SaleLockRow[]>(
      `SELECT id, origin, status, total_amount, reservation_expires_at,
              ${customerSchemaReady ? 'payment_method' : 'NULL AS payment_method'},
              UNIX_TIMESTAMP(reservation_expires_at) AS expires_epoch,
              (reservation_expires_at IS NOT NULL AND reservation_expires_at <= CURRENT_TIMESTAMP) AS reservation_expired
       FROM sale_transactions WHERE id = ?`,
      [id],
    )
    const initialSale = initialSales[0]
    if (!initialSale) {
      await connection.rollback()
      return { ok: false as const, status: 404, error: 'Transaksi tidak ditemukan.' }
    }
    const [items] = await connection.execute<SaleItemRow[]>(
      `SELECT product_code, product_name, unit_price, unit_cost
       FROM sale_items WHERE transaction_id = ? ORDER BY product_code`,
      [id],
    )
    if (!items.length) {
      await connection.rollback()
      return { ok: false as const, status: 409, error: 'Transaksi tidak memiliki barang.' }
    }

    const products = await lockProducts(connection, items.map((item) => item.product_code))
    if (products.length !== items.length) {
      await connection.rollback()
      return { ok: false as const, status: 409, error: 'Satu atau beberapa produk tidak ditemukan.' }
    }
    const relatedSaleIds = [...new Set([
      id,
      ...products.map((product) => product.reserved_by_transaction_id).filter((value): value is string => Boolean(value)),
    ])].sort()
    const salePlaceholders = relatedSaleIds.map(() => '?').join(', ')
    const [lockedSales] = await connection.execute<SaleLockRow[]>(
      `SELECT id, origin, status, total_amount, reservation_expires_at,
              ${customerSchemaReady ? 'payment_method' : 'NULL AS payment_method'},
              UNIX_TIMESTAMP(reservation_expires_at) AS expires_epoch,
              (reservation_expires_at IS NOT NULL AND reservation_expires_at <= CURRENT_TIMESTAMP) AS reservation_expired
       FROM sale_transactions WHERE id IN (${salePlaceholders})
       ORDER BY id FOR UPDATE`,
      relatedSaleIds,
    )
    const byId = new Map(lockedSales.map((sale) => [sale.id, sale]))
    const sale = byId.get(id)
    if (!sale) throw new OrderConflictError('Status transaksi berubah. Silakan segarkan data.')
    if (sale.status !== 'pending') {
      await connection.rollback()
      return { ok: false as const, status: 409, error: `Transaksi berstatus ${sale.status} dan tidak dapat dibayar.` }
    }
    if (
      (paymentFlow === 'logistics_cod' &&
        (sale.payment_method !== 'cod' || sale.origin !== 'website')) ||
      (paymentFlow === 'staff' && sale.payment_method === 'cod')
    ) {
      await connection.rollback()
      return {
        ok: false as const,
        status: 409,
        error: paymentFlow === 'logistics_cod'
          ? 'Konfirmasi ini hanya berlaku untuk pesanan COD.'
          : 'Pembayaran COD hanya dapat dikonfirmasi dari halaman logistik.',
      }
    }
    if (paymentFlow === 'logistics_cod') {
      const [shipments] = await connection.execute<RowDataPacket[]>(
        'SELECT status FROM shipments WHERE transaction_id = ? FOR UPDATE',
        [id],
      )
      if (shipments[0]?.status !== 'delivered') {
        await connection.rollback()
        return {
          ok: false as const,
          status: 409,
          error: 'Pembayaran COD hanya dapat dikonfirmasi setelah pesanan diterima pembeli.',
        }
      }
    }

    for (const product of products) {
      const reservationId = product.reserved_by_transaction_id
      if (!reservationId) continue
      const reservation = byId.get(reservationId)
      if (!reservation) {
        await connection.execute(
          `UPDATE products SET reserved_by_transaction_id = NULL WHERE code = ? AND reserved_by_transaction_id = ?`,
          [product.code, reservationId],
        )
        product.reserved_by_transaction_id = null
        continue
      }
      const expired = Boolean(Number(reservation.reservation_expired))
      if (reservation.status === 'pending' && !expired) continue
      if (reservation.status === 'pending' && expired) {
        await connection.execute(
          `UPDATE sale_transactions SET status = 'expired' WHERE id = ? AND status = 'pending'`,
          [reservationId],
        )
      }
      if (reservation.status === 'paid') {
        await connection.execute(
          `UPDATE products SET stock_status = 'sold', reserved_by_transaction_id = NULL
           WHERE code = ? AND reserved_by_transaction_id = ?`,
          [product.code, reservationId],
        )
        product.stock_status = 'sold'
      } else {
        await connection.execute(
          `UPDATE products SET reserved_by_transaction_id = NULL
           WHERE code = ? AND reserved_by_transaction_id = ?`,
          [product.code, reservationId],
        )
      }
      product.reserved_by_transaction_id = null
    }

    if (sale.origin === 'website') {
      const expired = Boolean(Number(sale.reservation_expired))
      if (expired) {
        await connection.execute(
          `UPDATE sale_transactions SET status = 'expired' WHERE id = ? AND status = 'pending'`,
          [sale.id],
        )
        for (const product of products) {
          await connection.execute(
            `UPDATE products SET reserved_by_transaction_id = NULL
             WHERE code = ? AND reserved_by_transaction_id = ?`,
            [product.code, sale.id],
          )
        }
        await connection.commit()
        return { ok: false as const, status: 409, error: 'Reservasi pesanan sudah kedaluwarsa.' }
      }
      if (
        (sale.payment_method !== 'cod' && sale.reservation_expires_at === null) ||
        products.some((product) => product.reserved_by_transaction_id !== sale.id)
      ) {
        await connection.rollback()
        return { ok: false as const, status: 409, error: 'Reservasi produk tidak lagi aktif.' }
      }
    } else if (products.some((product) =>
      product.stock_status !== 'available' || product.reserved_by_transaction_id !== null,
    )) {
      await connection.rollback()
      return { ok: false as const, status: 409, error: 'Stok berubah atau sedang direservasi oleh pesanan website.' }
    }

    const codes = products.map((product) => product.code)
    const placeholders = codes.map(() => '?').join(', ')
    const [updatedProducts] = await connection.execute<ResultSetHeader>(
      `UPDATE products SET stock_status = 'sold', reserved_by_transaction_id = NULL
       WHERE code IN (${placeholders}) AND stock_status = 'available'`,
      codes,
    )
    if (updatedProducts.affectedRows !== codes.length) {
      await connection.rollback()
      return { ok: false as const, status: 409, error: 'Stok berubah; transaksi tidak dapat dikonfirmasi lunas.' }
    }
    const [updatedSale] = await connection.execute<ResultSetHeader>(
      `UPDATE sale_transactions SET status = 'paid', paid_by = ?, paid_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'pending'`,
      [staffId, id],
    )
    if (updatedSale.affectedRows !== 1) {
      await connection.rollback()
      return { ok: false as const, status: 409, error: 'Transaksi berubah sebelum pembayaran tersimpan.' }
    }
    await connection.commit()
    return { ok: true as const, id, status: 'paid' as const }
  } catch (error) {
    if (transactionStarted) await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
