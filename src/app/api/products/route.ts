import { getPublicProducts } from '@/lib/product-repository'

export const dynamic = 'force-dynamic'

export async function GET() {
  const products = await getPublicProducts()
  return Response.json({ products })
}
