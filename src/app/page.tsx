import Storefront from '@/app/storefront'
import { getPublicProducts } from '@/lib/product-repository'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const products = await getPublicProducts()
  return <Storefront products={products} />
}
