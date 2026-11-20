import { adminTabIdFromPathname, adminTabPath } from '@/lib/admin-tab-path'

export function adminTabFetch(input: string, init?: RequestInit): Promise<Response> {
  const tabId = adminTabIdFromPathname(window.location.pathname)
  if (!tabId || !input.startsWith('/api/admin/')) {
    throw new Error('Permintaan admin tidak memiliki konteks tab yang valid.')
  }
  return fetch(adminTabPath(tabId, input), init)
}

export function adminTabUrl(tabId: string, path: string): string {
  if (!path.startsWith('/admin')) {
    throw new Error('Navigasi admin harus menuju halaman admin.')
  }
  return adminTabPath(tabId, path)
}

export function currentAdminTabUrl(path: string): string {
  const tabId = adminTabIdFromPathname(window.location.pathname)
  if (!tabId) {
    throw new Error('Navigasi admin tidak memiliki konteks tab yang valid.')
  }
  return adminTabUrl(tabId, path)
}
