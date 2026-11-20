import { z } from 'zod'
import type { RowDataPacket } from 'mysql2'
import { requireStaffPermission } from '@/lib/staff-access'
import { getPool } from '@/lib/db'
import {
  isPublicOrderCustomerSchemaReady,
  isPublicOrderSchemaReady,
  settleSaleTransaction,
} from '@/lib/order-reservations'
import { isLogisticsSchemaReady } from '@/lib/logistics-repository'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteContext) {
  const access = await requireStaffPermission('logistics:manage', request)
  if (!access.ok) return access.response

  const { id } = await params
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: 'ID pengiriman tidak valid.' }, { status: 400 })
  }

  try {
    if (
      !(await isLogisticsSchemaReady()) ||
      !(await isPublicOrderSchemaReady()) ||
      !(await isPublicOrderCustomerSchemaReady())
    ) {
      return Response.json({ error: 'Skema COD atau pengiriman belum tersedia pada database.' }, { status: 503 })
    }
    const [shipments] = await getPool().execute<(RowDataPacket & { transaction_id: string })[]>(
      'SELECT transaction_id FROM shipments WHERE id = ? LIMIT 1',
      [id],
    )
    if (!shipments[0]) {
      return Response.json({ error: 'Data pengiriman tidak ditemukan.' }, { status: 404 })
    }
    const result = await settleSaleTransaction(
      shipments[0].transaction_id,
      access.user.id,
      'logistics_cod',
    )
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status })
    }
    return Response.json({ id: result.id, status: result.status })
  } catch (error) {
    console.error('COD payment confirmation failed', error)
    return Response.json({ error: 'Konfirmasi pembayaran COD gagal disimpan.' }, { status: 500 })
  }
}
