import type { ResultSetHeader } from 'mysql2'
import { requireStaffPermission } from '@/lib/staff-access'
import { getPool } from '@/lib/db'
import { isDuplicateKeyError } from '@/lib/mysql-errors'
import { readJsonBody } from '@/lib/request-body'
import { productInputSchema } from '@/lib/validation'
import {
  persistProductImage,
  prepareProductImage,
  ProductImageError,
  productInputFromForm,
  removeProductImage,
} from '@/lib/product-image-storage'
import { getAdminProductSummary, getAdminProducts } from '@/lib/admin-repository'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const access = await requireStaffPermission('products:read', request)
  if (!access.ok) return access.response

  const includeAll = new URL(request.url).searchParams.get('all') === '1'
  const [products, summary] = await Promise.all([
    getAdminProducts(includeAll ? null : 250),
    getAdminProductSummary(),
  ])
  return Response.json({ products, summary })
}

export async function POST(request: Request) {
  const access = await requireStaffPermission('products:write', request)
  if (!access.ok) return access.response

  let image = null
  let input: unknown
  if (request.headers.get('content-type')?.includes('multipart/form-data')) {
    const form = await request.formData()
    try {
      image = await prepareProductImage(form.get('imageFile'))
    } catch (error) {
      if (error instanceof ProductImageError) {
        return Response.json({ error: error.message }, { status: error.status })
      }
      throw error
    }
    const storedUrl = form.get('imageUrl')
    input = productInputFromForm(
      form,
      image?.imageUrl ?? (typeof storedUrl === 'string' ? storedUrl : ''),
    )
  } else {
    const body = await readJsonBody(request)
    if (!body.ok) return body.response
    input = body.value
  }

  const parsed = productInputSchema.safeParse(input)
  if (!parsed.success) {
    return Response.json(
      { error: 'Periksa kembali data produk.', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const product = parsed.data
  const stockStatus =
    product.inspectionStatus === 'passed' && product.cleaningStatus === 'cleaned'
      ? 'available'
      : 'qc_pending'

  try {
    if (image) await persistProductImage(image)
    const [result] = await getPool().execute<ResultSetHeader>(
      `INSERT INTO products (
        code, name, category, size, product_color, measurements, purchase_cost, price,
        condition_note, image_url, image_alt, image_tone, photo_mood,
        product_condition, cleaning_condition, completeness, damage_type, damage_note, fabric_check,
        seams_check, buttons_check, zipper_check, inspection_status,
        cleaning_status, stock_status, search_terms, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        product.code,
        product.name,
        product.category,
        product.size,
        product.productColor,
        product.measurements,
        product.purchaseCost,
        product.price,
        product.conditionNote,
        product.imageUrl,
        product.imageAlt,
        product.imageTone,
        product.photoMood,
        product.productCondition,
        product.cleaningCondition,
        product.completeness,
        product.damageType,
        product.damageNote || null,
        product.fabricCheck,
        product.seamsCheck,
        product.buttonsCheck,
        product.zipperCheck,
        product.inspectionStatus,
        product.cleaningStatus,
        stockStatus,
        product.searchTerms,
        access.user.id,
      ],
    )

    if (result.affectedRows !== 1) {
      throw new Error('Product insert did not create exactly one row.')
    }
  } catch (error) {
    if (image) await removeProductImage(image)
    if (isDuplicateKeyError(error)) {
      return Response.json({ error: 'Kode produk sudah digunakan.' }, { status: 409 })
    }
    throw error
  }

  return Response.json({ code: product.code, stockStatus }, { status: 201 })
}
