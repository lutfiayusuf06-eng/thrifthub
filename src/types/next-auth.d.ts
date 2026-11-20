import type { DefaultSession, DefaultUser } from 'next-auth'
import type { UserRole } from '@/lib/auth-types'

declare module 'next-auth' {
  interface User extends DefaultUser {
    role: UserRole
    tabId: string
  }

  interface Session {
    sessionId: string
    tabId: string
    user: {
      id: string
      role: UserRole
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: UserRole
    sid?: string
    tabId?: string
  }
}
