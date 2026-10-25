import { expect, it } from 'vitest'
import { canEditTeamMember, filterTeamMembers, validateTeamMember } from './team'
import type { TeamMember } from '@/types'
const owner = { id: 'owner', role: 'admin', email: 'owner@test.fr', created_at: '' } as TeamMember
const staff = { id: 'staff', account_owner_id: 'owner', role: 'cashier', full_name: 'Fatou Diene', email: 'fatou@test.fr', created_at: '' } as TeamMember
it('validates and trims names without accepting unknown roles', () => {
  expect(validateTeamMember({ full_name: ' Fatou ', role: 'cashier' }).full_name).toBe('Fatou')
  for (const full_name of ['', '  ', 'x'.repeat(121)]) expect(() => validateTeamMember({ full_name, role: 'employee' })).toThrow(/nom/)
  expect(() => validateTeamMember({ full_name: 'Nom', role: 'root' as TeamMember['role'] })).toThrow(/Role/)
})
it('protects the owner, self and other businesses while permitting delegated admins', () => {
  expect(canEditTeamMember(owner, staff)).toBe(true)
  expect(canEditTeamMember(owner, owner)).toBe(false)
  expect(canEditTeamMember(owner, { ...staff, account_owner_id: 'elsewhere' })).toBe(false)
  expect(canEditTeamMember(staff, owner)).toBe(false)
  const admin = { ...staff, role: 'admin' as const }
  expect(canEditTeamMember(admin, admin)).toBe(false)
  expect(canEditTeamMember(admin, { ...staff, id: 'other-staff' })).toBe(true)
})
it('combines name/email search with role filters, ignoring case and accents', () => {
  const people = [owner, { ...staff, full_name: 'Fatou Diéne' }]
  expect(filterTeamMembers(people, 'DIENE', 'cashier')).toHaveLength(1)
  expect(filterTeamMembers(people, 'fatou@', 'employee')).toHaveLength(0)
  expect(filterTeamMembers(people, 'owner@', '')).toEqual([owner])
})
