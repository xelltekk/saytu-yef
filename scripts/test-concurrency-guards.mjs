import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

const root = 'C:/private/restore-tests/20261012T000000Z-00000000000000000000000000000000'
const base = { SAYTU_TEST_DATABASE: 'saytu_restore_test_00000000000000000000000000000000', SAYTU_TEST_PORT: '55439',
  SAYTU_TEST_PASSWORD: 'synthetic-not-a-real-password', SAYTU_TEST_PG_BIN: `C:/nonexistent-${randomUUID()}`,
  SAYTU_TEST_CLUSTER: `${root}/cluster`, SAYTU_TEST_LOGS: `${root}/concurrency` }
const checks = [
  [{ SAYTU_TEST_DATABASE: '' }, /Configuration de test isolee/],
  [{ SAYTU_TEST_DATABASE: 'postgres' }, /Configuration de test isolee/],
  [{ SAYTU_TEST_DATABASE: 'saytu_restore_test_abc;DROP TABLE public.sales' }, /Configuration de test isolee/],
  [{ SAYTU_TEST_PORT: '22' }, /Configuration de test isolee/],
  [{ SAYTU_TEST_CLUSTER: 'C:/production/cluster' }, /Cluster\/dossier prive inattendu/],
  [{ SAYTU_TEST_LOGS: 'C:/public/concurrency' }, /Cluster\/dossier prive inattendu/],
  [{}, /Outil PostgreSQL ou dossier de test absent/],
]
for (const [override, expected] of checks) {
  const result = spawnSync(process.execPath, [resolve('scripts/test-retail-concurrency.mjs')], {
    env: { ...process.env, ...base, ...override }, encoding: 'utf8', timeout: 10000, windowsHide: true,
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, expected)
}
console.log(`${checks.length} concurrency isolation guards passed; no PostgreSQL connection opened.`)
