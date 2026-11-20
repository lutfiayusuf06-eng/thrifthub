'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, RefreshCw, ShoppingBag, Trash2 } from 'lucide-react'
import Link from 'next/link'
import PublicCheckoutForm from '@/components/public-checkout-form'
import { useShoppingCart } from '@/components/cart-provider'
import {
  parsePublicProductsResponse,
  type CartProduct,
} from '@/lib/shopping-cart'
import { formatRupiah } from '@/lib/products'

function getErrorMessage(payload: unknown) {
  return typeof payload === 'object' && payload !== null &&
    'error' in payload && typeof payload.error === 'string'
    ? payload.error
    : 'Data produk tidak dapat diperbarui.'
}

export default function CartView({ deliveryFee }: { deliveryFee: number }) {
  const {
    items,
    hydrated,
    storageError,
    removeProduct,
    removeProducts,
    clearCheckoutAttempt,
    refreshProducts: updateCartProducts,
  } = useShoppingCart()
  const [currentProducts, setCurrentProducts] = useState<CartProduct[]>([])
  const [productsLoaded, setProductsLoaded] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const productsByCode = useMemo(
    () => new Map(currentProducts.map((product) => [product.code, product])),
    [currentProducts],
  )
  const availableItems = useMemo(
    () => items.filter((item) => productsByCode.has(item.code)),
    [items, productsByCode],
  )
  const unavailableItems = productsLoaded
    ? items.filter((item) => !productsByCode.has(item.code))
    : []
  const subtotal = availableItems.reduce(
    (sum, item) => sum + (productsByCode.get(item.code)?.price ?? 0),
    0,
  )

  const refreshProducts = useCallback(async () => {
    setLoadingProducts(true)
    setRefreshError('')
    try {
      const response = await fetch('/api/products', {
        cache: 'no-store',
      })
      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        throw new Error('Server mengirim data produk yang tidak valid.')
      }
      if (!response.ok) throw new Error(getErrorMessage(payload))
      const parsed = parsePublicProductsResponse(payload)
      if (!parsed.success) {
        throw new Error('Server mengirim data produk dengan format yang tidak dikenal.')
      }
      const availableProducts = parsed.data.products
        .filter((product) => product.available && !product.reserved)
        .map((product) => ({
          code: product.code,
          name: product.name,
          image: product.image,
          imageAlt: product.imageAlt,
          size: product.size,
          condition: product.condition,
          productColor: product.productColor,
          price: product.price,
        }))
      setCurrentProducts(availableProducts)
      updateCartProducts(availableProducts)
      setProductsLoaded(true)
    } catch (caught) {
      setRefreshError(caught instanceof Error
        ? caught.message
        : 'Data produk tidak dapat diperbarui.')
    } finally {
      setLoadingProducts(false)
    }
  }, [updateCartProducts])

  useEffect(() => {
    // Load server-verified availability after the client mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshProducts()
  }, [refreshProducts])

  function handleOrderCreated(order: {
    status: 'pending' | 'paid' | 'cancelled' | 'expired'
    items: Array<{ productCode: string }>
  }) {
    if (order.status === 'expired' || order.status === 'cancelled') {
      clearCheckoutAttempt()
      return
    }
    removeProducts(order.items.map((item) => item.productCode))
  }

  const checkoutDisabled = !hydrated ||
    loadingProducts ||
    !productsLoaded ||
    Boolean(refreshError) ||
    unavailableItems.length > 0 ||
    !items.length

  return (
    <main className="public-content cart-content">
      <section className="public-page-hero cart-hero">
        <p className="eyebrow"><span className="eyebrow-line" /> PILIHANMU · THRIFTHUB</p>
        <h1>Keranjang <em>belanja.</em></h1>
        <p>Setiap pakaian adalah barang unik. Stok baru ditahan setelah pesanan berhasil dibuat.</p>
      </section>

      <section className="cart-section section-wrap" aria-label="Isi keranjang belanja">
        {storageError ? <p className="form-message" role="alert">{storageError}</p> : null}
        {refreshError ? (
          <div className="cart-error" role="alert">
            <p>{refreshError}</p>
            <button className="text-link" type="button" onClick={() => void refreshProducts()}>
              Coba perbarui lagi <RefreshCw size={14} aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {!hydrated ? (
          <p className="cart-loading">Memuat keranjang...</p>
        ) : (
          <div className={`cart-layout${items.length ? '' : ' cart-layout--empty'}`}>
            <div className="cart-main">
              {items.length ? (
                <>
                  <div className="cart-heading">
                    <h2>{items.length} barang di keranjang</h2>
                    <button
                      className="text-link cart-refresh"
                      type="button"
                      disabled={loadingProducts}
                      onClick={() => void refreshProducts()}
                    >
                      {loadingProducts ? 'Memeriksa stok...' : 'Perbarui stok'}
                      <RefreshCw size={14} aria-hidden="true" />
                    </button>
                  </div>

                  {unavailableItems.length ? (
                    <p className="cart-unavailable-warning" role="alert">
                      {unavailableItems.length === 1
                        ? 'Satu barang sudah tidak tersedia.'
                        : `${unavailableItems.length} barang sudah tidak tersedia.`}
                      Hapus barang tersebut atau perbarui keranjang sebelum checkout.
                    </p>
                  ) : null}

                  <ul className="cart-items">
                    {items.map((item) => {
                      const currentProduct = productsByCode.get(item.code)
                      const product = currentProduct ?? item
                      const available = Boolean(currentProduct)
                      return (
                        <li className={`cart-item${available ? '' : ' cart-item--unavailable'}`} key={item.code}>
                          <img src={product.image} alt={product.imageAlt} />
                          <div className="cart-item-details">
                            <p className="eyebrow">{product.code}</p>
                            <h3>{product.name}</h3>
                            <dl>
                              <div><dt>Ukuran</dt><dd>{product.size}</dd></div>
                              <div><dt>Kondisi</dt><dd>{product.condition}</dd></div>
                              <div><dt>Warna</dt><dd>{product.productColor || 'Belum dicatat'}</dd></div>
                            </dl>
                            {!available ? (
                              <p className="cart-item-warning">Tidak tersedia untuk checkout</p>
                            ) : null}
                            <strong>{formatRupiah(product.price)}</strong>
                          </div>
                          <button
                            className="cart-remove-button"
                            type="button"
                            aria-label={`Hapus ${product.name} dari keranjang`}
                            disabled={checkoutBusy}
                            onClick={() => removeProduct(item.code)}
                          >
                            <Trash2 size={16} aria-hidden="true" />
                            <span>Hapus</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </>
              ) : (
                <div className="cart-empty">
                  <ShoppingBag size={26} aria-hidden="true" />
                  <h2>Keranjangmu masih kosong.</h2>
                  <p>Temukan pakaian unik yang cocok untuk cerita barumu.</p>
                  <Link className="button button--gold" href="/koleksi">
                    Lanjutkan Belanja <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              )}
            </div>
            <aside className="cart-summary" aria-label="Ringkasan belanja">
              {items.length ? (
                <>
                  <h2>Ringkasan</h2>
                  <dl>
                    <div><dt>Jumlah barang</dt><dd>{items.length}</dd></div>
                    <div><dt>Subtotal barang tersedia</dt><dd>{formatRupiah(subtotal)}</dd></div>
                    <div><dt>Ongkir, satu kali per pesanan</dt><dd>{formatRupiah(deliveryFee)}</dd></div>
                  </dl>
                  <div className="cart-summary-total">
                    <span>{unavailableItems.length ? 'Perkiraan sementara' : 'Total sementara'}</span>
                    <strong>{formatRupiah(subtotal + deliveryFee)}</strong>
                  </div>
                  {unavailableItems.length ? (
                    <p className="cart-summary-note">
                      Total belum mencakup barang yang tidak tersedia. Checkout aktif setelah barang tersebut dihapus.
                    </p>
                  ) : (
                    <p className="cart-summary-note">
                      Harga dan stok akan diperiksa kembali oleh server saat checkout.
                    </p>
                  )}
                  <Link className="cart-continue-link" href="/koleksi">
                    Lanjutkan Belanja <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </>
              ) : null}
              <PublicCheckoutForm
                productCodes={availableItems.map((item) => item.code)}
                disabled={checkoutDisabled || checkoutBusy}
                buttonLabel="Checkout"
                persistIdempotency
                onBusyChange={setCheckoutBusy}
                onOrderCreated={handleOrderCreated}
                onStockConflict={() => void refreshProducts()}
              />
            </aside>
          </div>
        )}
      </section>
    </main>
  )
}
