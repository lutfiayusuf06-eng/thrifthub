'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowRight, Clock3, PackageCheck, RefreshCw, Search, Truck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { adminTabFetch, currentAdminTabUrl } from '@/lib/admin-tab-client'
import { z } from 'zod'
import { formatRupiah } from '@/lib/products'
import type {
  LogisticsOrder,
  LogisticsShipment,
  ShipmentStatus,
} from '@/lib/logistics-repository'

type LogisticsSection = 'overview' | 'ready-orders' | 'shipments' | 'history'
const statusLabels: Record<ShipmentStatus, string> = {
  ready_to_ship: 'Siap dikirim',
  in_transit: 'Dalam perjalanan',
  delivered: 'Pesanan selesai',
  problem: 'Bermasalah',
}

const orderSchema = z.object({
  transaction_id: z.string(),
  shipment_id: z.string().nullable().optional(),
  transaction_status: z.enum(['pending', 'paid', 'cancelled', 'expired']),
  total_amount: z.number(),
  created_at: z.string(),
  paid_at: z.string().nullable(),
  paid_by_name: z.string().nullable(),
  customer_name: z.string().nullable(),
  customer_whatsapp: z.string().nullable(),
  delivery_district: z.string().nullable(),
  delivery_address: z.string().nullable(),
  customer_note: z.string().nullable(),
  payment_method: z.enum(['transfer', 'cod']).nullable(),
  item_count: z.number(),
  items: z.array(z.object({ product_code: z.string(), product_name: z.string() })),
  eligible: z.boolean(),
  ineligible_reasons: z.array(z.string()),
})

const shipmentSchema = orderSchema.extend({
  shipment_id: z.string(),
  status: z.enum(['ready_to_ship', 'in_transit', 'delivered', 'problem']),
  courier: z.string().nullable(),
  tracking_number: z.string().nullable(),
  shipped_at: z.string().nullable(),
  delivered_at: z.string().nullable(),
  problem_note: z.string().nullable(),
  updated_at: z.string(),
  notification_status: z.enum(['sending', 'sent', 'failed', 'unknown']).nullable(),
  notification_error: z.string().nullable(),
  notification_sent_at: z.string().nullable(),
  history: z.array(z.object({
    id: z.string(),
    previous_status: z.enum(['ready_to_ship', 'in_transit', 'delivered', 'problem']).nullable(),
    new_status: z.enum(['ready_to_ship', 'in_transit', 'delivered', 'problem']),
    changed_by_name: z.string().nullable(),
    note: z.string().nullable(),
    changed_at: z.string(),
  })),
})

const notificationResultSchema = z.object({
  status: z.enum(['sending', 'sent', 'failed', 'unknown']),
  sentAt: z.string().nullable(),
  error: z.string().nullable(),
  alreadySent: z.boolean().optional(),
})

const payloadSchemas = {
  summary: z.object({
    summary: z.object({
      counts: z.object({
        ready_to_ship: z.number(),
        in_transit: z.number(),
        delivered: z.number(),
        problem: z.number(),
      }),
      recent: z.array(z.object({
        transaction_id: z.string(),
        status: z.enum(['ready_to_ship', 'in_transit', 'delivered', 'problem']),
        courier: z.string().nullable(),
        tracking_number: z.string().nullable(),
        updated_at: z.string(),
        item_count: z.number(),
        items: z.array(z.object({ product_code: z.string(), product_name: z.string() })),
      })),
    }),
  }),
  ready: z.object({ orders: z.array(orderSchema) }),
  shipments: z.object({ shipments: z.array(shipmentSchema) }),
  history: z.object({ shipments: z.array(shipmentSchema) }),
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function shortTransactionId(id: string) {
  return id.replaceAll('-', '').slice(0, 8).toUpperCase()
}

function failureMessage(payload: unknown, fallback: string) {
  return typeof payload === 'object' && payload !== null && 'error' in payload &&
    typeof payload.error === 'string' ? payload.error : fallback
}

async function responsePayload(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new Error('Server mengirim respons yang tidak valid. Coba lagi.')
  }
}

