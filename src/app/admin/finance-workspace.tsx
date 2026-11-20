'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Download, Eye, RotateCw } from 'lucide-react'
import { formatRupiah } from '@/lib/products'
import type { AdminSale } from '@/lib/admin-repository'
import {
  saleDetailResponseSchema,
  salesResponseSchema,
} from '@/lib/validation'
import { hasPermission, type UserRole } from '@/lib/auth-types'
import { adminTabFetch } from '@/lib/admin-tab-client'

type SaleStatusFilter = 'all' | 'pending' | 'paid' | 'expired' | 'cancelled'
type ReportPeriod = 'daily' | 'weekly' | 'monthly'
type SaleDetail = ReturnType<typeof saleDetailResponseSchema.parse>['sale']

function dateKey(value: string | null) {
  if (!value) return ''
  return localDateKey(new Date(value))
}

function localDateKey(date: Date) {
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function weekKey(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = monday.getDay() || 7
  monday.setDate(monday.getDate() - day + 1)
  return localDateKey(monday)
}

function monthKey(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function errorMessage(payload: unknown, fallback: string) {
  return typeof payload === 'object' && payload !== null && 'error' in payload &&
    typeof payload.error === 'string' ? payload.error : fallback
}

function downloadReport(sales: AdminSale[], period: ReportPeriod) {
  const paidSales = sales.filter((sale) => sale.status === 'paid')
  const groups = new Map<string, { posCount: number; posTotal: number; websiteCount: number; websiteTotal: number }>()
  for (const sale of paidSales) {
    const key = period === 'daily'
      ? dateKey(sale.paid_at)
      : period === 'weekly'
        ? weekKey(sale.paid_at ?? '')
        : monthKey(sale.paid_at ?? '')
    if (!key) continue
    const current = groups.get(key) ?? { posCount: 0, posTotal: 0, websiteCount: 0, websiteTotal: 0 }
    if (sale.origin === 'website') {
      current.websiteCount += 1
      current.websiteTotal += sale.total_amount
    } else {
      current.posCount += 1
      current.posTotal += sale.total_amount
    }
    groups.set(key, current)
  }
  const rows = Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a))
  const csv = [
    ['Periode', 'Transaksi POS lunas', 'Penjualan POS', 'Transaksi Website lunas', 'Penjualan Website', 'Total transaksi', 'Total penjualan'],
    ...rows.map(([key, summary]) => [
      key,
      String(summary.posCount),
      String(summary.posTotal),
      String(summary.websiteCount),
      String(summary.websiteTotal),
      String(summary.posCount + summary.websiteCount),
      String(summary.posTotal + summary.websiteTotal),
    ]),
  ].map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `rekap-penjualan-${period}.csv`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export default function FinanceWorkspace({
  initialSales,
  role,
}: {
  initialSales: AdminSale[]
  role: UserRole
}) {
  const [sales, setSales] = useState(initialSales)
  const [statusFilter, setStatusFilter] = useState<SaleStatusFilter>('all')
  const [historyFrom, setHistoryFrom] = useState('')
  const [historyTo, setHistoryTo] = useState('')
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('daily')
  const [details, setDetails] = useState<Record<string, SaleDetail>>({})
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const canConfirmPayments = hasPermission(role, 'sales:pay')
  const todayKey = localDateKey(new Date())
  const paidSales = useMemo(() => sales.filter((sale) => sale.status === 'paid'), [sales])
  const codPendingSales = useMemo(
    () => sales.filter((sale) => sale.status === 'pending' && sale.payment_method === 'cod'),
    [sales],
  )
  const recordedSales = useMemo(
    () => sales.filter((sale) => sale.status === 'paid' ||
      (sale.status === 'pending' && sale.payment_method === 'cod')),
    [sales],
  )
  const totalSalesValue = recordedSales.reduce((sum, sale) => sum + sale.total_amount, 0)
  const totalSoldItems = recordedSales.reduce((sum, sale) => sum + sale.item_count, 0)
  const paidTotal = paidSales.reduce((sum, sale) => sum + sale.total_amount, 0)
  const codPendingTotal = codPendingSales.reduce((sum, sale) => sum + sale.total_amount, 0)
  const todayTotal = paidSales
    .filter((sale) => dateKey(sale.paid_at) === todayKey)
    .reduce((sum, sale) => sum + sale.total_amount, 0)

  const filteredTransactions = useMemo(
    () => sales.filter((sale) => statusFilter === 'all' || sale.status === statusFilter),
    [sales, statusFilter],
  )
  const filteredHistory = useMemo(
    () => paidSales.filter((sale) => {
      const key = dateKey(sale.paid_at)
      return (!historyFrom || key >= historyFrom) && (!historyTo || key <= historyTo)
    }),
    [historyFrom, historyTo, paidSales],
  )

  const reportRows = useMemo(() => {
    const groups = new Map<string, { posCount: number; posTotal: number; websiteCount: number; websiteTotal: number }>()
    for (const sale of paidSales) {
      const key = reportPeriod === 'daily'
        ? dateKey(sale.paid_at)
        : reportPeriod === 'weekly'
          ? weekKey(sale.paid_at ?? '')
          : monthKey(sale.paid_at ?? '')
      if (!key) continue
      const summary = groups.get(key) ?? { posCount: 0, posTotal: 0, websiteCount: 0, websiteTotal: 0 }
      if (sale.origin === 'website') {
        summary.websiteCount += 1
        summary.websiteTotal += sale.total_amount
      } else {
        summary.posCount += 1
        summary.posTotal += sale.total_amount
      }
      groups.set(key, summary)
    }
    return Array.from(groups.entries())
      .sort(([left], [right]) => right.localeCompare(left))
      .slice(0, 8)
  }, [paidSales, reportPeriod])

  const refreshSales = useCallback(async () => {
    setRefreshing(true)
    setError('')
    try {
      const response = await adminTabFetch('/api/admin/sales?all=1', { cache: 'no-store' })
      const payload: unknown = await response.json()
      if (!response.ok) throw new Error(errorMessage(payload, 'Gagal memuat transaksi.'))
      const parsed = salesResponseSchema.safeParse(payload)
      if (!parsed.success) throw new Error('Format data transaksi tidak dikenali.')
      setSales(parsed.data.sales.map((sale) => ({ ...sale, item_count: sale.item_count ?? 0 })))
      setNotice('Data transaksi berhasil diperbarui.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Data transaksi gagal dimuat.')
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshSales()
    }, 15_000)
    return () => window.clearInterval(interval)
  }, [refreshSales])

  async function loadDetail(id: string) {
    if (details[id]) {
      setDetails((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
      return
    }
    setError('')
    try {
      const response = await adminTabFetch(`/api/admin/sales/${encodeURIComponent(id)}`, { cache: 'no-store' })
      const payload: unknown = await response.json()
      if (!response.ok) throw new Error(errorMessage(payload, 'Detail transaksi tidak dapat dimuat.'))
      const parsed = saleDetailResponseSchema.safeParse(payload)
      if (!parsed.success) throw new Error('Format detail transaksi tidak dikenali.')
      setDetails((current) => ({ ...current, [id]: parsed.data.sale }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Detail transaksi tidak dapat dimuat.')
    }
  }

  async function confirmPayment(id: string) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await adminTabFetch(`/api/admin/sales/${encodeURIComponent(id)}/paid`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid: true }),
      })
      const payload: unknown = await response.json()
      if (!response.ok) throw new Error(errorMessage(payload, 'Pembayaran tidak dapat dikonfirmasi.'))
      setNotice(`Transaksi ${id.slice(0, 8).toUpperCase()} berhasil dikonfirmasi lunas.`)
      await refreshSales()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Pembayaran tidak dapat dikonfirmasi.')
    } finally {
      setBusy(false)
    }
  }

  const cardStyle = {
    minHeight: 104,
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    padding: '16px 18px',
    border: '1px solid #e1e2d8',
    background: '#fbfbf7',
  }
  const sectionStyle = { marginTop: 18, padding: 20 }
  const tableStyle = { width: '100%', minWidth: 720, borderCollapse: 'collapse' as const, fontSize: 10 }
  const cellStyle = { padding: '11px 9px', borderBottom: '1px solid #e7e8e0', textAlign: 'left' as const }

  return (
    <div className="pos-workspace">
      <section aria-label="Ringkasan keuangan">
        <p className="eyebrow"><span className="eyebrow-line" /> RINGKASAN KEUANGAN</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 11, marginTop: 14 }}>
          <article style={cardStyle}><span className="eyebrow">TOTAL PENJUALAN</span><strong style={{ marginTop: 7, color: '#294332', fontFamily: 'var(--serif)', fontSize: 25, fontWeight: 400 }}>{formatRupiah(totalSalesValue)}</strong><small>{recordedSales.length} transaksi · {totalSoldItems} barang terjual</small></article>
          <article style={cardStyle}><span className="eyebrow">PEMBAYARAN DITERIMA</span><strong style={{ marginTop: 7, color: '#294332', fontFamily: 'var(--serif)', fontSize: 25, fontWeight: 400 }}>{formatRupiah(paidTotal)}</strong><small>{paidSales.length} transaksi lunas · transfer dan COD</small></article>
          <article style={cardStyle}><span className="eyebrow">COD BELUM DIBAYAR</span><strong style={{ marginTop: 7, color: '#294332', fontFamily: 'var(--serif)', fontSize: 25, fontWeight: 400 }}>{formatRupiah(codPendingTotal)}</strong><small>{codPendingSales.length} pesanan menunggu uang diterima</small></article>
          <article style={cardStyle}><span className="eyebrow">TOTAL TRANSAKSI</span><strong style={{ marginTop: 7, color: '#294332', fontFamily: 'var(--serif)', fontSize: 25, fontWeight: 400 }}>{sales.length}</strong><small>seluruh periode · semua status</small></article>
          <article style={cardStyle}><span className="eyebrow">PENERIMAAN HARI INI</span><strong style={{ marginTop: 7, color: '#294332', fontFamily: 'var(--serif)', fontSize: 25, fontWeight: 400 }}>{formatRupiah(todayTotal)}</strong><small>pembayaran lunas hari ini</small></article>
        </div>
        <p style={{ margin: '10px 0 0', color: '#858b80', fontSize: 9 }}>
          Berdasarkan transaksi pada database. Pengeluaran, modal, dan laba tidak ditampilkan karena belum dicatat.
        </p>
      </section>

      {error ? <p className="admin-alert admin-alert--error" role="alert">{error}</p> : null}
      {notice ? <p className="admin-alert admin-alert--success" role="status"><Check size={15} /> {notice}</p> : null}

      <section className="admin-card" style={sectionStyle} aria-labelledby="finance-transactions-title">
        <div className="panel-heading">
          <div><h3 id="finance-transactions-title">Transaksi & pembayaran</h3><p>Daftar pembayaran dan status transaksi dari sumber data yang sama.</p></div>
          <div className="admin-topbar-right">
            <button className="refresh-button" type="button" onClick={() => void refreshSales()} disabled={refreshing || busy}>
              <RotateCw size={14} aria-hidden="true" /> {refreshing ? 'Memuat...' : 'Segarkan'}
            </button>
          </div>
        </div>
        <div className="workspace-tabs" role="group" aria-label="Filter status transaksi">
          {(['all', 'pending', 'paid', 'expired', 'cancelled'] as const).map((filter) => (
            <button key={filter} type="button" aria-pressed={statusFilter === filter} onClick={() => setStatusFilter(filter)}>
              {filter === 'all' ? 'Semua' : filter === 'pending' ? 'Menunggu Pembayaran' : filter === 'paid' ? 'Lunas' : filter === 'expired' ? 'Kedaluwarsa' : 'Dibatalkan'}
            </button>
          ))}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead><tr>{['Kode transaksi', 'Tanggal', 'Asal transaksi', 'Saluran', 'Jumlah barang', 'Total pembayaran', 'Metode', 'Status', 'Aksi'].map((label) => <th key={label} style={cellStyle}>{label}</th>)}</tr></thead>
            <tbody>
              {filteredTransactions.map((sale) => (
                <tr key={sale.id}>
                  <td style={cellStyle}>{sale.id.slice(0, 8).toUpperCase()}</td>
                  <td style={cellStyle}>{formatDate(sale.created_at)}</td>
                  <td style={cellStyle}>{sale.origin === 'website' ? 'Etalase publik' : 'POS staf'}</td>
                  <td style={cellStyle}>{sale.source}</td>
                  <td style={cellStyle}>{sale.item_count} barang</td>
                  <td style={cellStyle}>{formatRupiah(sale.total_amount)}</td>
                  <td style={cellStyle}>{sale.payment_method === 'cod' ? 'COD' : sale.payment_method === 'transfer' ? 'Transfer' : 'POS'}</td>
                  <td style={cellStyle}><span className={`inventory-status inventory-status--${sale.status}`}>{sale.status === 'pending' ? sale.payment_method === 'cod' ? 'Belum dibayar' : 'menunggu pembayaran' : sale.status === 'paid' ? 'lunas' : sale.status === 'expired' ? 'kedaluwarsa' : 'dibatalkan'}</span></td>
                  <td style={cellStyle}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                      <button className="refresh-button" type="button" onClick={() => void loadDetail(sale.id)}><Eye size={13} /> Detail</button>
                      {canConfirmPayments && sale.status === 'pending' && sale.payment_method !== 'cod' ? <button className="button" type="button" disabled={busy} onClick={() => void confirmPayment(sale.id)}>Konfirmasi lunas</button> : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredTransactions.length ? <tr><td colSpan={9} style={{ ...cellStyle, color: '#858b80' }}>Tidak ada transaksi pada filter ini.</td></tr> : null}
            </tbody>
          </table>
        </div>
        {sales.filter((sale) => details[sale.id]).map((sale) => {
          const detail = details[sale.id]
          if (!detail) return null
          const buyer = detail.buyer
          return (
            <div key={`${sale.id}-details`} className="admin-empty" style={{ justifyItems: 'start', padding: '14px 8px', textAlign: 'left', borderBottom: '1px solid #e7e8e0' }}>
              <strong>Detail {sale.id.slice(0, 8).toUpperCase()} · {sale.origin === 'website' ? 'Etalase publik' : 'POS staf'} · {sale.source}</strong>
              <small>Dibuat {formatDate(sale.created_at)} · {sale.paid_at ? `Dibayar ${formatDate(sale.paid_at)}${sale.paid_by_name ? ` oleh ${sale.paid_by_name}` : ''}` : 'Belum dibayar'}</small>
              {buyer ? (
                <>
                  <span>Nama pembeli: {buyer.name}</span>
                  <span>WhatsApp: {buyer.whatsapp}</span>
                  {buyer.email ? <span>Email: {buyer.email}</span> : null}
                  {buyer.note ? <span>Catatan: {buyer.note}</span> : null}
                  <span>Pengantaran: {buyer.deliveryDistrict} · {buyer.deliveryAddress}</span>
                  <span>Pembayaran: {buyer.paymentMethod === 'cod' ? 'COD' : 'Transfer bank'} · Ongkir {formatRupiah(buyer.deliveryFee)}</span>
                </>
              ) : sale.origin === 'website' ? <small>Data pembeli tidak tersedia untuk transaksi ini atau akun Anda tidak berwenang melihatnya.</small> : null}
              {detail.items.map((item) => <span key={item.product_code}>{item.product_code} · {item.product_name} · {formatRupiah(item.unit_price)}</span>)}
            </div>
          )
        })}
      </section>

      <section className="admin-card" style={sectionStyle} aria-labelledby="finance-history-title">
        <div className="panel-heading">
          <div><h3 id="finance-history-title">Riwayat transaksi lunas</h3><p>Filter tanggal berdasarkan waktu pembayaran yang tercatat.</p></div>
          <span>{filteredHistory.length} transaksi</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <label style={{ display: 'grid', gap: 5, color: '#596458', fontSize: 9 }}>Dari tanggal<input type="date" value={historyFrom} onChange={(event) => setHistoryFrom(event.currentTarget.value)} /></label>
          <label style={{ display: 'grid', gap: 5, color: '#596458', fontSize: 9 }}>Sampai tanggal<input type="date" value={historyTo} onChange={(event) => setHistoryTo(event.currentTarget.value)} /></label>
          <button className="refresh-button" type="button" onClick={() => { setHistoryFrom(''); setHistoryTo('') }}>Hapus filter tanggal</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead><tr>{['Kode transaksi', 'Tanggal lunas', 'Jumlah barang', 'Total', 'Detail'].map((label) => <th key={label} style={cellStyle}>{label}</th>)}</tr></thead>
            <tbody>
              {filteredHistory.map((sale) => (
                <tr key={sale.id}>
                  <td style={cellStyle}>{sale.id.slice(0, 8).toUpperCase()}</td><td style={cellStyle}>{formatDate(sale.paid_at)}</td>
                  <td style={cellStyle}>{sale.item_count} barang</td><td style={cellStyle}>{formatRupiah(sale.total_amount)}</td>
                  <td style={cellStyle}><button className="refresh-button" type="button" onClick={() => void loadDetail(sale.id)}><Eye size={13} /> {details[sale.id] ? 'Tutup detail' : 'Lihat detail'}</button></td>
                </tr>
              ))}
              {!filteredHistory.length ? <tr><td colSpan={5} style={{ ...cellStyle, color: '#858b80' }}>Belum ada transaksi lunas pada rentang tanggal ini.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card" style={sectionStyle} aria-labelledby="finance-report-title">
        <div className="panel-heading">
          <div><h3 id="finance-report-title">Rekap penjualan & laporan</h3><p>Rekap hanya mencakup transaksi berstatus lunas.</p></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select aria-label="Periode rekap" value={reportPeriod} onChange={(event) => setReportPeriod(event.currentTarget.value as ReportPeriod)}>
              <option value="daily">Harian</option><option value="weekly">Mingguan</option><option value="monthly">Bulanan</option>
            </select>
            <button className="refresh-button" type="button" onClick={() => downloadReport(sales, reportPeriod)} disabled={!reportRows.length}>
              <Download size={13} /> Ekspor CSV
            </button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead><tr><th style={cellStyle}>Periode</th><th style={cellStyle}>Transaksi POS</th><th style={cellStyle}>Penjualan POS</th><th style={cellStyle}>Transaksi Website</th><th style={cellStyle}>Penjualan Website</th><th style={cellStyle}>Total penjualan</th></tr></thead>
            <tbody>
              {reportRows.map(([period, summary]) => (
                <tr key={period}>
                  <td style={cellStyle}>{period}</td><td style={cellStyle}>{summary.posCount}</td>
                  <td style={cellStyle}>{formatRupiah(summary.posTotal)}</td><td style={cellStyle}>{summary.websiteCount}</td>
                  <td style={cellStyle}>{formatRupiah(summary.websiteTotal)}</td>
                  <td style={cellStyle}>{formatRupiah(summary.posTotal + summary.websiteTotal)}</td>
                </tr>
              ))}
              {!reportRows.length ? <tr><td colSpan={6} style={{ ...cellStyle, color: '#858b80' }}>Belum ada data transaksi lunas untuk direkap.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <p style={{ margin: '12px 0 0', color: '#858b80', fontSize: 9 }}>
          Modal, pengeluaran, dan laba operasional tidak ditampilkan karena belum tersedia. HPP tersimpan per barang, tetapi belum direkap di bagian laporan ini.
        </p>
      </section>
    </div>
  )
}
