import { expect,it } from 'vitest'
import { resolveReportsRange } from './reports'

it('rejects invalid calendar dates instead of moving them to another month',() => {
  expect(() => resolveReportsRange({preset:'custom',startDate:'2026-02-30',endDate:'2026-03-01'})).toThrow(/date/)
})
it('uses an exclusive next-day boundary and daily buckets for short ranges',() => {
  const r=resolveReportsRange({preset:'custom',startDate:'2026-02-01',endDate:'2026-02-28'})
  expect(r.start.getDate()).toBe(1);expect(r.endExclusive.getMonth()).toBe(2);expect(r.endExclusive.getDate()).toBe(1)
  expect(r.granularity).toBe('day')
})
it('uses monthly buckets for annual data and rejects reversed or oversized ranges',() => {
  expect(resolveReportsRange({preset:'custom',startDate:'2026-01-01',endDate:'2026-12-31'}).granularity).toBe('month')
  expect(() => resolveReportsRange({preset:'custom',startDate:'2026-10-02',endDate:'2026-10-01'})).toThrow(/anterieure/)
  expect(() => resolveReportsRange(Infinity)).toThrow(/10 ans/)
})
