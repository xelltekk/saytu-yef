import { spawn } from 'node:child_process'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir, freemem, totalmem } from 'node:os'
import { validateFixture } from '../ops/load/spec.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const profile = process.argv[2] ?? 'smoke'
const lab = resolve(process.env.LOCALAPPDATA ?? resolve(homedir(), '.local/share'), 'SaytuYefLoadLab')
const fixtureFile = resolve(lab, 'credentials.json')
const decode = (token) => {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) } catch { return null }
}
try {
  if (process.argv.length > 3) throw new Error('Utilisez seulement un profil de charge')
  if ((await stat(fixtureFile)).size > 2000000) throw new Error('Fichier de test trop volumineux')
  validateFixture(JSON.parse(await readFile(fixtureFile, 'utf8')), profile, decode)
  const requiredMemory = profile === 'smoke' ? 256 * 1024 ** 2 : ['shops100', 'cashiers300'].includes(profile) ? 2 * 1024 ** 3 : 1024 ** 3
  if (freemem() < requiredMemory) throw new Error('RAM_INSUFFISANTE')
  const results = resolve(lab, 'results')
  await mkdir(results, { recursive: true, mode: 0o700 })
  const resultFile = resolve(results, `${profile}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^K6_|^(HTTP|HTTPS|ALL)_PROXY$/i.test(name)))
  Object.assign(env, { LOAD_PROFILE: profile, LOAD_FIXTURE: fixtureFile, LOAD_RESULT: resultFile, K6_NO_USAGE_REPORT: 'true', NO_PROXY: '127.0.0.1' })
  const binary = process.env.LOCAL_K6_BINARY || 'k6'
  const configFile = resolve(lab, 'k6-config.json')
  await writeFile(configFile, '{}', { mode: 0o600 })
  const child = spawn(binary, ['run', '--config', configFile, '--no-usage-report', '--include-system-env-vars=false',
    '--env', `LOAD_PROFILE=${profile}`, '--env', `LOAD_FIXTURE=${fixtureFile}`, '--env', `LOAD_RESULT=${resultFile}`,
    resolve(root, 'ops/load/reads.k6.js')], { env, cwd: root, stdio: 'inherit', windowsHide: true })
  const samples = []
  let lowSamples = 0
  let abortedForMemory = false
  const sampleMemory = () => {
    const freeBytes = freemem()
    samples.push({ at: new Date().toISOString(), freeBytes })
    if (samples.length > 370) samples.shift()
    lowSamples = freeBytes < 128 * 1024 ** 2 ? lowSamples + 1 : 0
    if (lowSamples >= 3 && !abortedForMemory) {
      abortedForMemory = true
      console.error('Arret du seul generateur k6 : memoire Windows critique pendant trois mesures.')
      child.kill()
    }
  }
  sampleMemory()
  const memoryTimer = setInterval(sampleMemory, 2000)
  child.on('error', () => { console.error('k6 introuvable ou impossible a lancer.'); process.exitCode = 1 })
  child.on('close', async (code) => {
    clearInterval(memoryTimer)
    process.exitCode = abortedForMemory ? 1 : code ?? 1
    try {
      await writeFile(`${resultFile}.host.json`, JSON.stringify({ kind: 'load-host-memory', profile, totalBytes: totalmem(),
        abortedForMemory, exitCode: process.exitCode, samples, note: 'Host free RAM only; not container or k6 RSS/CPU.' }, null, 2), { mode: 0o600 })
    } catch { console.error('Impossible de conserver les mesures memoire locales.'); process.exitCode = 1 }
    console.log(`Resultat local: ${resultFile}`)
  })
} catch (error) {
  console.error(error?.message === 'RAM_INSUFFISANTE' ? 'RAM libre insuffisante pour ce palier. Aucun test lance.'
    : 'Banc local non pret : verifier le fichier prive SaytuYefLoadLab/credentials.json et le profil dans ops/LOAD-TESTS.md. Aucun test lance.')
  process.exitCode = 1
}
