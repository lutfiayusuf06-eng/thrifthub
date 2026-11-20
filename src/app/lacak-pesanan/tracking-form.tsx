'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { z } from 'zod'

const trackingResultSchema = z.object({
  order: z.object({
    orderCode: z.string(),
    items: z.array(z.object({
      productCode: z.string(),
      productName: z.string(),
      unitPrice: z.number(),
    })),
    totalAmount: z.number(),
    deliveryFee: z.number(),
    recipientName: z.string(),
    deliveryDistrict: z.string(),
    deliveryAddress: z.string(),
    paymentMethod: z.enum(['transfer', 'cod']).nullable(),
    paymentStatus: z.string(),
    status: z.string(),
    courier: z.string().nullable(),
    estimatedDelivery: z.string(),
    updatedAt: z.string().nullable(),
  }),
})

type TrackingOrder = z.infer<typeof trackingResultSchema>['order']
type Lookup = { orderCode: string; whatsapp: string }

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return 'Belum tersedia'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Belum tersedia'
    : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function getError(payload: unknown) {
  return typeof payload === 'object' && payload !== null &&
    'error' in payload && typeof payload.error === 'string'
    ? payload.error
    : 'Pelacakan pesanan gagal dimuat. Silakan coba kembali.'
}

async function lookupOrder(lookup: Lookup, signal?: AbortSignal): Promise<TrackingOrder> {
  const response = await fetch('/api/orders/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    signal,
    body: JSON.stringify(lookup),
  })
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('Server mengirim respons yang tidak valid. Coba lagi.')
  }
  if (!response.ok) throw new Error(getError(payload))
  const parsed = trackingResultSchema.safeParse(payload)
  if (!parsed.success) throw new Error('Server mengirim data pelacakan dengan format yang tidak dikenal.')
  return parsed.data.order
}

export default function TrackingForm() {
  const [orderCode, setOrderCode] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [lookup, setLookup] = useState<Lookup | null>(null)
  const [order, setOrder] = useState<TrackingOrder | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [refreshError, setRefreshError] = useState('')

  useEffect(() => {
    if (!lookup) return
    const controller = new AbortController()
    const interval = window.setInterval(() => {
      void lookupOrder(lookup, controller.signal)
        .then((latest) => {
          setOrder(latest)
          setRefreshError('')
        })
        .catch((caught: unknown) => {
          if (!controller.signal.aborted) {
            setRefreshError(caught instanceof Error ? caught.message : 'Status terbaru gagal diperbarui.')
          }
        })
    }, 30_000)
    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [lookup])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextLookup = { orderCode: orderCode.trim(), whatsapp: whatsapp.trim() }
    setBusy(true)
    setError('')
    setRefreshError('')
    setOrder(null)
    setLookup(nextLookup)
    try {
      setOrder(await lookupOrder(nextLookup))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Pelacakan pesanan gagal dimuat.')
      setLookup(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="order-tracking-panel">
      <form className="order-tracking-form" onSubmit={(event) => void submit(event)}>
        <label>
          Kode pesanan
          <input
            autoComplete="off"
            maxLength={36}
            placeholder="Contoh: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
            required
            value={orderCode}
            onChange={(event) => setOrderCode(event.currentTarget.value)}
          />
        </label>
        <label>
          Nomor WhatsApp
          <input
            autoComplete="tel"
            inputMode="tel"
            maxLength={32}
            placeholder="Nomor yang digunakan saat checkout"
            required
            type="tel"
            value={whatsapp}
            onChange={(event) => setWhatsapp(event.currentTarget.value)}
          />
        </label>
        <button className="button button--gold" type="submit" disabled={busy}>
          {busy ? 'Mencari pesanan...' : 'Lacak Pesanan'}
        </button>
      </form>

      {error ? <p className="order-tracking-error" role="alert">{error}</p> : null}
      {refreshError ? <p className="order-tracking-error" role="alert">{refreshError}</p> : null}
      {order ? (
        <section className="order-tracking-result" aria-live="polite" aria-labelledby="tracking-result-title">
          <div className="order-tracking-result-heading">
            <div>
              <p className="eyebrow">PESANAN #{order.orderCode.toUpperCase()}</p>
              <h2 id="tracking-result-title">{order.status}</h2>
            </div>
            <span className="order-tracking-payment">{order.paymentStatus}</span>
          </div>
          <dl>
            <div className="order-tracking-wide">
              <dt>Barang</dt>
              <dd>
                {order.items.length ? (
                  <ul>{order.items.map((item) => (
                    <li key={item.productCode}>
                      {item.productName} <span>({item.productCode}) · {formatRupiah(item.unitPrice)}</span>
                    </li>
                  ))}</ul>
                ) : 'Tidak ada rincian barang.'}
              </dd>
            </div>
            <div><dt>Total pembayaran</dt><dd>{formatRupiah(order.totalAmount)}</dd></div>
            <div><dt>Ongkir</dt><dd>{formatRupiah(order.deliveryFee)}</dd></div>
            <div><dt>Penerima</dt><dd>{order.recipientName}</dd></div>
            <div><dt>Area pengiriman</dt><dd>{order.deliveryDistrict}, Makassar</dd></div>
            <div className="order-tracking-wide"><dt>Alamat penerima</dt><dd>{order.deliveryAddress}</dd></div>
            <div><dt>Kurir</dt><dd>{order.courier || 'Belum ditugaskan'}</dd></div>
            <div><dt>Estimasi</dt><dd>{order.estimatedDelivery}</dd></div>
            <div><dt>Pembaruan terakhir</dt><dd>{formatDate(order.updatedAt)}</dd></div>
          </dl>
          <p className="order-tracking-auto-refresh">Status diperbarui otomatis setiap 30 detik selama halaman ini terbuka.</p>
        </section>
      ) : null}
    </div>
  )
}