async function requestLogisticsData(
  section: LogisticsSection,
  filters: { query: string; status: string; from: string; to: string },
  signal?: AbortSignal,
) {
  const view = section === 'overview' ? 'summary' : section === 'ready-orders' ? 'ready' : section
  const params = new URLSearchParams({ view })
  if (section !== 'overview') {
    if (filters.query) params.set('q', filters.query)
    if (filters.status !== 'all') params.set('status', filters.status)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
  }
  const response = await adminTabFetch(`/api/admin/logistics?${params}`, {
    cache: 'no-store',
    signal,
  })
  const payload = await responsePayload(response)
  if (!response.ok) throw new Error(failureMessage(payload, 'Data logistik tidak dapat dimuat.'))
  const parsed = payloadSchemas[view].safeParse(payload)
  if (!parsed.success) throw new Error('Server mengirim data logistik dengan format yang tidak dikenal.')
  return parsed.data
}

function OrderDetails({ order }: { order: LogisticsOrder }) {
  return (
    <div className="logistics-order-details">
      <div><span>Penerima</span><strong>{order.customer_name || 'Belum tersedia'}</strong></div>
      <div><span>WhatsApp</span><strong>{order.customer_whatsapp || 'Belum tersedia'}</strong></div>
      <div><span>Area</span><strong>{order.delivery_district || 'Belum tersedia'}</strong></div>
      <div className="logistics-address"><span>Alamat</span><strong>{order.delivery_address || 'Belum tersedia'}</strong></div>
      <div className="logistics-items">
        <span>Barang · {order.item_count}</span>
        {order.items.length ? (
          <ul>{order.items.map((item) => <li key={`${item.product_code}-${item.product_name}`}>{item.product_code} · {item.product_name}</li>)}</ul>
        ) : <strong>Belum ada item transaksi.</strong>}
      </div>
      {order.customer_note ? <div className="logistics-address"><span>Catatan pembeli</span><strong>{order.customer_note}</strong></div> : null}
      <div><span>Metode pembayaran</span><strong>{order.payment_method === 'cod' ? 'COD' : order.payment_method === 'transfer' ? 'Transfer' : 'Tidak tercatat'}</strong></div>
      <div><span>{order.payment_method === 'cod' && order.transaction_status === 'pending' ? 'Total COD yang harus diterima' : 'Total pembayaran'}</span><strong>{formatRupiah(order.total_amount)}</strong></div>
      <div><span>Status pembayaran</span><strong>{order.transaction_status === 'paid' ? 'Lunas' : order.payment_method === 'cod' ? 'Belum Dibayar' : order.transaction_status}</strong></div>
      {order.transaction_status === 'paid' && order.paid_at ? (
        <div><span>Pembayaran dikonfirmasi</span><strong>{formatDate(order.paid_at)}{order.paid_by_name ? ` · ${order.paid_by_name}` : ''}</strong></div>
      ) : null}
    </div>
  )
}

