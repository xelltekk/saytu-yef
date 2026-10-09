import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), query: vi.fn(), ensure: vi.fn(),
}))
vi.mock('./client', () => ({
  ensureBrowserSupabaseSession: mocks.ensure,
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({ select: () => ({ eq: (_key: string, id: string) => ({ maybeSingle: () => mocks.query(id) }) }) }),
  }),
}))
import { getAccountContext, getAuthenticatedUser, invalidateAccountContext } from './account'

describe('shared account reads', () => {
  beforeEach(() => {
    invalidateAccountContext()
    vi.clearAllMocks()
    mocks.ensure.mockResolvedValue(true)
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'cashier' } }, error: null })
    mocks.query.mockImplementation(async (id: string) => ({ data: id === 'cashier' ? { id, role: 'cashier', account_owner_id: 'owner' } : { id, business_logo_url: 'https://example.com/logo.png' }, error: null }))
  })
  it('coalesces profile and auth reads from simultaneous consumers', async () => {
    const contexts = await Promise.all(Array.from({ length: 8 }, () => getAccountContext()))
    expect(mocks.getUser).toHaveBeenCalledTimes(1)
    expect(mocks.query).toHaveBeenCalledTimes(2)
    expect(contexts[0].member?.role).toBe('cashier')
    expect(contexts[0].business?.id).toBe('owner')
    expect(contexts[0].business?.business_logo_url).toContain('logo.png')
  })
  it('does not retain another account after invalidation', async () => {
    await getAccountContext()
    invalidateAccountContext()
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'new-owner' } }, error: null })
    expect((await getAccountContext()).user.id).toBe('new-owner')
  })
  it('retries failed identity checks without clearing stored sessions', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('Network error') })
    await expect(getAccountContext()).rejects.toThrow('Network error')
    await expect(getAccountContext()).resolves.toHaveProperty('user.id', 'cashier')
  })
  it('never caches standalone validated identity checks', async () => {
    await getAuthenticatedUser()
    await getAuthenticatedUser()
    expect(mocks.getUser).toHaveBeenCalledTimes(2)
  })
})
