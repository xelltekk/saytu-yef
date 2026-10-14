import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
import { monitorConfig, runMonitor } from './monitor-runtime.mjs'

const appDir = await realpath(process.argv[2] ?? '')
assert(appDir.startsWith('/var/tmp/saytu-yef-validation-'), 'Only an isolated validation directory is permitted')
const port = Number(process.argv[3] ?? 3379)
assert(Number.isInteger(port) && port >= 3300 && port <= 3399)
await stat(join(appDir, '.next/BUILD_ID'))
const home = await mkdtemp(join(tmpdir(), 'saytu-yef-pm2-proof-'))
const env = { ...process.env, PM2_HOME: home }
const command = promisify(execFile)
const pm2 = async (...args) => (await command('pm2', args, { env, cwd: appDir, timeout: 30000, maxBuffer: 4000000 })).stdout
const require = createRequire(import.meta.url)
const base = require(join(appDir, 'ecosystem.config.js')).apps[0]
const name = 'saytu-yef-supervision-proof'
const config = { apps: [{ ...base, name, cwd: appDir, args: `start -H 127.0.0.1 -p ${port}`,
  out_file: join(home, 'next-out.log'), error_file: join(home, 'next-error.log') }] }
const file = join(home, 'proof.config.js')
await writeFile(file, `module.exports = ${JSON.stringify(config)}`, { mode: 0o600 })
async function waitReady() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1000) })
      const body = await response.json()
      if (body.app === 'saytu-yef') return
    } catch { /* Only the disposable server is polled. */ }
    await new Promise((done) => setTimeout(done, 250))
  }
  throw new Error('The isolated Next server did not become ready')
}
async function waitStopped(id) {
  for (let attempt = 0; attempt < 40; attempt++) {
    try { process.kill(id, 0) } catch { return }
    await new Promise((done) => setTimeout(done, 100))
  }
  throw new Error('Disposable Next process must be stopped')
}
let pid
try {
  process.env.PM2_HOME = home
  const legacyFile = join(home, 'legacy.config.js')
  const legacyConfig = { apps: [{ ...config.apps[0], script: 'npm', args: `run start -- -H 127.0.0.1 -p ${port}` }] }
  await writeFile(legacyFile, `module.exports = ${JSON.stringify(legacyConfig)}`, { mode: 0o600 })
  await pm2('start', legacyFile, '--only', name)
  await waitReady()
  const legacy = await runMonitor(monitorConfig({ APP_DIR: appDir, APP_URL: `http://127.0.0.1:${port}`,
    LOCAL_HEALTH_URL: `http://127.0.0.1:${port}/api/health`, PM2_NAME: name, MONITOR_STATE: join(home, 'unused.json') }), true)
  assert.equal(legacy.sample.runtime.direct, false)
  assert(legacy.sample.runtime.pid > 0)
  await pm2('stop', name)
  await pm2('delete', name)
  await waitStopped(legacy.sample.runtime.pid)
  await pm2('start', file, '--only', name)
  await waitReady()
  const app = JSON.parse(await pm2('jlist')).find((item) => item.name === name)
  pid = app.pid
  assert.equal(app.pm2_env.exec_mode, 'fork_mode')
  assert(app.pm2_env.pm_exec_path.endsWith('/node_modules/next/dist/bin/next'))
  assert(app.monit.memory > 0)
  const result = await runMonitor(monitorConfig({ APP_DIR: appDir, APP_URL: `http://127.0.0.1:${port}`,
    LOCAL_HEALTH_URL: `http://127.0.0.1:${port}/api/health`, PM2_NAME: name, MONITOR_STATE: join(home, 'unused.json') }), true)
  assert.equal(result.sample.runtime.pid, pid)
  assert.equal(result.sample.runtime.direct, true)
  assert(result.sample.runtime.rssBytes > 0)
  const status = await readFile(`/proc/${pid}/status`, 'utf8')
  const rss = Number(status.match(/^VmRSS:\s+(\d+)/m)[1]) * 1024
  assert(Math.abs(rss - result.sample.runtime.rssBytes) < 10 * 1048576)
  const stateFile = join(home, 'monitor.json')
  const logFile = join(home, 'monitor.log')
  const configForPersistence = monitorConfig({ APP_DIR: appDir, APP_URL: `http://127.0.0.1:${port}`,
    LOCAL_HEALTH_URL: `http://127.0.0.1:${port}/api/health`, PM2_NAME: name, MONITOR_STATE: stateFile, MONITOR_LOG: logFile })
  assert.equal((await runMonitor(configForPersistence)).action, 'none')
  assert.equal(JSON.parse(await readFile(stateFile, 'utf8')).samples.length, 1)
  assert.equal((await stat(stateFile)).mode & 0o777, 0o600)
  assert.equal((await stat(logFile)).mode & 0o777, 0o600)
  await writeFile(stateFile, 'invalid-state')
  await assert.rejects(runMonitor(configForPersistence))
  assert.equal(JSON.parse(await pm2('jlist')).find((item) => item.name === name).pid, pid)
  console.log('PASS: PM2 owns the actual Next PID; direct RSS, private health probes and read-only monitor verified.')
  console.log('PASS: private atomic state/logs; corrupt state fails closed without restarting Next.')
  console.log('PASS: npm-to-direct-Next transition stops the old child before starting the new PID.')
} finally {
  await pm2('delete', name).catch(() => {})
  await pm2('kill').catch(() => {})
  if (pid) await waitStopped(pid)
  console.log(`Isolated PM2 proof directory: ${home}`)
}
