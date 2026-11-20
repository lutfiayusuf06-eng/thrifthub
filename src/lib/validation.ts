import { z } from 'zod'
import {
  cleaningConditionValues,
  completenessValues,
  damageValues,
  productConditionValues,
} from '@/lib/product-quality'

const photoUrl = z.string().trim().max(2048).refine(
  (value) =>
    value.toLowerCase().startsWith('https://') ||
    /^\/uploads\/products\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i.test(value),
  { message: 'Foto harus menggunakan URL HTTPS atau foto produk yang diunggah.' },
)

const qcText = z.string().trim().min(2).max(240)
const plainText = (max: number) => z.string()
  .transform(stripControlCharacters)
  .pipe(z.string().trim().max(max))

function stripControlCharacters(value: string) {
  return Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0)
      return code >= 32 && code !== 127
    })
    .join('')
}

export const makassarDistricts = [
  'Biringkanaya',
  'Bontoala',
  'Kepulauan Sangkarrang',
  'Makassar',
  'Mamajang',
  'Manggala',
  'Mariso',
  'Panakkukang',
  'Rappocini',
  'Tallo',
  'Tamalanrea',
  'Tamalate',
  'Ujung Pandang',
  'Ujung Tanah',
  'Wajo',
] as const

const productFieldsSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^TH-[A-Z0-9-]{2,29}$/),
  name: z.string().trim().min(2).max(160),
  category: z.string().trim().min(2).max(80),
  size: z.string().trim().min(1).max(32),
  productColor: plainText(120).pipe(z.string().min(1, 'Warna produk wajib diisi.')),
  measurements: z.string().trim().min(5).max(240),
  purchaseCost: z.number().int().min(0).max(100_000_000),
  price: z.number().int().min(1).max(100_000_000),
  conditionNote: plainText(500),
  imageUrl: photoUrl,
  imageAlt: z.string().trim().min(5).max(180),
  imageTone: z.enum(['blue', 'cream', 'white', 'olive']),
  photoMood: plainText(120).pipe(z.string().min(1, 'Nuansa foto wajib diisi.')),
  fabricCheck: qcText,
  seamsCheck: qcText,
  buttonsCheck: qcText,
  zipperCheck: qcText,
  inspectionStatus: z.enum(['pending', 'passed', 'failed']),
  cleaningCondition: z.enum(cleaningConditionValues),
  productCondition: z.enum(productConditionValues),
  completeness: z.enum(completenessValues),
  damageType: z.enum(damageValues),
  damageNote: plainText(240),
  searchTerms: z.string().trim().max(500).default(''),
})

type ProductFields = z.infer<typeof productFieldsSchema>
type ProductFieldsWithOptionalCode = Omit<ProductFields, 'code'> & { code?: string }

function validateProduct(
  product: ProductFieldsWithOptionalCode,
  context: z.RefinementCtx,
) {
  const isApparel = !/(celana|pants|trouser|jeans|shorts?|sepatu|sandal|footwear|shoes?)/i.test(product.category)
  if (isApparel && /^(?:[4-9]\d*)\s*(?:XL|X-LARGE)$/i.test(product.size)) {
    context.addIssue({
      code: 'custom',
      path: ['size'],
      message: 'Ukuran pakaian maksimal 3XL.',
    })
  }
  if (product.damageType !== 'none' && !product.damageNote.trim()) {
    context.addIssue({
      code: 'custom',
      path: ['damageNote'],
      message: 'Keterangan kerusakan wajib diisi.',
    })
  }
}

function deriveProductStatus<T extends ProductFieldsWithOptionalCode>(product: T) {
  return {
    ...product,
    cleaningStatus: product.cleaningCondition === 'clean' ? 'cleaned' as const : 'pending' as const,
  }
}

export const productInputSchema = productFieldsSchema
  .superRefine(validateProduct)
  .transform(deriveProductStatus)

export const productUpdateSchema = productFieldsSchema
  .omit({ code: true })
  .superRefine(validateProduct)
  .transform(deriveProductStatus)

export const qcUpdateSchema = z.object({
  fabricCheck: qcText,
  seamsCheck: qcText,
  buttonsCheck: qcText,
  zipperCheck: qcText,
  conditionNote: z.string().trim().min(5).max(500),
  inspectionStatus: z.enum(['pending', 'passed', 'failed']),
  cleaningStatus: z.enum(['pending', 'cleaned']),
})

export const saleInputSchema = z.object({
  source: z.enum(['website', 'instagram', 'tiktok', 'whatsapp', 'direct']),
  productCodes: z.array(z.string().trim().toUpperCase().regex(/^TH-[A-Z0-9-]{2,29}$/))
    .min(1)
    .max(30)
    .refine((codes) => new Set(codes).size === codes.length, {
      message: 'Produk yang sama tidak boleh dicantumkan dua kali.',
    }),
})

