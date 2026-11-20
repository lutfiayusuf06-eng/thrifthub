import type { Metadata } from 'next'
import { ArrowRight, Check, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import PublicFooter from '@/components/public-footer'
import PublicHeader from '@/components/public-header'

export const metadata: Metadata = {
  title: 'Cerita Kami',
  description:
    'Kenali ThriftHub, platform pakaian preloved Makassar yang mengutamakan kurasi dan informasi kondisi produk secara jujur.',
  openGraph: {
    title: 'Cerita Kami | ThriftHub Makassar',
    description: 'Mengenal misi, komitmen kualitas, dan cerita ThriftHub di Makassar.',
  },
}

export default function OurStoryPage() {
  return (
    <>
      <PublicHeader />
      <main className="editorial-page">
        <section className="editorial-hero story-hero">
          <p className="eyebrow"><span className="eyebrow-line" /> CERITA THRIFTHUB · MAKASSAR</p>
          <h1>Barang baik layak mendapat <em>cerita baru.</em></h1>
          <p>
            ThriftHub adalah proyek usaha mahasiswa Teknik Komputer, Jurusan Teknik Informatika
            dan Komputer, Universitas Negeri Makassar, untuk menghadirkan pilihan pakaian
            preloved yang mudah dijelajahi dan informasinya terbuka.
          </p>
          <Link className="button button--gold" href="/koleksi">
            Jelajahi koleksi <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
        <section className="editorial-story-grid">
          <div className="editorial-image">
            <img
              src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=90"
              alt="Inspirasi gaya pakaian yang dapat digunakan kembali"
              loading="lazy"
            />
            <span className="story-image-tag">PILIHAN PRELOVED · MAKASSAR</span>
          </div>
          <div className="editorial-copy">
            <p className="eyebrow"><span className="eyebrow-line" /> VISI KAMI</p>
            <h2>Belanja preloved yang terasa lebih <em>percaya diri.</em></h2>
            <p>
              Menjadi platform pilihan untuk menemukan pakaian preloved yang terkurasi,
              terjangkau, dan disampaikan dengan jujur bagi mahasiswa serta masyarakat Makassar.
            </p>
          </div>
        </section>
        <section className="editorial-mission section-wrap">
          <div>
            <p className="eyebrow"><span className="eyebrow-line" /> MISI KAMI</p>
            <h2>Lebih mudah memilih, lebih jelas informasinya.</h2>
          </div>
          <ul>
            <li><Check size={17} aria-hidden="true" /> Mengumpulkan pilihan pakaian preloved dalam satu katalog yang mudah dicari.</li>
            <li><Check size={17} aria-hidden="true" /> Menyampaikan ukuran, kondisi, dan ketersediaan produk secara transparan.</li>
            <li><Check size={17} aria-hidden="true" /> Mengonfirmasi stok sebelum pembayaran dan membantu pembeli memilih cara menerima barang.</li>
          </ul>
        </section>
        <section className="quality-promise">
          <div className="quality-promise-icon"><ShieldCheck size={22} aria-hidden="true" /></div>
          <p className="eyebrow">KOMITMEN KUALITAS</p>
          <h2>Setiap detail penting.</h2>
          <p>
            Produk yang tercantum diperiksa pada bagian kain, jahitan, kancing, dan ritsleting.
            Catatan kondisi dan pembersihan diisi oleh pengelola; kekurangan yang diketahui
            disampaikan apa adanya pada detail produk. Ketersediaan akhir tetap dikonfirmasi
            oleh tim sebelum pembayaran.
          </p>
        </section>
        <section className="makassar-note section-wrap">
          <div>
            <p className="eyebrow"><span className="eyebrow-line" /> BERAWAL DI MAKASSAR</p>
            <h2>Dibuat dekat dengan keseharian kampus.</h2>
          </div>
          <p>
            ThriftHub dikembangkan untuk mahasiswa di lingkungan UNM dan masyarakat umum di
            Kota Makassar, dengan pilihan pengambilan langsung di sekitar kampus atau pengiriman
            melalui ekspedisi sesuai kesepakatan.
          </p>
        </section>
      </main>
      <PublicFooter />
    </>
  )
}
