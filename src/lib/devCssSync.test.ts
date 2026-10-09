import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

describe('local CSS synchronization', () => {
  it('copies only changed CSS, and recreates a removed alias', async () => {
    const source = readFileSync(path.join(process.cwd(), 'scripts/dev-local.mjs'), 'utf8')
    const parsed = ts.createSourceFile('dev-local.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
    const startup = parsed.statements.find((statement) => ts.isVariableStatement(statement) && statement.declarationList.declarations.some((declaration) => declaration.name.getText(parsed) === 'nextProcess'))!
    const helperSource = parsed.statements.filter((statement) => !ts.isImportDeclaration(statement) && statement.getStart(parsed) < startup.getStart(parsed)).map((statement) => statement.getText(parsed)).join('\n')
    const cssRoot = path.join(process.cwd(), '.next-dev/static/css')
    const css = path.join(cssRoot, 'compiled.css')
    const target = path.join(cssRoot, 'app/layout.css')
    const files = new Map<string, { mtimeMs: number }>([[css, { mtimeMs: 1 }]])
    const copyFile = vi.fn(async (_source: string, destination: string) => { files.set(destination, { mtimeMs: Date.now() }) })
    const context = vm.createContext({
      path, process: { cwd: () => process.cwd(), argv: [] }, console,
      readdir: async () => [{ name: 'compiled.css', isFile: () => true }],
      stat: async (filename: string) => { if (!files.has(filename)) throw new Error('Missing'); return files.get(filename) },
      mkdir: async () => undefined, copyFile,
    })
    const sync = vm.runInContext(`${helperSource}\nsyncStableLayoutCss`, context) as () => Promise<void>
    for (let i = 0; i < 10; i++) await sync()
    expect(copyFile).toHaveBeenCalledTimes(1)
    files.set(css, { mtimeMs: 2 })
    await sync()
    expect(copyFile).toHaveBeenCalledTimes(2)
    files.delete(target)
    await sync()
    expect(copyFile).toHaveBeenCalledTimes(3)
  })
})
