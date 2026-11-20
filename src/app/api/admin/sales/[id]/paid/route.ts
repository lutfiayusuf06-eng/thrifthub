import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { requireStaffPermission } from '@/lib/staff-access'
import { getPool } from '@/lib/db'
import { readJsonBody } from '@/lib/request-body'
import { paidSaleSchema } from '@/lib/validation'
import {
  isPublicOrderSchemaReady,
  OrderConflictError,
  OrderSchemaUnavailableError,
  settleSaleTransaction,
} from '@/lib/order-reservations'

type SaleRow = RowDataPacket & {
  id: string
  status: 'pending' | 'paid' | 'cancelled' | 'expired'
}

type SaleItemRow = RowDataPacket & {
  product_code: string
}

type ProductCodeRow = RowDataPacket & {
  code: string
}

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const access = await requireStaffPermission('sales:pay', request)
  if (!access.ok) return access.response

  const body = await readJsonBody(request)
  if (!body.ok) return body.response
  const parsed = paidSaleSchema.safeParse(body.value)
  if (!parsed.success) {
    return Response.json({ error: 'Konfirmasi pembayaran tidak valid.' }, { status: 400 })
  }

  const { id } = await params
  if (await isPublicOrderSchemaReady()) {
    try {
      const result = await settleSaleTransaction(id, access.user.id)
      if (!result.ok) {
        return Response.json({ error: result.error }, { status: result.status })
      }
      return Response.json({ id: result.id, status: result.status })
    } catch (error) {
      if (error instanceof OrderConflictError) {
        return Response.json({ error: error.message }, { status: 409 })
      }
      if (error instanceof OrderSchemaUnavailableError) {
        return Response.json({ error: 'Migrasi pemesanan belum tersedia.' }, { status: 503 })
      }
      throw error
    }
  }

  const connection = await getPool().getConnection()
  let transactionStarted = false
  try {
    await connection.beginTransaction()
    transactionStarted = true
    const [sales] = await connection.execute<SaleRow[]>(
      'SELECT id, status FROM sale_transactions WHERE id = ? FOR UPDATE',
      [id],
    )
    const sale = sales[0]

    if (!sale) {
      await connection.rollback()
      return Response.json({ error: 'Transaksi tidak ditemukan.' }, { status: 404 })
    }

    if (sale.status !== 'pending') {
      await connection.rollback()
      return Response.json(
        { error: `Transaksi berstatus ${sale.status} dan tidak dapat dibayar.` },
        { status: 409 },
      )
    }

    const [items] = await connection.execute<SaleItemRow[]>(
      'SELECT product_code FROM sale_items WHERE transaction_id = ? ORDER BY product_code',
      [id],
    )
    if (items.length === 0) {
      await connection.rollback()
      return Response.json({ error: 'Transaksi tidak memiliki barang.' }, { status: 409 })
    }

    const codes = items.map((item) => item.product_code)
    const placeholders = codes.map(() => '?').join(', ')
    const [available] = await connection.execute<ProductCodeRow[]>(
      `SELECT code FROM products
       WHERE stock_status = 'available' AND code IN (${placeholders})
       FOR UPDATE`,
      codes,
    )

    if (available.length !== codes.length) {
      await connection.rollback()
      return Response.json(
        { error: 'Stok berubah; transaksi ini tidak dapat dikonfirmasi lunas.' },
        { status: 409 },
      )
    }

    const [updatedProducts] = await connection.execute<ResultSetHeader>(
      `UPDATE products SET stock_status = 'sold'
       WHERE stock_status = 'available' AND code IN (${placeholders})`,
      codes,
    )
    if (updatedProducts.affectedRows !== codes.length) {
      await connection.rollback()
      return Response.json(
        { error: 'Stok berubah saat konfirmasi; transaksi dibatalkan.' },
        { status: 409 },
      )
    }

    const [updatedSale] = await connection.execute<ResultSetHeader>(
      `UPDATE sale_transactions
       SET status = 'paid', paid_by = ?, paid_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'pending'`,
      [access.user.id, id],
    )
    if (updatedSale.affectedRows !== 1) {
      await connection.rollback()
      return Response.json({ error: 'Transaksi berubah sebelum pembayaran tersimpan.' }, { status: 409 })
    }
    await connection.commit()
    return Response.json({ id, status: 'paid' })
  } catch (error) {
    if (transactionStarted) await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
