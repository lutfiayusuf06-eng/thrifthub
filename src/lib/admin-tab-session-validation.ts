import { isAdminTabId } from './admin-tab-path'
import { isStaffLoginAllowed, type UserRole } from './auth-types'

export type ActiveAdminTabSessionRow = {
  session_id: string
  staff_user_id: string
  tab_id: string
  email: string
  name: string
  role: UserRole
  active: 1
  revoked_at: null
  is_unexpired: 1
}

type SessionValidationInput = {
  requestTabId: unknown
  tokenTabId: unknown
  sessionId: unknown
  staffId: unknown
  row: unknown
}

type AdminTabContextInput = {
  requestTabId: unknown
  tokenTabId: unknown
  staffId: unknown
  sessionId: unknown
}

type ValidAdminTabContext = {
  requestTabId: string
  tokenTabId: string
  staffId: string
  sessionId: string
}

function isActiveSessionRow(value: unknown): value is ActiveAdminTabSessionRow {
  if (typeof value !== 'object' || value === null) return false
  if (!('session_id' in value) || !('staff_user_id' in value) || !('tab_id' in value)) return false
  if (!('email' in value) || !('name' in value) || !('role' in value)) return false
  if (!('active' in value) || !('revoked_at' in value) || !('is_unexpired' in value)) return false

  return typeof value.session_id === 'string' &&
    typeof value.staff_user_id === 'string' &&
    typeof value.tab_id === 'string' &&
    typeof value.email === 'string' &&
    typeof value.name === 'string' &&
    isStaffLoginAllowed(value.role) &&
    value.active === 1 &&
    value.revoked_at === null &&
    Number(value.is_unexpired) === 1
}

export function hasMatchingAdminTabContext(
  input: AdminTabContextInput,
): input is AdminTabContextInput & ValidAdminTabContext {
  return isAdminTabId(input.requestTabId) &&
    input.tokenTabId === input.requestTabId &&
    typeof input.staffId === 'string' &&
    typeof input.sessionId === 'string'
}

export function isActiveAdminTabSession(
  input: SessionValidationInput,
): input is SessionValidationInput & { row: ActiveAdminTabSessionRow & { role: UserRole } } {
  const { requestTabId, tokenTabId, sessionId, staffId, row } = input
  return hasMatchingAdminTabContext({ requestTabId, tokenTabId, sessionId, staffId }) &&
    isActiveSessionRow(row) &&
    row.session_id === sessionId &&
    row.staff_user_id === staffId &&
    row.tab_id === requestTabId
}
