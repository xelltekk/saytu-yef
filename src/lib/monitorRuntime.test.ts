import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { classifyHealth, healthStatistics, planMonitor, selectRuntime } from '../../scripts/monitor-policy.mjs'
import { monitorConfig, parseProcessRows, probe } from '../../scripts/monitor-runtime.mjs'

const now = Date.UTC(2026, 9, 13, 12)
const limits = { failures: 3, cooldownMs: 900000, memoryBytes: 400 * 1048576, diskBytes: 2 * 1024 ** 3, slowMs: 2500 }
const healthy = { state: 'ok', durationMs: 120 }
const sample = { at: now, public: healthy, local: healthy,
  runtime: { status: 'online', pid: 42, direct: true, rssBytes: 300 * 1048576, cpuPercent: 2 }, diskFreeBytes: 10 * 1024 ** 3 }
const previous = { samples: [], failures: 0, signature: '', lastRestartAt: null }
const body = { app: 'saytu-yef', status: 'ok', dependencies: { database: 'ok', auth: 'ok' } }

describe('runtime supervision policy', () => {
  it.each([
    [200, body, 'ok'], [503, { ...body, status: 'degraded', dependencies: { database: 'unavailable', auth: 'ok' } }, 'dependency'],
    [200, { ...body, dependencies: { database: 'ok', auth: 'unavailable' } }, 'dependency'],
    [502, body, 'unreachable'], [200, { ...body, app: 'other' }, 'unreachable'], [200, {}, 'unreachable'],
  ])('classifies HTTP %s without accepting arbitrary successful HTML', (status, value, expected) => {
    expect(classifyHealth(status, value)).toBe(expected)
  })
  it('waits for three failures of both probes, with a fifteen-minute cooldown', () => {
    const down = { ...sample, public: { ...healthy, state: 'unreachable' }, local: { ...healthy, state: 'unreachable' } }
    const first = planMonitor(previous, down, limits)
    const second = planMonitor(first.state, { ...down, at: now + 120000 }, limits)
    const third = planMonitor(second.state, { ...down, at: now + 240000 }, limits)
    expect(first.restart).toBe(false)
    expect(second.restart).toBe(false)
    expect(third.restart).toBe(true)
    expect(planMonitor({ ...third.state, lastRestartAt: now + 240000 }, { ...down, at: now + 360000 }, limits).restart).toBe(false)
    expect(planMonitor({ ...third.state, lastRestartAt: now }, { ...down, at: now + 900000 }, limits).restart).toBe(true)
  })
  it.each(['dependency', 'unreachable'])('never restarts for public %s when Next is reachable', (state) => {
    const plan = planMonitor({ ...previous, failures: 9 }, { ...sample, public: { ...healthy, state } }, limits)
    expect(plan.restart).toBe(false)
    expect(plan.state.failures).toBe(0)
    expect(plan.state.signature).toContain(state === 'dependency' ? 'dependency' : 'public_access')
  })
  it('does not restart a Supabase outage or a failed local probe when public access works', () => {
    expect(planMonitor({ ...previous, failures: 9 }, { ...sample, local: { ...healthy, state: 'dependency' } }, limits).restart).toBe(false)
    const local = planMonitor({ ...previous, failures: 9 }, { ...sample, local: { ...healthy, state: 'unreachable' } }, limits)
    expect(local.restart).toBe(false)
    expect(local.state.signature).toContain('local_probe')
  })
  it.each(['stopped', 'missing', 'unknown', 'launching'])('does not restart an intentional or unknown PM2 state: %s', (status) => {
    expect(planMonitor({ ...previous, failures: 9 }, { ...sample, public: { ...healthy, state: 'unreachable' },
      local: { ...healthy, state: 'unreachable' }, runtime: { ...sample.runtime, status } }, limits).restart).toBe(false)
  })
  it('records memory and disk warnings without restarting healthy sales', () => {
    const plan = planMonitor(previous, { ...sample, diskFreeBytes: 1024, runtime: { ...sample.runtime, rssBytes: 450 * 1048576 } }, limits)
    expect(plan.restart).toBe(false)
    expect(plan.state.signature).toBe('disk_low,memory_high')
    expect(plan.changed).toBe(true)
    expect(planMonitor(plan.state, { ...sample, at: now + 120000 }, limits).changed).toBe(true)
  })
  it('bounds stored samples and uses only successful health probes for p95', () => {
    const samples = Array.from({ length: 800 }, (_, i) => ({ ...sample, at: now - (800 - i) * 1000,
      public: { state: 'ok', durationMs: 4000 } }))
    samples.push({ ...sample, at: now - 90000000, public: { state: 'unreachable', durationMs: 99999 } })
    const plan = planMonitor({ ...previous, samples }, sample, limits)
    expect(plan.state.samples).toHaveLength(720)
    expect(plan.state.signature).toContain('health_slow')
    const stats = healthStatistics([...samples, { ...sample, public: { state: 'dependency', durationMs: 10000 } }], now)
    expect(stats.healthP95Ms).toBe(4000)
    expect(stats.failed).toBe(1)
  })
  it('finds the real Next child without exposing PM2 environment values', () => {
    const rows = parseProcessRows('10 1 80000 npm\n11 10 2000 sh\n12 11 340000 next-server (v15)\n99 1 9999 unrelated')
    const wrapper = { name: 'saytu-yef', pid: 10, pm2_env: { status: 'online', pm_exec_path: '/usr/bin/npm', SECRET: 'never-copy' }, monit: { cpu: 1 } }
    const runtime = selectRuntime([wrapper], rows, 'saytu-yef')
    expect(runtime).toMatchObject({ pid: 12, rssBytes: 340000 * 1024, direct: false, cpuPercent: null })
    expect(JSON.stringify(runtime)).not.toContain('never-copy')
    expect(selectRuntime([{ ...wrapper, pid: 12, pm2_env: { status: 'online', pm_exec_path: '/app/node_modules/next/dist/bin/next' } }], rows, 'saytu-yef')).toMatchObject({ pid: 12, direct: true, cpuPercent: 1 })
  })
  it('refuses arbitrary local targets and invalid thresholds', () => {
    expect(() => monitorConfig({ LOCAL_HEALTH_URL: 'http://example.com/api/health' })).toThrow('URL')
    expect(() => monitorConfig({ MONITOR_MEMORY_MB: 'NaN' })).toThrow('Configuration')
    expect(monitorConfig({}).limits.failures).toBe(3)
  })
  it('refuses to guess a process when multiple PM2 entries share a name', () => {
    const app = { name: 'saytu-yef', pid: 10, pm2_env: { status: 'online', pm_exec_path: '/usr/bin/npm' } }
    expect(selectRuntime([app, { ...app, pid: 11 }], [], 'saytu-yef')).toMatchObject({ status: 'ambiguous', pid: null })
  })
  it('turns invalid JSON or network failures into failed health probes', async () => {
    const malformed = async () => new Response('not json', { status: 200 })
    expect((await probe('http://127.0.0.1', malformed)).state).toBe('unreachable')
    expect((await probe('http://127.0.0.1', (async () => { throw new Error('offline') }) as typeof fetch)).state).toBe('unreachable')
  })
  it('configures a single direct Next process bound to loopback', () => {
    const config = createRequire(import.meta.url)(resolve('ecosystem.config.js'))
    expect(config.apps[0]).toMatchObject({ script: 'node_modules/next/dist/bin/next', args: 'start -H 127.0.0.1 -p 3000',
      instances: 1, exec_mode: 'fork', watch: false, max_memory_restart: '500M', kill_timeout: 10000 })
  })
})
