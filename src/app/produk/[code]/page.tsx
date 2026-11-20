import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from 'lucide-react'
import { formatRupiah } from '@/lib/products'
import { getPublicProduct } from '@/lib/product-repository'
import ProductOrderButton from './product-order-button'
import AddToCartButton from '@/components/add-to-cart-button'
import CartLink from '@/components/cart-link'

type ProductPageProps = {
  params: Promise<{ code: string }>
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { code } = await params
  const product = await getPublicProduct(code)

  if (!product) return { title: 'Produk tidak ditemukan' }

  const stockCopy = product.reserved
    ? 'Pesanan sedang ditahan sementara.'
    : 'Stok tersedia untuk dipesan.'
  const description = `${product.name}, pakaian preloved ${product.category.toLowerCase()} ukuran ${product.size}. ${product.condition}. ${stockCopy} ThriftHub Makassar.`

  return {
    title: `${product.name} — ${product.code}`,
    description,
    keywords: [
      'thrift shop Makassar',
      'pakaian preloved mahasiswa UNM',
      product.name,
      product.category,
      product.size,
    ],
    openGraph: {
      type: 'website',
      title: `${product.name} | ThriftHub Makassar`,
      description,
      images: [{ url: product.image, alt: product.imageAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${product.name} | ThriftHub Makassar`,
      description,
      images: [product.image],
    },
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { code } = await params
  const product = await getPublicProduct(code)

  if (!product) notFound()

  const stockCopy = product.reserved
    ? 'Produk sedang ditahan sementara untuk pesanan lain.'
    : 'Pesanan transfer menahan stok selama 15 menit; pesanan COD menahan stok sampai pembayaran dikonfirmasi. Pembayaran belum lunas sebelum diterima.'
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    sku: product.code,
    category: product.category,
    image: product.image,
    description: `${product.condition}. ${product.fit}. ${stockCopy}`,
    size: product.size,
    itemCondition: 'https://schema.org/UsedCondition',
    offers: {
      '@type': 'Offer',
      priceCurrency: 'IDR',
      price: product.price,
      availability: product.available && !product.reserved
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/UsedCondition',
      seller: {
        '@type': 'Organization',
        name: 'ThriftHub',
        areaServed: 'Makassar, Sulawesi Selatan',
      },
    },
  }
  const safeStructuredData = JSON.stringify(structuredData).replace(/</g, '\\u003c')

  return (
    <main className="product-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeStructuredData }}
      />
      <header className="product-page-header">
        <Link className="wordmark" href="/" aria-label="ThriftHub, kembali ke koleksi">
          thrift<span>hub</span><i>.</i>
        </Link>
        <Link className="back-link" href="/koleksi">
          <ArrowLeft size={15} aria-hidden="true" /> Kembali ke koleksi
        </Link>
        <CartLink />
      </header>
      <section className="product-detail">
        <div className={`detail-image product-image--${product.tone}`}>
          <img src={product.image} alt={product.imageAlt} />
          <span className="product-code">{product.code}</span>
        </div>
        <div className="detail-copy">
          <p className="eyebrow"><span className="eyebrow-line" /> {product.category.toUpperCase()} · MAKASSAR</p>
          <h1>{product.name}</h1>
          <p className="detail-price">{formatRupiah(product.price)}</p>
          <div className="detail-stock">
            <span className={product.reserved ? 'status-dot status-dot--reserved' : 'status-dot'} />
            {product.reserved ? 'Sedang dipesan' : 'Tersedia'}
          </div>
          <p className="detail-description">
            Pakaian preloved terpilih dengan informasi ukuran dan kondisi yang kami sampaikan apa adanya.
            Pesanan transfer menahan stok selama 15 menit; pesanan COD menahan stok sampai pembayaran dikonfirmasi. Pembayaran belum lunas sebelum dikonfirmasi.
          </p>
          <div className="detail-facts">
            <div><span>Kode produk</span><strong>{product.code}</strong></div>
            <div><span>Ukuran</span><strong>{product.size}</strong></div>
            <div><span>Detail ukuran</span><strong>{product.fit}</strong></div>
            <div><span>Kondisi</span><strong>{product.condition}</strong></div>
          </div>
          <div className="detail-qc">
            <h2><ShieldCheck size={17} aria-hidden="true" /> Hasil pemeriksaan</h2>
            <ul>
              <li><Check size={14} aria-hidden="true" /><span><strong>Kain</strong>{product.qc.fabric}</span></li>
              <li><Check size={14} aria-hidden="true" /><span><strong>Jahitan</strong>{product.qc.seams}</span></li>
              <li><Check size={14} aria-hidden="true" /><span><strong>Kancing</strong>{product.qc.buttons}</span></li>
              <li><Check size={14} aria-hidden="true" /><span><strong>Ritsleting</strong>{product.qc.zipper}</span></li>
            </ul>
          </div>
          <ProductOrderButton productCode={product.code} disabled={Boolean(product.reserved)} />
          {product.available && !product.reserved
            ? <AddToCartButton product={product} />
            : null}
          <p className="detail-delivery">
            Pengantaran hanya untuk Kota Makassar dengan ongkir tetap Rp5.000. Total biaya ditampilkan saat checkout.
          </p>
        </div>
      </section>
      <footer className="detail-footer">
        <span>© 2026 ThriftHub Makassar</span>
        <Link href="/koleksi">Lihat pilihan lainnya <ArrowRight size={14} aria-hidden="true" /></Link>
      </footer>
    </main>
  )
}
