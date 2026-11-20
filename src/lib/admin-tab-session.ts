import { headers } from 'next/headers'
import { ADMIN_TAB_ID_HEADER, isAdminTabId } from '@/lib/admin-tab-path'

export function adminTabIdFromHeaders(requestHeaders: Pick<Headers, 'get'>): string | null {
  const tabId = requestHeaders.get(ADMIN_TAB_ID_HEADER)
  return isAdminTabId(tabId) ? tabId.toLowerCase() : null
}

export async function currentAdminTabId(): Promise<string | null> {
  return adminTabIdFromHeaders(await headers())
}
