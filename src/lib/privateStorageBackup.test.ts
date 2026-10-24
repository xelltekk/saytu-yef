import { expect, it, vi } from 'vitest'
import { fetchPrivateBackup, validatePrivateBackupRequest } from '../../scripts/backup-private-storage.mjs'
const request = {bucket:'expense-receipts',name:'10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001.jpg',size:3,etag:'"v1"'}
it('only allows bounded expense receipt downloads, not arbitrary URLs or traversal', () => {
  expect(validatePrivateBackupRequest(request)).toEqual(request)
  for (const changed of [{bucket:'other'},{name:'../private'},{name:'https://example.invalid/photo.jpg'},{size:5242881},{size:0}]) expect(() => validatePrivateBackupRequest({...request,...changed})).toThrow()
})
it('downloads private files using server credentials and refuses redirects or versions that changed',async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(new Uint8Array([1,2,3]),{headers:{etag:'"v1"','content-length':'3'}}))
  expect([...await fetchPrivateBackup(request,'fake-server-key',fetcher)]).toEqual([1,2,3])
  expect(fetcher.mock.calls[0][0]).toContain('/object/authenticated/expense-receipts/')
  expect(fetcher.mock.calls[0][1].redirect).toBe('error')
  fetcher.mockResolvedValue(new Response('bad',{headers:{etag:'"v2"'}}))
  await expect(fetchPrivateBackup(request,'fake-server-key',fetcher)).rejects.toThrow(/version/)
  fetcher.mockResolvedValue(new Response('denied',{status:401}))
  await expect(fetchPrivateBackup(request,'fake-server-key',fetcher)).rejects.toThrow(/HTTP 401/)
})
it('never declares an incomplete or oversized binary response as a complete backup',async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(new Uint8Array([1,2]),{headers:{etag:'"v1"'}}))
  await expect(fetchPrivateBackup(request,'fake-server-key',fetcher)).rejects.toThrow(/incomplet/)
  fetcher.mockResolvedValue(new Response(new Uint8Array([1,2,3,4]),{headers:{etag:'"v1"'}}))
  await expect(fetchPrivateBackup(request,'fake-server-key',fetcher)).rejects.toThrow(/volumineux/)
})
