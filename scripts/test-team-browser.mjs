import { build, stop } from 'esbuild'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { once } from 'node:events'
import assert from 'node:assert/strict'
const dir=resolve('tmp/team-validation')
await mkdir(dir,{recursive:true})
const mock=resolve('scripts/team-validation-mocks.tsx')
await build({entryPoints:['scripts/team-validation.tsx'],outfile:resolve(dir,'bundle.js'),bundle:true,jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},
  alias:{'@':resolve('src'),'@/hooks/useUser':mock,'@/hooks/useAccountRole':mock,'@/hooks/useSubscriptionOverview':mock,
    '@/lib/supabase/queries':mock,'@/lib/supabase/team':mock,'@/store/accountStore':mock,'@/components/layout/Header':mock,'next/link':mock}})
stop()
await writeFile(resolve(dir,'styles.css'),(await postcss([tailwind()]).process(await readFile('src/app/globals.css','utf8'),{from:resolve('src/app/globals.css')})).css)
const server=createServer(async (req,res) => {
  if(req.url==='/bundle.js'||req.url==='/styles.css') {
    res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/css')
    res.end(await readFile(resolve(dir,req.url.slice(1))))
  } else {res.setHeader('Content-Type','text/html;charset=utf-8');res.end('<!doctype html><html lang="fr"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>')}
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
  for(const width of [360,768,1440]) {
    const context=await browser.newContext({viewport:{width,height:width===360?640:900}})
    await context.route('https://**/*',(route) => route.abort())
    const page=await context.newPage()
    const errors=[]
    page.on('pageerror',(error) => {errors.push(error.message);console.error(error.message)})
    await page.goto(`http://127.0.0.1:${server.address().port}/team`)
    const list=page.getByRole('region',{name:'Liste des membres'})
    try { await expect(list.locator('article')).toHaveCount(4) } catch(error) {
      await page.screenshot({path:resolve(dir,`failure-${width}.png`),fullPage:true})
      console.error(await page.locator('#root').innerText())
      throw error
    }
    await expect(page.getByRole('button',{name:'Modifier Proprietaire',exact:true})).toHaveCount(0)
    await page.screenshot({path:resolve(dir,`list-${width}.png`),fullPage:true})
    await page.getByLabel('Rechercher un membre',{exact:true}).fill('fatou')
    await expect(list.locator('article')).toHaveCount(1)
    await page.getByLabel('Role',{exact:true}).selectOption('employee')
    await expect(page.getByText('Aucun membre ne correspond aux filtres.',{exact:true})).toBeVisible()
    await page.getByLabel('Role',{exact:true}).selectOption('')
    await page.getByRole('button',{name:'Modifier Fatou Diene',exact:true}).click()
    const editor=page.getByRole('dialog',{name:'Modifier le membre',exact:true})
    await expect(editor.getByLabel('Email de connexion',{exact:true})).toHaveAttribute('readonly','')
    await editor.getByLabel('Nom complet',{exact:true}).fill('Fatou Modifiee')
    await editor.getByLabel('Role du membre',{exact:true}).selectOption('employee')
    await page.screenshot({path:resolve(dir,`editor-${width}.png`),fullPage:true})
    const box=await editor.getByRole('button',{name:'Enregistrer',exact:true}).boundingBox()
    assert(box && box.x>=0 && box.y>=0 && box.x+box.width<=width && box.y+box.height<=page.viewportSize().height)
    if(width===360) {
      await page.setViewportSize({width,height:480})
      const small=await editor.getByRole('button',{name:'Enregistrer',exact:true}).boundingBox()
      assert(small && small.y+small.height<=480)
      await page.screenshot({path:resolve(dir,'editor-short-360.png'),fullPage:true})
      await page.setViewportSize({width,height:640})
    }
    await editor.getByRole('button',{name:'Enregistrer',exact:true}).click()
    await expect(page.getByRole('status')).toHaveText('Modifications enregistrees.')
    await expect(list.getByText('Fatou Modifiee',{exact:true})).toBeVisible()
    await expect(list.getByText('Employé',{exact:true})).toBeVisible()
    await page.getByRole('button',{name:'Modifier Fatou Modifiee',exact:true}).click()
    await editor.getByLabel('Nom complet',{exact:true}).fill('Ne pas enregistrer')
    await editor.getByRole('button',{name:'Annuler',exact:true}).click()
    await expect(list.getByText('Fatou Modifiee',{exact:true})).toBeVisible()
    await page.getByRole('button',{name:'Retirer Fatou Modifiee',exact:true}).click()
    const removal=page.getByRole('dialog',{name:'Retirer le membre',exact:true})
    await removal.getByRole('button',{name:'Annuler',exact:true}).click()
    await expect(list.locator('article')).toHaveCount(1)
    await page.getByRole('button',{name:'Retirer Fatou Modifiee',exact:true}).click()
    await removal.getByRole('button',{name:'Retirer',exact:true}).click()
    await expect(list.locator('article')).toHaveCount(0)
    await page.getByLabel('Rechercher un membre',{exact:true}).fill('')
    await page.evaluate(() => window.teamFixture.plan('free'))
    await expect(page.getByRole('button',{name:'Ajouter un membre',exact:true})).toBeDisabled()
    await expect(page.getByRole('button',{name:'Modifier Samba Ndiaye',exact:true})).toBeEnabled()
    await page.evaluate(() => window.teamFixture.plan('lifetime'))
    await page.getByRole('button',{name:'Ajouter un membre',exact:true}).click()
    const add=page.getByRole('dialog',{name:'Ajouter un membre',exact:true})
    await add.getByLabel('Email du compte',{exact:true}).fill('nouveau@example.test')
    await add.getByLabel('Role du membre',{exact:true}).selectOption('cashier')
    await add.getByRole('button',{name:'Ajouter',exact:true}).click()
    await expect(list.getByText('nouveau@example.test',{exact:true})).toBeVisible()
    await page.getByRole('button',{name:'Modifier Nouveau membre',exact:true}).click()
    await page.evaluate(() => window.teamFixture.fail(true))
    await editor.getByRole('button',{name:'Enregistrer',exact:true}).click()
    await expect(editor.getByRole('alert')).toHaveText('Enregistrement indisponible')
    await editor.getByRole('button',{name:'Annuler',exact:true}).click()
    await page.evaluate(() => {window.teamFixture.fail(false);window.teamFixture.readFail(true)})
    await page.getByRole('button',{name:"Actualiser l'equipe",exact:true}).click()
    await expect(page.getByRole('alert')).toHaveText('Connexion indisponible')
    await page.evaluate(() => window.teamFixture.readFail(false))
    await page.getByRole('button',{name:"Actualiser l'equipe",exact:true}).click()
    await expect(page.getByRole('alert')).toHaveCount(0)
    const overflow=await page.evaluate(() => document.documentElement.scrollWidth>innerWidth)
    assert.equal(overflow,false)
    await page.getByRole('button',{name:'Modifier Nouveau membre',exact:true}).click()
    await page.evaluate(() => window.teamFixture.role('employee'))
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('button',{name:'Ajouter un membre',exact:true})).toHaveCount(0)
    await expect(list.getByRole('button')).toHaveCount(0)
    assert.deepEqual(errors,[])
    console.log(`Equipe ${width}px: modification, filtres, retrait, ajout, erreurs et acces OK`)
    await context.close()
  }
} finally {await browser?.close();server.close();await once(server,'close')}
