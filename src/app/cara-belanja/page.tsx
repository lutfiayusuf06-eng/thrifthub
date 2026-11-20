import type { Metadata } from 'next'
import { ArrowRight, CheckCircle2, Clock3, PackageCheck, Truck } from 'lucide-react'
import Link from 'next/link'
import PublicFooter from '@/components/public-footer'
import PublicHeader from '@/components/public-header'

export const metadata: Metadata = {
  title: 'Cara Belanja',
  description:
    'Panduan berbelanja pakaian preloved di ThriftHub: pilih produk, buat pesanan, selesaikan konfirmasi pembayaran, lalu ambil atau kirim.',
  openGraph: {
    title: 'Cara Belanja | ThriftHub Makassar',
    description: 'Ikuti langkah pemesanan pakaian preloved di ThriftHub Makassar.',
  },
}

const steps = [
  {
    number: '01',
    title: 'Pilih produk dengan teliti',
    description:
      'Buka koleksi dan periksa foto, kode produk, ukuran, pengukuran aktual, catatan kondisi, serta hasil pemeriksaan kualitas.',
    icon: PackageCheck,
  },
  {
    number: '02',
    title: 'Pesan produk',
    description:
      'Buat pesanan dari detail produk. Produk ditahan selama 15 menit dan pesanan berstatus menunggu pembayaran.',
    icon: Clock3,
  },
  {
    number: '03',
    title: 'Sepakati pembayaran',
    description:
      'Tim Keuangan akan mengonfirmasi pembayaran. Pesanan baru belum berarti pembayaran berhasil.',
    icon: CheckCircle2,
  },
  {
    number: '04',
    title: 'Pilih pengambilan atau pengiriman',
    description:
      'Atur pengambilan langsung di sekitar kampus atau sepakati ekspedisi, alamat, dan ongkos kirim bersama tim.',
    icon: Truck,
  },
]

export default function HowToShopPage() {
  return (
    <>
      <PublicHeader />
      <main className="editorial-page">
        <section className="editorial-hero shopping-hero">
          <p className="eyebrow"><span className="eyebrow-line" /> PANDUAN PEMBELI</p>
          <h1>Temukan barangmu, <em>tanpa terburu-buru.</em></h1>
          <p>
            Setiap pakaian punya detail yang berbeda. Ikuti langkah berikut agar kondisi,
            ketersediaan, dan cara penerimaan barang jelas sebelum pesanan diproses.
          </p>
          <Link className="button button--gold" href="/koleksi">
            Mulai dari koleksi <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
        <section className="shopping-steps section-wrap" aria-label="Langkah berbelanja">
          {steps.map(({ number, title, description, icon: Icon }) => (
            <article className="shopping-step" key={number}>
              <div className="shopping-step-top">
                <span>{number}</span>
                <Icon size={20} aria-hidden="true" />
              </div>
              <h2>{title}</h2>
              <p>{description}</p>
            </article>
          ))}
        </section>
        <section className="shopping-note">
          <p className="eyebrow">PENTING</p>
          <h2>Pesanan menahan stok sementara.</h2>
          <p>
            Produk unik ditahan selama 15 menit setelah pesanan dibuat. Selesaikan proses
            pembayaran dalam batas waktu tersebut; status lunas hanya berubah setelah
            pembayaran dikonfirmasi oleh tim.
            Pengiriman belum terhubung dengan pelacakan otomatis ekspedisi.
          </p>
        </section>
      </main>
      <PublicFooter />
    </>
  )
}
