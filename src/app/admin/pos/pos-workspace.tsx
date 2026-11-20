'use client'

import { motion } from 'framer-motion'
import { useCallback, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, Check, ClipboardList, PackagePlus, ReceiptText, RotateCw } from 'lucide-react'
import {
  availableSaleProductsSchema,
  createdSaleSchema,
  createdProductSchema,
  inventoryResponseSchema,
  salesResponseSchema,
  type inventoryProductSchema,
  type saleRecordSchema,
} from '@/lib/validation'
import { formatRupiah } from '@/lib/products'
import type { z } from 'zod'
import { adminTabFetch } from '@/lib/admin-tab-client'
import type {
  AdminProduct,
  AdminProductSummary,
  AdminSale,
  SaleProduct,
} from '@/lib/admin-repository'
import { hasPermission, type UserRole } from '@/lib/auth-types'
import ProductPhotoField from './product-photo-field'
import ProductSizeField from './product-size-field'
import ProductQualityFields from './product-quality-fields'
import {
  cleaningConditionLabels,
  completenessLabels,
  damageLabels,
  productConditionLabels,
} from '@/lib/product-quality'

type InventoryProduct = z.infer<typeof inventoryProductSchema> & AdminProduct
type SaleRecord = z.infer<typeof saleRecordSchema> & AdminSale
type Section = 'inventory' | 'intake' | 'sales'

function errorMessage(payload: unknown, fallback: string) {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof payload.error === 'string'
  ) {
    return payload.error
  }
  return fallback
}

