import type { RowDataPacket } from 'mysql2'
import { getPool } from '@/lib/db'
import type { Product } from '@/lib/products'
import type {
  CleaningCondition,
  ProductCompleteness,
  ProductCondition,
  ProductDamage,
} from '@/lib/product-quality'
import {
  isPublicOrderCustomerSchemaReady,
  isPublicOrderSchemaReady,
} from '@/lib/order-reservations'

export type AdminProduct = Product & {
  purchase_cost: number
  measurements: string
  condition_note: string
  image_url: string
  image_alt: string
  image_tone: Product['tone']
  product_color: string | null
  photo_mood: string | null
  product_condition: ProductCondition | null
  cleaning_condition: CleaningCondition | null
  completeness: ProductCompleteness | null
  damage_type: ProductDamage | null
  damage_note: string | null
  fabric_check: string
  seams_check: string
  buttons_check: string
  zipper_check: string
  inspection_status: 'pending' | 'passed' | 'failed'
  cleaning_status: 'pending' | 'cleaned'
  stock_status: 'qc_pending' | 'available' | 'sold' | 'archived'
  reserved?: boolean
  created_at: string
}

export type AdminSale = {
  id: string
  source: 'website' | 'instagram' | 'tiktok' | 'whatsapp' | 'direct'
  origin: 'pos' | 'website'
  status: 'pending' | 'paid' | 'cancelled' | 'expired'
  total_amount: number
  created_at: string
  paid_at: string | null
  paid_by_name: string | null
  payment_method: 'transfer' | 'cod' | null
  item_count: number
}

export type AdminSaleItem = {
  product_code: string
  product_name: string
  unit_price: number
}

export type AdminSaleDetail = AdminSale & {
  items: AdminSaleItem[]
  buyer: {
    name: string
    whatsapp: string
    email: string | null
    note: string
    deliveryDistrict: string
    deliveryAddress: string
    paymentMethod: 'transfer' | 'cod'
    deliveryFee: number
  } | null
}

export type SaleProduct = {
  code: string
  name: string
  price: number
}

export type AdminProductSummary = {
  total: number
  pendingQc: number
  readyToSell: number
}

type AdminProductRow = RowDataPacket & {
  code: string
  name: string
  category: string
  size: string
  measurements: string
  purchase_cost: number
  price: number
  condition_note: string
  image_url: string
  image_alt: string
  image_tone: Product['tone']
  product_color: string | null
  photo_mood: string | null
  product_condition: ProductCondition | null
  cleaning_condition: CleaningCondition | null
  completeness: ProductCompleteness | null
  damage_type: ProductDamage | null
  damage_note: string | null
  fabric_check: string
  seams_check: string
  buttons_check: string
  zipper_check: string
  inspection_status: AdminProduct['inspection_status']
  cleaning_status: AdminProduct['cleaning_status']
  stock_status: AdminProduct['stock_status']
  is_reserved?: number | boolean
  search_terms: string
  created_at: Date | string
}

type AdminSaleRow = RowDataPacket & {
  id: string
  source: AdminSale['source']
  origin: AdminSale['origin']
  status: AdminSale['status']
  total_amount: number
  created_at: Date | string
  paid_at: Date | string | null
  item_count: number | string
  customer_name?: string | null
  customer_whatsapp?: string | null
  customer_email?: string | null
  customer_note?: string | null
  delivery_district?: string | null
  delivery_address?: string | null
  payment_method?: 'transfer' | 'cod' | null
  paid_by_name?: string | null
  delivery_fee?: number
}

type SaleProductRow = RowDataPacket & SaleProduct

type AdminSaleItemRow = RowDataPacket & AdminSaleItem

