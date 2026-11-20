import { redirect } from 'next/navigation'
import { adminTabPath } from '@/lib/admin-tab-path'
import { currentAdminTabId } from '@/lib/admin-tab-session'

export default async function PosPage() {
  const tabId = await currentAdminTabId()
  redirect(tabId ? adminTabPath(tabId, '/admin?section=operations') : '/admin/login')
}