function ShipmentCard({
  shipment,
  onUpdated,
}: {
  shipment: LogisticsShipment
  onUpdated: () => void
}) {
  const [status, setStatus] = useState<ShipmentStatus>(shipment.status)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [notificationBusy, setNotificationBusy] = useState(false)
  const choices: ShipmentStatus[] = shipment.status === 'ready_to_ship'
    ? ['in_transit', 'problem']
    : shipment.status === 'in_transit'
      ? ['delivered', 'problem']
      : shipment.status === 'problem'
        ? ['ready_to_ship', 'in_transit']
        : []
  const canEdit = shipment.status !== 'delivered'
  const canConfirmCodPayment = shipment.payment_method === 'cod' &&
    shipment.transaction_status === 'pending' &&
    shipment.status === 'delivered'
  const hasChanges = status !== shipment.status

  async function confirmCodPayment() {
    if (!window.confirm(
      `Konfirmasi uang COD sebesar ${formatRupiah(shipment.total_amount)} telah diterima dari ${shipment.customer_name ?? 'pembeli'} untuk pesanan #${shortTransactionId(shipment.transaction_id)}?`,
    )) {
      return
    }

    setBusy(true)
    setMessage('')
    setError('')
    try {
      const response = await adminTabFetch(
        `/api/admin/logistics/shipments/${encodeURIComponent(shipment.shipment_id)}/cod-payment`,
        { method: 'POST' },
      )
      const payload = await responsePayload(response)
      if (!response.ok) throw new Error(failureMessage(payload, 'Pembayaran COD gagal dikonfirmasi.'))
      setMessage('Pembayaran COD berhasil dikonfirmasi lunas.')
      onUpdated()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Pembayaran COD gagal dikonfirmasi.')
    } finally {
      setBusy(false)
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const response = await adminTabFetch(`/api/admin/logistics/shipments/${encodeURIComponent(shipment.shipment_id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note }),
      })
      const payload = await responsePayload(response)
      if (!response.ok) throw new Error(failureMessage(payload, 'Data pengiriman gagal disimpan.'))
      const notification = typeof payload === 'object' && payload !== null && 'notification' in payload
        ? notificationResultSchema.safeParse(payload.notification)
        : null
      if (notification?.success && notification.data.status === 'failed') {
        setError(`Status pengiriman diperbarui, tetapi WhatsApp gagal dikirim: ${notification.data.error}`)
      } else if (notification?.success && notification.data.status === 'unknown') {
        setError(`Status pengiriman diperbarui, tetapi hasil WhatsApp belum terkonfirmasi: ${notification.data.error}`)
      } else {
        setMessage(notification?.success && notification.data.status === 'sent'
          ? 'Status diperbarui dan Fonnte mengonfirmasi notifikasi WhatsApp.'
          : 'Perubahan pengiriman berhasil disimpan.')
      }
      setNote('')
      onUpdated()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Data pengiriman gagal disimpan.')
    } finally {
      setBusy(false)
    }
  }

  async function retryNotification() {
    setNotificationBusy(true)
    setMessage('')
    setError('')
    try {
      const response = await adminTabFetch(
        `/api/admin/logistics/shipments/${encodeURIComponent(shipment.shipment_id)}`,
        { method: 'POST' },
      )
      const payload = await responsePayload(response)
      if (!response.ok) throw new Error(failureMessage(payload, 'Notifikasi gagal dikirim ulang.'))
      const parsed = typeof payload === 'object' && payload !== null && 'notification' in payload
        ? notificationResultSchema.safeParse(payload.notification)
        : null
      if (!parsed?.success) throw new Error('Status notifikasi yang diterima tidak valid.')
      if (parsed.data.status !== 'sent') {
        throw new Error(parsed.data.error ?? 'Fonnte belum mengonfirmasi pengiriman.')
      }
      setMessage('Fonnte mengonfirmasi notifikasi WhatsApp terkirim.')
      onUpdated()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Notifikasi gagal dikirim ulang.')
      onUpdated()
    } finally {
      setNotificationBusy(false)
    }
  }

  return (
    <article className="logistics-card">
      <div className="logistics-card-heading">
        <div>
          <p className="eyebrow"><span className="eyebrow-line" /> TRANSAKSI #{shortTransactionId(shipment.transaction_id)}</p>
          <h3>{shipment.customer_name || 'Penerima belum tersedia'}</h3>
          <p>ID {shipment.transaction_id} · {shipment.delivery_district || 'Area belum tersedia'} · diperbarui {formatDate(shipment.updated_at)}</p>
        </div>
        <span className={`logistics-status logistics-status--${shipment.status}`}>{statusLabels[shipment.status]}</span>
      </div>
      <OrderDetails order={shipment} />
      <div className="logistics-tracking-summary">
        <span><Truck size={15} /> Kurir internal ThriftHub</span>
        {shipment.tracking_number ? <span>Referensi: {shipment.tracking_number}</span> : null}
        {shipment.shipped_at ? <span>Diserahkan: {formatDate(shipment.shipped_at)}</span> : null}
        {shipment.delivered_at ? <span>Diterima: {formatDate(shipment.delivered_at)}</span> : null}
      </div>
      {shipment.notification_status ? (
        <div className="logistics-form-actions">
          <span className={shipment.notification_status === 'failed' || shipment.notification_status === 'unknown' ? 'logistics-error' : 'logistics-success'} role="status">
            WhatsApp: {shipment.notification_status === 'sent'
              ? `terkonfirmasi ${formatDate(shipment.notification_sent_at)}`
              : shipment.notification_status === 'sending' ? 'sedang diproses'
                : shipment.notification_status === 'unknown' ? 'belum terkonfirmasi; kirim ulang tidak diaktifkan untuk mencegah pesan ganda'
                  : 'gagal dikirim'}
          </span>
          {shipment.notification_status === 'failed' ? (
            <button type="button" className="button" onClick={() => void retryNotification()} disabled={notificationBusy}>
              {notificationBusy ? 'Mengirim ulang...' : 'Kirim ulang notifikasi'}
            </button>
          ) : null}
        </div>
      ) : null}
      {shipment.problem_note ? <p className="logistics-problem-note"><AlertTriangle size={15} /> Kendala: {shipment.problem_note}</p> : null}

      <details className="logistics-timeline">
        <summary><Clock3 size={15} /> Kronologi status ({shipment.history.length})</summary>
        {shipment.history.length ? (
          <ol>{[...shipment.history].reverse().map((entry) => (
            <li key={entry.id}>
              <strong>{entry.previous_status ? `${statusLabels[entry.previous_status]} → ` : ''}{statusLabels[entry.new_status]}</strong>
              <span>{formatDate(entry.changed_at)} · {entry.changed_by_name || 'Sistem'}</span>
              {entry.note ? <p>{entry.note}</p> : null}
            </li>
          ))}</ol>
        ) : <p>Belum ada catatan kronologi.</p>}
      </details>

      {canEdit ? (
        <form className="logistics-update-form" onSubmit={save}>
          <label>Status berikutnya
            <select value={status} onChange={(event) => setStatus(event.currentTarget.value as ShipmentStatus)}>
              <option value={shipment.status}>{statusLabels[shipment.status]} (saat ini)</option>
              {choices.map((choice) => <option value={choice} key={choice}>{statusLabels[choice]}</option>)}
            </select>
          </label>
          <label className="logistics-note-field">{status === 'problem' ? 'Catatan kendala (wajib)' : 'Catatan perubahan (opsional)'}
            <textarea maxLength={1000} required={status === 'problem'} value={note} onChange={(event) => setNote(event.currentTarget.value)} rows={2} />
          </label>
          <div className="logistics-form-actions">
            <button className="button" type="submit" disabled={busy || !hasChanges}>
              {busy ? 'Menyimpan...' : 'Simpan perubahan'}
            </button>
            {message ? <span className="logistics-success" role="status">{message}</span> : null}
            {error ? <span className="logistics-error" role="alert">{error}</span> : null}
          </div>
        </form>
      ) : <p className="logistics-final-note">Pengiriman telah selesai dan tidak dapat diubah.</p>}
      {canConfirmCodPayment ? (
        <div className="logistics-form-actions">
          <button className="button" type="button" onClick={() => void confirmCodPayment()} disabled={busy}>
            {busy ? 'Mengonfirmasi...' : 'Konfirmasi Pembayaran Diterima'}
          </button>
          {message ? <span className="logistics-success" role="status">{message}</span> : null}
          {error ? <span className="logistics-error" role="alert">{error}</span> : null}
        </div>
      ) : null}
    </article>
  )
}

export default function LogisticsWorkspace({ section }: { section: LogisticsSection }) {
  const router = useRouter()
  const [requestResult, setRequestResult] = useState<{
    key: string
    data: unknown
    error: string
  } | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [activeFilters, setActiveFilters] = useState({ query: '', status: 'all', from: '', to: '' })
  const [creatingId, setCreatingId] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const requestKey = `${section}:${JSON.stringify(activeFilters)}:${retryKey}`
  const loading = requestResult?.key !== requestKey
  const data = requestResult?.key === requestKey ? requestResult.data : null
  const error = requestResult?.key === requestKey ? requestResult.error : ''

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    let timedOut = false
    const timeout = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 20_000)

    void requestLogisticsData(section, activeFilters, controller.signal)
      .then((result) => {
        if (!cancelled) setRequestResult({ key: requestKey, data: result, error: '' })
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setRequestResult({
          key: requestKey,
          data: null,
          error: timedOut
            ? 'Permintaan data logistik terlalu lama. Periksa koneksi lalu coba lagi.'
            : caught instanceof Error ? caught.message : 'Data logistik tidak dapat dimuat.',
        })
      })
      .finally(() => {
        window.clearTimeout(timeout)
        if (!cancelled) {
          setRefreshing(false)
        }
      })
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [section, activeFilters, retryKey, requestKey])

  function refresh() {
    setActionError('')
    setRefreshing(true)
    setRetryKey((current) => current + 1)
  }

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setActionError('')
    setActiveFilters({ query: query.trim(), status, from, to })
  }

  async function createShipment(order: LogisticsOrder) {
    if (!window.confirm(`Mulai pengiriman untuk pesanan ${order.customer_name ?? ''} dengan transaksi #${shortTransactionId(order.transaction_id)}?`)) {
      return
    }

    setCreatingId(order.transaction_id)
    setActionError('')
    setNotice('')
    try {
      const response = order.shipment_id
        ? await adminTabFetch(`/api/admin/logistics/shipments/${encodeURIComponent(order.shipment_id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'in_transit', note: '' }),
          })
        : await adminTabFetch('/api/admin/logistics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactionId: order.transaction_id }),
          })
      const payload = await responsePayload(response)
      if (!response.ok) throw new Error(failureMessage(payload, 'Pengiriman tidak dapat dibuat.'))
      const notification = typeof payload === 'object' && payload !== null && 'notification' in payload
        ? notificationResultSchema.safeParse(payload.notification)
        : null
      setNotice(notification?.success && notification.data.status === 'sent'
        ? `Pengiriman transaksi #${shortTransactionId(order.transaction_id)} dimulai; Fonnte mengonfirmasi WhatsApp terkirim.`
        : notification?.success && notification.data.status === 'failed'
          ? `Pengiriman dimulai, tetapi WhatsApp gagal dikirim: ${notification.data.error}`
          : notification?.success && notification.data.status === 'unknown'
            ? `Pengiriman dimulai, tetapi status WhatsApp belum terkonfirmasi: ${notification.data.error}`
          : `Pengiriman transaksi #${shortTransactionId(order.transaction_id)} dimulai.`)
      setRetryKey((current) => current + 1)
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Pengiriman tidak dapat dibuat.')
    } finally {
      setCreatingId('')
    }
  }

  const title = section === 'overview'
    ? 'Ringkasan logistik'
    : section === 'ready-orders'
      ? 'Pesanan siap dikirim'
      : section === 'shipments'
        ? 'Pengiriman & pelacakan'
        : 'Riwayat pengiriman'

  return (
    <section className="logistics-workspace" aria-labelledby="logistics-workspace-title">
      <div className="logistics-heading">
        <div>
          <p className="eyebrow"><span className="eyebrow-line" /> LOGISTIK & DISTRIBUSI</p>
          <h2 id="logistics-workspace-title">{title}</h2>
          <p>Data pengiriman mengikuti status transaksi dan catatan operasional yang tersimpan.</p>
        </div>
        <button type="button" className="logistics-refresh" onClick={refresh} disabled={loading || refreshing}>
          <RefreshCw size={15} className={refreshing ? 'is-spinning' : ''} /> Perbarui
        </button>
      </div>
      {error || actionError ? (
        <div className="logistics-alert logistics-alert--error" role="alert">
          <span>{error || actionError}</span>
          <button type="button" className="logistics-refresh" onClick={refresh}>Coba lagi</button>
        </div>
      ) : null}
      {notice ? <div className="logistics-alert logistics-alert--success" role="status">{notice}</div> : null}
      {loading ? <div className="logistics-empty">Memuat data logistik...</div> : null}

      {!loading && section === 'overview' ? (() => {
        const parsed = payloadSchemas.summary.safeParse(data)
        if (!parsed.success) return <div className="logistics-empty">Ringkasan belum dapat ditampilkan.</div>
        const summary = parsed.data.summary
        const cards: Array<{ status: ShipmentStatus; value: number; label: string }> = [
          { status: 'ready_to_ship', value: summary.counts.ready_to_ship, label: 'Pesanan siap dikirim' },
          { status: 'in_transit', value: summary.counts.in_transit, label: 'Sedang dikirim' },
          { status: 'delivered', value: summary.counts.delivered, label: 'Berhasil diterima' },
          { status: 'problem', value: summary.counts.problem, label: 'Pengiriman bermasalah' },
        ]
        return (
          <>
            <div className="logistics-stat-grid">
              {cards.map((card) => (
                <article className={`logistics-stat logistics-stat--${card.status}`} key={card.status}>
                  <span>{card.label}</span><strong>{card.value}</strong><small>{statusLabels[card.status]}</small>
                </article>
              ))}
            </div>
            <div className="logistics-overview-actions">
              <div><PackageCheck size={19} /><span>Mulai dari transaksi lunas atau pesanan COD dengan data penerima dan alamat lengkap.</span></div>
              <button type="button" className="button" onClick={() => {
                router.push(currentAdminTabUrl('/admin?section=ready-orders'))
              }}>
                Lihat pesanan siap dikirim <ArrowRight size={15} />
              </button>
            </div>
            <section className="logistics-recent">
              <h3>Aktivitas pengiriman terbaru</h3>
              {summary.recent.length ? (
                <div className="logistics-recent-list">{summary.recent.map((item) => (
                  <article key={`${item.transaction_id}-${item.updated_at}`}>
                    <div><strong>#{shortTransactionId(item.transaction_id)}</strong><span>{item.item_count} barang · {item.items.map((product) => product.product_name).join(', ') || 'tanpa nama barang'}</span></div>
                    <span className={`logistics-status logistics-status--${item.status}`}>{statusLabels[item.status]}</span>
                    <small>Kurir internal ThriftHub · {formatDate(item.updated_at)}</small>
                  </article>
                ))}</div>
              ) : <div className="logistics-empty">Belum ada aktivitas pengiriman tersimpan.</div>}
            </section>
          </>
        )
      })() : null}

      {!loading && section === 'ready-orders' ? (() => {
        const parsed = payloadSchemas.ready.safeParse(data)
        if (!parsed.success) return <div className="logistics-empty">Daftar pesanan belum dapat ditampilkan.</div>
        const orders = parsed.data.orders
        const eligible = orders.filter((order) => order.eligible)
        const incomplete = orders.filter((order) => !order.eligible)
        return (
          <>
            <FilterForm {...{ query, setQuery, status, setStatus, from, setFrom, to, setTo, applyFilters }} showStatus={false} />
            {eligible.length ? eligible.map((order) => (
              <article className="logistics-card" key={order.transaction_id}>
                <div className="logistics-card-heading">
                  <div><p className="eyebrow"><span className="eyebrow-line" /> TRANSAKSI #{shortTransactionId(order.transaction_id)}</p><h3>{order.customer_name}</h3><p>ID {order.transaction_id} · Dibeli {formatDate(order.created_at)}</p></div>
                  <span className="logistics-status logistics-status--ready_to_ship">
                    Pembayaran {order.payment_method === 'cod'
                      ? 'COD · Belum Dibayar'
                      : 'Transfer · Lunas'}
                  </span>
                </div>
                <OrderDetails order={order} />
                <button className="button logistics-create-button" type="button" onClick={() => void createShipment(order)} disabled={creatingId === order.transaction_id}>
                  {creatingId === order.transaction_id ? 'Memulai pengiriman...' : 'Kirim Pesanan'}
                </button>
              </article>
            )) : <div className="logistics-empty">Belum ada pesanan yang memenuhi syarat untuk dikirim.</div>}
            {incomplete.length ? (
              <section className="logistics-incomplete">
                <h3>Perlu dilengkapi sebelum pengiriman</h3>
                <p>Pesanan di bawah ini belum memenuhi persyaratan alamat atau item. Data transaksi tidak diubah otomatis.</p>
                {incomplete.map((order) => (
                  <article key={order.transaction_id}>
                    <strong>#{shortTransactionId(order.transaction_id)} · {formatDate(order.created_at)}</strong>
                    <ul>{order.ineligible_reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                  </article>
                ))}
              </section>
            ) : null}
          </>
        )
      })() : null}

      {!loading && (section === 'shipments' || section === 'history') ? (() => {
        const parsed = payloadSchemas[section].safeParse(data)
        if (!parsed.success) return <div className="logistics-empty">Data pengiriman belum dapat ditampilkan.</div>
        const shipments = parsed.data.shipments
        return (
          <>
            <FilterForm {...{ query, setQuery, status, setStatus, from, setFrom, to, setTo, applyFilters }} showStatus />
            {shipments.length ? shipments.map((shipment) => (
              <ShipmentCard key={shipment.shipment_id} shipment={shipment} onUpdated={refresh} />
            )) : <div className="logistics-empty">Belum ada data pengiriman yang sesuai dengan filter.</div>}
          </>
        )
      })() : null}
    </section>
  )
}

function FilterForm({
  query,
  setQuery,
  status,
  setStatus,
  from,
  setFrom,
  to,
  setTo,
  applyFilters,
  showStatus,
}: {
  query: string
  setQuery: (value: string) => void
  status: string
  setStatus: (value: string) => void
  from: string
  setFrom: (value: string) => void
  to: string
  setTo: (value: string) => void
  applyFilters: (event: React.FormEvent<HTMLFormElement>) => void
  showStatus: boolean
}) {
  return (
    <form className="logistics-filters" onSubmit={applyFilters}>
      <label className="logistics-search"><span className="sr-only">Cari transaksi, penerima, produk, atau resi</span><Search size={15} /><input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Cari transaksi, penerima, produk, resi..." /></label>
      {showStatus ? <label><span className="sr-only">Filter status</span><select value={status} onChange={(event) => setStatus(event.currentTarget.value)}><option value="all">Semua status</option>{Object.entries(statusLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label> : null}
      <label><span className="sr-only">Dari tanggal</span><input type="date" value={from} onChange={(event) => setFrom(event.currentTarget.value)} /></label>
      <label><span className="sr-only">Sampai tanggal</span><input type="date" value={to} onChange={(event) => setTo(event.currentTarget.value)} /></label>
      <button className="button" type="submit">Terapkan filter</button>
    </form>
  )
}
