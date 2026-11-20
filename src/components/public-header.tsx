'use client'

import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import CartLink from '@/components/cart-link'

export default function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  function closeMenu() {
    setMenuOpen(false)
  }

  const isCollectionActive =
    pathname === '/koleksi' ||
    pathname.startsWith('/koleksi/') ||
    pathname.startsWith('/produk/')

  return (
    <header className="site-header">
      <Link className="wordmark" href="/" aria-label="ThriftHub, beranda">
        thrift<span>hub</span><i>.</i>
      </Link>
      <button
        className="menu-toggle"
        type="button"
        aria-label={menuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
        aria-expanded={menuOpen}
        aria-controls="public-navigation"
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
      </button>
      <nav
        id="public-navigation"
        className={menuOpen ? 'main-nav main-nav--open' : 'main-nav'}
        aria-label="Navigasi utama"
      >
        <Link
          className={pathname === '/' ? 'is-active' : undefined}
          href="/"
          aria-current={pathname === '/' ? 'page' : undefined}
          onClick={closeMenu}
        >
          Home
        </Link>
        <Link
          className={isCollectionActive ? 'is-active' : undefined}
          href="/koleksi"
          aria-current={isCollectionActive ? 'page' : undefined}
          onClick={closeMenu}
        >
          Koleksi
        </Link>
        <Link
          className={pathname === '/cerita-kami' ? 'is-active' : undefined}
          href="/cerita-kami"
          aria-current={pathname === '/cerita-kami' ? 'page' : undefined}
          onClick={closeMenu}
        >
          Cerita kami
        </Link>
        <Link
          className={pathname === '/pemasok' ? 'is-active' : undefined}
          href="/pemasok"
          aria-current={pathname === '/pemasok' ? 'page' : undefined}
          onClick={closeMenu}
        >
          Pemasok
        </Link>
        <Link
          className={pathname === '/cara-belanja' ? 'is-active' : undefined}
          href="/cara-belanja"
          aria-current={pathname === '/cara-belanja' ? 'page' : undefined}
          onClick={closeMenu}
        >
          Cara belanja
        </Link>
        <Link
          className={pathname === '/lacak-pesanan' ? 'is-active' : undefined}
          href="/lacak-pesanan"
          aria-current={pathname === '/lacak-pesanan' ? 'page' : undefined}
          onClick={closeMenu}
        >
          Lacak Pesanan
        </Link>
        <CartLink />
      </nav>
    </header>
  )
}
