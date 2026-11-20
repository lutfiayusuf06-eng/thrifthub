import { z } from 'zod'
import { readJsonBody } from '@/lib/request-body'
import { requireStaffPermission } from '@/lib/staff-access'
import {
  createShipment,
  getLogisticsShipments,
  getLogisticsSummary,
  getReadyToShipOrders,
  isLogisticsSchemaReady,
  LogisticsConflictError,
  LogisticsEligibilityError,
  LogisticsNotFoundError,
  type ShipmentFilterStatus,
  type ShipmentStatus,
} from '@/lib/logistics-repository'
import { sendShipmentStartedNotification } from '@/lib/fonnte-shipment-notification'

export const dynamic = 'force-dynamic'

const statusValues = ['ready_to_ship', 'in_transit', 'delivered', 'problem'] as const
const createShipmentSchema = z.object({
  transactionId: z.string().uuid(),
})

function filtersFromUrl(url: URL) {
  const query = url.searchParams.get('q')?.trim().slice(0, 100) ?? ''
  const status = url.searchParams.get('status') ?? 'all'
  const from = url.searchParams.get('from') ?? ''
  const to = url.searchParams.get('to') ?? ''
  const validDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const date = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  }
  if (status !== 'all' && !statusValues.includes(status as ShipmentStatus)) {
    return { error: 'Filter status tidak valid.' }
  }
  if ((from && !validDate(from)) || (to && !validDate(to))) {
    return { error: 'Format tanggal filter tidak valid.' }
  }
  if (from && to && from > to) {
    return { error: 'Tanggal awal tidak boleh melewati tanggal akhir.' }
  }
  return {
    filters: {
      query,
      status: status as ShipmentFilterStatus,
      from: from || undefined,
      to: to || undefined,
    },
  }
}

function errorResponse(error: unknown) {
  if (error instanceof LogisticsNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 })
  }
  if (error instanceof LogisticsEligibilityError) {
    return Response.json({ error: error.message }, { status: 422 })
  }
  if (error instanceof LogisticsConflictError) {
    return Response.json({ error: error.message }, { status: 409 })
  }
  console.error('Logistics API request failed')
  return Response.json({ error: 'Operasi logistik gagal diproses. Coba lagi.' }, { status: 500 })
}

export async function GET(request: Request) {
  const access = await requireStaffPermission('logistics:manage', request)
  if (!access.ok) return access.response

  try {
    if (!(await isLogisticsSchemaReady())) {
      return Response.json({ error: 'Skema pengiriman belum tersedia pada database.' }, { status: 503 })
    }

    const url = new URL(request.url)
    const view = url.searchParams.get('view') ?? 'summary'
    const parsed = filtersFromUrl(url)
    if ('error' in parsed) {
      return Response.json({ error: parsed.error }, { status: 400 })
    }
    if (view === 'summary') {
      return Response.json({ summary: await getLogisticsSummary() })
    }
    if (view === 'ready') {
      return Response.json({ orders: await getReadyToShipOrders(parsed.filters) })
    }
    if (view === 'shipments' || view === 'history') {
      const shipments = await getLogisticsShipments(parsed.filters, view === 'history')
      return Response.json({ shipments })
    }
    return Response.json({ error: 'Jenis data logistik tidak dikenal.' }, { status: 400 })
  } catch {
    return errorResponse(new Error('Logistics GET failed'))
  }
}

export async function POST(request: Request) {
  const access = await requireStaffPermission('logistics:manage', request)
  if (!access.ok) return access.response

  try {
    if (!(await isLogisticsSchemaReady())) {
      return Response.json({ error: 'Skema pengiriman belum tersedia pada database.' }, { status: 503 })
    }

    const body = await readJsonBody(request)
    if (!body.ok) return body.response
    const parsed = createShipmentSchema.safeParse(body.value)
    if (!parsed.success) {
      return Response.json({ error: 'ID transaksi tidak valid.' }, { status: 400 })
    }

    const shipment = await createShipment(parsed.data.transactionId, access.user.id)
    const notification = await sendShipmentStartedNotification(
      shipment.shipmentId,
      request.url,
    )
    return Response.json({ ...shipment, notification }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
