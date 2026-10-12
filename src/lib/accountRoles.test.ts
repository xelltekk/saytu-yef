import { expect, it } from 'vitest'
import { canManageInventory, isAdminRole, normalizeAccountRole } from './accountRoles'
it('never treats a missing or unknown role as an administrator', () => {
  for (const value of [null,undefined,'owner','superadmin']) {
    expect(isAdminRole(value)).toBe(false)
    expect(canManageInventory(value)).toBe(false)
  }
  expect(normalizeAccountRole('admin')).toBe('admin')
  expect(normalizeAccountRole('employee')).toBe('employee')
})
