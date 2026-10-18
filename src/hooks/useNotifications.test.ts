import { expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/client', () => ({}))
import { buildLowStockNotifications } from './useNotifications'

it('links each low-stock alert to its exact variant, including an out-of-stock variant', () => {
  const row = { name: 'Iphone 8', quantity: 5, min_quantity: 5, status: 'active' as const, updated_at: '2026-10-17' }
  const items = buildLowStockNotifications([
    { ...row, id: 'black' }, { ...row, id: 'white', quantity: 0 },
    { ...row, id: 'restaurant', track_stock: false }, { ...row, id: 'inactive', status: 'inactive' },
    { ...row, id: 'enough', quantity: 6 },
  ])
  expect(items.map((item) => item.href)).toEqual(['/inventory?product=white', '/inventory?product=black'])
  expect(items[0].tone).toBe('danger')
})

it('encodes identifiers rather than allowing them to inject other navigation parameters', () => {
  const [item] = buildLowStockNotifications([{ id: 'id&other=1', name: 'Test', quantity: 1, min_quantity: 2, status: 'active', updated_at: '' }])
  expect(item.href).toBe('/inventory?product=id%26other%3D1')
})
