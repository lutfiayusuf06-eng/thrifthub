import type { RowDataPacket } from 'mysql2'
import { getPool } from '@/lib/db'
import type { Product } from '@/lib/products'
import { isPublicOrderSchemaReady } from '@/lib/order-reservations'

type ProductRow = RowDataPacket & {
  code: string
  name: string
  category: string
  size: Product['size']
  product_color: Product['productColor']
  measurements: string
  price: number
  condition_note: string
  image_url: string
  image_alt: string
  image_tone: Product['tone']
  fabric_check: string
  seams_check: string
  buttons_check: string
  zipper_check: string
  stock_status: 'qc_pending' | 'available' | 'sold' | 'archived'
  reserved: number | boolean
  search_terms: string
}

function toProduct(row: ProductRow): Product {
  return {
    code: row.code,
    name: row.name,
    category: row.category,
    size: row.size,
    productColor: row.product_color,
    fit: row.measurements,
    price: row.price,
    condition: row.condition_note,
    image: row.image_url,
    imageAlt: row.image_alt,
    available: row.stock_status === 'available',
    reserved: Boolean(row.reserved),
    tone: row.image_tone,
    searchTerms: row.search_terms
      .split(',')
      .map((term) => term.trim())
      .filter(Boolean),
    qc: {
      fabric: row.fabric_check,
      seams: row.seams_check,
      buttons: row.buttons_check,
      zipper: row.zipper_check,
    },
  }
}

export async function getPublicProducts(): Promise<Product[]> {
  const schemaReady = await isPublicOrderSchemaReady()
  const reservationFields = schemaReady
    ? `, CASE WHEN EXISTS (
         SELECT 1 FROM sale_transactions active_reservation
         WHERE active_reservation.id = p.reserved_by_transaction_id
           AND active_reservation.status = 'pending'
           AND (active_reservation.reservation_expires_at IS NULL
             OR active_reservation.reservation_expires_at > CURRENT_TIMESTAMP)
       ) THEN 1 ELSE 0 END AS reserved`
    : ', 0 AS reserved'
  const reservationFilter = schemaReady
    ? `AND (p.reserved_by_transaction_id IS NULL OR NOT EXISTS (
         SELECT 1 FROM sale_transactions active_reservation
         WHERE active_reservation.id = p.reserved_by_transaction_id
           AND active_reservation.status = 'pending'
           AND (active_reservation.reservation_expires_at IS NULL
             OR active_reservation.reservation_expires_at > CURRENT_TIMESTAMP)
       ))`
    : ''
  const [rows] = await getPool().execute<ProductRow[]>(
    `SELECT p.code, p.name, p.category, p.size, p.product_color, p.measurements, p.price, p.condition_note,
            p.image_url, p.image_alt, p.image_tone, p.fabric_check, p.seams_check,
            p.buttons_check, p.zipper_check, p.stock_status, p.search_terms${reservationFields}
     FROM products p
     WHERE p.stock_status = 'available'
       AND p.inspection_status = 'passed'
       AND p.cleaning_status = 'cleaned'
       ${reservationFilter}
     ORDER BY p.created_at DESC`,
  )
  return rows.map(toProduct)
}

export async function getPublicProduct(code: string): Promise<Product | undefined> {
  const schemaReady = await isPublicOrderSchemaReady()
  const reservationField = schemaReady
    ? `, CASE WHEN EXISTS (
         SELECT 1 FROM sale_transactions active_reservation
         WHERE active_reservation.id = p.reserved_by_transaction_id
           AND active_reservation.status = 'pending'
           AND (active_reservation.reservation_expires_at IS NULL
             OR active_reservation.reservation_expires_at > CURRENT_TIMESTAMP)
       ) THEN 1 ELSE 0 END AS reserved`
    : ', 0 AS reserved'
  const [rows] = await getPool().execute<ProductRow[]>(
    `SELECT p.code, p.name, p.category, p.size, p.product_color, p.measurements, p.price, p.condition_note,
            p.image_url, p.image_alt, p.image_tone, p.fabric_check, p.seams_check,
            p.buttons_check, p.zipper_check, p.stock_status, p.search_terms${reservationField}
     FROM products p
     WHERE p.code = ? AND p.stock_status = 'available'
       AND p.inspection_status = 'passed'
       AND p.cleaning_status = 'cleaned'
     LIMIT 1`,
    [code],
  )
  return rows[0] ? toProduct(rows[0]) : undefined
}
