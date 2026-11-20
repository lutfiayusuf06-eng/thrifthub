'use client'

import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { ArrowRight, Search, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { formatRupiah, type Product } from '@/lib/products'
import AddToCartButton from '@/components/add-to-cart-button'

const sizes = ['Semua ukuran', 'S', 'M', 'L', 'XL']
const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID')
const normalizeSize = (value: string) => value.trim().toLocaleUpperCase('id-ID')

export default function CollectionExplorer({ products }: { products: Product[] }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Semua kategori')
  const [size, setSize] = useState('Semua ukuran')
  const [minimumPrice, setMinimumPrice] = useState('')
  const [maximumPrice, setMaximumPrice] = useState('')
  const [sort, setSort] = useState('newest')
  const categories = useMemo(() => {
    const uniqueCategories = new Map<string, string>()

    products.forEach((product) => {
      const normalized = normalizeText(product.category)
      if (!uniqueCategories.has(normalized)) {
        uniqueCategories.set(normalized, product.category.trim())
      }
    })

    return ['Semua kategori', ...Array.from(uniqueCategories.values())]
  }, [products])

  const filteredProducts = useMemo(() => {
    const normalizedQuery = normalizeText(query)
    const minimum = minimumPrice === '' ? 0 : Number(minimumPrice)
    const maximum = maximumPrice === '' ? Number.POSITIVE_INFINITY : Number(maximumPrice)
    const matchesValidRange =
      Number.isFinite(minimum) && minimum >= 0 && maximum >= minimum

    if (!matchesValidRange) return []

    const filtered = products.filter((product) => {
      const searchable = [
        product.name,
        product.code,
        product.category,
        product.condition,
        ...product.searchTerms,
      ].join(' ').toLocaleLowerCase('id-ID')

      return (
        (!normalizedQuery || searchable.includes(normalizedQuery)) &&
        (category === 'Semua kategori' || normalizeText(product.category) === normalizeText(category)) &&
        (size === 'Semua ukuran' || normalizeSize(product.size) === normalizeSize(size)) &&
        product.price >= minimum &&
        product.price <= maximum
      )
    })

    if (sort === 'price-asc') return filtered.sort((a, b) => a.price - b.price)
    if (sort === 'price-desc') return filtered.sort((a, b) => b.price - a.price)
    if (sort === 'name') return filtered.sort((a, b) => a.name.localeCompare(b.name, 'id'))
    return filtered
  }, [category, maximumPrice, minimumPrice, products, query, size, sort])

  const hasInvalidPriceRange =
    (minimumPrice !== '' && (!Number.isFinite(Number(minimumPrice)) || Number(minimumPrice) < 0)) ||
    (maximumPrice !== '' &&
      (!Number.isFinite(Number(maximumPrice)) ||
        Number(maximumPrice) < (minimumPrice === '' ? 0 : Number(minimumPrice))))

  return (
    <MotionConfig reducedMotion="user">
      <section className="catalog-section section-wrap collection-section" aria-labelledby="collection-title">
        <h2 id="collection-title" className="sr-only">Daftar produk ThriftHub</h2>
        <div className="collection-toolbar">
          <label className="search-control collection-search">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Cari nama atau kode produk</span>
            <input
              type="search"
              placeholder="Cari nama atau kode..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="select-control">
            <span className="sr-only">Filter kategori</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="select-control">
            <SlidersHorizontal size={15} aria-hidden="true" />
            <span className="sr-only">Filter ukuran</span>
            <select value={size} onChange={(event) => setSize(event.target.value)}>
              {sizes.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <fieldset className="price-range">
            <legend>Rentang harga</legend>
            <label>
              <span className="sr-only">Harga minimum dalam Rupiah</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="Min"
                value={minimumPrice}
                onChange={(event) => setMinimumPrice(event.target.value)}
              />
            </label>
            <span aria-hidden="true">—</span>
            <label>
              <span className="sr-only">Harga maksimum dalam Rupiah</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="Maks"
                value={maximumPrice}
                onChange={(event) => setMaximumPrice(event.target.value)}
              />
            </label>
          </fieldset>
          <label className="select-control">
            <span className="sr-only">Urutkan produk</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="newest">Terbaru</option>
              <option value="price-asc">Harga terendah</option>
              <option value="price-desc">Harga tertinggi</option>
              <option value="name">Nama A–Z</option>
            </select>
          </label>
        </div>
        {hasInvalidPriceRange ? (
          <p className="form-message" role="alert">
            Masukkan rentang harga yang valid. Harga minimum tidak boleh melebihi harga maksimum.
          </p>
        ) : null}
        <p className="result-count" aria-live="polite">
          {filteredProducts.length} produk ditampilkan
        </p>
        <AnimatePresence mode="wait">
          {filteredProducts.length ? (
            <motion.div
              className="product-grid"
              key={`${category}-${size}-${sort}-${query}-${minimumPrice}-${maximumPrice}`}
              initial={{ y: 8 }}
              animate={{ y: 0 }}
              exit={{ y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {filteredProducts.map((product, index) => (
                <motion.article
                  className="product-card"
                  key={product.code}
                  initial={{ y: 18 }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.2) }}
                >
                  <Link
                    className={`product-image product-image--${product.tone} collection-image`}
                    href={`/koleksi/${encodeURIComponent(product.code)}`}
                    aria-label={`Lihat detail ${product.name}, ${product.code}`}
                  >
                    <img src={product.image} alt={product.imageAlt} loading="lazy" />
                    <span className="product-condition">
                      <span className={product.available ? 'status-dot' : 'status-dot status-dot--sold'} />
                      {product.available ? 'Tersedia' : 'Terjual'}
                    </span>
                    <span className="product-code">{product.code}</span>
                  </Link>
                  <div className="product-info">
                    <div className="product-heading">
                      <div>
                        <p className="eyebrow product-category">{product.category}</p>
                        <h3>
                          <Link href={`/koleksi/${encodeURIComponent(product.code)}`}>{product.name}</Link>
                        </h3>
                      </div>
                      <span className="product-size">{product.size}</span>
                    </div>
                    <p className="product-fit">{product.fit}</p>
                    <p className="product-qc"><ShieldCheck size={14} aria-hidden="true" /> {product.condition}</p>
                    <div className="product-footer">
                      <strong>{formatRupiah(product.price)}</strong>
                      {product.available ? (
                        <Link
                          className="text-link"
                          href={`/koleksi/${encodeURIComponent(product.code)}`}
                          aria-label={`Lihat cara memesan ${product.name}`}
                        >
                          Detail <ArrowRight size={15} aria-hidden="true" />
                        </Link>
                      ) : (
                        <span className="sold-label">Sudah terjual</span>
                      )}
                    </div>
                    {product.available && !product.reserved
                      ? <AddToCartButton product={product} />
                      : null}
                  </div>
                </motion.article>
              ))}
            </motion.div>
          ) : (
            <motion.div
              className="empty-state"
              key="collection-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Search size={22} aria-hidden="true" />
              <h3>{products.length ? 'Tidak ada produk yang cocok.' : 'Koleksi sedang diperbarui.'}</h3>
              <p>
                {products.length
                  ? 'Coba ubah pencarian atau filter untuk melihat pilihan lainnya.'
                  : 'Belum ada produk yang ditampilkan. Silakan kunjungi kembali nanti.'}
              </p>
              {products.length ? (
                <button
                  className="text-link"
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setCategory('Semua kategori')
                    setSize('Semua ukuran')
                    setMinimumPrice('')
                    setMaximumPrice('')
                    setSort('newest')
                  }}
                >
                  Atur ulang filter <ArrowRight size={15} aria-hidden="true" />
                </button>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
        <p className="catalog-footnote">
          <ShieldCheck size={17} aria-hidden="true" />
          <span>Stok dikonfirmasi kembali sebelum pembayaran diproses.</span>
        </p>
      </section>
    </MotionConfig>
  )
}
