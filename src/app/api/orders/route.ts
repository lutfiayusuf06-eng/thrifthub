import { createPublicOrder, OrderConflictError, OrderSchemaUnavailableError } from '@/lib/order-reservations'
import { readJsonBody } from '@/lib/request-body'
import { publicOrderInputSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request)
    if (!body.ok) return body.response
    const parsed = publicOrderInputSchema.safeParse(body.value)
    if (!parsed.success) {
      return Response.json({ error: 'Permintaan pemesanan tidak valid.' }, { status: 400 })
    }

    const order = await createPublicOrder(
      parsed.data.productCodes,
      parsed.data.idempotencyKey,
      {
        name: parsed.data.customerName,
        whatsapp: parsed.data.customerWhatsapp,
        email: parsed.data.customerEmail,
        note: parsed.data.customerNote,
        deliveryDistrict: parsed.data.deliveryDistrict,
        deliveryAddress: parsed.data.deliveryAddress,
        paymentMethod: parsed.data.paymentMethod,
      },
    )
    return Response.json({ order }, { status: 201 })
  } catch (error) {
    if (error instanceof OrderConflictError) {
      return Response.json({ error: error.message }, { status: 409 })
    }
    if (error instanceof OrderSchemaUnavailableError) {
      return Response.json(
        { error: 'Checkout belum aktif pada database. Admin perlu menerapkan migrasi data pembeli dan pengantaran terlebih dahulu.' },
        { status: 503 },
      )
    }
    console.error('Public order creation failed', error)
    return Response.json(
      { error: 'Pesanan gagal diproses. Periksa koneksi lalu coba kembali.' },
      { status: 500 },
    )
  }
}
