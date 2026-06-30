import { spawn } from 'node:child_process'
import { copyFile, mkdir, readdir, stat } from 'node:fs/promises'
import { watch } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const workspaceRoot = process.cwd()
const nextBin = path.join(workspaceRoot, 'node_modules', 'next', 'dist', 'bin', 'next')
const devDistDir = path.join(workspaceRoot, '.next-dev')
const cssRoot = path.join(devDistDir, 'static', 'css')
const stableCssDir = path.join(cssRoot, 'app')
const stableCssFile = path.join(stableCssDir, 'layout.css')
const forwardedArgs = process.argv.slice(2)
const defaultPort = '3003'
const defaultHost = '0.0.0.0'

let lastSourcePath = ''
let syncInFlight = false
let cssWatcher = null
let warmedUp = false

function readCliOption(longFlag, shortFlag, fallback) {
  const longIndex = forwardedArgs.indexOf(longFlag)
  if (longIndex >= 0 && forwardedArgs[longIndex + 1]) return forwardedArgs[longIndex + 1]

  const shortIndex = forwardedArgs.indexOf(shortFlag)
  if (shortIndex >= 0 && forwardedArgs[shortIndex + 1]) return forwardedArgs[shortIndex + 1]

  return fallback
}

const devPort = readCliOption('--port', '-p', defaultPort)
const devHost = readCliOption('--hostname', '-H', defaultHost)
const localOrigin = `http://${devHost === '0.0.0.0' ? '127.0.0.1' : devHost}:${devPort}`
const nextDevArgs = [
  'dev',
  ...(forwardedArgs.includes('--hostname') || forwardedArgs.includes('-H') ? [] : ['--hostname', defaultHost]),
  ...(forwardedArgs.includes('--port') || forwardedArgs.includes('-p') ? [] : ['--port', defaultPort]),
  ...forwardedArgs,
]

async function findLatestCompiledCss() {
  try {
    const entries = await readdir(cssRoot, { withFileTypes: true })
    const candidates = []

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.css')) continue
      const fullPath = path.join(cssRoot, entry.name)
      const { mtimeMs } = await stat(fullPath)
      candidates.push({ fullPath, mtimeMs })
    }

    candidates.sort((left, right) => right.mtimeMs - left.mtimeMs)
    return candidates[0]?.fullPath ?? null
  } catch {
    return null
  }
}

async function syncStableLayoutCss() {
  if (syncInFlight) return
  syncInFlight = true

  try {
    const sourcePath = await findLatestCompiledCss()
    if (!sourcePath) return

    await mkdir(stableCssDir, { recursive: true })
    await copyFile(sourcePath, stableCssFile)

    if (sourcePath !== lastSourcePath) {
      console.log(`[dev-css-fix] ${path.basename(sourcePath)} -> .next-dev/static/css/app/layout.css`)
      lastSourcePath = sourcePath
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`[dev-css-fix] sync failed: ${message}`)
  } finally {
    syncInFlight = false
  }
}

function attachCssWatcher() {
  if (cssWatcher) return

  try {
    cssWatcher = watch(cssRoot, () => {
      void syncStableLayoutCss()
    })
  } catch {
    cssWatcher = null
  }
}

function cleanup() {
  if (cssWatcher) {
    cssWatcher.close()
    cssWatcher = null
  }

  clearInterval(syncInterval)
  clearInterval(watcherInterval)
}

async function warmUpDevelopmentCss() {
  if (warmedUp) return

  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${localOrigin}/`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(4000),
      })

      if (!response.ok) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        continue
      }

      await Promise.allSettled([
        fetch(`${localOrigin}/`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(8000),
        }),
        fetch(`${localOrigin}/login`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(8000),
        }),
      ])

      await syncStableLayoutCss()
      warmedUp = true
      console.log(`[dev-css-fix] warmup complete on ${localOrigin}`)
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
}

const nextProcess = spawn(process.execPath, [nextBin, ...nextDevArgs], {
  cwd: workspaceRoot,
  stdio: 'inherit',
  env: process.env,
})

const syncInterval = setInterval(() => {
  void syncStableLayoutCss()
}, 1200)

const watcherInterval = setInterval(() => {
  attachCssWatcher()
}, 2000)

attachCssWatcher()
void syncStableLayoutCss()
void warmUpDevelopmentCss()

process.on('SIGINT', () => {
  cleanup()
  nextProcess.kill('SIGINT')
})

process.on('SIGTERM', () => {
  cleanup()
  nextProcess.kill('SIGTERM')
})

nextProcess.on('exit', (code, signal) => {
  cleanup()

  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
