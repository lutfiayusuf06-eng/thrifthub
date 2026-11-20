import { randomUUID } from 'node:crypto'
import { headers } from 'next/headers'
import type { NextRequest } from 'next/server'
import NextAuth from 'next-auth'
import type { NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { z } from 'zod'
import { isStaffLoginAllowed, isUserRole } from '@/lib/auth-types'
import { adminTabPath, isAdminTabId } from '@/lib/admin-tab-path'
import { adminTabIdFromHeaders } from '@/lib/admin-tab-session'
import {
  hasMatchingAdminTabContext,
  isActiveAdminTabSession,
} from '@/lib/admin-tab-session-validation'
import { getPool } from '@/lib/db'
import type { RowDataPacket } from 'mysql2'

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
})

type StaffRow = RowDataPacket & {
  id: string
  email: string
  name: string
  password_hash: string
  role: unknown
  active: number
}

type AuthDatabaseIdentity = RowDataPacket & {
  database_name: string
  server_port: number
  server_version: string
}

type AuthDiagnosticCategory =
  | 'invalid_input'
  | 'database_target_verified'
  | 'database_target_unexpected'
  | 'account_not_found'
  | 'account_inactive'
  | 'role_unrecognized'
  | 'role_login_disabled'
  | 'tab_context_missing'
  | 'session_invalid'
  | 'password_hash_invalid'
  | 'password_mismatch'

function logAuthDiagnostic(category: AuthDiagnosticCategory) {
  console.info(`[auth-diagnostic] ${category}`)
}

async function getRequestTabId(request?: NextRequest): Promise<string | null> {
  const requestHeaders = request?.headers ?? await headers()
  return adminTabIdFromHeaders(requestHeaders)
}

async function authConfig(request: NextRequest | undefined): Promise<NextAuthConfig> {
  const requestTabId = await getRequestTabId(request)
  const cookiePath = requestTabId
    ? adminTabPath(requestTabId, '/')
    : '/__thrifthub/00000000-0000-4000-8000-000000000000/'

  return {
    secret: process.env.AUTH_SECRET,
    session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
    pages: { signIn: '/admin/login' },
    cookies: {
      sessionToken: {
        name: '__Secure-thrifthub.tab-session-token',
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: cookiePath,
          secure: true,
        },
      },
    },
    providers: [
      Credentials({
        credentials: {
          email: { label: 'Email', type: 'email' },
          password: { label: 'Kata sandi', type: 'password' },
        },
        async authorize(credentials, request) {
          const tabId = adminTabIdFromHeaders(request.headers)
          if (!tabId) {
            logAuthDiagnostic('tab_context_missing')
            return null
          }

          const parsed = loginSchema.safeParse(credentials)
          if (!parsed.success) {
            logAuthDiagnostic('invalid_input')
            return null
          }

          const pool = getPool()
          const [identityRows] = await pool.query<AuthDatabaseIdentity[]>(
            'SELECT DATABASE() AS database_name, @@port AS server_port, VERSION() AS server_version',
          )
          const identity = identityRows[0]
          if (
            identity?.database_name === 'thrifthub' &&
            Number(identity.server_port) === 3306 &&
            identity.server_version.startsWith('5.7.19')
          ) {
            logAuthDiagnostic('database_target_verified')
          } else {
            logAuthDiagnostic('database_target_unexpected')
          }

          const email = parsed.data.email.toLocaleLowerCase('en-US')
          const [rows] = await pool.execute<StaffRow[]>(
            'SELECT id, email, name, password_hash, role, active FROM staff_users WHERE email = ? LIMIT 1',
            [email],
          )
          const user = rows[0]

          if (!user) {
            logAuthDiagnostic('account_not_found')
            return null
          }
          if (!user.active) {
            logAuthDiagnostic('account_inactive')
            return null
          }
          if (!isUserRole(user.role)) {
            logAuthDiagnostic('role_unrecognized')
            return null
          }
          if (!isStaffLoginAllowed(user.role)) {
            logAuthDiagnostic('role_login_disabled')
            return null
          }

          let passwordMatches: boolean
          try {
            passwordMatches = await compare(parsed.data.password, user.password_hash)
          } catch {
            logAuthDiagnostic('password_hash_invalid')
            return null
          }
          if (!passwordMatches) {
            logAuthDiagnostic('password_mismatch')
            return null
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            tabId,
          }
        },
      }),
    ],
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          if (!user.id || !isAdminTabId(user.tabId) || !isUserRole(user.role)) {
            logAuthDiagnostic('tab_context_missing')
            throw new Error('Invalid admin tab context.')
          }

          const sessionId = randomUUID()
          const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000)
          await getPool().execute(
            `INSERT INTO staff_auth_sessions (
              id, staff_user_id, tab_id, expires_at, revoked_at
            ) VALUES (?, ?, ?, ?, NULL)
            ON DUPLICATE KEY UPDATE
              id = VALUES(id),
              staff_user_id = VALUES(staff_user_id),
              expires_at = VALUES(expires_at),
              revoked_at = NULL`,
            [sessionId, user.id, user.tabId, expiresAt],
          )

          token.sub = user.id
          token.role = user.role
          token.tabId = user.tabId
          token.sid = sessionId
        }
        return token
      },
      async session({ session, token }) {
        const context = {
          requestTabId,
          tokenTabId: token.tabId,
          sessionId: token.sid,
          staffId: token.sub,
        }
        if (!hasMatchingAdminTabContext(context)) {
          logAuthDiagnostic('session_invalid')
          throw new Error('Invalid staff session claims.')
        }

        const [rows] = await getPool().execute<RowDataPacket[]>(
          `SELECT s.id AS session_id, s.staff_user_id, s.tab_id,
                  u.email, u.name, u.role, u.active, s.revoked_at,
                  (s.expires_at > CURRENT_TIMESTAMP) AS is_unexpired
           FROM staff_auth_sessions s
           INNER JOIN staff_users u ON u.id = s.staff_user_id
           WHERE s.id = ?
             AND s.staff_user_id = ?
             AND s.tab_id = ?
           LIMIT 1`,
          [context.sessionId, context.staffId, context.requestTabId],
        )
        const sessionValidation = {
          ...context,
          row: rows[0],
        }
        if (!isActiveAdminTabSession(sessionValidation)) {
          logAuthDiagnostic('session_invalid')
          throw new Error('The staff session is no longer active.')
        }
        const activeSession = sessionValidation.row

        if (!session.user) {
          logAuthDiagnostic('session_invalid')
          throw new Error('The staff session has no user.')
        }
        session.sessionId = activeSession.session_id
        session.tabId = activeSession.tab_id
        session.user.id = activeSession.staff_user_id
        session.user.name = activeSession.name
        session.user.email = activeSession.email
        session.user.role = activeSession.role

        return session
      },
    },
    events: {
      async signOut(message) {
        if (!('token' in message)) return
        const sessionId = message.token?.sid
        const tabId = message.token?.tabId
        if (typeof sessionId !== 'string' || !isAdminTabId(tabId)) return
        await getPool().execute(
          `UPDATE staff_auth_sessions
           SET revoked_at = CURRENT_TIMESTAMP
           WHERE id = ? AND tab_id = ? AND revoked_at IS NULL`,
          [sessionId, tabId],
        )
      },
    },
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
