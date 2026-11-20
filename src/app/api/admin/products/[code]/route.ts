import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { getPool } from '@/lib/db'
import { requireStaffPermission } from '@/lib/staff-access'
import { readJsonBody } from '@/lib/request-body'
import { productUpdateSchema } from '@/lib/validation'
import {
  isPublicOrderSchemaReady,
  releaseOrExpireProductReservation,
} from '@/lib/order-reservations'
import {
  persistProductImage,
  prepareProductImage,
  ProductImageError,
  productInputFromForm,
  removeProductImage,
} from '@/lib/product-image-storage'

type ProductStatusRow = RowDataPacket & {
  stock_status: 'qc_pending' | 'available' | 'sold' | 'archived'
  reserved_by_transaction_id?: string | null
}

type RouteContext = {
  params: Promise<{ code: string }>
}

export async function PATCH(request: Request, { params }: RouteContext) {
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

  const parsed = productUpdateSchema.safeParse(input)
  if (!parsed.success) {
    return Response.json(
      { error: 'Periksa kembali data produk.', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { code } = await params
  const product = parsed.data
  const stockStatus =
    product.inspectionStatus === 'passed' && product.cleaningStatus === 'cleaned'
      ? 'available'
      : 'qc_pending'

  const connection = await getPool().getConnection()
  let transactionStarted = false
  try {
    await connection.beginTransaction()
    transactionStarted = true
    const orderSchemaReady = await isPublicOrderSchemaReady()
    const [rows] = await connection.execute<ProductStatusRow[]>(
      `SELECT stock_status${orderSchemaReady ? ', reserved_by_transaction_id' : ''}
       FROM products WHERE code = ? FOR UPDATE`,
      [code],
    )
    const currentProduct = rows[0]
    if (!currentProduct) {
      await connection.rollback()
      return Response.json({ error: 'Produk tidak ditemukan.' }, { status: 404 })
    }
    if (currentProduct.stock_status === 'sold' || currentProduct.stock_status === 'archived') {
      await connection.rollback()
      return Response.json(
        { error: 'Produk terjual atau diarsipkan dan tidak dapat diedit.' },
        { status: 409 },
      )
    }
    if (orderSchemaReady && currentProduct.reserved_by_transaction_id) {
      const reservableProduct = {
        code,
        stock_status: currentProduct.stock_status,
        reserved_by_transaction_id: currentProduct.reserved_by_transaction_id,
      }
      const reserved = await releaseOrExpireProductReservation(connection, reservableProduct)
      if (reserved) {
        await connection.rollback()
        return Response.json(
          { error: 'Produk sedang direservasi untuk pesanan website dan belum dapat diedit.' },
          { status: 409 },
        )
      }
      const [updatedStatus] = await connection.execute<ProductStatusRow[]>(
        'SELECT stock_status FROM products WHERE code = ? FOR UPDATE',
        [code],
      )
      if (updatedStatus[0]?.stock_status === 'sold') {
        await connection.commit()
        return Response.json(
          { error: 'Produk sudah terjual dan tidak dapat diedit.' },
          { status: 409 },
        )
      }
    }

    if (image) await persistProductImage(image)
    await connection.execute<ResultSetHeader>(
      `UPDATE products
       SET name = ?, category = ?, size = ?, product_color = ?, measurements = ?, purchase_cost = ?,
           price = ?, condition_note = ?, image_url = ?, image_alt = ?, image_tone = ?,
           photo_mood = ?, product_condition = ?, cleaning_condition = ?, completeness = ?,
           damage_type = ?, damage_note = ?,
           fabric_check = ?, seams_check = ?, buttons_check = ?, zipper_check = ?,
           inspection_status = ?, cleaning_status = ?, stock_status = ?,
           search_terms = ?
       WHERE code = ?`,
      [
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
        code,
      ],
    )
    await connection.commit()
    return Response.json({ code, stockStatus })
  } catch (error) {
    if (transactionStarted) await connection.rollback()
    if (image) await removeProductImage(image)
    throw error
  } finally {
    connection.release()
  }
}
