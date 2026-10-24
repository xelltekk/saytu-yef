import { build,stop } from 'esbuild'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { mkdir,readFile,writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { once } from 'node:events'
import assert from 'node:assert/strict'
const dir=resolve('tmp/expenses-validation')
await mkdir(dir,{recursive:true})
const mock=resolve('scripts/expenses-validation-mocks.tsx')
await build({entryPoints:['scripts/expenses-validation.tsx'],outfile:resolve(dir,'bundle.js'),bundle:true,jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},
  alias:{'@':resolve('src'),'@/hooks/useUser':mock,'@/hooks/useAccountRole':mock,'@/lib/supabase/expenses':mock,
    '@/components/layout/Header':mock,'@/components/brand/BrandLogo':mock,'next/link':mock,'next/navigation':mock}})
stop()
await writeFile(resolve(dir,'styles.css'),(await postcss([tailwind()]).process(await readFile('src/app/globals.css','utf8'),{from:resolve('src/app/globals.css')})).css)
const server=createServer(async (req,res) => {
  if (req.url==='/bundle.js'||req.url==='/styles.css') {
    res.setHeader('Content-Type',req.url.endsWith('.js') ? 'text/javascript':'text/css')
    res.end(await readFile(resolve(dir,req.url.slice(1))))
  } else { res.setHeader('Content-Type','text/html;charset=utf-8');res.end('<!doctype html><html lang="fr"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>') }
})
server.listen(0,'127.0.0.1')
await once(server,'listening')
const require=createRequire(import.meta.url)
const runtime=resolve(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')
const {chromium}=require(require.resolve('playwright',{paths:[runtime]}))
const {expect}=require(require.resolve('playwright/test',{paths:[runtime]}))
let browser
try {
  browser=await chromium.launch({channel:'msedge',headless:true})
  for (const width of [360,768,1440]) {
    const context=await browser.newContext({viewport:{width,height:width===360?640:900},acceptDownloads:true})
    await context.route('https://**/*',(route) => route.abort())
    const page=await context.newPage()
    const errors=[]
    page.on('pageerror',(error) => errors.push(error.message))
    await page.goto(`http://127.0.0.1:${server.address().port}/expenses`)
    const list=page.getByRole('region',{name:'Liste des depenses'})
    await expect(list.locator('article')).toHaveCount(25)
    await page.getByRole('button',{name:'Suivant',exact:true}).click()
    await expect(page.getByText('26-50 sur 56',{exact:true})).toBeVisible()
    await page.getByRole('button',{name:'Precedent',exact:true}).click()
    await expect(page.getByText('1-25 sur 56',{exact:true})).toBeVisible()
    const selectedMonth=await page.getByLabel('Mois',{exact:true}).inputValue()
    await page.getByLabel('Mois',{exact:true}).fill(`${Number(selectedMonth.slice(0,4))-1}-01`)
    await expect(page.getByText('Aucune depense pour cette selection.',{exact:true})).toBeVisible()
    await page.getByRole('button',{name:'Nouvelle depense',exact:true}).click()
    await expect(page.getByRole('dialog').getByLabel('Date du paiement',{exact:true})).toHaveValue(`${Number(selectedMonth.slice(0,4))-1}-01-01`)
    await page.getByRole('dialog').getByRole('button',{name:'Annuler',exact:true}).click()
    await page.getByLabel('Mois',{exact:true}).fill(selectedMonth)
    await page.getByLabel('Categorie',{exact:true}).selectOption('rent')
    await expect(page.getByText('1-25 sur 28',{exact:true})).toBeVisible()
    await page.getByLabel('Categorie',{exact:true}).selectOption('')
    await page.getByRole('button',{name:'Nouvelle depense',exact:true}).click()
    const editor=page.getByRole('dialog',{name:'Nouvelle depense',exact:true})
    await editor.getByLabel('Libelle',{exact:true}).fill('Loyer test boutique')
    await editor.getByLabel('Montant (FCFA)',{exact:true}).fill('150000')
    await editor.getByLabel('Categorie',{exact:true}).selectOption('rent')
    await editor.getByLabel('Photo du justificatif',{exact:true}).setInputFiles('public/brand/logo-saytu-yef-mark-v2.png')
    await expect(editor.getByAltText('Justificatif selectionne',{exact:true})).toBeVisible()
    const save=editor.getByRole('button',{name:'Enregistrer',exact:true})
    const bounds=await save.boundingBox()
    assert(bounds && bounds.y+bounds.height<=page.viewportSize().height,'Editor footer must remain visible on smartphone')
    await page.screenshot({path:resolve(dir,`editor-${width}.png`)})
    await save.click()
    await expect(editor).toHaveCount(0)
    await expect(page.getByText('Depense enregistree.',{exact:true})).toBeVisible()
    assert.equal(await page.evaluate(() => window.expenseFixture.writes()),1)
    await page.getByRole('button',{name:'Voir le justificatif de Loyer test boutique',exact:true}).click()
    const receipt=page.getByRole('dialog',{name:'Justificatif',exact:true})
    await expect(receipt.getByAltText('Justificatif : Loyer test boutique',{exact:true})).toBeVisible()
    await receipt.getByRole('button',{name:'Fermer',exact:true}).click()
    await page.getByRole('button',{name:'Modifier Loyer test boutique',exact:true}).click()
    await page.getByRole('dialog').getByLabel('Montant (FCFA)',{exact:true}).fill('175000')
    await page.getByRole('dialog').getByRole('button',{name:'Retirer',exact:true}).click()
    await page.getByRole('button',{name:'Enregistrer',exact:true}).click()
    await expect(list.getByText('175 000 FCFA',{exact:true})).toBeVisible()
    await expect(list.getByRole('heading',{name:'Loyer test boutique',exact:true})).toBeVisible()
    await expect(page.getByRole('button',{name:'Voir le justificatif de Loyer test boutique',exact:true})).toHaveCount(0)
    await page.getByRole('button',{name:'Annuler Loyer test boutique',exact:true}).click()
    await page.getByRole('dialog').getByRole('button',{name:'Confirmer',exact:true}).click()
    await expect(page.getByText('Depense annulee.',{exact:true})).toBeVisible()
    assert.equal(await page.evaluate(() => window.expenseFixture.writes()),3)
    await page.screenshot({path:resolve(dir,`list-${width}.png`),fullPage:true})
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth>innerWidth+1),false,'No horizontal page overflow')
    await page.evaluate(() => window.expenseFixture.fail(true))
    await page.getByRole('button',{name:'Actualiser les depenses',exact:true}).click()
    await expect(page.getByRole('alert')).toHaveText('Connexion indisponible')
    await page.evaluate(() => {window.expenseFixture.fail(false);window.expenseFixture.delay(300)})
    await page.getByRole('button',{name:'Actualiser les depenses',exact:true}).click()
    await page.evaluate(() => window.expenseFixture.role('admin',true))
    await expect(page.getByRole('alert')).toHaveText('Acces reserve au proprietaire de la boutique.')
    const calls=await page.evaluate(() => window.expenseFixture.calls())
    await page.waitForTimeout(400)
    assert.equal(await page.evaluate(() => window.expenseFixture.calls()),calls,'Delegated administrator must not query expenses')
    await expect(page.getByRole('link',{name:'Depenses',exact:true})).toHaveCount(0)
    await expect(page.getByRole('button',{name:'Nouvelle depense',exact:true})).toHaveCount(0)
    for (const role of ['cashier','employee']) {
      await page.evaluate((role) => window.expenseFixture.role(role,true),role)
      await expect(page.getByRole('alert')).toHaveText('Acces reserve au proprietaire de la boutique.')
      await expect(page.getByRole('button',{name:'Nouvelle depense',exact:true})).toHaveCount(0)
    }
    assert.equal(errors.length,0,errors.join('\n'))
    console.log(`PASS ${width}px: pagination, monthly/category filters, create with photo, authenticated preview, edit, cancel, errors and owner-only scope.`)
    await context.close()
  }
} finally { await browser?.close();await new Promise((resolve) => server.close(resolve)) }
