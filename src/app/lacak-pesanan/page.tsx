import type { Metadata } from 'next'
import PublicFooter from '@/components/public-footer'
import PublicHeader from '@/components/public-header'
import TrackingForm from './tracking-form'

export const metadata: Metadata = {
  title: 'Lacak Pesanan',
  description: 'Lacak status pengiriman pesanan ThriftHub dengan kode pesanan dan nomor WhatsApp.',
  robots: { index: false, follow: false },
}

export default function OrderTrackingPage() {
  return (
    <>
      <PublicHeader />
      <main className="order-tracking-page">
        <div className="order-tracking-content">
          <p className="eyebrow"><span className="eyebrow-line" /> PENGIRIMAN THRIFTHUB · MAKASSAR</p>
          <h1>Lacak pesananmu.</h1>
          <p className="order-tracking-intro">
            Masukkan kode pesanan dan nomor WhatsApp yang digunakan saat checkout.
            Tidak perlu masuk atau membuat akun.
          </p>
          <TrackingForm />
        </div>
      </main>
      <PublicFooter />
    </>
  )
}
