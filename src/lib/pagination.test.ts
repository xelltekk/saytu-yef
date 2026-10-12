import { expect, it } from 'vitest'
import { readAllPages } from './pagination'

it('does not silently stop at the database row limit', async () => {
  const rows = Array.from({ length: 1201 }, (_, id) => ({ id }))
  expect((await readAllPages(async (from, to) => ({ data: rows.slice(from, to + 1), error: null }))).data).toHaveLength(1201)
})
it('propagates failed pages rather than returning incomplete reports', async () => {
  await expect(readAllPages(async () => ({ data: null, error: new Error('network') }))).rejects.toThrow('network')
})