export const publicOrderInputSchema = z.object({
  productCode: z.string().trim().toUpperCase().regex(/^TH-[A-Z0-9-]{2,29}$/).optional(),
  productCodes: z.array(
    z.string().trim().toUpperCase().regex(/^TH-[A-Z0-9-]{2,29}$/),
  ).min(1).max(30).refine((codes) => new Set(codes).size === codes.length, {
    message: 'Produk yang sama tidak boleh dicantumkan dua kali.',
  }).optional(),
  idempotencyKey: z.string().uuid(),
  customerName: z.string()
    .transform(stripControlCharacters)
    .pipe(z.string().trim().min(2).max(120)),
  customerWhatsapp: z.string()
    .transform((value) => value.replace(/[\s().-]/g, ''))
    .pipe(z.string().regex(/^(?:\+?[1-9]\d{7,14}|0\d{7,14})$/, 'Nomor WhatsApp tidak valid.')),
  customerEmail: z.string()
    .trim()
    .max(254)
    .transform((value) => value || null)
    .pipe(z.email().nullable()),
  customerNote: z.string()
    .transform(stripControlCharacters)
    .pipe(z.string().trim().max(500)),
  deliveryDistrict: z.enum(makassarDistricts),
  deliveryAddress: z.string()
    .transform(stripControlCharacters)
    .pipe(z.string().trim().min(10).max(500)),
  paymentMethod: z.enum(['transfer', 'cod']),
}).superRefine((input, context) => {
  if (Boolean(input.productCode) === Boolean(input.productCodes)) {
    context.addIssue({
      code: 'custom',
      path: ['productCodes'],
      message: 'Kirim satu kode produk atau daftar kode produk.',
    })
  }
}).transform(({ productCode, productCodes, ...input }) => ({
  ...input,
  productCodes: productCodes ?? (productCode ? [productCode] : []),
}))

export const publicOrderResponseSchema = z.object({
  order: z.object({
    id: z.string().uuid(),
    productCode: z.string(),
    productName: z.string(),
    items: z.array(z.object({
      productCode: z.string(),
      productName: z.string(),
      unitPrice: z.number().int().nonnegative(),
    })).min(1),
    status: z.enum(['pending', 'paid', 'cancelled', 'expired']),
    totalAmount: z.number().int().nonnegative(),
    deliveryFee: z.number().int().nonnegative(),
    paymentMethod: z.enum(['transfer', 'cod']),
    reservationExpiresAt: z.string().nullable(),
  }),
})

export const paidSaleSchema = z.object({
  paid: z.literal(true),
})

export const inventoryProductSchema = z.object({
  code: z.string(),
  name: z.string(),
  category: z.string(),
  size: z.string(),
  product_color: z.string().nullable(),
  photo_mood: z.string().nullable(),
  product_condition: z.enum(productConditionValues).nullable(),
  cleaning_condition: z.enum(cleaningConditionValues).nullable(),
  completeness: z.enum(completenessValues).nullable(),
  damage_type: z.enum(damageValues).nullable(),
  damage_note: z.string().nullable(),
  fit: z.string(),
  measurements: z.string(),
  purchase_cost: z.number(),
  price: z.number(),
  condition: z.string(),
  condition_note: z.string(),
  image: z.string(),
  image_url: z.string(),
  imageAlt: z.string(),
  image_alt: z.string(),
  tone: z.enum(['blue', 'cream', 'white', 'olive']),
  image_tone: z.enum(['blue', 'cream', 'white', 'olive']),
  available: z.boolean(),
  searchTerms: z.array(z.string()),
  qc: z.object({
    fabric: z.string(),
    seams: z.string(),
    buttons: z.string(),
    zipper: z.string(),
  }),
  fabric_check: z.string(),
  seams_check: z.string(),
  buttons_check: z.string(),
  zipper_check: z.string(),
  inspection_status: z.enum(['pending', 'passed', 'failed']),
  cleaning_status: z.enum(['pending', 'cleaned']),
  stock_status: z.enum(['qc_pending', 'available', 'sold', 'archived']),
  reserved: z.boolean().optional(),
  created_at: z.string(),
})

export const inventoryResponseSchema = z.object({
  products: z.array(inventoryProductSchema),
  summary: z.object({
    total: z.number(),
    pendingQc: z.number(),
    readyToSell: z.number(),
  }).optional(),
})

export const createdProductSchema = z.object({
  code: z.string(),
  stockStatus: z.enum(['qc_pending', 'available']),
})

export const saleRecordSchema = z.object({
  id: z.string(),
  source: z.enum(['website', 'instagram', 'tiktok', 'whatsapp', 'direct']),
  origin: z.enum(['pos', 'website']),
  status: z.enum(['pending', 'paid', 'cancelled', 'expired']),
  total_amount: z.number(),
  created_at: z.string(),
  paid_at: z.string().nullable(),
  paid_by_name: z.string().nullable(),
  payment_method: z.enum(['transfer', 'cod']).nullable(),
  item_count: z.number(),
})

export const salesResponseSchema = z.object({
  sales: z.array(saleRecordSchema),
})

export const saleDetailResponseSchema = z.object({
  sale: saleRecordSchema.extend({
    buyer: z.object({
      name: z.string(),
      whatsapp: z.string(),
      email: z.string().nullable(),
      note: z.string(),
      deliveryDistrict: z.enum(makassarDistricts),
      deliveryAddress: z.string(),
      paymentMethod: z.enum(['transfer', 'cod']),
      deliveryFee: z.number(),
    }).nullable(),
    items: z.array(z.object({
      product_code: z.string(),
      product_name: z.string(),
      unit_price: z.number(),
    })),
  }),
})

export const saleProductSchema = z.object({
  code: z.string(),
  name: z.string(),
  price: z.number(),
})

export const availableSaleProductsSchema = z.object({
  products: z.array(saleProductSchema),
})

export const createdSaleSchema = z.object({
  id: z.string(),
  status: z.literal('pending'),
  totalAmount: z.number(),
})
