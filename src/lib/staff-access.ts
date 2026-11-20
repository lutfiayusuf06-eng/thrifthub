import { auth } from '@/auth'
import { currentAdminTabId } from '@/lib/admin-tab-session'
import {
  hasPermission,
  isStaffLoginAllowed,
  type StaffPermission,
  type UserRole,
} from '@/lib/auth-types'

type StaffUser = {
  id: string
  role: UserRole
  email?: string | null
  name?: string | null
}

type StaffAccess =
  | { ok: true; user: StaffUser }
  | { ok: false; response: Response }

export async function requireStaff(
  allowedRoles?: readonly UserRole[],
): Promise<StaffAccess> {
  const session = await auth()
  const tabId = await currentAdminTabId()

  if (
    !session?.user?.id ||
    !session.sessionId ||
    !tabId ||
    session.tabId !== tabId ||
    !isStaffLoginAllowed(session.user.role)
  ) {
    return {
      ok: false,
      response: Response.json({ error: 'Autentikasi diperlukan.' }, { status: 401 }),
    }
  }

  if (allowedRoles && !allowedRoles.includes(session.user.role)) {
    return {
      ok: false,
      response: Response.json({ error: 'Akses tidak diizinkan.' }, { status: 403 }),
    }
  }

  return { ok: true, user: session.user }
}

export async function requireStaffPermission(
  permission: StaffPermission,
  request?: Request,
): Promise<StaffAccess> {
  if (request && !isSameOriginMutation(request)) {
    return {
      ok: false,
      response: Response.json({ error: 'Asal permintaan tidak diizinkan.' }, { status: 403 }),
    }
  }

  const access = await requireStaff()
  if (!access.ok) return access
  if (!hasPermission(access.user.role, permission)) {
    return {
      ok: false,
      response: Response.json({ error: 'Akses tidak diizinkan.' }, { status: 403 }),
    }
  }
  return access
}

function isSameOriginMutation(request: Request): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase())) {
    return true
  }

  const origin = request.headers.get('origin')
  if (!origin) return false

  try {
    return new URL(origin).origin === new URL(request.url).origin
  } catch {
    return false
  }
}
