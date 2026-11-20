import { z } from 'zod'
import type { Product } from '@/lib/products'

const productCodeSchema = z.string().regex(/^TH-[A-Z0-9-]{2,29}$/)

const cartProductSchema = z.object({
  code: productCodeSchema,
  name: z.string().trim().min(1).max(160),
  image: z.string().max(2048).refine(
    (value) =>
      value.toLowerCase().startsWith('https://') ||
      /^\/uploads\/products\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i.test(value),
  ),
  imageAlt: z.string().max(180),
  size: z.string().max(32),
  condition: z.string().max(500),
  productColor: z.string().max(120).nullable(),
  price: z.number().int().nonnegative().max(100_000_000),
}).strict()

const checkoutAttemptSchema = z.object({
  idempotencyKey: z.uuid(),
  productCodes: z.array(productCodeSchema).min(1).max(30),
}).strict()

const storedCartSchema = z.object({
  version: z.literal(1),
  items: z.array(cartProductSchema).max(30),
  checkoutAttempt: checkoutAttemptSchema.nullable(),
}).strict().superRefine((cart, context) => {
  const codes = cart.items.map((item) => item.code)
  if (new Set(codes).size !== codes.length) {
    context.addIssue({
      code: 'custom',
      path: ['items'],
      message: 'Keranjang tidak boleh berisi kode produk ganda.',
    })
  }
  if (cart.checkoutAttempt &&
    new Set(cart.checkoutAttempt.productCodes).size !== cart.checkoutAttempt.productCodes.length) {
    context.addIssue({
      code: 'custom',
      path: ['checkoutAttempt', 'productCodes'],
      message: 'Kunci checkout berisi kode produk ganda.',
    })
  }
})

const publicProductsResponseSchema = z.object({
  products: z.array(cartProductSchema.extend({
    available: z.boolean(),
    reserved: z.boolean().optional(),
  }).strip()),
})

export type CartProduct = z.infer<typeof cartProductSchema>
export type CartCheckoutAttempt = z.infer<typeof checkoutAttemptSchema>
export type StoredCart = z.infer<typeof storedCartSchema>

export const MAX_CART_ITEMS = 30

export function toCartProduct(product: Product): CartProduct {
  return {
    code: product.code.toUpperCase(),
    name: product.name,
    image: product.image,
    imageAlt: product.imageAlt,
    size: product.size,
    condition: product.condition,
    productColor: product.productColor ?? null,
    price: product.price,
  }
}

export function parseStoredCart(raw: string | null): {
  cart: StoredCart
  invalid: boolean
} {
  const emptyCart: StoredCart = {
    version: 1,
    items: [],
    checkoutAttempt: null,
  }
  if (raw === null) return { cart: emptyCart, invalid: false }

  try {
    const parsed: unknown = JSON.parse(raw)
    const result = storedCartSchema.safeParse(parsed)
    return result.success
      ? { cart: result.data, invalid: false }
      : { cart: emptyCart, invalid: true }
  } catch {
    return { cart: emptyCart, invalid: true }
  }
}

export function parsePublicProductsResponse(value: unknown) {
  return publicProductsResponseSchema.safeParse(value)
}

export function addUniqueCartProduct(
  items: CartProduct[],
  product: CartProduct,
): { items: CartProduct[]; result: 'added' | 'duplicate' | 'limit' } {
  if (items.some((item) => item.code === product.code)) {
    return { items, result: 'duplicate' }
  }
  if (items.length >= MAX_CART_ITEMS) {
    return { items, result: 'limit' }
  }
  return { items: [...items, product], result: 'added' }
}

export function refreshCartProducts(
  items: CartProduct[],
  currentProducts: CartProduct[],
): CartProduct[] {
  const productsByCode = new Map(currentProducts.map((product) => [product.code, product]))
  return items.map((item) => productsByCode.get(item.code) ?? item)
}

export function getSortedCartCodes(codes: string[]) {
  return [...new Set(codes)].sort()
}

export function sameCartCodes(first: string[], second: string[]) {
  const sortedFirst = getSortedCartCodes(first)
  const sortedSecond = getSortedCartCodes(second)
  return sortedFirst.length === first.length &&
    sortedSecond.length === second.length &&
    sortedFirst.length === sortedSecond.length &&
    sortedFirst.every((code, index) => code === sortedSecond[index])
}

export function createCartIdempotencyKey() {
  const cryptoApi = globalThis.crypto
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID()
  if (!cryptoApi?.getRandomValues) {
    throw new Error('Browser tidak mendukung pembuatan kunci pesanan. Silakan gunakan browser yang lebih baru.')
  }

  const bytes = cryptoApi.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
