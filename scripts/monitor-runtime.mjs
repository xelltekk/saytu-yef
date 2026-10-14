import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, rename, stat, statfs, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadavg, freemem } from 'node:os'
import { classifyHealth, planMonitor, selectRuntime } from './monitor-policy.mjs'

const command = promisify(execFile)
export async function probe(url, fetchFn = fetch) {
  const start = performance.now()
  try {
    const response = await fetchFn(url, { signal: AbortSignal.timeout(12000), redirect: 'error', cache: 'no-store' })
    const body = await response.json()
    return { state: classifyHealth(response.status, body), durationMs: Math.round(performance.now() - start) }
  } catch {
    return { state: 'unreachable', durationMs: Math.round(performance.now() - start) }
  }
}

export function parseProcessRows(text) {
  return text.trim().split('\n').flatMap((line) => {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/)
    return match ? [{ pid: Number(match[1]), ppid: Number(match[2]), rssKiB: Number(match[3]), comm: match[4] }] : []
  })
}

function positive(env, key, fallback) {
  const value = env[key] === undefined ? fallback : Number(env[key])
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Configuration invalide: ${key}`)
  return value
}

/** @param {Record<string, string | undefined>} env */
export function monitorConfig(env = process.env) {
  const publicUrl = new URL('/api/health', env.APP_URL ?? 'https://saytu-yef.xelltekk.com')
  const localUrl = new URL(env.LOCAL_HEALTH_URL ?? 'http://127.0.0.1:3000/api/health')
  if (publicUrl.username || publicUrl.password || !['http:', 'https:'].includes(publicUrl.protocol)
    || localUrl.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(localUrl.hostname) || localUrl.username || localUrl.password) {
    throw new Error('URL de controle invalide')
  }
  return { publicUrl: publicUrl.href, localUrl: localUrl.href, appDir: env.APP_DIR ?? '/var/www/saytu-yef',
    name: env.PM2_NAME ?? 'saytu-yef', stateFile: env.MONITOR_STATE ?? '/var/lib/saytu-yef/monitor.json',
    logFile: env.MONITOR_LOG ?? '/var/log/saytu-yef-monitor.log', webhook: env.ALERT_WEBHOOK_URL,
    limits: { failures: Math.ceil(positive(env, 'MONITOR_FAILURES', 3)), cooldownMs: positive(env, 'MONITOR_COOLDOWN_SECONDS', 900) * 1000,
      memoryBytes: positive(env, 'MONITOR_MEMORY_MB', 400) * 1048576, diskBytes: positive(env, 'MONITOR_DISK_MB', 2048) * 1048576,
      slowMs: positive(env, 'MONITOR_SLOW_MS', 2500) } }
}

async function readState(path) {
  try {
    if ((await stat(path)).size > 2000000) throw new Error('Etat de supervision trop volumineux')
    const state = JSON.parse(await readFile(path, 'utf8'))
    if (state.version !== 1 || !Array.isArray(state.samples) || !Number.isInteger(state.failures) || state.failures < 0
      || typeof state.signature !== 'string' || (state.lastRestartAt !== null && !Number.isFinite(state.lastRestartAt))) {
      throw new Error('Etat de supervision invalide')
    }
    return state
  } catch (error) {
    if (error.code === 'ENOENT') return { version: 1, samples: [], failures: 0, signature: '', lastRestartAt: null }
    throw error
  }
}

async function saveState(path, state) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const temporary = `${path}.${process.pid}.tmp`
  await writeFile(temporary, JSON.stringify(state), { mode: 0o600 })
  await rename(temporary, path)
}

async function collect(config) {
  const publicHealth = await probe(config.publicUrl)
  const localHealth = await probe(config.localUrl)
  let runtime = { status: 'unknown', pid: null, direct: false, rssBytes: null, cpuPercent: null }
  try {
    const pm2 = await command('pm2', ['jlist'], { timeout: 10000, maxBuffer: 4000000 })
    const processes = await command('ps', ['-eo', 'pid=,ppid=,rss=,comm='], { timeout: 5000 })
    runtime = selectRuntime(JSON.parse(pm2.stdout), parseProcessRows(processes.stdout), config.name)
  } catch { /* Incomplete process data cannot authorize a restart. */ }
  let diskFreeBytes = null
  try { const disk = await statfs(config.appDir); diskFreeBytes = disk.bavail * disk.bsize } catch { /* Report unknown separately. */ }
  return { at: Date.now(), public: publicHealth, local: localHealth, runtime, diskFreeBytes,
    hostFreeBytes: freemem(), hostLoad: loadavg() }
}

async function notify(config, signature) {
  if (!config.webhook) return
  try {
    await fetch(config.webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ text: `Saytu Yef supervision: ${signature || 'RETABLI'}` }) })
  } catch { /* Alert failures must not cause another application restart. */ }
}

export async function runMonitor(config, readOnly = false) {
  const previous = await readState(config.stateFile)
  const sample = await collect(config)
  const plan = planMonitor(previous, sample, config.limits)
  const output = { timestamp: new Date(sample.at).toISOString(), flags: plan.state.signature, sample, stats: plan.stats,
    action: readOnly ? 'read_only' : plan.restart ? 'restart' : 'none' }
  if (readOnly) { console.log(JSON.stringify(output)); return output }
  // Persist the cooldown before invoking PM2, even if its command fails.
  if (plan.restart) plan.state.lastRestartAt = sample.at
  await saveState(config.stateFile, plan.state)
  await writeFile(config.logFile, `${JSON.stringify(output)}\n`, { flag: 'a', mode: 0o600 })
  if (plan.changed) await notify(config, plan.state.signature)
  if (plan.restart) {
    try {
      await command('pm2', ['restart', config.name, '--update-env'], { timeout: 30000 })
      await new Promise((done) => setTimeout(done, 8000))
      const check = await probe(config.localUrl)
      await writeFile(config.logFile, `${JSON.stringify({ timestamp: new Date().toISOString(), event: 'restart_check', state: check.state })}\n`, { flag: 'a' })
      await notify(config, `redemarrage: ${check.state}`)
    } catch {
      await writeFile(config.logFile, `${JSON.stringify({ timestamp: new Date().toISOString(), event: 'restart_failed' })}\n`, { flag: 'a' })
      await notify(config, 'redemarrage echoue')
    }
  }
  return output
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length > 3 || (process.argv[2] && process.argv[2] !== '--read-only')) throw new Error('Argument invalide')
    await runMonitor(monitorConfig(), process.argv.includes('--read-only'))
  }
  catch { console.error('Controle de supervision echoue; aucune nouvelle action autorisee.'); process.exitCode = 1 }
}
