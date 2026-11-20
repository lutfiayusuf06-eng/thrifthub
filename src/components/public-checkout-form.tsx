'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import {
  makassarDistricts,
  publicOrderResponseSchema,
} from '@/lib/validation'
import { publicOrderPaymentDetails } from '@/lib/payment-details'
import { createCartIdempotencyKey } from '@/lib/shopping-cart'
import { useShoppingCart } from '@/components/cart-provider'
import type { infer as ZodInfer } from 'zod'

function getError(payload: unknown) {
  return typeof payload === 'object' && payload !== null &&
    'error' in payload && typeof payload.error === 'string'
    ? payload.error
    : 'Pesanan gagal dibuat. Silakan coba kembali.'
}

async function readOrderResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(response.ok
      ? 'Konfirmasi pesanan tidak dapat dibaca. Silakan coba kembali.'
      : 'Pesanan belum dapat diproses. Silakan coba kembali.')
  }

  let payload: unknown
  try {
    const body = await response.text()
    if (!body.trim()) throw new Error('empty_response')
    payload = JSON.parse(body)
  } catch {
    throw new Error(response.ok
      ? 'Konfirmasi pesanan tidak dapat dibaca. Silakan coba kembali.'
      : 'Pesanan belum dapat diproses. Silakan coba kembali.')
  }

  if (!response.ok) throw new Error(getError(payload))
  return payload
}

