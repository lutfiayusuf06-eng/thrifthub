'use client'

import { RefreshCw } from 'lucide-react'
import PublicFooter from '@/components/public-footer'
import PublicHeader from '@/components/public-header'

export default function CollectionError({ reset }: { reset: () => void }) {
  return (
    <>
      <PublicHeader />
      <main className="public-error" role="alert">
        <p className="eyebrow">KOLEKSI BELUM DAPAT DIMUAT</p>
        <h1>Maaf, ada kendala saat menghubungkan katalog.</h1>
        <p>Silakan coba lagi. Jika masalah berlanjut, hubungi tim ThriftHub untuk mengecek ketersediaan produk.</p>
        <button className="button button--gold" type="button" onClick={reset}>
          Coba lagi <RefreshCw size={15} aria-hidden="true" />
        </button>
      </main>
      <PublicFooter />
    </>
  )
}
