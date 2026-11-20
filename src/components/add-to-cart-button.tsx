'use client'

import { useEffect, useRef, useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import type { Product } from '@/lib/products'
import { useShoppingCart } from '@/components/cart-provider'

export default function AddToCartButton({
  product,
  disabled = false,
}: {
  product: Product
  disabled?: boolean
}) {
  const { addProduct } = useShoppingCart()
  const [message, setMessage] = useState('')
  const timer = useRef<number | null>(null)

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
  }, [])

  function addToCart() {
    const result = addProduct(product)
    setMessage(result === 'added'
      ? `${product.name} berhasil ditambahkan ke keranjang.`
      : result === 'duplicate'
        ? `${product.name} sudah ada di keranjang.`
        : 'Keranjang sudah mencapai batas 30 produk.')
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMessage(''), 3500)
  }

  return (
    <div className="add-to-cart-control">
      <button
        className="button button--cart"
        type="button"
        disabled={disabled}
        onClick={addToCart}
      >
        <ShoppingBag size={15} aria-hidden="true" />
        Tambah ke Keranjang
      </button>
      {message ? <span className="cart-add-message" role="status">{message}</span> : null}
    </div>
  )
}
