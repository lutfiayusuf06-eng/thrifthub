import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import PublicFooter from '@/components/public-footer'
import PublicHeader from '@/components/public-header'
import CollectionExplorer from './collection-explorer'
import { getPublicProducts } from '@/lib/product-repository'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Koleksi Pakaian Preloved',
  description:
    'Jelajahi koleksi baju thrift dan pakaian preloved terkurasi di Makassar. Cari berdasarkan nama, kode, kategori, ukuran, harga, dan status ketersediaan.',
  keywords: [
    'thrift shop Makassar',
    'pakaian preloved mahasiswa UNM',
    'baju thrift murah berkualitas',
    'fashion preloved terjangkau',
  ],
  openGraph: {
    title: 'Koleksi Pakaian Preloved | ThriftHub Makassar',
    description:
      'Cari pakaian preloved ThriftHub berdasarkan kategori, ukuran, harga, dan ketersediaan.',
  },
}

export default async function CollectionPage() {
  const products = await getPublicProducts()

  return (
    <>
      <PublicHeader />
      <main className="public-content">
        <section className="public-page-hero">
          <p className="eyebrow"><span className="eyebrow-line" /> KURASI PRELOVED · MAKASSAR</p>
          <h1>Temukan <em>cerita baru.</em></h1>
          <p>
            Telusuri pilihan pakaian preloved dengan informasi kondisi dan ukuran
            yang disampaikan secara transparan.
          </p>
          <Link className="text-link" href="/cara-belanja">
            Pelajari cara belanja <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </section>
        <CollectionExplorer products={products} />
      </main>
      <PublicFooter />
    </>
  )
}
