import { signOut } from '@/auth'
import { redirect } from 'next/navigation'
import { hasPermission } from '@/lib/auth-types'
import { adminTabPath } from '@/lib/admin-tab-path'
import { currentAdminTabId } from '@/lib/admin-tab-session'
import { requireStaff } from '@/lib/staff-access'
import {
  getAdminProductSummary,
  getAdminProducts,
  getAdminSales,
  getAvailableSaleProducts,
} from '@/lib/admin-repository'
import { getPublicProducts } from '@/lib/product-repository'
import AdminDashboard from './dashboard'

export const dynamic = 'force-dynamic'

type AdminHomePageProps = {
  searchParams: Promise<{ section?: string }>
}

export default async function AdminHomePage({ searchParams }: AdminHomePageProps) {
  const tabId = await currentAdminTabId()
  if (!tabId) redirect('/admin/login')
  const sessionTabId = tabId

  const access = await requireStaff()
  if (!access.ok) redirect(adminTabPath(sessionTabId, '/admin/login'))

  const { section: requestedSection } = await searchParams
  const role = access.user.role
  const canReadProducts = hasPermission(role, 'products:read')
  const canReadCatalog = hasPermission(role, 'products:catalog:read')
  const canReadSales = hasPermission(role, 'sales:read')
  const canCreateSales = hasPermission(role, 'sales:create')
  const productSectionRequested = requestedSection === 'products'
  const [products, productSummary, sales, saleProducts, catalogProducts] = await Promise.all([
    canReadProducts ? getAdminProducts(productSectionRequested ? null : 250) : Promise.resolve([]),
    canReadProducts ? getAdminProductSummary() : Promise.resolve(null),
    canReadSales
      ? getAdminSales(
        (role === 'finance' && requestedSection === 'operations') ||
        (role === 'super_admin' && requestedSection === 'finance')
          ? null
          : 50,
      )
      : Promise.resolve([]),
    canCreateSales ? getAvailableSaleProducts() : Promise.resolve([]),
    canReadCatalog ? getPublicProducts() : Promise.resolve([]),
  ])

  async function logout() {
    'use server'
    await signOut({ redirectTo: adminTabPath(sessionTabId, '/admin/login') })
  }

  return (
    <AdminDashboard
      key={requestedSection ?? 'overview'}
      tabId={sessionTabId}
      role={role}
      requestedSection={requestedSection}
      userName={access.user.name ?? access.user.email ?? 'Anggota ThriftHub'}
      products={products}
      productSummary={productSummary}
      sales={sales}
      saleProducts={saleProducts}
      catalogProducts={catalogProducts}
      logout={logout}
    />
  )
}
