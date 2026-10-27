import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(), insert: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn(),
  getUser: vi.fn(), upload: vi.fn(),
  rpc: vi.fn(),
}))
vi.mock('./client', () => ({ createClient: () => ({ from: mocks.from, rpc: mocks.rpc, auth: { getUser: mocks.getUser } }) }))
vi.mock('./account', () => ({ getAccountContext: vi.fn() }))
vi.mock('./retail', () => ({ uploadProductImage: mocks.upload }))
import { activateAbroadProduct, saveAbroadProduct, updateAbroadProductRecord } from './queries'

const draft = { name: 'Telephone', purchase_price: 100, quantity: 2, currency: 'CNY', source_country: 'CN', synced: true, activated: false, local_id: 'draft-1' }
const image = 'data:image/jpeg;base64,aGVsbG8='
const url = 'https://example.invalid/storage/v1/object/public/product-images/shop/photo.jpg'

beforeEach(() => {
  vi.clearAllMocks()
  const chain = { insert: mocks.insert, update: mocks.update, eq: mocks.eq, select: mocks.select, single: mocks.single }
  mocks.from.mockReturnValue(chain)
  for (const method of [mocks.insert, mocks.update, mocks.eq, mocks.select]) method.mockReturnValue(chain)
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner' } } })
  mocks.single.mockResolvedValue({ data: { ...draft, id: 'saved', image_url: url }, error: null })
  mocks.upload.mockReset().mockResolvedValue(url)
})

it('uploads the offline photo before inserting a URL, leaving the draft unchanged', async () => {
  const pending = { ...draft, image_url: image }
  const saved = await saveAbroadProduct(pending)
  expect(mocks.upload).toHaveBeenCalledWith(image)
  expect(mocks.insert).toHaveBeenCalledWith({ ...draft, image_url: url, user_id: 'owner' })
  expect(saved.image_url).toBe(url)
  expect(pending.image_url).toBe(image)
})

it('does not insert or lose the draft when the upload fails', async () => {
  mocks.upload.mockRejectedValue(new Error('Stockage indisponible'))
  await expect(saveAbroadProduct({ ...draft, image_url: image })).rejects.toThrow('Stockage indisponible')
  expect(mocks.insert).not.toHaveBeenCalled()
})

it('keeps photo-free entries compatible and refuses an expired session before upload', async () => {
  await saveAbroadProduct(draft)
  expect(mocks.upload).not.toHaveBeenCalled()
  expect(mocks.insert).toHaveBeenCalledWith({ ...draft, user_id: 'owner' })
  mocks.getUser.mockResolvedValue({ data: { user: null } })
  await expect(saveAbroadProduct({ ...draft, image_url: image })).rejects.toThrow('Session expirée')
  expect(mocks.upload).not.toHaveBeenCalled()
})

it('returns the persisted URL on edit so the local cache does not keep inline photos', async () => {
  const saved = await updateAbroadProductRecord('saved', { image_url: image })
  expect(mocks.update).toHaveBeenCalledWith({ image_url: url })
  expect(mocks.eq).toHaveBeenCalledWith('id', 'saved')
  expect(saved.image_url).toBe(url)
})

it('removes an existing photo explicitly with null without uploading anything', async () => {
  await updateAbroadProductRecord('saved', { image_url: null })
  expect(mocks.update).toHaveBeenCalledWith({ image_url: null })
  expect(mocks.upload).not.toHaveBeenCalled()
})

it('uses only the atomic RPC for transfers, including replenishment at a product quota', async () => {
  const result = { abroad: { ...draft, transferred_quantity: 1 }, product: { id: 'product' }, transfer: { id: 'receipt', quantity: 1 } }
  mocks.rpc.mockResolvedValue({ data: result, error: null })
  const options = { expected_transferred: 0, sku: 'SKU' }
  expect(await activateAbroadProduct('request', 'source', 1, options)).toEqual(result)
  expect(mocks.rpc).toHaveBeenCalledWith('transfer_abroad_product', { p_request_id: 'request', p_abroad_id: 'source', p_quantity: 1, p_options: options })
  expect(mocks.from).not.toHaveBeenCalled()
})

it('reports missing migrations without falling back to the unsafe two-write transfer', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } })
  await expect(activateAbroadProduct('request', 'source', 1, { expected_transferred: 0, sku: 'SKU' })).rejects.toThrow(/mise a jour/)
  expect(mocks.from).not.toHaveBeenCalled()
})

it('surfaces RPC failures as readable errors', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: 'La quantite depasse le reste' } })
  await expect(activateAbroadProduct('request', 'source', 1, { expected_transferred: 0, sku: 'SKU' })).rejects.toThrow(/quantite depasse/)
})
