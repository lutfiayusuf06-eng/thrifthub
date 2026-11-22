import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

const maxPhotoBytes = 5 * 1024 * 1024
const storageDirectory = path.join(process.cwd(), 'public', 'uploads', 'products')

export class ProductImageError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'ProductImageError'
    this.status = status
  }
}

export type PreparedProductImage = {
  imageUrl: string
  filePath: string
  contents: Buffer
}

export async function prepareProductImage(
  entry: FormDataEntryValue | null,
): Promise<PreparedProductImage | null> {
  if (entry === null || (typeof entry !== 'string' && entry.size === 0)) return null
  if (typeof entry === 'string' || !(entry instanceof File)) {
    throw new ProductImageError('Pilih file foto produk yang valid.')
  }
  if (entry.size > maxPhotoBytes) {
    throw new ProductImageError('Ukuran foto maksimal 5 MB.')
  }

  const contents = Buffer.from(await entry.arrayBuffer())
  let extension: string
  if (contents.length >= 3 && contents[0] === 0xff && contents[1] === 0xd8 && contents[2] === 0xff) {
    extension = 'jpg'
  } else if (
    contents.length >= 8 &&
    contents.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    extension = 'png'
  } else if (
    contents.length >= 12 &&
    contents.toString('ascii', 0, 4) === 'RIFF' &&
    contents.toString('ascii', 8, 12) === 'WEBP'
  ) {
    extension = 'webp'
  } else {
    throw new ProductImageError('Isi file bukan foto JPG, JPEG, PNG, atau WEBP yang valid.')
  }

  const fileName = `${randomUUID()}.${extension}`
  return {
    imageUrl: `/uploads/products/${fileName}`,
    filePath: path.join(storageDirectory, fileName),
    contents,
  }
}

export async function persistProductImage(image: PreparedProductImage) {
  await mkdir(storageDirectory, { recursive: true })
  await writeFile(image.filePath, image.contents, { flag: 'wx' })
}

export async function removeProductImage(image: PreparedProductImage) {
  try {
    await unlink(image.filePath)
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
  }
}

function parseProductPrice(value: string): number {
  const normalized = value.trim()
  if (!/^\d+$/.test(normalized) && !/^\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
    return Number.NaN
  }

  const price = Number(normalized.replace(/\./g, ''))
  return Number.isSafeInteger(price) ? price : Number.NaN
}

export function productInputFromForm(
  form: FormData,
  imageUrl: string,
) {
  const value = (key: string) => {
    const entry = form.get(key)
    return typeof entry === 'string' ? entry : ''
  }

  return {
    code: value('code'),
    name: value('name'),
    category: value('category'),
    size: value('size'),
    productColor: value('productColor'),
    measurements: value('measurements'),
    purchaseCost: Number(value('purchaseCost')),
    price: parseProductPrice(value('price')),
    conditionNote: value('conditionNote'),
    imageUrl,
    imageAlt: value('imageAlt'),
    imageTone: value('imageTone'),
    photoMood: value('photoMood'),
    fabricCheck: value('fabricCheck'),
    seamsCheck: value('seamsCheck'),
    buttonsCheck: value('buttonsCheck'),
    zipperCheck: value('zipperCheck'),
    inspectionStatus: value('inspectionStatus'),
    cleaningCondition: value('cleaningCondition'),
    productCondition: value('productCondition'),
    completeness: value('completeness'),
    damageType: value('damageType'),
    damageNote: value('damageNote'),
    searchTerms: value('searchTerms'),
  }
}
