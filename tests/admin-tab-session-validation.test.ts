import assert from 'node:assert/strict'
import test from 'node:test'
import { hasPermission } from '../src/lib/auth-types'
import {
  hasMatchingAdminTabContext,
  isActiveAdminTabSession,
} from '../src/lib/admin-tab-session-validation'

const tabId = 'c41b1ee6-d778-4af0-9c31-a45d29390893'
const otherTabId = '76bc1073-8db5-4db4-b3f5-1a3e245f846c'
const sessionId = 'ca211b85-3c8d-4c79-9602-43cfb52842d8'
const staffId = '0b117ab9-a5aa-4ca2-95e3-f12c344db5d7'

type TestSessionRow = {
  session_id: string
  staff_user_id: string
  tab_id: string
  email: string
  name: string
  role: unknown
  active: number
  revoked_at: Date | string | null
  is_unexpired: number
}

function createSessionRow(
  overrides: Partial<TestSessionRow> = {},
): TestSessionRow {
  return {
    session_id: sessionId,
    staff_user_id: staffId,
    tab_id: tabId,
    email: 'finance@example.test',
    name: 'Finance',
    role: 'finance',
    active: 1,
    revoked_at: null,
    is_unexpired: 1,
    ...overrides,
  }
}

function isValidSession(
  row: TestSessionRow | undefined = createSessionRow(),
  requestTabId: unknown = tabId,
) {
  return isActiveAdminTabSession({
    requestTabId,
    tokenTabId: tabId,
    sessionId,
    staffId,
    row,
  })
}

test('accepts a session whose request, token, and database tab IDs match', () => {
  assert.equal(hasMatchingAdminTabContext({
    requestTabId: tabId,
    tokenTabId: tabId,
    staffId,
    sessionId,
  }), true)
  assert.equal(isValidSession(), true)
})

test('rejects a session when the request uses a different tab ID', () => {
  assert.equal(hasMatchingAdminTabContext({
    requestTabId: otherTabId,
    tokenTabId: tabId,
    staffId,
    sessionId,
  }), false)
  assert.equal(isValidSession(createSessionRow(), otherTabId), false)
  assert.equal(isValidSession(createSessionRow({ tab_id: otherTabId })), false)
})

test('rejects revoked or expired sessions', () => {
  assert.equal(isValidSession(createSessionRow({ revoked_at: new Date() })), false)
  assert.equal(isValidSession(createSessionRow({ is_unexpired: 0 })), false)
})

test('rejects inactive accounts and roles that cannot log in', () => {
  assert.equal(isValidSession(createSessionRow({ active: 0 })), false)
  assert.equal(isValidSession(createSessionRow({ role: 'technology' })), false)
})

test('retains role-based permission checks', () => {
  assert.equal(hasPermission('finance', 'sales:pay'), true)
  assert.equal(hasPermission('finance', 'products:write'), false)
  assert.equal(hasPermission('super_admin', 'logistics:manage'), true)
})
