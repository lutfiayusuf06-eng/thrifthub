'use client'

import {
  AnimatePresence,
  MotionConfig,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion'
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronDown,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState, type PointerEvent } from 'react'
import PublicFooter from '@/components/public-footer'
import PublicHeader from '@/components/public-header'
import AddToCartButton from '@/components/add-to-cart-button'
import { formatRupiah, type Product } from '@/lib/products'

const sizes = ['Semua ukuran', 'S', 'M', 'L', 'XL']

function ProductCard({ product, index }: { product: Product; index: number }) {
  const [isSaved, setIsSaved] = useState(false)
  const pointerX = useMotionValue(0.5)
  const pointerY = useMotionValue(0.5)
  const smoothX = useSpring(pointerX, { stiffness: 180, damping: 22 })
  const smoothY = useSpring(pointerY, { stiffness: 180, damping: 22 })
  const rotateY = useTransform(smoothX, [0, 1], [-7, 7])
  const rotateX = useTransform(smoothY, [0, 1], [6, -6])

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== 'mouse') return
    const bounds = event.currentTarget.getBoundingClientRect()
    pointerX.set((event.clientX - bounds.left) / bounds.width)
    pointerY.set((event.clientY - bounds.top) / bounds.height)
  }

  function resetTilt() {
    pointerX.set(0.5)
    pointerY.set(0.5)
  }

  return (
    <motion.article
      className="product-card"
      initial={{ y: 22 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.48, delay: index * 0.07 }}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
      style={{ rotateX, rotateY, transformPerspective: 1100 }}
    >
      <div className={`product-image product-image--${product.tone}`}>
        <Link className="product-image-link" href={`/koleksi/${encodeURIComponent(product.code)}`} aria-label={`Lihat detail ${product.name}`}>
          <img src={product.image} alt={product.imageAlt} loading="lazy" />
        </Link>
        <span className="product-condition">
          <span className={product.available ? 'status-dot' : 'status-dot status-dot--sold'} />
          {product.available ? 'Siap dipinang' : 'Terjual'}
        </span>
        <span className="product-code">{product.code}</span>
        <button
          className="save-button"
          type="button"
          aria-label={isSaved ? `Hapus ${product.name} dari simpanan` : `Simpan ${product.name}`}
          aria-pressed={isSaved}
          onClick={() => setIsSaved(!isSaved)}
        >
          <Sparkles size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="product-info">
        <div className="product-heading">
          <div>
            <p className="eyebrow product-category">{product.category}</p>
            <h3><Link href={`/koleksi/${encodeURIComponent(product.code)}`}>{product.name}</Link></h3>
          </div>
          <span className="product-size">{product.size}</span>
        </div>
        <p className="product-fit">{product.fit}</p>
        <p className="product-qc">
          <Check size={14} aria-hidden="true" />
          {product.condition}
        </p>
        <details className="product-qc-details">
          <summary>Rincian pemeriksaan</summary>
          <dl>
            <div><dt>Kain</dt><dd>{product.qc.fabric}</dd></div>
            <div><dt>Jahitan</dt><dd>{product.qc.seams}</dd></div>
            <div><dt>Kancing</dt><dd>{product.qc.buttons}</dd></div>
            <div><dt>Ritsleting</dt><dd>{product.qc.zipper}</dd></div>
          </dl>
        </details>
        <div className="product-footer">
          <strong>{formatRupiah(product.price)}</strong>
          {product.available ? (
            <Link
              className="text-link"
              href={`/koleksi/${encodeURIComponent(product.code)}`}
              aria-label={`Lihat detail dan pesan ${product.name}`}
            >
              Detail & pesan <ArrowRight size={15} aria-hidden="true" />
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
  )
}

const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID')
const normalizeSize = (value: string) => value.trim().toLocaleUpperCase('id-ID')

export default function Storefront({ products }: { products: Product[] }) {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('Semua')
  const [activeSize, setActiveSize] = useState('Semua ukuran')
  const [priceRange, setPriceRange] = useState('all')
  const categories = useMemo(() => {
    const uniqueCategories = new Map<string, string>()

    products.forEach((product) => {
      const normalized = normalizeText(product.category)
      if (!uniqueCategories.has(normalized)) {
        uniqueCategories.set(normalized, product.category.trim())
      }
    })

    return ['Semua', ...Array.from(uniqueCategories.values())]
  }, [products])

  const filteredProducts = useMemo(() => {
    const normalizedQuery = normalizeText(query)

    return products.filter((product) => {
      const matchesQuery =
        !normalizedQuery ||
        `${product.name} ${product.category} ${product.code} ${product.condition} ${product.searchTerms.join(' ')}`
          .toLocaleLowerCase('id-ID')
          .includes(normalizedQuery)
      const matchesCategory =
        activeCategory === 'Semua' ||
        normalizeText(product.category) === normalizeText(activeCategory)
      const matchesSize =
        activeSize === 'Semua ukuran' ||
        normalizeSize(product.size) === normalizeSize(activeSize)
      const matchesPrice =
        priceRange === 'all' ||
        (priceRange === 'under-50' && product.price < 50000) ||
        (priceRange === '50-75' && product.price >= 50000 && product.price <= 75000) ||
        (priceRange === 'over-75' && product.price > 75000)

      return matchesQuery && matchesCategory && matchesSize && matchesPrice
    })
  }, [activeCategory, activeSize, priceRange, products, query])

  return (
    <MotionConfig reducedMotion="user">
    <main>
      <div className="announcement">
        <span className="announcement-star">✳</span>
        <p>Preloved, dipilih dengan hati. Temukan hidden gem-mu di Makassar.</p>
        <ArrowRight size={14} aria-hidden="true" />
      </div>

      <PublicHeader />

      <section className="hero-section" id="beranda">
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow">
            <span className="eyebrow-line" /> KURASI PRELOVED · MAKASSAR
          </p>
          <p className="hero-hook">Gaya unikmu punya cerita sendiri.</p>
          <h1>
            Cerita baru,
            <br />
            <em>gaya</em> yang punya masa lalu.
          </h1>
          <p className="hero-description">
            Temukan hidden gem yang terasa seperti kamu: pilihan preloved istimewa,
            diperiksa dengan teliti, dan siap menemani cerita berikutnya.
          </p>
          <div className="hero-actions">
            <a className="button button--gold" href="#koleksi">
              Lihat koleksi <ArrowRight size={16} aria-hidden="true" />
            </a>
            <a className="quiet-link" href="#cerita">
              Kenali ThriftHub <ArrowDown size={14} aria-hidden="true" />
            </a>
          </div>
          <div className="hero-proof">
            <div className="proof-icon"><ShieldCheck size={17} aria-hidden="true" /></div>
            <p><strong>Jujur soal kondisi.</strong><br />Detail barang selalu kami ceritakan.</p>
          </div>
        </div>

        <div className="hero-visual" aria-label="Inspirasi gaya preloved ThriftHub">
          <motion.div
            className="hero-photo hero-photo--back"
            animate={{ y: [0, -12, 0], rotate: [7, 9, 7] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          >
            <img
              src="https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=1000&q=90"
              alt="Inspirasi tampilan busana preloved bernuansa netral"
            />
          </motion.div>
          <motion.div
            className="hero-photo hero-photo--front"
            animate={{ y: [0, 10, 0], rotate: [-5, -3, -5] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
          >
            <img
              src="https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1000&q=90"
              alt="Pilihan outfit kasual untuk gaya sehari-hari"
            />
          </motion.div>
          <motion.div
            className="hero-note"
            initial={{ opacity: 0, scale: 0.85, rotate: 8 }}
            animate={{ opacity: 1, scale: 1, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 150, delay: 0.55 }}
          >
            <span>good finds</span>
            <strong>feel like<br />good stories.</strong>
            <i>✳</i>
          </motion.div>
          <div className="hero-stamp"><span>THRIFT<br />WITH<br />PURPOSE</span><i>✳</i></div>
          <span className="hero-visual-caption">MAKASSAR, INDONESIA · EST. 2026</span>
        </div>
        <div className="hero-bottomline"><span>SCROLL TO DISCOVER</span><span>01 — 04</span></div>
      </section>

      <section className="trust-strip" aria-label="Keunggulan ThriftHub">
        <div><span>01</span><p>Diperiksa satu per satu</p></div>
        <div><span>02</span><p>Detail kondisi transparan</p></div>
        <div><span>03</span><p>Ambil di kampus atau kirim</p></div>
        <div><span>04</span><p>Preloved, bukan kompromi</p></div>
      </section>

      <section className="catalog-section section-wrap" id="koleksi">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><span className="eyebrow-line" /> PILIHAN MINGGU INI</p>
            <h2>Temukan <em>favorit</em> barumu.</h2>
          </div>
          <p className="section-intro">Setiap barang unik, jumlahnya satu. Kalau cocok, jangan tunggu lama.</p>
        </div>
        <div className="catalog-toolbar">
          <div className="category-tabs" role="group" aria-label="Filter kategori">
            {categories.map((category) => (
              <button
                key={category}
                className={activeCategory === category ? 'category-tab is-active' : 'category-tab'}
                type="button"
                aria-pressed={activeCategory === category}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="filter-controls">
            <label className="search-control">
              <Search size={16} aria-hidden="true" />
              <span className="sr-only">Cari produk</span>
              <input
                type="search"
                placeholder="Cari barang..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label className="select-control">
              <SlidersHorizontal size={15} aria-hidden="true" />
              <span className="sr-only">Filter ukuran</span>
              <select value={activeSize} onChange={(event) => setActiveSize(event.target.value)}>
                {sizes.map((size) => <option key={size}>{size}</option>)}
              </select>
              <ChevronDown size={14} aria-hidden="true" />
            </label>
            <label className="select-control price-control">
              <span className="sr-only">Filter rentang harga</span>
              <select value={priceRange} onChange={(event) => setPriceRange(event.target.value)}>
                <option value="all">Semua harga</option>
                <option value="under-50">Di bawah Rp50 rb</option>
                <option value="50-75">Rp50–75 rb</option>
                <option value="over-75">Di atas Rp75 rb</option>
              </select>
              <ChevronDown size={14} aria-hidden="true" />
            </label>
          </div>
        </div>
        <p className="result-count" aria-live="polite">
          {filteredProducts.length
            ? `${filteredProducts.length} barang pilihan · mulai ${formatRupiah(Math.min(...filteredProducts.map((product) => product.price)))}`
            : '0 barang pilihan'}
        </p>
        <AnimatePresence mode="wait">
          {filteredProducts.length ? (
            <motion.div
              className="product-grid"
              key={`${activeCategory}-${activeSize}-${priceRange}-${query}`}
              initial={{ y: 8 }}
              animate={{ y: 0 }}
              exit={{ y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {filteredProducts.map((product, index) => (
                <ProductCard key={product.code} product={product} index={index} />
              ))}
            </motion.div>
          ) : (
            <motion.div
              className="empty-state"
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Search size={22} aria-hidden="true" />
              <h3>Belum ada yang cocok.</h3>
              <p>Coba kata pencarian atau filter lain, ya.</p>
              <button
                className="text-link"
                type="button"
                onClick={() => {
                  setQuery('')
                  setActiveCategory('Semua')
                  setActiveSize('Semua ukuran')
                  setPriceRange('all')
                }}
              >
                Reset filter <ArrowRight size={15} aria-hidden="true" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="catalog-footnote">
          <ShieldCheck size={17} aria-hidden="true" />
          <p>Foto, ukuran, dan kondisi aktual kami konfirmasi kembali sebelum pesanan diproses.</p>
        </div>
      </section>

      <section className="story-section" id="cerita">
        <div className="story-image">
          <img
            src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=90"
            alt="Inspirasi gaya fashion berkelanjutan"
            loading="lazy"
          />
          <span className="story-image-tag">BAGIAN DARI PERJALANAN BARU</span>
        </div>
        <div className="story-copy">
          <p className="eyebrow"><span className="eyebrow-line" /> KENALAN DENGAN KAMI</p>
          <h2>Lebih dari sekadar baju <em>bekas.</em></h2>
          <p>ThriftHub lahir dari ide sederhana: barang yang masih baik layak mendapat cerita baru. Kami memilih, memeriksa, dan menjelaskan setiap detailnya supaya kamu bisa belanja dengan tenang.</p>
          <a className="text-link" href="#cara-beli">
            Belanja dengan lebih sadar <ArrowRight size={15} aria-hidden="true" />
          </a>
          <div className="story-stat"><strong>01</strong><span>barang unik untuk<br />cerita yang berbeda</span><i>✳</i></div>
        </div>
      </section>

      <section className="buying-section section-wrap" id="cara-beli">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><span className="eyebrow-line" /> BELANJA TANPA RAGU</p>
            <h2>Gampang dari awal <em>sampai jadi milikmu.</em></h2>
          </div>
          <p className="section-intro">Kamu pilih, kami cek stoknya, lalu tentukan cara menerima barang.</p>
        </div>
        <div className="buying-steps">
          <article><span>01</span><h3>Pilih barang</h3><p>Lihat ukuran, detail ukur, dan catatan kondisi sebelum bertanya.</p></article>
          <article><span>02</span><h3>Pesan produk</h3><p>Pesanan transfer menahan stok selama 15 menit; pesanan COD menahan stok sampai pembayaran dikonfirmasi. Pembayaran belum lunas sebelum dikonfirmasi.</p></article>
          <article><span>03</span><h3>Atur penerimaan</h3><p>Setelah pembayaran terkonfirmasi, atur pengambilan atau pengiriman bersama tim.</p></article>
        </div>
      </section>

      <section className="newsletter-banner">
        <div className="banner-star">✳</div>
        <p className="eyebrow">GOOD THINGS DON’T STAY LONG</p>
        <h2>Barang bagus. Cerita baru.<br /><em>Giliranmu.</em></h2>
        <a
          className="button button--light"
          href="#koleksi"
        >
          Jelajahi koleksi <ArrowRight size={16} aria-hidden="true" />
        </a>
        <div className="banner-orbit banner-orbit--one" />
        <div className="banner-orbit banner-orbit--two" />
      </section>

      <PublicFooter />
    </main>
    </MotionConfig>
  )
}
