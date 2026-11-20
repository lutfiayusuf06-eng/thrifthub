export const userRoles = [
  'manager',
  'operator',
  'products',
  'technology',
  'marketing',
  'finance',
  'logistics',
  'super_admin',
] as const

export const assignableUserRoles = [
  'manager',
  'products',
  'finance',
  'logistics',
] as const

export type UserRole = (typeof userRoles)[number]
export type AssignableUserRole = (typeof assignableUserRoles)[number]

export const staffRoleLabels: Record<UserRole, string> = {
  manager: 'Ketua Tim / Manajer Usaha',
  operator: 'Operator lama (akses sebelumnya)',
  products: 'Divisi Produk dan Persediaan',
  technology: 'Divisi Teknologi dan Website',
  marketing: 'Divisi Pemasaran dan Pelayanan Konsumen',
  finance: 'Divisi Keuangan dan Administrasi',
  logistics: 'Divisi Logistik dan Distribusi',
  super_admin: 'Super Admin',
}

export const staffPermissions = [
  'team:read',
  'products:read',
  'products:catalog:read',
  'products:write',
  'sales:read',
  'sales:create',
  'sales:pay',
  'logistics:manage',
] as const

export type StaffPermission = (typeof staffPermissions)[number]

const rolePermissions: Record<UserRole, readonly StaffPermission[]> = {
  manager: staffPermissions.filter((permission) => permission !== 'logistics:manage'),
  operator: staffPermissions.filter((permission) => permission !== 'logistics:manage'),
  products: ['team:read', 'products:read', 'products:write'],
  technology: [],
  marketing: [],
  finance: ['team:read', 'sales:read', 'sales:pay'],
  logistics: ['team:read', 'logistics:manage'],
  super_admin: staffPermissions,
}

const disabledLoginRoles = ['technology', 'marketing'] as const

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && userRoles.some((role) => role === value)
}

export function isStaffLoginAllowed(value: unknown): value is UserRole {
  return isUserRole(value) &&
    !disabledLoginRoles.some((role) => role === value)
}

export function isAssignableUserRole(value: unknown): value is AssignableUserRole {
  return typeof value === 'string' &&
    assignableUserRoles.some((role) => role === value)
}

export function hasPermission(
  role: UserRole,
  permission: StaffPermission,
): boolean {
  return rolePermissions[role].includes(permission)
}
