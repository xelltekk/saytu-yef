import { afterEach,describe,expect,it,vi } from 'vitest'
import { GET } from './route'
afterEach(() => vi.unstubAllGlobals())
describe('dependency health checks', () => {
  it('checks real PostgreSQL execution and Auth in parallel', async () => {
    const fetch = vi.fn(async (url: string) => new Response(url.includes('/rpc/') ? 'true' : '{}',{ status:200 }))
    vi.stubGlobal('fetch',fetch)
    const response = await GET()
    expect(response.status).toBe(200)
    expect((await response.json()).dependencies).toEqual({ database:'ok',auth:'ok' })
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(expect.arrayContaining([expect.stringContaining('/rpc/database_health'),expect.stringContaining('/auth/v1/health')]))
  })
  it('does not report a healthy database when Auth alone responds', async () => {
    vi.stubGlobal('fetch',vi.fn(async (url: string) => new Response(url.includes('/rpc/') ? '{}' : '{}',{ status:url.includes('/rpc/') ? 503 : 200 })))
    const response = await GET()
    expect(response.status).toBe(503)
    expect((await response.json()).dependencies).toEqual({ database:'unavailable',auth:'ok' })
  })
  it('fails closed when a dependency request throws', async () => {
    vi.stubGlobal('fetch',vi.fn(async () => { throw new Error('offline') }))
    expect((await GET()).status).toBe(503)
  })
})
