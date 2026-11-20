import type { RowDataPacket } from 'mysql2'
import { requireStaffPermission } from '@/lib/staff-access'
import { getPool } from '@/lib/db'
import { readJsonBody } from '@/lib/request-body'
import { qcUpdateSchema } from '@/lib/validation'
import {
  isPublicOrderSchemaReady,
  releaseOrExpireProductReservation,
} from '@/lib/order-reservations'

type ProductStatusRow = RowDataPacket & {
  stock_status: 'qc_pending' | 'available' | 'sold' | 'archived'
  reserved_by_transaction_id?: string | null
}

type RouteContext = {
  params: Promise<{ code: string }>
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const access = await requireStaffPermission('products:write', request)
  if (!access.ok) return access.response

  const body = await readJsonBody(request)
  if (!body.ok) return body.response
  const parsed = qcUpdateSchema.safeParse(body.value)
  if (!parsed.success) {
    return Response.json(
      { error: 'Periksa kembali hasil pemeriksaan.', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { code } = await params
  const update = parsed.data
  const stockStatus =
    update.inspectionStatus === 'passed' && update.cleaningStatus === 'cleaned'
      ? 'available'
      : 'qc_pending'
  const connection = await getPool().getConnection()
  let transactionStarted = false
  try {
    await connection.beginTransaction()
    transactionStarted = true
    const orderSchemaReady = await isPublicOrderSchemaReady()
    const [rows] = await connection.execute<ProductStatusRow[]>(
      `SELECT stock_status${orderSchemaReady ? ', reserved_by_transaction_id' : ''}
       FROM products WHERE code = ? FOR UPDATE`,
      [code],
    )
    const currentProduct = rows[0]
    if (!currentProduct) {
      await connection.rollback()
      return Response.json({ error: 'Produk tidak ditemukan.' }, { status: 404 })
    }
    if (currentProduct.stock_status === 'sold' || currentProduct.stock_status === 'archived') {
      await connection.rollback()
      return Response.json({ error: 'Produk sudah tidak dapat diperiksa.' }, { status: 409 })
    }
    if (orderSchemaReady && currentProduct.reserved_by_transaction_id) {
      const reservableProduct = {
        code,
        stock_status: currentProduct.stock_status,
        reserved_by_transaction_id: currentProduct.reserved_by_transaction_id,
      }
      const reserved = await releaseOrExpireProductReservation(connection, reservableProduct)
      if (reserved) {
        await connection.rollback()
        return Response.json(
          { error: 'Produk sedang direservasi untuk pesanan website dan QC belum dapat diubah.' },
          { status: 409 },
        )
      }
      const [updatedStatus] = await connection.execute<ProductStatusRow[]>(
        'SELECT stock_status FROM products WHERE code = ? FOR UPDATE',
        [code],
      )
      if (updatedStatus[0]?.stock_status === 'sold') {
        await connection.commit()
        return Response.json({ error: 'Produk sudah terjual.' }, { status: 409 })
      }
    }

    await connection.execute(
      `UPDATE products
       SET fabric_check = ?, seams_check = ?, buttons_check = ?, zipper_check = ?,
           condition_note = ?, inspection_status = ?, cleaning_status = ?,
           stock_status = ?
       WHERE code = ? AND stock_status NOT IN ('sold', 'archived')`,
      [
        update.fabricCheck,
        update.seamsCheck,
        update.buttonsCheck,
        update.zipperCheck,
        update.conditionNote,
        update.inspectionStatus,
        update.cleaningStatus,
        stockStatus,
        code,
      ],
    )
    await connection.commit()
    return Response.json({ code, stockStatus })
  } catch (error) {
    if (transactionStarted) await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