function formValue(form: FormData, name: string) {
  const value = form.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

export default function PosWorkspace({
  initialProducts,
  initialSales,
  initialSaleProducts,
  initialSummary,
  role,
  productsOnly = false,
}: {
  initialProducts: AdminProduct[]
  initialSummary?: AdminProductSummary
  initialSales: AdminSale[]
  initialSaleProducts: SaleProduct[]
  role: UserRole
  productsOnly?: boolean
}) {
  const canReadProducts = hasPermission(role, 'products:read')
  const canWriteProducts = hasPermission(role, 'products:write')
  const canReadSales = !productsOnly && hasPermission(role, 'sales:read')
  const canCreateSales = !productsOnly && hasPermission(role, 'sales:create')
  const canConfirmPayments = !productsOnly && hasPermission(role, 'sales:pay')
  const [section, setSection] = useState<Section>(canReadProducts ? 'inventory' : 'sales')
  const [products, setProducts] = useState<InventoryProduct[]>(initialProducts)
  const [summary, setSummary] = useState<AdminProductSummary>(
    initialSummary ?? {
      total: initialProducts.length,
      pendingQc: initialProducts.filter((product) => product.inspection_status === 'pending').length,
      readyToSell: initialProducts.filter((product) => product.stock_status === 'available').length,
    },
  )
  const [sales, setSales] = useState<SaleRecord[]>(initialSales)
  const [saleProducts, setSaleProducts] = useState(initialSaleProducts)
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const creatingProduct = useRef(false)
  const refreshingData = useRef(false)

  const refresh = useCallback(async () => {
    if (refreshingData.current) return false
    refreshingData.current = true
    setRefreshing(true)
    setError('')

    try {
      const [productResponse, saleResponse, saleProductsResponse] = await Promise.all([
        canReadProducts
          ? adminTabFetch(`/api/admin/products${productsOnly ? '?all=1' : ''}`, { cache: 'no-store' })
          : null,
        canReadSales ? adminTabFetch('/api/admin/sales', { cache: 'no-store' }) : null,
        canCreateSales
          ? adminTabFetch('/api/admin/sales/available-products', { cache: 'no-store' })
          : null,
      ])
      const [productPayload, salePayload, saleProductsPayload]: [unknown, unknown, unknown] =
        await Promise.all([
        productResponse ? productResponse.json() : null,
        saleResponse ? saleResponse.json() : null,
        saleProductsResponse ? saleProductsResponse.json() : null,
      ])

      const productResult = canReadProducts
        ? inventoryResponseSchema.safeParse(productPayload)
        : null
      const saleResult = canReadSales ? salesResponseSchema.safeParse(salePayload) : null
      const saleProductsResult = canCreateSales
        ? availableSaleProductsSchema.safeParse(saleProductsPayload)
        : null

      if (
        (productResponse && !productResponse.ok) ||
        (saleResponse && !saleResponse.ok) ||
        (saleProductsResponse && !saleProductsResponse.ok)
      ) {
        const response = [productResponse, saleResponse, saleProductsResponse].find(
          (item) => item && !item.ok,
        )
        const payload = response === productResponse
          ? productPayload
          : response === saleResponse
            ? salePayload
            : saleProductsPayload
        throw new Error(errorMessage(payload, productsOnly ? 'Gagal memuat produk.' : 'Gagal memuat data POS & persediaan.'))
      }

      if (
        (productResult && !productResult.success) ||
        (saleResult && !saleResult.success) ||
        (saleProductsResult && !saleProductsResult.success)
      ) {
        throw new Error('Server mengirim data dengan format yang tidak dikenali.')
      }
      if (productResult?.success) {
        setProducts(productResult.data.products)
        if (productResult.data.summary) setSummary(productResult.data.summary)
      }
      if (saleResult?.success) setSales(saleResult.data.sales)
      if (saleProductsResult?.success) {
        setSaleProducts(saleProductsResult.data.products)
        setSelectedCodes((current) =>
          current.filter((code) => saleProductsResult.data.products.some((product) => product.code === code)),
        )
      }
      return true
    } catch (caught) {
      setError(caught instanceof Error
        ? caught.message
        : productsOnly ? 'Tidak dapat memuat produk.' : 'Tidak dapat memuat data POS & persediaan.')
      return false
    } finally {
      refreshingData.current = false
      setRefreshing(false)
    }
  }, [canCreateSales, canReadProducts, canReadSales, productsOnly])

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (creatingProduct.current) return
    creatingProduct.current = true
    const formElement = event.currentTarget
    setBusy(true)
    setError('')
    setNotice('')

    const form = new FormData(formElement)

    try {
      const selectedImage = form.get('imageFile')
      if (!(selectedImage instanceof File && selectedImage.size > 0)) {
        throw new Error('Pilih foto produk sebelum menyimpan.')
      }
      const response = await adminTabFetch('/api/admin/products', {
        method: 'POST',
        body: form,
      })
      const result: unknown = await response.json()
      if (!response.ok) throw new Error(errorMessage(result, 'Produk gagal disimpan.'))
      const parsed = createdProductSchema.safeParse(result)
      if (!parsed.success) throw new Error('Server belum mengonfirmasi penyimpanan produk.')
      formElement.reset()
      setNotice(`Produk ${parsed.data.code} tersimpan. Status stok mengikuti hasil QC dan pembersihan.`)
      setSection('inventory')
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Produk gagal disimpan.')
    } finally {
      creatingProduct.current = false
      setBusy(false)
    }
  }

  async function updateQc(event: FormEvent<HTMLFormElement>, product: InventoryProduct) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    const form = new FormData(event.currentTarget)
    const payload = {
      fabricCheck: formValue(form, 'fabricCheck'),
      seamsCheck: formValue(form, 'seamsCheck'),
      buttonsCheck: formValue(form, 'buttonsCheck'),
      zipperCheck: formValue(form, 'zipperCheck'),
      conditionNote: formValue(form, 'conditionNote'),
      inspectionStatus: formValue(form, 'inspectionStatus'),
      cleaningStatus: formValue(form, 'cleaningStatus'),
    }

    try {
      const response = await adminTabFetch(`/api/admin/products/${encodeURIComponent(product.code)}/qc`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result: unknown = await response.json()
      if (!response.ok) throw new Error(errorMessage(result, 'Pemeriksaan gagal diperbarui.'))
      setNotice(`Pemeriksaan ${product.code} diperbarui.`)
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Pemeriksaan gagal diperbarui.')
    } finally {
      setBusy(false)
    }
  }

  async function updateProduct(event: FormEvent<HTMLFormElement>, product: InventoryProduct) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    const form = new FormData(event.currentTarget)

    try {
      const response = await adminTabFetch(`/api/admin/products/${encodeURIComponent(product.code)}`, {
        method: 'PATCH',
        body: form,
      })
      const result: unknown = await response.json()
      if (!response.ok) throw new Error(errorMessage(result, 'Produk gagal diperbarui.'))
      setNotice(`Produk ${product.code} berhasil diperbarui.`)
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Produk gagal diperbarui.')
    } finally {
      setBusy(false)
    }
  }

  async function createSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    setBusy(true)
    setError('')
    setNotice('')
    const form = new FormData(formElement)
    const source = formValue(form, 'source')

    try {
      const response = await adminTabFetch('/api/admin/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, productCodes: selectedCodes }),
      })
      const result: unknown = await response.json()
      if (!response.ok) throw new Error(errorMessage(result, 'Transaksi gagal dibuat.'))
      const parsed = createdSaleSchema.safeParse(result)
      if (!parsed.success) throw new Error('Server mengirim tanda terima dengan format yang tidak dikenali.')
      setNotice(`Transaksi ${parsed.data.id.slice(0, 8)} dibuat sebesar ${formatRupiah(parsed.data.totalAmount)}. Stok berubah setelah konfirmasi lunas.`)
      setSelectedCodes([])
      formElement.reset()
      setSection('sales')
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Transaksi gagal dibuat.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmPaid(id: string) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await adminTabFetch(`/api/admin/sales/${encodeURIComponent(id)}/paid`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid: true }),
      })
      const result: unknown = await response.json()
      if (!response.ok) throw new Error(errorMessage(result, 'Pembayaran tidak dapat dikonfirmasi.'))
      setNotice(`Transaksi ${id.slice(0, 8)} lunas; stok produk telah diperbarui.`)
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Pembayaran tidak dapat dikonfirmasi.')
    } finally {
      setBusy(false)
    }
  }

  const pendingSales = sales.filter((sale) => sale.status === 'pending').length

  return (
    <div className="pos-workspace">
      {productsOnly ? (
        <section className="admin-summary" aria-label="Ringkasan produk">
          <article><span>SELURUH PRODUK</span><strong>{summary.total.toString().padStart(2, '0')}</strong><small>tersimpan di database</small></article>
          <article><span>MENUNGGU QC</span><strong>{summary.pendingQc.toString().padStart(2, '0')}</strong><small>perlu pemeriksaan</small></article>
          <article><span>SIAP DIJUAL</span><strong>{summary.readyToSell.toString().padStart(2, '0')}</strong><small>lolos QC dan dibersihkan</small></article>
          <article className="summary-mark"><span>✳</span><p>Detail terjaga,<br />cerita berlanjut.</p></article>
        </section>
      ) : (
        <section className="admin-summary" aria-label="Ringkasan persediaan">
          {canReadProducts ? (
            <>
              <article><span>BARANG TERSEDIA</span><strong>{summary.readyToSell.toString().padStart(2, '0')}</strong><small>siap ditawarkan</small></article>
              <article><span>MENUNGGU QC</span><strong>{summary.pendingQc.toString().padStart(2, '0')}</strong><small>perlu pemeriksaan</small></article>
            </>
          ) : null}
          {canReadSales ? (
            <article><span>TRANSAKSI TERTUNDA</span><strong>{pendingSales.toString().padStart(2, '0')}</strong><small>menunggu konfirmasi lunas</small></article>
          ) : null}
          <article className="summary-mark"><span>✳</span><p>Setiap barang<br />punya ceritanya.</p></article>
        </section>
      )}

      <div className="workspace-heading">
        <div>
          <p className="eyebrow"><span className="eyebrow-line" /> {productsOnly ? 'ADMINISTRASI PRODUK' : 'OPERASIONAL HARI INI'}</p>
          <h2>{productsOnly ? section === 'intake' ? <>Tambah <em>Produk</em></> : <>Kelola <em>Produk</em></> : canWriteProducts ? <>Mengelola stok dan <em>operasional penjualan.</em></> : canCreateSales ? <>Catat <em>penjualan.</em></> : <>Kelola <em>pembayaran.</em></>}</h2>
        </div>
        <div className="admin-topbar-right">
          {!productsOnly && canWriteProducts && section === 'inventory' ? (
            <button className="button button--gold" type="button" onClick={() => setSection('intake')}>
              <PackagePlus size={15} aria-hidden="true" /> + Tambah Produk
            </button>
          ) : null}
          {productsOnly && section === 'intake' ? (
            <button className="refresh-button" type="button" onClick={() => setSection('inventory')}>
              Kembali ke daftar
            </button>
          ) : null}
          <button className="refresh-button" type="button" onClick={() => void refresh()} disabled={busy || refreshing}>
            <RotateCw size={14} aria-hidden="true" /> {refreshing ? 'Memuat data...' : 'Segarkan'}
          </button>
        </div>
      </div>
      {!productsOnly ? (
        <p className="workspace-description">
          Daftar stok, status barang, pencatatan penjualan, dan transaksi sesuai izin akun Anda.
        </p>
      ) : null}

      {error ? <p className="admin-alert admin-alert--error" role="alert">{error}</p> : null}
      {notice ? <p className="admin-alert admin-alert--success" role="status"><Check size={15} /> {notice}</p> : null}

      {!productsOnly ? <div className="workspace-tabs" role="group" aria-label="Modul operasional">
        {canReadProducts ? (
          <button type="button" aria-pressed={section === 'inventory'} onClick={() => setSection('inventory')}><ClipboardList size={15} /> Persediaan</button>
        ) : null}
        {canWriteProducts ? (
          <button type="button" aria-pressed={section === 'intake'} onClick={() => setSection('intake')}><PackagePlus size={15} /> Catat & QC barang</button>
        ) : null}
        {canReadSales ? (
          <button type="button" aria-pressed={section === 'sales'} onClick={() => setSection('sales')}><ReceiptText size={15} /> Kasir digital</button>
        ) : null}
      </div> : null}

      <>
        {section === 'inventory' ? (
          <motion.section className="admin-card inventory-panel" key="inventory" initial={false} animate={{ opacity: 1, y: 0 }}>
            <div className="panel-heading">
              <div>
                <h3>{productsOnly ? 'Daftar produk' : 'Daftar persediaan'}</h3>
                <p>{productsOnly
                  ? 'Pantau identitas, harga, QC, kebersihan, dan kelayakan tayang setiap produk.'
                  : 'Status katalog berubah hanya setelah QC lolos dan pakaian dibersihkan.'}</p>
              </div>
              <span>{productsOnly ? summary.total : products.length} barang</span>
            </div>
            {products.length ? (
              <div className="inventory-list">
                {products.map((product) => (
                  <article className="inventory-row" key={product.code}>
                    <div className="inventory-main">
                      <span className={`inventory-thumbnail inventory-thumbnail--${product.image_tone}`}><img src={product.image_url} alt="" /></span>
                      <div className="inventory-name">
                        <strong>{product.name}</strong>
                        <span>{product.code} · {product.category} · ukuran {product.size}</span>
                        {productsOnly ? <span>{product.measurements}</span> : null}
                      </div>
                      <span className={`inventory-status inventory-status--${product.stock_status}`}>
                        {product.reserved ? 'dipesan sementara'
                          : product.stock_status === 'available' ? 'siap dijual'
                          : product.stock_status === 'sold' ? 'terjual'
                            : product.stock_status === 'archived' ? 'diarsipkan'
                              : 'belum dipublikasikan'}
                      </span>
                      <div className="inventory-price"><strong>{formatRupiah(product.price)}</strong><span>HPP {formatRupiah(product.purchase_cost)}</span></div>
                    </div>
                    {productsOnly ? (
                      <div className="product-admin-statuses">
                        <span className={`inventory-status ${product.inspection_status === 'passed' ? 'inventory-status--available' : `inventory-status--${product.inspection_status}`}`}>
                          QC: {product.inspection_status === 'passed' ? 'lolos' : product.inspection_status === 'failed' ? 'tidak lolos' : 'menunggu'}
                        </span>
                        <span className={`inventory-status ${product.cleaning_status === 'cleaned' ? 'inventory-status--available' : 'inventory-status--pending'}`}>
                          Kebersihan: {product.cleaning_status === 'cleaned' ? 'bersih' : 'belum dibersihkan'}
                        </span>
                      </div>
                    ) : null}
                    {productsOnly ? (
                      <details className="qc-editor product-editor">
                        <summary>Lihat detail produk</summary>
                        <div className="qc-existing-notes">
                          <span><b>Kode</b> {product.code}</span>
                          <span><b>Kategori</b> {product.category}</span>
                          <span><b>Ukuran</b> {product.size} · {product.measurements}</span>
                          <span><b>Warna</b> {product.product_color ?? 'Belum dicatat'}</span>
                          <span><b>Nuansa foto</b> {product.photo_mood ?? 'Belum dicatat'}</span>
                          <span><b>Kondisi pemeriksaan</b> {product.product_condition ? productConditionLabels[product.product_condition] : 'Belum dicatat'}</span>
                          <span><b>Kebersihan</b> {product.cleaning_condition ? cleaningConditionLabels[product.cleaning_condition] : 'Belum dicatat'}</span>
                          <span><b>Kelengkapan</b> {product.completeness ? completenessLabels[product.completeness] : 'Belum dicatat'}</span>
                          <span><b>Cacat/kerusakan</b> {product.damage_type ? `${damageLabels[product.damage_type]}${product.damage_note ? ` — ${product.damage_note}` : ''}` : 'Belum dicatat'}</span>
                          <span><b>HPP</b> {formatRupiah(product.purchase_cost)}</span>
                          <span><b>Harga jual</b> {formatRupiah(product.price)}</span>
                          <span><b>Kain</b> {product.fabric_check}</span>
                          <span><b>Jahitan</b> {product.seams_check}</span>
                          <span><b>Kancing</b> {product.buttons_check}</span>
                          <span><b>Ritsleting</b> {product.zipper_check}</span>
                          <span><b>Kondisi</b> {product.condition_note}</span>
                          <span><b>Status katalog</b> {product.stock_status === 'available' ? 'Tayang' : product.stock_status === 'sold' ? 'Terjual' : product.stock_status === 'archived' ? 'Diarsipkan' : 'Belum tayang'}</span>
                        </div>
                      </details>
                    ) : null}
                    {canWriteProducts && !['sold', 'archived'].includes(product.stock_status) ? (
                      <details className="qc-editor product-editor">
                        <summary>Edit informasi produk</summary>
                        <form className="product-form product-edit-form" onSubmit={(event) => void updateProduct(event, product)}>
                          <label>Nama produk<input name="name" defaultValue={product.name} maxLength={160} required /></label>
                          <ProductSizeField initialCategory={product.category} initialSize={product.size} />
                          <label>Detail ukuran<input name="measurements" defaultValue={product.measurements} maxLength={240} required /></label>
                          <label>Warna produk<input name="productColor" type="text" defaultValue={product.product_color ?? ''} maxLength={120} required /></label>
                          <label>HPP (Rp)<input name="purchaseCost" type="number" min="0" max="100000000" defaultValue={product.purchase_cost} required /></label>
                          <label>Harga jual (Rp)<input name="price" type="number" min="1" max="100000000" defaultValue={product.price} required /></label>
                          <ProductPhotoField
                            key={`${product.code}:${product.image_url}`}
                            initialUrl={product.image_url}
                          />
                          <label>Deskripsi foto<input name="imageAlt" defaultValue={product.image_alt} maxLength={180} required /></label>
                          <input type="hidden" name="imageTone" value={product.image_tone} />
                          <label>Nuansa foto<input name="photoMood" type="text" defaultValue={product.photo_mood ?? ''} maxLength={120} required /></label>
                          <label>Kata bantu pencarian<input name="searchTerms" defaultValue={product.searchTerms.join(', ')} maxLength={500} /></label>
                          <label className="form-grid-wide">Catatan kondisi<textarea name="conditionNote" defaultValue={product.condition_note} rows={2} maxLength={500} required /></label>
                          <ProductQualityFields
                            productCondition={product.product_condition}
                            cleaningCondition={product.cleaning_condition ?? (product.cleaning_status === 'cleaned' ? 'clean' : 'needs_wash')}
                            completeness={product.completeness}
                            damageType={product.damage_type}
                            damageNote={product.damage_note}
                          />
                          <label>Kain<input name="fabricCheck" defaultValue={product.fabric_check} maxLength={240} required /></label>
                          <label>Jahitan<input name="seamsCheck" defaultValue={product.seams_check} maxLength={240} required /></label>
                          <label>Kancing<input name="buttonsCheck" defaultValue={product.buttons_check} maxLength={240} required /></label>
                          <label>Ritsleting<input name="zipperCheck" defaultValue={product.zipper_check} maxLength={240} required /></label>
                          <label>Status pemeriksaan<select name="inspectionStatus" defaultValue={product.inspection_status}><option value="pending">Menunggu pemeriksaan</option><option value="passed">Lolos pemeriksaan</option><option value="failed">Tidak layak jual</option></select></label>
                          <button className="button button--gold form-grid-wide" type="submit" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan perubahan produk'} <ArrowRight size={14} /></button>
                        </form>
                      </details>
                    ) : null}
                    {canWriteProducts && (!productsOnly || !['sold', 'archived'].includes(product.stock_status)) ? <details className="qc-editor">
                      <summary>Detail / ubah QC</summary>
                      <div className="qc-existing-notes">
                        <span><b>Kain</b> {product.fabric_check}</span>
                        <span><b>Jahitan</b> {product.seams_check}</span>
                        <span><b>Kancing</b> {product.buttons_check}</span>
                        <span><b>Ritsleting</b> {product.zipper_check}</span>
                      </div>
                      <form onSubmit={(event) => void updateQc(event, product)}>
                        <label>Catatan kain<input name="fabricCheck" defaultValue={product.fabric_check} maxLength={240} required /></label>
                        <label>Catatan jahitan<input name="seamsCheck" defaultValue={product.seams_check} maxLength={240} required /></label>
                        <label>Catatan kancing<input name="buttonsCheck" defaultValue={product.buttons_check} maxLength={240} required /></label>
                        <label>Catatan ritsleting<input name="zipperCheck" defaultValue={product.zipper_check} maxLength={240} required /></label>
                        <label>Kondisi jujur<input name="conditionNote" defaultValue={product.condition_note} maxLength={500} required /></label>
                        <label>Status QC<select name="inspectionStatus" defaultValue={product.inspection_status}><option value="pending">Menunggu pemeriksaan</option><option value="passed">Lolos pemeriksaan</option><option value="failed">Tidak layak jual</option></select></label>
                        <label>Status pembersihan<select name="cleaningStatus" defaultValue={product.cleaning_status}><option value="pending">Belum dibersihkan</option><option value="cleaned">Sudah dibersihkan</option></select></label>
                        <button className="button button--gold" type="submit" disabled={busy}>Simpan hasil QC <ArrowRight size={14} /></button>
                      </form>
                    </details> : null}
                  </article>
                ))}
              </div>
            ) : <div className="admin-empty">
              <PackagePlus size={22} />
              <p>{productsOnly ? 'Belum ada produk yang tersimpan. Tambahkan produk pertama untuk mulai mengelola detail, harga, dan pemeriksaannya.' : 'Belum ada barang. Catat pakaian dari pemasok untuk memulai persediaan.'}</p>
              {canWriteProducts ? <button type="button" onClick={() => setSection('intake')}><PackagePlus size={14} /> + Tambah Produk</button> : null}
            </div>}
          </motion.section>
        ) : null}

        {section === 'intake' && canWriteProducts ? (
          <motion.section className="admin-card" key="intake" initial={false} animate={{ opacity: 1, y: 0 }}>
            <div className="panel-heading"><div><h3>Pendataan & pemeriksaan</h3><p>Barang baru tampil di katalog hanya setelah lolos QC dan dibersihkan.</p></div><span>FORM PRODUK</span></div>
            <form className="product-form" onSubmit={(event) => void createProduct(event)}>
              <div className="form-section-title"><span>01</span><div><strong>Identitas & harga barang</strong><small>Masukkan harga sesuai data barang yang sebenarnya.</small></div></div>
              <div className="form-grid">
                <label>Kode produk<input name="code" placeholder="TH-043" pattern="TH-[A-Za-z0-9-]{2,29}" maxLength={32} required /></label>
                <label>Nama produk<input name="name" maxLength={160} required /></label>
                <ProductSizeField />
                <label>Detail ukuran<input name="measurements" placeholder="Lingkar dada 100 cm · panjang 68 cm" maxLength={240} required /></label>
                <label>Warna produk<input name="productColor" type="text" maxLength={120} required placeholder="Contoh: Cream, Sage Green, Black" /></label>
                <label>HPP (Rp)<input name="purchaseCost" type="number" min="0" max="100000000" required /></label>
                <label>Harga jual (Rp)<input name="price" type="number" min="1" max="100000000" required /></label>
                <input type="hidden" name="imageTone" value="olive" />
                <ProductPhotoField />
                <label className="form-grid-wide">Deskripsi foto untuk aksesibilitas<input name="imageAlt" maxLength={180} required /></label>
                <label className="form-grid-wide">Kata bantu pencarian (pisahkan koma)<input name="searchTerms" maxLength={500} placeholder="jaket, denim, outerwear" /></label>
                <label>Nuansa foto<input name="photoMood" type="text" maxLength={120} required placeholder="Contoh: Vintage, Minimalist, Y2K" /></label>
                <label className="form-grid-wide">Catatan kondisi jujur<textarea name="conditionNote" rows={2} maxLength={500} required placeholder="Jelaskan kondisi tambahan bila diperlukan." /></label>
              </div>

              <div className="form-section-title form-section-title--second"><span>02</span><div><strong>Pemeriksaan produk</strong><small>Pilih hasil pemeriksaan dan jelaskan kerusakan jika ditemukan.</small></div></div>
              <div className="form-grid">
                <ProductQualityFields
                  productCondition={null}
                  cleaningCondition={null}
                  completeness={null}
                  damageType={null}
                  damageNote={null}
                />
                <label>Kain<input name="fabricCheck" maxLength={240} required /></label>
                <label>Jahitan<input name="seamsCheck" maxLength={240} required /></label>
                <label>Kancing<input name="buttonsCheck" maxLength={240} required /></label>
                <label>Ritsleting<input name="zipperCheck" maxLength={240} required /></label>
                <label>Status pemeriksaan<select name="inspectionStatus" defaultValue="pending"><option value="pending">Menunggu pemeriksaan</option><option value="passed">Lolos pemeriksaan</option><option value="failed">Tidak layak jual</option></select></label>
              </div>
              <div className="form-submit-row"><p>Catatan tetap disimpan, tetapi barang belum masuk katalog sampai kedua proses selesai.</p><button className="button button--gold" type="submit" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan pemeriksaan'} <ArrowRight size={15} /></button></div>
            </form>
          </motion.section>
        ) : null}

        {section === 'sales' && canReadSales ? (
          <motion.section className="sales-layout" key="sales" initial={false} animate={{ opacity: 1, y: 0 }}>
            {canCreateSales ? <form className="admin-card sale-form" onSubmit={(event) => void createSale(event)}>
              <div className="panel-heading"><div><h3>Transaksi baru</h3><p>Pilih barang yang tersedia dan asal penjualan.</p></div><ReceiptText size={19} /></div>
              <label>Saluran penjualan<select name="source" defaultValue="direct"><option value="website">Website</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="whatsapp">WhatsApp</option><option value="direct">Penjualan langsung</option></select></label>
              <label>Barang tersedia <small>(pilih satu atau lebih)</small>
                <select className="sale-product-select" multiple value={selectedCodes} onChange={(event) => setSelectedCodes(Array.from(event.currentTarget.selectedOptions, (option) => option.value))}>
                  {saleProducts.map((product) => <option key={product.code} value={product.code}>{product.code} · {product.name} · {formatRupiah(product.price)}</option>)}
                </select>
              </label>
              {selectedCodes.length ? <p className="sale-selection-count">{selectedCodes.length} barang dipilih · total dihitung ulang dari harga tersimpan.</p> : <p className="sale-selection-count">Stok tidak berkurang sebelum transaksi dikonfirmasi lunas.</p>}
              <button className="button button--gold" type="submit" disabled={busy || selectedCodes.length === 0}>Buat transaksi tertunda <ArrowRight size={15} /></button>
            </form> : null}
            <section className="admin-card sales-history">
              <div className="panel-heading"><div><h3>Transaksi terbaru</h3><p>{canConfirmPayments ? 'Konfirmasi pembayaran mengubah status transaksi dan stok.' : 'Daftar ini hanya menampilkan ringkasan transaksi.'}</p></div><span>{sales.length} catatan</span></div>
              {sales.length ? (
                <div className="sales-list">
                  {sales.map((sale) => (
                    <article className="sale-row" key={sale.id}>
                      <div className="sale-row-main"><span className="sale-receipt"><ReceiptText size={16} /></span><div><strong>{sale.id.slice(0, 8).toUpperCase()}</strong><small>{sale.origin === 'website' ? 'Etalase publik' : 'POS staf'} · {sale.source} · {new Date(sale.created_at).toLocaleString('id-ID')}</small></div></div>
                      <div className="sale-row-actions"><strong>{formatRupiah(sale.total_amount)}</strong><span className={`inventory-status inventory-status--${sale.status}`}>{sale.status === 'pending' ? 'menunggu bayar' : sale.status === 'paid' ? 'lunas' : sale.status === 'expired' ? 'kedaluwarsa' : 'dibatalkan'}</span>{canConfirmPayments && sale.status === 'pending' ? <button type="button" disabled={busy} onClick={() => void confirmPaid(sale.id)}>Konfirmasi lunas</button> : null}</div>
                    </article>
                  ))}
                </div>
              ) : <div className="admin-empty admin-empty--small"><ReceiptText size={19} /><p>Belum ada transaksi tercatat.</p></div>}
            </section>
          </motion.section>
        ) : null}
      </>
    </div>
  )
}
