import { Camera } from 'lucide-react'
import Link from 'next/link'

export default function PublicFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Link className="wordmark" href="/" aria-label="ThriftHub, beranda">
            thrift<span>hub</span><i>.</i>
          </Link>
          <p>Temukan cerita baru dalam setiap pilihan preloved di Makassar.</p>
        </div>
        <nav className="footer-links" aria-label="Tautan footer">
          <div>
            <span>JELAJAHI</span>
            <Link href="/koleksi">Koleksi</Link>
            <Link href="/cerita-kami">Cerita kami</Link>
          </div>
          <div>
            <span>BANTUAN</span>
            <Link href="/cara-belanja">Cara belanja</Link>
            <Link href="/koleksi">Tanya stok</Link>
          </div>
          <div>
            <span>IKUTI CERITA KAMI</span>
            <a href="https://instagram.com" target="_blank" rel="noreferrer">
              <Camera size={15} aria-hidden="true" /> Instagram
            </a>
          </div>
        </nav>
      </div>
      <div className="footer-bottom">
        <span>© 2026 ThriftHub Makassar</span>
        <span>Dibuat dengan hati di Makassar <i>✳</i></span>
      </div>
    </footer>
  )
}
