import { beforeEach, expect, it, vi } from 'vitest'
import type { Product } from '@/types'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), context: vi.fn(), from: vi.fn(), eq: vi.fn(), single: vi.fn(), abort: vi.fn() }))
vi.mock('./client', () => ({ createClient: () => ({ rpc: mocks.rpc, from: mocks.from }), ensureBrowserSupabaseSession: async () => {} }))
vi.mock('./account', () => ({ getAccountContext: mocks.context }))
import { getInventoryProductTarget } from './catalogue'

const id = '11111111-1111-4111-8111-111111111111'
const groupId = '22222222-2222-4222-8222-222222222222'
const account = { user: { id: 'cashier' }, business: { id: 'owner' }, member: { role: 'cashier' } }
const product = { id, user_id: 'owner', product_group_id: groupId, name: 'Telephone', quantity: 0, selling_price: 1000,
  min_quantity: 5, status: 'active', color: 'Noir', currency: 'XOF', created_at: '2026-01-01', updated_at: '2026-01-01' } as Product
const page = (products = [product]) => ({ data: { ownerId: 'owner', products }, error: null })

beforeEach(() => {
  vi.resetAllMocks()
  mocks.context.mockResolvedValue(account)
  const query = { select: vi.fn().mockReturnThis(), eq: mocks.eq, maybeSingle: mocks.single, abortSignal: mocks.abort }
  mocks.eq.mockReturnValue(query)
  mocks.abort.mockReturnValue(query)
  mocks.from.mockReturnValue(query)
  mocks.single.mockResolvedValue({ data: { id, product_group_id: groupId }, error: null })
  mocks.rpc.mockResolvedValue(page())
})

it('fetches only the matching group, retains zero-stock variants and enforces shop ownership', async () => {
  mocks.rpc.mockResolvedValue(page([product, { ...product, id: 'sibling', color: 'Blanc' }]))
  const result = await getInventoryProductTarget(id)
  expect(result?.product.id).toBe(id)
  expect(result?.product.quantity).toBe(0)
  expect(result?.group.variants).toHaveLength(2)
  expect(mocks.eq.mock.calls).toEqual([['user_id', 'owner'], ['id', id]])
  expect(mocks.rpc).toHaveBeenCalledWith('list_catalogue_page', { p_options: { scope: 'inventory', group: groupId, limit: 1, code: '' } })
})

it('does not query the database for an invalid identifier', async () => {
  expect(await getInventoryProductTarget('bad&other=1')).toBeNull()
  expect(mocks.from).not.toHaveBeenCalled()
})

it('returns missing for a deleted or inaccessible product without loading the entire catalogue', async () => {
  mocks.single.mockResolvedValue({ data: null, error: null })
  expect(await getInventoryProductTarget(id)).toBeNull()
  expect(mocks.rpc).not.toHaveBeenCalled()
})

it('never substitutes a sibling if the requested variant was deleted between queries', async () => {
  mocks.rpc.mockResolvedValue(page([{ ...product, id: 'sibling' }]))
  expect(await getInventoryProductTarget(id)).toBeNull()
})

it('also resolves products without a variant group', async () => {
  mocks.single.mockResolvedValue({ data: { id, product_group_id: null }, error: null })
  mocks.rpc.mockResolvedValue(page([{ ...product, product_group_id: null }]))
  expect((await getInventoryProductTarget(id))?.group.id).toBe(id)
})

it.each([
  { ...account, user: { id: 'other' } },
  { ...account, business: { id: 'other' } },
  { ...account, member: { role: 'admin' } },
])('rejects a result after an account, shop or role change', async (changed) => {
  mocks.context.mockResolvedValueOnce(account).mockResolvedValueOnce(account).mockResolvedValueOnce(account).mockResolvedValueOnce(changed)
  await expect(getInventoryProductTarget(id)).rejects.toThrow(/Session modifiee/)
})

it('propagates database failures instead of opening an unrelated product', async () => {
  mocks.single.mockResolvedValue({ data: null, error: { message: 'Database unavailable' } })
  await expect(getInventoryProductTarget(id)).rejects.toThrow('Database unavailable')
})

it('forwards cancellation to both the direct lookup and the scoped group request', async () => {
  const signal = new AbortController().signal
  const groupAbort = vi.fn().mockResolvedValue(page())
  mocks.rpc.mockReturnValue({ abortSignal: groupAbort })
  expect((await getInventoryProductTarget(id, signal))?.product.id).toBe(id)
  expect(mocks.abort).toHaveBeenCalledWith(signal)
  expect(groupAbort).toHaveBeenCalledWith(signal)
})