function toIso(value: Date | string | null) {
  if (value === null) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function mapProduct(row: AdminProductRow): AdminProduct {
  return {
    code: row.code,
    name: row.name,
    category: row.category,
    size: row.size,
    fit: row.measurements,
    measurements: row.measurements,
    price: row.price,
    condition: row.condition_note,
    condition_note: row.condition_note,
    image: row.image_url,
    image_url: row.image_url,
    imageAlt: row.image_alt,
    image_alt: row.image_alt,
    available: row.stock_status === 'available',
    tone: row.image_tone,
    image_tone: row.image_tone,
    product_color: row.product_color,
    photo_mood: row.photo_mood,
    product_condition: row.product_condition,
    cleaning_condition: row.cleaning_condition,
    completeness: row.completeness,
    damage_type: row.damage_type,
    damage_note: row.damage_note,
    searchTerms: row.search_terms.split(',').map((term) => term.trim()).filter(Boolean),
    qc: {
      fabric: row.fabric_check,
      seams: row.seams_check,
      buttons: row.buttons_check,
      zipper: row.zipper_check,
    },
    purchase_cost: row.purchase_cost,
    fabric_check: row.fabric_check,
    seams_check: row.seams_check,
    buttons_check: row.buttons_check,
    zipper_check: row.zipper_check,
    inspection_status: row.inspection_status,
    cleaning_status: row.cleaning_status,
    stock_status: row.stock_status,
    reserved: Boolean(row.is_reserved),
    created_at: toIso(row.created_at) ?? '',
  }
}

export async function getAdminProducts(limit: number | null = 250): Promise<AdminProduct[]> {
  if (limit !== null && (!Number.isSafeInteger(limit) || limit <= 0)) {
    throw new RangeError('Product limit must be a positive integer or null.')
  }

  const orderSchemaReady = await isPublicOrderSchemaReady()
  const limitClause = limit === null ? '' : `LIMIT ${limit}`
  const [rows] = await getPool().execute<AdminProductRow[]>(
    `SELECT code, name, category, size, product_color, measurements, purchase_cost, price,
            condition_note, image_url, image_alt, image_tone, photo_mood,
            product_condition, cleaning_condition, completeness, damage_type, damage_note,
            fabric_check,
            seams_check, buttons_check, zipper_check, inspection_status,
            cleaning_status, stock_status, search_terms, created_at
            ${orderSchemaReady ? `, CASE WHEN EXISTS (
              SELECT 1 FROM sale_transactions active_reservation
              WHERE active_reservation.id = products.reserved_by_transaction_id
                AND active_reservation.status = 'pending'
                AND (active_reservation.reservation_expires_at IS NULL
                  OR active_reservation.reservation_expires_at > CURRENT_TIMESTAMP)
            ) THEN 1 ELSE 0 END AS is_reserved` : ', 0 AS is_reserved'}
     FROM products
     ORDER BY created_at DESC
     ${limitClause}`,
  )
  return rows.map(mapProduct)
}

export async function getAdminProductSummary(): Promise<AdminProductSummary> {
  const orderSchemaReady = await isPublicOrderSchemaReady()
  type SummaryRow = RowDataPacket & {
    total: number | string
    pending_qc: number | string
    ready_to_sell: number | string
  }

  const [rows] = await getPool().execute<SummaryRow[]>(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(inspection_status = 'pending'), 0) AS pending_qc,
            COALESCE(SUM(stock_status = 'available'
              ${orderSchemaReady ? `AND (reserved_by_transaction_id IS NULL OR NOT EXISTS (
                SELECT 1 FROM sale_transactions active_reservation
                WHERE active_reservation.id = products.reserved_by_transaction_id
                  AND active_reservation.status = 'pending'
                  AND (active_reservation.reservation_expires_at IS NULL
                    OR active_reservation.reservation_expires_at > CURRENT_TIMESTAMP)
              ))` : ''}), 0) AS ready_to_sell
     FROM products`,
  )
  const row = rows[0]

  return {
    total: Number(row.total),
    pendingQc: Number(row.pending_qc),
    readyToSell: Number(row.ready_to_sell),
  }
}

export async function getAdminSales(limit: number | null = 50): Promise<AdminSale[]> {
  if (limit !== null && (!Number.isSafeInteger(limit) || limit <= 0)) {
    throw new RangeError('Sales limit must be a positive integer or null.')
  }

  const orderSchemaReady = await isPublicOrderSchemaReady()
  const customerSchemaReady = await isPublicOrderCustomerSchemaReady()
  const limitClause = limit === null ? '' : `LIMIT ${limit}`
  const [rows] = await getPool().execute<AdminSaleRow[]>(
    `SELECT id, source, ${orderSchemaReady ? 'origin' : "'pos' AS origin"}, status, total_amount, created_at, paid_at,
            ${customerSchemaReady ? 'payment_method' : 'NULL AS payment_method'},
            (SELECT u.name FROM staff_users u WHERE u.id = sale_transactions.paid_by) AS paid_by_name,
            (SELECT COUNT(*) FROM sale_items WHERE transaction_id = sale_transactions.id) AS item_count
     FROM sale_transactions
     ORDER BY created_at DESC
     ${limitClause}`,
  )
  return rows.map((row) => ({
    id: row.id,
    source: row.source,
    origin: row.origin,
    status: row.status,
    total_amount: row.total_amount,
    created_at: toIso(row.created_at) ?? '',
    paid_at: toIso(row.paid_at),
    paid_by_name: row.paid_by_name ?? null,
    payment_method: row.payment_method ?? null,
    item_count: Number(row.item_count),
  }))
}

export async function getAdminSaleDetail(
  id: string,
  includeBuyer = false,
): Promise<AdminSaleDetail | undefined> {
  const orderSchemaReady = await isPublicOrderSchemaReady()
  const includeBuyerFields = includeBuyer && await isPublicOrderCustomerSchemaReady()
  const [sales] = await getPool().execute<AdminSaleRow[]>(
    `SELECT id, source, ${orderSchemaReady ? 'origin' : "'pos' AS origin"}, status, total_amount, created_at, paid_at
            ${includeBuyerFields
              ? `, customer_name, customer_whatsapp, customer_email, customer_note,
                 delivery_district, delivery_address, payment_method, delivery_fee`
              : `, NULL AS customer_name, NULL AS customer_whatsapp, NULL AS customer_email,
                 NULL AS customer_note, NULL AS delivery_district, NULL AS delivery_address,
                 NULL AS payment_method, 0 AS delivery_fee`},
            (SELECT u.name FROM staff_users u WHERE u.id = sale_transactions.paid_by) AS paid_by_name,
            (SELECT COUNT(*) FROM sale_items WHERE transaction_id = sale_transactions.id) AS item_count
     FROM sale_transactions
     WHERE id = ?
     LIMIT 1`,
    [id],
  )
  const sale = sales[0]
  if (!sale) return undefined

  const [items] = await getPool().execute<AdminSaleItemRow[]>(
    `SELECT product_code, product_name, unit_price
     FROM sale_items
     WHERE transaction_id = ?
     ORDER BY product_code`,
    [id],
  )

  return {
    id: sale.id,
    source: sale.source,
    origin: sale.origin,
    status: sale.status,
    total_amount: sale.total_amount,
    created_at: toIso(sale.created_at) ?? '',
    paid_at: toIso(sale.paid_at),
    paid_by_name: sale.paid_by_name ?? null,
    payment_method: sale.payment_method ?? null,
    item_count: Number(sale.item_count),
    buyer: sale.customer_name && sale.customer_whatsapp && sale.delivery_district &&
      sale.delivery_address && sale.payment_method
      ? {
          name: sale.customer_name,
          whatsapp: sale.customer_whatsapp,
          email: sale.customer_email ?? null,
          note: sale.customer_note ?? '',
          deliveryDistrict: sale.delivery_district,
          deliveryAddress: sale.delivery_address,
          paymentMethod: sale.payment_method,
          deliveryFee: Number(sale.delivery_fee ?? 0),
        }
      : null,
    items,
  }
}

export async function getAvailableSaleProducts(): Promise<SaleProduct[]> {
  const orderSchemaReady = await isPublicOrderSchemaReady()
  const [rows] = await getPool().execute<SaleProductRow[]>(
    `SELECT code, name, price
     FROM products
     WHERE stock_status = 'available'
       ${orderSchemaReady ? `AND (
         reserved_by_transaction_id IS NULL
         OR NOT EXISTS (
           SELECT 1 FROM sale_transactions reserved_sale
           WHERE reserved_sale.id = products.reserved_by_transaction_id
             AND reserved_sale.status = 'pending'
             AND (reserved_sale.reservation_expires_at IS NULL
               OR reserved_sale.reservation_expires_at > CURRENT_TIMESTAMP)
         )
       )` : ''}
     ORDER BY created_at DESC
     LIMIT 250`,
  )
  return rows
}
