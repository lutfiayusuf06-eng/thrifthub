'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ADMIN_TAB_STORAGE_KEY,
  adminTabIdFromPathname,
  adminTabPath,
} from '@/lib/admin-tab-path'

export default function TabSessionBootstrap() {
  const router = useRouter()

  useEffect(() => {
    const pathname = window.location.pathname
    const existingTabId = adminTabIdFromPathname(pathname)
    if (existingTabId) {
      sessionStorage.setItem(ADMIN_TAB_STORAGE_KEY, existingTabId)
      return
    }

    const tabId = crypto.randomUUID()
    sessionStorage.setItem(ADMIN_TAB_STORAGE_KEY, tabId)
    const query = window.location.search
    router.replace(`${adminTabPath(tabId, pathname)}${query ? `?${query}` : ''}`)
  }, [router])

  return null
}
