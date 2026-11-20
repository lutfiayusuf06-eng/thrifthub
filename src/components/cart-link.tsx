'use client'

import { ShoppingBag } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useShoppingCart } from '@/components/cart-provider'

export default function CartLink() {
  const pathname = usePathname()
  const { itemCount } = useShoppingCart()
  const active = pathname === '/keranjang'

  return (
    <Link
      className={`cart-nav-link${active ? ' is-active' : ''}`}
      href="/keranjang"
      aria-current={active ? 'page' : undefined}
      aria-label={`Keranjang belanja, ${itemCount} barang`}
    >
      <ShoppingBag size={16} aria-hidden="true" />
      <span>Keranjang</span>
      <span className="cart-nav-count" aria-hidden="true">{itemCount}</span>
    </Link>
  )
}
