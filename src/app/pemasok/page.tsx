import type { Metadata } from 'next'
import {
  Banknote,
  MapPin,
  Package,
  Scale,
  Shirt,
  ShoppingBag,
  Store,
  Truck,
} from 'lucide-react'
import PublicFooter from '@/components/public-footer'
import PublicHeader from '@/components/public-header'

export const metadata: Metadata = {
  title: 'Pemasok',
  description:
    'Informasi Gudang Ball BangBeb, pemasok pakaian thrift grosir dan ketentuan penjualan ball.',
  openGraph: {
    title: 'Pemasok | ThriftHub Makassar',
    description:
      'Kenali informasi ball, kisaran harga, dan wilayah layanan COD pemasok pakaian thrift.',
  },
}

const supplierDetails = [
  { icon: Package, label: 'Bentuk penjualan', value: 'Ball besar' },
  { icon: Scale, label: 'Berat per ball', value: 'Sekitar 80–100 kg' },
  { icon: Banknote, label: 'Kisaran harga', value: 'Mulai dari Rp3 jutaan' },
  { icon: ShoppingBag, label: 'Penjualan satuan', value: 'Tidak tersedia' },
  { icon: Store, label: 'Paket usaha', value: 'Tidak tersedia' },
  { icon: Shirt, label: 'Sistem isi ball', value: 'Satu jenis pakaian' },
]

const supplierSummary = [
  { icon: Store, label: 'Nama pemasok', value: 'Gudang Ball BangBeb' },
  { icon: Package, label: 'Jenis penjualan', value: 'Pakaian thrift grosir · ball besar' },
  { icon: Scale, label: 'Berat ball', value: 'Sekitar 80–100 kg' },
  { icon: Banknote, label: 'Kisaran harga', value: 'Mulai dari Rp3 jutaan' },
  { icon: Shirt, label: 'Isi ball', value: 'Satu ball = satu jenis pakaian' },
  {
    icon: MapPin,
    label: 'Wilayah COD',
    value: 'Jabodetabek, Jawa Barat, Jawa Tengah, dan sebagian Jawa Timur',
  },
]

const codRegions = [
  'Jabodetabek',
  'Jawa Barat',
  'Jawa Tengah',
  'Sebagian wilayah Jawa Timur',
]

export default function SupplierPage() {
  return (
    <>
      <PublicHeader />
      <main className="editorial-page supplier-page">
        <section className="editorial-hero supplier-hero">
          <p className="eyebrow"><span className="eyebrow-line" /> SUMBER PILIHAN THRIFTHUB</p>
          <h1>Mengenal <em>Pemasok Kami</em></h1>
          <p>
            ThriftHub menyediakan pakaian thrift pilihan melalui pemasok yang bergerak di
            bidang penjualan pakaian thrift grosir. Halaman ini memberikan informasi mengenai
            pemasok dan sistem penyediaan pakaian yang menjadi salah satu sumber produk ThriftHub.
          </p>
        </section>

        <section className="supplier-profile section-wrap" aria-labelledby="supplier-profile-title">
          <div className="supplier-profile-card">
            <div className="supplier-profile-mark" aria-hidden="true">
              <Store size={34} strokeWidth={1.4} />
              <span>PEMASOK THRIFT</span>
            </div>
            <div className="supplier-profile-copy">
              <p className="eyebrow"><span className="eyebrow-line" /> PROFIL PEMASOK</p>
              <h2 id="supplier-profile-title">Gudang Ball BangBeb</h2>
              <p className="supplier-category">Pemasok pakaian thrift grosir</p>
              <p>
                Gudang Ball BangBeb merupakan pemasok pakaian thrift yang menyediakan produk
                dalam bentuk ball besar. Pemasok menawarkan pembelian grosir dengan berat sekitar
                80–100 kg per ball.
              </p>
            </div>
          </div>
        </section>

        <section className="supplier-details section-wrap" aria-labelledby="supplier-details-title">
          <div className="supplier-section-heading">
            <p className="eyebrow"><span className="eyebrow-line" /> INFORMASI PENJUALAN</p>
            <h2 id="supplier-details-title">Ketahui sistem <em>penyediaannya.</em></h2>
          </div>
          <div className="supplier-detail-grid">
            {supplierDetails.map(({ icon: Icon, label, value }) => (
              <article className="supplier-detail-card" key={label}>
                <span className="supplier-detail-icon"><Icon size={20} aria-hidden="true" /></span>
                <p>{label}</p>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="supplier-ball-note" aria-labelledby="supplier-ball-title">
          <div className="supplier-ball-icon" aria-hidden="true"><Shirt size={25} /></div>
          <p className="eyebrow">KETENTUAN ISI BALL</p>
          <h2 id="supplier-ball-title">SATU BALL <span>=</span> SATU JENIS PAKAIAN</h2>
          <p>
            Setiap ball hanya berisi satu jenis pakaian dan bukan campuran beberapa kategori
            pakaian. Dengan demikian, pembelian dilakukan berdasarkan jenis pakaian yang tersedia.
          </p>
        </section>

        <section className="supplier-delivery section-wrap" aria-labelledby="supplier-delivery-title">
          <div className="supplier-delivery-copy">
            <p className="eyebrow"><span className="eyebrow-line" /> INFORMASI PENGIRIMAN</p>
            <h2 id="supplier-delivery-title">Wilayah layanan <em>COD.</em></h2>
            <p>
              Layanan COD hanya tersedia untuk wilayah yang disebutkan oleh pemasok. Ketersediaan
              pengiriman dan ketentuan pemesanan perlu dikonfirmasi langsung kepada pemasok.
            </p>
          </div>
          <div className="supplier-regions">
            <h3><Truck size={18} aria-hidden="true" /> Wilayah yang dilayani</h3>
            <ul>
              {codRegions.map((region) => (
                <li key={region}><MapPin size={15} aria-hidden="true" /> {region}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="supplier-summary" aria-labelledby="supplier-summary-title">
          <div className="section-wrap">
            <div className="supplier-section-heading">
              <p className="eyebrow"><span className="eyebrow-line" /> RINGKASAN</p>
              <h2 id="supplier-summary-title">Ringkasan informasi <em>pemasok.</em></h2>
            </div>
            <dl className="supplier-summary-grid">
              {supplierSummary.map(({ icon: Icon, label, value }) => (
                <div className="supplier-summary-item" key={label}>
                  <dt><Icon size={17} aria-hidden="true" /> {label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  )
}
