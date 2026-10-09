import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ context: vi.fn(), invalidate: vi.fn(), callback: null as null | ((event: string, session: unknown) => void) }))
vi.mock('@/lib/supabase/account', () => ({ getAccountContext: mocks.context, invalidateAccountContext: mocks.invalidate }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { onAuthStateChange: (callback: typeof mocks.callback) => { mocks.callback = callback } } }) }))

describe('shared account lifecycle', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('window', { setTimeout, addEventListener: vi.fn() })
  })
  it('initial auth callback does not invalidate an in-flight profile', async () => {
    const state = await import('./accountStore')
    const user = { id: 'owner' }
    mocks.context.mockResolvedValue({ user, member: { id: 'owner', role: 'admin' }, business: { id: 'owner' } })
    state.startAccountSubscription()
    mocks.callback?.('INITIAL_SESSION', { user })
    await state.refreshAccount()
    expect(state.useAccountStore.getState().member?.role).toBe('admin')
    expect(mocks.invalidate).not.toHaveBeenCalled()
    expect(mocks.context).toHaveBeenCalledTimes(1)
  })
  it('late requests cannot restore an account after sign-out', async () => {
    const state = await import('./accountStore')
    let resolve!: (value: unknown) => void
    mocks.context.mockReturnValue(new Promise((done) => { resolve = done }))
    state.startAccountSubscription()
    const request = state.refreshAccount()
    mocks.callback?.('SIGNED_OUT', null)
    resolve({ user: { id: 'old-owner' }, member: { id: 'old-owner', role: 'admin' }, business: { id: 'old-owner' } })
    await request
    expect(state.useAccountStore.getState().user).toBeNull()
    expect(state.useAccountStore.getState().member).toBeNull()
  })
  it('forced refresh supersedes a pending profile read', async () => {
    const state = await import('./accountStore')
    let resolve!: (value: unknown) => void
    mocks.context.mockReturnValueOnce(new Promise((done) => { resolve = done }))
    const old = state.refreshAccount()
    mocks.context.mockResolvedValue({ user: { id: 'owner' }, member: { id: 'owner', role: 'admin' }, business: { id: 'owner', business_logo_url: 'new.png' } })
    await state.refreshAccount(true)
    resolve({ user: { id: 'owner' }, member: { id: 'owner', role: 'admin' }, business: { id: 'owner', business_logo_url: 'old.png' } })
    await old
    expect(state.useAccountStore.getState().business?.business_logo_url).toBe('new.png')
  })
})
