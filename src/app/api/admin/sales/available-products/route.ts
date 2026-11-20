import { requireStaffPermission } from '@/lib/staff-access'
import { getAvailableSaleProducts } from '@/lib/admin-repository'

export const dynamic = 'force-dynamic'

export async function GET() {
  const access = await requireStaffPermission('sales:create')
  if (!access.ok) return access.response

  const products = await getAvailableSaleProducts()
  return Response.json({ products })
}
