import type { TeamMember, User } from '@/types'

export type AccountRole = User['role']

export const ACCOUNT_ROLE_LABELS: Record<AccountRole, string> = {
  admin: 'Administrateur',
  employee: 'Employé',
  cashier: 'Caisse',
}

export const TEAM_ROLE_OPTIONS: Array<{
  value: TeamMember['role']
  label: string
  teamLabel: string
}> = [
  {
    value: 'cashier',
    label: 'Caisse — ventes, stock, clients et rapports personnels',
    teamLabel: 'Caisse',
  },
  {
    value: 'employee',
    label: 'Employé — accès opérationnel élargi',
    teamLabel: 'Employé',
  },
  {
    value: 'admin',
    label: 'Administrateur — accès complet',
    teamLabel: 'Administrateur',
  },
]

const CASHIER_ALLOWED_PREFIXES = ['/sales', '/inventory', '/clients', '/reports'] as const
const CASHIER_BLOCKED_PREFIXES = ['/dashboard', '/suppliers', '/team', '/settings', '/abroad'] as const

function matchesRoutePrefix(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function normalizeAccountRole(value: unknown): AccountRole {
  if (value === 'cashier') return 'cashier'
  if (value === 'employee') return 'employee'
  return 'admin'
}

export function isCashierRole(value: unknown): value is 'cashier' {
  return normalizeAccountRole(value) === 'cashier'
}

export function isAdminRole(value: unknown): value is 'admin' {
  return normalizeAccountRole(value) === 'admin'
}

export function getRoleLandingPath(role: unknown) {
  return isCashierRole(role) ? '/sales' : '/dashboard'
}

export function isCashierRestrictedRoute(pathname: string) {
  return matchesRoutePrefix(pathname, CASHIER_BLOCKED_PREFIXES)
}

export function canCashierAccessPath(pathname: string) {
  return matchesRoutePrefix(pathname, CASHIER_ALLOWED_PREFIXES)
}

export function canManageInventory(role: unknown) {
  return !isCashierRole(role)
}

export function canUseAbroadEntry(role: unknown) {
  return !isCashierRole(role)
}

export function canOpenSettings(role: unknown) {
  return !isCashierRole(role)
}
