import { NextResponse, type NextRequest } from 'next/server'
import {
  ADMIN_TAB_ID_HEADER,
  ADMIN_TAB_PREFIX,
  isAdminTabId,
} from '@/lib/admin-tab-path'

const protectedTabRoots = ['/admin', '/api/admin', '/api/auth'] as const

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete(ADMIN_TAB_ID_HEADER)

  const pathname = request.nextUrl.pathname
  if (!pathname.startsWith(`${ADMIN_TAB_PREFIX}/`)) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  const [, , rawTabId, ...segments] = pathname.split('/')
  if (!isAdminTabId(rawTabId)) {
    return new Response('Not found', { status: 404 })
  }

  const tabPath = segments.length ? `/${segments.join('/')}` : '/'
  if (!protectedTabRoots.some((root) => tabPath === root || tabPath.startsWith(`${root}/`))) {
    return new Response('Not found', { status: 404 })
  }

  requestHeaders.set(ADMIN_TAB_ID_HEADER, rawTabId.toLowerCase())
  const destination = request.nextUrl.clone()
  destination.pathname = tabPath
  return NextResponse.rewrite(destination, { request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
