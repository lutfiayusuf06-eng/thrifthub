import { z } from 'zod'
import { readJsonBody } from '@/lib/request-body'
import { requireStaffPermission } from '@/lib/staff-access'
import {
  isLogisticsSchemaReady,
  LogisticsConflictError,
  LogisticsEligibilityError,
  LogisticsNotFoundError,
  updateShipment,
} from '@/lib/logistics-repository'
import { sendShipmentStartedNotification } from '@/lib/fonnte-shipment-notification'

const updateShipmentSchema = z.object({
  status: z.enum(['ready_to_ship', 'in_transit', 'delivered', 'problem']),
  note: z.string().trim().max(1000, 'Catatan maksimal 1000 karakter.'),
})

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const access = await requireStaffPermission('logistics:manage', request)
  if (!access.ok) return access.response

  try {
    if (!(await isLogisticsSchemaReady())) {
      return Response.json({ error: 'Skema pengiriman belum tersedia pada database.' }, { status: 503 })
    }

    const body = await readJsonBody(request)
    if (!body.ok) return body.response
    const parsed = updateShipmentSchema.safeParse(body.value)
    if (!parsed.success) {
      return Response.json(
        { error: 'Periksa kembali status dan informasi pengiriman.' },
        { status: 400 },
      )
    }
    const { id } = await params
    if (!z.uuid().safeParse(id).success) {
      return Response.json({ error: 'ID pengiriman tidak valid.' }, { status: 400 })
    }

    const shipment = await updateShipment(id, access.user.id, parsed.data)
    const notification = parsed.data.status === 'in_transit'
      ? await sendShipmentStartedNotification(id, request.url)
      : null
    return Response.json({ ...shipment, notification })
  } catch (error) {
    if (error instanceof LogisticsNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 })
    }
    if (error instanceof LogisticsEligibilityError) {
      return Response.json({ error: error.message }, { status: 422 })
    }
    if (error instanceof LogisticsConflictError) {
      return Response.json({ error: error.message }, { status: 409 })
    }
    console.error('Logistics shipment update failed')
    return Response.json({ error: 'Perubahan pengiriman gagal disimpan. Coba lagi.' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const access = await requireStaffPermission('logistics:manage', request)
  if (!access.ok) return access.response

  try {
    if (!(await isLogisticsSchemaReady())) {
      return Response.json({ error: 'Skema pengiriman belum tersedia pada database.' }, { status: 503 })
    }

    const { id } = await params
    if (!z.uuid().safeParse(id).success) {
      return Response.json({ error: 'ID pengiriman tidak valid.' }, { status: 400 })
    }

    const notification = await sendShipmentStartedNotification(id, request.url, true)
    return Response.json({ notification })
  } catch (error) {
    if (error instanceof LogisticsNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 })
    }
    console.error('Shipment notification retry failed')
    return Response.json({ error: 'Notifikasi gagal dikirim ulang. Coba lagi.' }, { status: 500 })
  }
}
