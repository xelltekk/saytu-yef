import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ rpc:vi.fn(), context:vi.fn() }))
vi.mock('./client', () => ({ createClient:() => ({ rpc:mocks.rpc }), ensureBrowserSupabaseSession:async () => {} }))
vi.mock('./account', () => ({ getAccountContext:mocks.context }))
import { getCatalogueExport, getCataloguePage, lookupCatalogueCode } from './catalogue'

beforeEach(() => {
  mocks.rpc.mockReset()
  mocks.context.mockReset().mockResolvedValue({user:{id:'cashier'},business:{id:'owner'}})
})
const response = (offset = 0,version = 'stable') => ({ data:{ownerId:'owner',version,offset,limit:50,totalGroups:101,
  products:[{id:`product-${offset}`,user_id:'owner'}]},error:null })
it('exports every matching page without photos instead of only visible products', async () => {
  mocks.rpc.mockImplementation((_name,args) => Promise.resolve(response(args.p_options.offset)))
  const products = await getCatalogueExport({search:'chaussure',category:'category'})
  expect(products).toHaveLength(3)
  expect(mocks.rpc.mock.calls.map((call) => call[1].p_options.offset)).toEqual([0,50,100])
  expect(mocks.rpc.mock.calls.every((call) => call[1].p_options.images===false && call[1].p_options.search==='chaussure')).toBe(true)
})
it('refuses an incomplete export if stock or catalogue changes between pages', async () => {
  mocks.rpc.mockResolvedValueOnce(response()).mockResolvedValueOnce(response(50,'changed'))
  await expect(getCatalogueExport({})).rejects.toThrow(/catalogue a change/)
})
it('fails with an actionable migration message without falling back to the entire catalogue', async () => {
  mocks.rpc.mockResolvedValue({data:null,error:{code:'PGRST202',message:'missing'}})
  await expect(getCataloguePage({})).rejects.toThrow(/migration/)
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
})
it('rejects another shop result and an identity change during a request', async () => {
  mocks.rpc.mockResolvedValue({...response(),data:{...response().data,ownerId:'other'}})
  await expect(getCataloguePage({})).rejects.toThrow(/Session modifiee/)
  mocks.rpc.mockResolvedValue(response())
  mocks.context.mockResolvedValueOnce({user:{id:'cashier'},business:{id:'owner'}})
    .mockResolvedValueOnce({user:{id:'other'},business:{id:'owner'}})
  await expect(getCataloguePage({})).rejects.toThrow(/Session modifiee/)
})
it('uses exact server lookup outside the loaded page without losing code punctuation', async () => {
  mocks.rpc.mockResolvedValue({data:{ownerId:'owner',product:{id:'off-page'}},error:null})
  expect((await lookupCatalogueCode(' CODE-123 ', 'pos'))?.id).toBe('off-page')
  expect(mocks.rpc).toHaveBeenCalledWith('lookup_catalogue_code',{p_code:'CODE-123',p_scope:'pos'})
})
it('rejects a stale result if the same cashier changes shops while the request is pending', async () => {
  mocks.rpc.mockResolvedValue(response())
  mocks.context.mockResolvedValueOnce({user:{id:'cashier'},business:{id:'owner'}})
    .mockResolvedValueOnce({user:{id:'cashier'},business:{id:'new-owner'}})
  await expect(getCataloguePage({})).rejects.toThrow(/Session modifiee/)
})
