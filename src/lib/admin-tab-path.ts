export const ADMIN_TAB_PREFIX = '/__thrifthub'
export const ADMIN_TAB_ID_HEADER = 'x-thrifthub-tab-id'
export const ADMIN_TAB_STORAGE_KEY = 'thrifthub.admin-tab-id'

const tabIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isAdminTabId(value: unknown): value is string {
  return typeof value === 'string' && tabIdPattern.test(value)
}

export function adminTabIdFromPathname(pathname: string): string | null {
  const match = pathname.match(
    /^\/__thrifthub\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?=\/|$)/i,
  )
  return match?.[1]?.toLowerCase() ?? null
}

export function adminTabPath(tabId: string, path: string): string {
  if (!isAdminTabId(tabId)) {
    throw new Error('Identitas tab admin tidak valid.')
  }
  if (!path.startsWith('/')) {
    throw new Error('Path admin harus dimulai dengan /.')
  }

  return `${ADMIN_TAB_PREFIX}/${tabId.toLowerCase()}${path}`
}
