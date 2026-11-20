'use client'

import Link from 'next/link'
import { RefreshCw } from 'lucide-react'

export default function PublicError({ reset }: { reset: () => void }) {
  return (
    <main className="public-error" role="alert">
      <p className="eyebrow">THRIFTHUB · MAKASSAR</p>
      <h1>Halaman belum dapat dimuat.</h1>
      <p>Terjadi kendala saat menyiapkan halaman. Coba lagi atau kembali ke beranda.</p>
      <div className="public-error-actions">
        <button className="button button--gold" type="button" onClick={reset}>
          Coba lagi <RefreshCw size={15} aria-hidden="true" />
        </button>
        <Link className="text-link" href="/">Kembali ke beranda</Link>
      </div>
    </main>
  )
}
