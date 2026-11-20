'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { Product } from '@/lib/products'
import {
  addUniqueCartProduct,
  createCartIdempotencyKey,
  getSortedCartCodes,
  parseStoredCart,
  refreshCartProducts,
  sameCartCodes,
  toCartProduct,
  type CartCheckoutAttempt,
  type CartProduct,
  type StoredCart,
} from '@/lib/shopping-cart'

const CART_STORAGE_KEY = 'thrifthub:cart:v1'

type CartContextValue = {
  items: CartProduct[]
  itemCount: number
  hydrated: boolean
  storageError: string
  addProduct: (product: Product) => 'added' | 'duplicate' | 'limit'
  removeProduct: (code: string) => void
  removeProducts: (codes: string[]) => void
  refreshProducts: (products: CartProduct[]) => void
  getCheckoutAttempt: (productCodes: string[]) => CartCheckoutAttempt
  clearCheckoutAttempt: () => void
  clearCart: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

function emptyCart(): StoredCart {
  return { version: 1, items: [], checkoutAttempt: null }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<StoredCart>(emptyCart)
  const [hydrated, setHydrated] = useState(false)
  const [storageError, setStorageError] = useState('')
  const cartRef = useRef(cart)
  const hydratedRef = useRef(false)

  const persist = useCallback((nextCart: StoredCart) => {
    if (!hydratedRef.current) return
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(nextCart))
      setStorageError('')
    } catch {
      setStorageError('Keranjang hanya tersimpan sementara karena penyimpanan browser tidak tersedia.')
    }
  }, [])

  const updateCart = useCallback((nextCart: StoredCart) => {
    cartRef.current = nextCart
    setCart(nextCart)
    persist(nextCart)
  }, [persist])

  useEffect(() => {
    try {
      const { cart: savedCart, invalid } = parseStoredCart(
        window.localStorage.getItem(CART_STORAGE_KEY),
      )
      cartRef.current = savedCart
      // localStorage is only available after the client mounts.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCart(savedCart)
      hydratedRef.current = true
      setHydrated(true)
      if (invalid) {
        window.localStorage.removeItem(CART_STORAGE_KEY)
        setStorageError('Data keranjang yang rusak telah direset. Silakan tambahkan produk kembali.')
      }
    } catch {
      cartRef.current = emptyCart()
      setCart(emptyCart())
      hydratedRef.current = true
      setHydrated(true)
      setStorageError('Penyimpanan browser tidak dapat dibaca. Keranjang hanya tersedia sementara.')
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== CART_STORAGE_KEY) return
      const { cart: nextCart, invalid } = parseStoredCart(event.newValue)
      cartRef.current = nextCart
      setCart(nextCart)
      if (invalid) {
        setStorageError('Data keranjang dari tab lain tidak valid dan telah diabaikan.')
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const addProduct = useCallback((product: Product) => {
    const result = addUniqueCartProduct(cartRef.current.items, toCartProduct(product))
    if (result.result !== 'added') return result.result
    updateCart({
      ...cartRef.current,
      items: result.items,
      checkoutAttempt: null,
    })
    return result.result
  }, [updateCart])

  const removeProduct = useCallback((code: string) => {
    const items = cartRef.current.items.filter((item) => item.code !== code)
    if (items.length === cartRef.current.items.length) return
    updateCart({ version: 1, items, checkoutAttempt: null })
  }, [updateCart])

  const removeProducts = useCallback((codes: string[]) => {
    const purchasedCodes = new Set(codes)
    const items = cartRef.current.items.filter((item) => !purchasedCodes.has(item.code))
    if (items.length === cartRef.current.items.length) return
    updateCart({ version: 1, items, checkoutAttempt: null })
  }, [updateCart])

  const refreshProducts = useCallback((products: CartProduct[]) => {
    const items = refreshCartProducts(cartRef.current.items, products)
    const unchanged = items.every((item, index) => item === cartRef.current.items[index])
    if (!unchanged) updateCart({ ...cartRef.current, items })
  }, [updateCart])

  const getCheckoutAttempt = useCallback((productCodes: string[]) => {
    const sortedCodes = getSortedCartCodes(productCodes)
    if (!sortedCodes.length || sortedCodes.length !== productCodes.length) {
      throw new Error('Daftar produk checkout tidak valid.')
    }
    const currentAttempt = cartRef.current.checkoutAttempt
    if (currentAttempt && sameCartCodes(currentAttempt.productCodes, sortedCodes)) {
      return currentAttempt
    }

    const checkoutAttempt = {
      idempotencyKey: createCartIdempotencyKey(),
      productCodes: sortedCodes,
    }
    updateCart({ ...cartRef.current, checkoutAttempt })
    return checkoutAttempt
  }, [updateCart])

  const clearCheckoutAttempt = useCallback(() => {
    if (!cartRef.current.checkoutAttempt) return
    updateCart({ ...cartRef.current, checkoutAttempt: null })
  }, [updateCart])

  const clearCart = useCallback(() => {
    updateCart(emptyCart())
  }, [updateCart])

  return (
    <CartContext.Provider value={{
      items: cart.items,
      itemCount: hydrated ? cart.items.length : 0,
      hydrated,
      storageError,
      addProduct,
      removeProduct,
      removeProducts,
      refreshProducts,
      getCheckoutAttempt,
      clearCheckoutAttempt,
      clearCart,
    }}>
      {children}
    </CartContext.Provider>
  )
}

export function useShoppingCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useShoppingCart must be used within CartProvider.')
  return context
}
