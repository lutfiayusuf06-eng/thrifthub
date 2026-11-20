import { requireStaffPermission } from '@/lib/staff-access'
import { getAdminSaleDetail } from '@/lib/admin-repository'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteContext) {
  const access = await requireStaffPermission('sales:read')
  if (!access.ok) return access.response

  const { id } = await params
  const canReadBuyerDetails = access.user.role === 'finance' ||
    access.user.role === 'manager' ||
    access.user.role === 'super_admin'
  const sale = await getAdminSaleDetail(id, canReadBuyerDetails)
  if (!sale) return Response.json({ error: 'Transaksi tidak ditemukan.' }, { status: 404 })
  return Response.json({ sale })
}
