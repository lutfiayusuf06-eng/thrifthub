import { z } from 'zod'
import { isLogisticsSchemaReady } from '@/lib/logistics-repository'
import { isPublicOrderCustomerSchemaReady } from '@/lib/order-reservations'
import { getPublicOrderTracking } from '@/lib/public-order-tracking'
import { readJsonBody } from '@/lib/request-body'

export const dynamic = 'force-dynamic'

const trackingInputSchema = z.object({
  orderCode: z.string().trim().uuid(),
  whatsapp: z.string()
    .trim()
    .min(8)
    .max(32)
    .transform((value) => value.replace(/[\s().-]/g, ''))
    .pipe(z.string().regex(/^(?:\+?[1-9]\d{7,14}|0\d{7,14})$/)),
})

const privateHeaders = { 'Cache-Control': 'private, no-store' }

export async function POST(request: Request) {
  const body = await readJsonBody(request)
  if (!body.ok) return body.response
  const parsed = trackingInputSchema.safeParse(body.value)
  if (!parsed.success) {
    return Response.json(
      { error: 'Masukkan kode pesanan dan nomor WhatsApp yang valid.' },
      { status: 400, headers: privateHeaders },
    )
  }

  try {
    if (!(await isPublicOrderCustomerSchemaReady()) || !(await isLogisticsSchemaReady())) {
      return Response.json(
        { error: 'Pelacakan pesanan belum tersedia pada database.' },
        { status: 503, headers: privateHeaders },
      )
    }

    const order = await getPublicOrderTracking(parsed.data.orderCode, parsed.data.whatsapp)
    if (!order) {
      return Response.json(
        { error: 'Pesanan tidak ditemukan. Periksa kembali kode pesanan dan nomor WhatsApp.' },
        { status: 404, headers: privateHeaders },
      )
    }
    return Response.json({ order }, { headers: privateHeaders })
  } catch {
    console.error('Public order tracking request failed')
    return Response.json(
      { error: 'Pelacakan pesanan gagal dimuat. Silakan coba kembali.' },
      { status: 500, headers: privateHeaders },
    )
  }
}