function formatExpiration(value: string | null) {
  if (!value) return 'Tidak tersedia'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Tidak tersedia'
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

type PublicOrder = ZodInfer<typeof publicOrderResponseSchema>['order']

export default function PublicCheckoutForm({
  productCode,
  productCodes,
  disabled = false,
  buttonLabel = 'Pesan Produk',
  persistIdempotency = false,
  onOrderCreated,
  onBusyChange,
  onStockConflict,
}: {
  productCode?: string
  productCodes?: string[]
  disabled?: boolean
  buttonLabel?: string
  persistIdempotency?: boolean
  onOrderCreated?: (order: PublicOrder) => void
  onBusyChange?: (busy: boolean) => void
  onStockConflict?: () => void
}) {
  const resolvedProductCodes = productCodes ?? (productCode ? [productCode] : [])
  const sortedProductCodes = [...resolvedProductCodes].sort()
  const productCodeKey = sortedProductCodes.join('|')
  const { getCheckoutAttempt } = useShoppingCart()
  const [formOpen, setFormOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerWhatsapp, setCustomerWhatsapp] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerNote, setCustomerNote] = useState('')
  const [deliveryDistrict, setDeliveryDistrict] = useState<(typeof makassarDistricts)[number]>('Makassar')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'transfer' | 'cod'>('transfer')
  const [currentTime, setCurrentTime] = useState<number | null>(null)
  const [order, setOrder] = useState<PublicOrder | null>(null)
  const [idempotencyAttempt, setIdempotencyAttempt] = useState<{
    productCodes: string
    key: string
  } | null>(null)

  useEffect(() => {
    if (!order) return
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [order])

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || disabled || order) return
    if (!sortedProductCodes.length) {
      setError('Keranjang belum berisi produk yang dapat dipesan.')
      return
    }
    const singleProductCode = sortedProductCodes[0]
    if (!singleProductCode) {
      setError('Daftar produk checkout tidak valid.')
      return
    }
    setBusy(true)
    onBusyChange?.(true)
    setError('')
    try {
      const requestKey = persistIdempotency
        ? getCheckoutAttempt(sortedProductCodes).idempotencyKey
        : idempotencyAttempt?.productCodes === productCodeKey
          ? idempotencyAttempt.key
          : createCartIdempotencyKey()
      if (!persistIdempotency && idempotencyAttempt?.productCodes !== productCodeKey) {
        setIdempotencyAttempt({ productCodes: productCodeKey, key: requestKey })
      }
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(productCodes ? { productCodes: sortedProductCodes } : { productCode: singleProductCode }),
          idempotencyKey: requestKey,
          customerName,
          customerWhatsapp,
          customerEmail,
          customerNote,
          deliveryDistrict,
          deliveryAddress,
          paymentMethod,
        }),
      })
      if (response.status === 409) onStockConflict?.()
      const payload = await readOrderResponse(response)
      const parsed = publicOrderResponseSchema.safeParse(payload)
      if (!parsed.success) throw new Error('Konfirmasi pesanan tidak dapat dibaca. Silakan coba kembali.')
      setOrder(parsed.data.order)
      setCurrentTime(Date.now())
      onOrderCreated?.(parsed.data.order)
    } catch (caught) {
      setError(caught instanceof TypeError
        ? 'Koneksi sedang bermasalah. Periksa jaringan lalu coba kembali.'
        : caught instanceof Error && !caught.message.includes('Unexpected')
          ? caught.message
          : 'Pesanan gagal diproses. Silakan coba kembali.')
    } finally {
      setBusy(false)
      onBusyChange?.(false)
    }
  }

  if (!order && !sortedProductCodes.length) return null

  if (order) {
    const codReservationIsActive = order.paymentMethod === 'cod' &&
      order.status === 'pending' &&
      (order.reservationExpiresAt === null ||
        (currentTime !== null && new Date(order.reservationExpiresAt).getTime() > currentTime))
    const reservationIsActive = codReservationIsActive ||
      (order.reservationExpiresAt !== null &&
        currentTime !== null && new Date(order.reservationExpiresAt).getTime() > currentTime)
    return (
      <div className="public-order-confirmation" role="status">
        <h2><Check size={17} aria-hidden="true" /> Pembayaran Pesanan ThriftHub</h2>
        <p>{order.paymentMethod === 'cod'
          ? 'Pesanan dibuat; pembayaran belum lunas sampai uang diterima pengantar dan dikonfirmasi Logistik.'
          : 'Pesanan dibuat; pembayaran belum lunas sampai diverifikasi staf Keuangan.'}</p>
        <dl>
          <div><dt>Kode transaksi</dt><dd>{order.id.toUpperCase()}</dd></div>
          <div><dt>Produk</dt><dd>
            <ul className="public-order-items">
              {order.items.map((item) => (
                <li key={item.productCode}>
                  {item.productName} <span>({item.productCode})</span>
                </li>
              ))}
            </ul>
          </dd></div>
          <div><dt>Total pembayaran</dt><dd>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(order.totalAmount)}</dd></div>
          <div><dt>Ongkir</dt><dd>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(order.deliveryFee)}</dd></div>
          <div><dt>Metode</dt><dd>{order.paymentMethod === 'cod' ? 'COD (bayar saat diterima)' : 'Transfer bank'}</dd></div>
          <div><dt>Status pembayaran</dt><dd>{order.status === 'pending'
            ? reservationIsActive
              ? order.paymentMethod === 'cod' ? 'Belum Dibayar' : 'Menunggu pembayaran'
              : 'Reservasi kedaluwarsa'
            : order.status}</dd></div>
          <div><dt>Reservasi sampai</dt><dd>{order.paymentMethod === 'cod' && order.status === 'pending'
            ? 'Pembayaran COD dikonfirmasi'
            : formatExpiration(order.reservationExpiresAt)}</dd></div>
        </dl>
        {order.status === 'pending' && reservationIsActive && order.paymentMethod === 'transfer' ? (
          <div className="public-order-bank-details">
            <h3>Transfer bank</h3>
            <dl>
              <div><dt>Bank</dt><dd>{publicOrderPaymentDetails.bank}</dd></div>
              <div><dt>Nomor rekening</dt><dd>{publicOrderPaymentDetails.accountNumber}</dd></div>
              <div><dt>Atas nama</dt><dd>{publicOrderPaymentDetails.accountName}</dd></div>
            </dl>
            <p>Transfer sesuai total di atas sebelum batas reservasi. Pesanan baru lunas setelah pembayaran diperiksa dan dikonfirmasi oleh staf Keuangan.</p>
          </div>
        ) : null}
        {order.status === 'pending' && reservationIsActive && order.paymentMethod === 'cod' ? (
          <div className="public-order-bank-details">
            <h3>Bayar di tempat (COD)</h3>
            <p>Bayarkan total di atas kepada pengantar saat barang diterima. Pembayaran menjadi lunas setelah pengantar mengonfirmasikannya di Logistik.</p>
          </div>
        ) : null}
        {persistIdempotency && resolvedProductCodes.length ? (
          <button className="text-link cart-checkout-again" type="button" onClick={() => setOrder(null)}>
            Checkout barang lain
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="public-order-action">
      {error ? <p className="form-message" role="alert">{error}</p> : null}
      {!formOpen ? (
        <button
          className="button button--gold detail-order"
          type="button"
          disabled={disabled}
          onClick={() => setFormOpen(true)}
        >
          {disabled ? 'Sedang dipesan' : buttonLabel}
          {!disabled ? <ArrowRight size={16} aria-hidden="true" /> : null}
        </button>
      ) : (
        <form className="public-order-form" onSubmit={(event) => void placeOrder(event)}>
          <h2>Data pembeli</h2>
          <label>
            Nama lengkap
            <input autoComplete="name" minLength={2} maxLength={120} pattern=".*\S.*" required value={customerName} onChange={(event) => setCustomerName(event.currentTarget.value)} />
          </label>
          <label>
            Nomor WhatsApp
            <input
              autoComplete="tel"
              type="tel"
              inputMode="tel"
              maxLength={32}
              pattern="(?=.*[0-9])[+0-9\s().-]{8,32}"
              title="Masukkan nomor WhatsApp yang dapat dihubungi."
              required
              value={customerWhatsapp}
              onChange={(event) => setCustomerWhatsapp(event.currentTarget.value)}
            />
          </label>
          <label>
            Email <span>(opsional)</span>
            <input autoComplete="email" type="email" maxLength={254} value={customerEmail} onChange={(event) => setCustomerEmail(event.currentTarget.value)} />
          </label>
          <label>
            Catatan pesanan <span>(opsional)</span>
            <textarea maxLength={500} rows={3} value={customerNote} onChange={(event) => setCustomerNote(event.currentTarget.value)} />
          </label>
          <label>
            Kecamatan di Kota Makassar
            <select required value={deliveryDistrict} onChange={(event) => setDeliveryDistrict(event.currentTarget.value as (typeof makassarDistricts)[number])}>
              {makassarDistricts.map((district) => <option key={district} value={district}>{district}</option>)}
            </select>
          </label>
          <label>
            Alamat lengkap pengantaran
            <textarea autoComplete="street-address" minLength={10} maxLength={500} rows={3} required value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.currentTarget.value)} />
          </label>
          <fieldset className="public-order-payment-options">
            <legend>Metode pembayaran</legend>
            <label>
              <input type="radio" name="public-order-payment" value="transfer" checked={paymentMethod === 'transfer'} onChange={() => setPaymentMethod('transfer')} />
              Transfer bank BRI
            </label>
            <label>
              <input type="radio" name="public-order-payment" value="cod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
              COD — bayar saat diterima
            </label>
          </fieldset>
          <p className="public-order-fee-note">Pengantaran hanya untuk Kota Makassar. Ongkir dihitung satu kali per pesanan. {paymentMethod === 'cod' ? 'Reservasi barang berlaku sampai pembayaran COD dikonfirmasi.' : 'Reservasi barang berlaku 15 menit.'}</p>
          <div className="public-order-form-actions">
            <button className="button button--gold" type="submit" disabled={busy || disabled}>
              {busy ? 'Memproses pesanan...' : disabled ? 'Periksa ketersediaan' : 'Buat Pesanan'} <ArrowRight size={16} aria-hidden="true" />
            </button>
            <button className="refresh-button" type="button" disabled={busy} onClick={() => setFormOpen(false)}>Batal</button>
          </div>
        </form>
      )}
    </div>
  )
}
