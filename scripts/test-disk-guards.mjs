import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const source = readFileSync(new URL('./archive-old-vps.sh', import.meta.url), 'utf8')
const parser = source.match(/references="\$\(pm2 jlist \| node -e '([\s\S]*?)'\)"/)
assert.ok(parser, 'The actual PM2 privacy parser must be tested')
const cases = [
  [JSON.stringify([{ pm2_env: { pm_cwd: '/var/www/saytu-yef', pm_exec_path: '/usr/bin/npm',
    SECRET: 'synthetic-secret-do-not-print' } }]), 0, '/var/www/saytu-yef\n/usr/bin/npm\n'],
  [JSON.stringify([{ pm2_env: { pm_cwd: '/var/www/saytu-yef-release-old', pm_exec_path: '/var/www/saytu-yef-release-old/app.js' } }]),
    0, '/var/www/saytu-yef-release-old\n/var/www/saytu-yef-release-old/app.js\n'],
  ['[]', 0, ''],
  ['{}', 1, ''],
  ['malformed-synthetic-secret-do-not-print', 1, ''],
]
for (const [input, status, output] of cases) {
  const result = spawnSync(process.execPath, ['-e', parser[1]], { input, encoding: 'utf8', timeout: 10000, windowsHide: true })
  assert.equal(result.status, status)
  assert.equal(result.stdout, output)
  assert.equal(result.stderr, '')
  assert.doesNotMatch(result.stdout, /synthetic-secret/)
}
assert.match(source, /sort -t- -k5,5r \| sed -n '1,2p'/)
console.log('6 disk guards passed; no VPS connection or deletion.')
