import { randomUUID } from 'node:crypto'
import type { RowDataPacket } from 'mysql2'
import { requireStaffPermission } from '@/lib/staff-access'
import { getPool } from '@/lib/db'
import { readJsonBody } from '@/lib/request-body'
import { saleInputSchema } from '@/lib/validation'
import { getAdminSales } from '@/lib/admin-repository'
import { isPublicOrderSchemaReady } from '@/lib/order-reservations'

type AvailableProductRow = RowDataPacket & {
  code: string
  name: string
  price: number
  purchase_cost: number
  stock_status?: 'available' | 'sold'
  reserved_by_transaction_id?: string | null
}

type ReservationRow = RowDataPacket & {
  id: string
  status: 'pending' | 'paid' | 'cancelled' | 'expired'
  expired: number
}

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const access = await requireStaffPermission('sales:read', request)
  if (!access.ok) return access.response

  const includeAll = new URL(request.url).searchParams.get('all') === '1'
  const sales = await getAdminSales(includeAll ? null : 50)
  return Response.json({ sales })
}

export async function POST(request: Request) {
  const access = await requireStaffPermission('sales:create', request)
  if (!access.ok) return access.response

  const body = await readJsonBody(request)
  if (!body.ok) return body.response
  const parsed = saleInputSchema.safeParse(body.value)
  if (!parsed.success) {
    return Response.json(
      { error: 'Periksa kembali data transaksi.', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const connection = await getPool().getConnection()
  const transactionId = randomUUID()
  let transactionStarted = false
  try {
    await connection.beginTransaction()
    transactionStarted = true
    const orderSchemaReady = await isPublicOrderSchemaReady()
    const productCodes = [...parsed.data.productCodes].sort()
    const placeholders = productCodes.map(() => '?').join(', ')
    const [products] = await connection.execute<AvailableProductRow[]>(
      `SELECT code, name, price, purchase_cost
       ${orderSchemaReady ? ', stock_status, reserved_by_transaction_id' : ''}
       FROM products
       WHERE stock_status = 'available' AND code IN (${placeholders})
       ORDER BY code
       FOR UPDATE`,
      productCodes,
    )

    if (orderSchemaReady) {
      const reservationIds = [...new Set(products
        .map((product) => product.reserved_by_transaction_id)
        .filter((id): id is string => Boolean(id)))].sort()
      if (reservationIds.length) {
        const reservationPlaceholders = reservationIds.map(() => '?').join(', ')
        const [reservations] = await connection.execute<ReservationRow[]>(
          `SELECT id, status,
                  (reservation_expires_at IS NOT NULL AND reservation_expires_at <= CURRENT_TIMESTAMP) AS expired
           FROM sale_transactions
           WHERE id IN (${reservationPlaceholders})
           ORDER BY id
           FOR UPDATE`,
          reservationIds,
        )
        const reservationsById = new Map(reservations.map((reservation) => [reservation.id, reservation]))
        for (const product of products) {
          const reservationId = product.reserved_by_transaction_id
          if (!reservationId) continue
          const reservation = reservationsById.get(reservationId)
          if (reservation?.status === 'pending' && !Number(reservation.expired)) continue
          if (reservation?.status === 'pending' && Number(reservation.expired)) {
            await connection.execute(
              `UPDATE sale_transactions SET status = 'expired'
               WHERE id = ? AND status = 'pending'`,
              [reservationId],
            )
          }
          if (reservation?.status === 'paid') {
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
      }
    }

    if (
      products.length !== productCodes.length ||
      products.some((product) => product.stock_status === 'sold' || product.reserved_by_transaction_id)
    ) {
      await connection.rollback()
      return Response.json(
        { error: 'Satu atau beberapa produk sudah dipesan, terjual, atau tidak lagi tersedia.' },
        { status: 409 },
      )
    }

    const totalAmount = products.reduce((total, product) => total + product.price, 0)
    if (orderSchemaReady) {
      await connection.execute(
        `INSERT INTO sale_transactions (id, source, origin, status, total_amount, created_by)
         VALUES (?, ?, 'pos', 'pending', ?, ?)`,
        [transactionId, parsed.data.source, totalAmount, access.user.id],
      )
    } else {
      await connection.execute(
        `INSERT INTO sale_transactions (id, source, status, total_amount, created_by)
         VALUES (?, ?, 'pending', ?, ?)`,
        [transactionId, parsed.data.source, totalAmount, access.user.id],
      )
    }

    for (const product of products) {
      await connection.execute(
        `INSERT INTO sale_items (
          transaction_id, product_code, product_name, unit_price, unit_cost
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          transactionId,
          product.code,
          product.name,
          product.price,
          product.purchase_cost,
        ],
      )
    }

    await connection.commit()
    return Response.json(
      { id: transactionId, status: 'pending', totalAmount },
      { status: 201 },
    )
  } catch (error) {
    if (transactionStarted) await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
