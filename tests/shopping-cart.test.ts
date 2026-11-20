import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addUniqueCartProduct,
  getSortedCartCodes,
  parseStoredCart,
  refreshCartProducts,
  type CartProduct,
} from '../src/lib/shopping-cart'
import { publicOrderInputSchema } from '../src/lib/validation'

const firstProduct: CartProduct = {
  code: 'TH-AB12',
  name: 'Kemeja Vintage',
  image: '/uploads/products/00000000-0000-4000-8000-000000000001.jpg',
  imageAlt: 'Kemeja vintage hijau',
  size: 'M',
  condition: 'Sangat baik',
  productColor: 'Hijau',
  price: 75000,
}

const secondProduct: CartProduct = {
  ...firstProduct,
  code: 'TH-CD34',
  name: 'Jaket Denim',
  price: 100000,
}

function orderInput(overrides: Record<string, unknown> = {}) {
  return {
    productCodes: [firstProduct.code, secondProduct.code],
    idempotencyKey: 'c41b1ee6-d778-4af0-9c31-a45d29390893',
    customerName: 'Pembeli ThriftHub',
    customerWhatsapp: '081234567890',
    customerEmail: '',
    customerNote: '',
    deliveryDistrict: 'Makassar',
    deliveryAddress: 'Jalan Contoh Nomor 123',
    paymentMethod: 'transfer',
    ...overrides,
  }
}

test('resets malformed or unexpected local cart data without accepting buyer details', () => {
  assert.equal(parseStoredCart('{broken').invalid, true)
  assert.equal(parseStoredCart(JSON.stringify({
    version: 1,
    items: [firstProduct],
    checkoutAttempt: null,
    customerName: 'Private data',
  })).invalid, true)
})

test('adds each unique product once and enforces the cart item limit', () => {
  const added = addUniqueCartProduct([], firstProduct)
  assert.equal(added.result, 'added')
  assert.equal(addUniqueCartProduct(added.items, firstProduct).result, 'duplicate')

  const fullCart = Array.from({ length: 30 }, (_, index) => ({
    ...firstProduct,
    code: `TH-${String(index).padStart(4, '0')}`,
  }))
  assert.equal(addUniqueCartProduct(fullCart, secondProduct).result, 'limit')
})

test('refreshes displayed price and details from current products while retaining missing items', () => {
  const updated = { ...firstProduct, price: 80000, size: 'L' }
  const refreshed = refreshCartProducts(
    [firstProduct, secondProduct],
    [updated],
  )

  assert.equal(refreshed[0]?.price, 80000)
  assert.equal(refreshed[0]?.size, 'L')
  assert.equal(refreshed[1]?.code, secondProduct.code)
})

test('normalizes product codes for a stable idempotent cart request', () => {
  assert.deepEqual(
    getSortedCartCodes([secondProduct.code, firstProduct.code, secondProduct.code]),
    [firstProduct.code, secondProduct.code],
  )
})

test('accepts multiple checkout items and rejects duplicates or mixed legacy input', () => {
  const parsed = publicOrderInputSchema.safeParse(orderInput())
  assert.equal(parsed.success, true)
  if (parsed.success) {
    assert.deepEqual(parsed.data.productCodes, [firstProduct.code, secondProduct.code])
  }

  assert.equal(publicOrderInputSchema.safeParse(orderInput({
    productCodes: [firstProduct.code, firstProduct.code],
  })).success, false)
  assert.equal(publicOrderInputSchema.safeParse(orderInput({
    productCode: firstProduct.code,
  })).success, false)

  const legacy = publicOrderInputSchema.safeParse(orderInput({
    productCodes: undefined,
    productCode: firstProduct.code,
  }))
  assert.equal(legacy.success, true)
  if (legacy.success) assert.deepEqual(legacy.data.productCodes, [firstProduct.code])
})
