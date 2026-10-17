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

const dir=resolve('tmp/restaurant-validation')
await mkdir(dir,{recursive:true})
const mock=resolve('scripts/catalogue-validation-mocks.tsx')
await build({entryPoints:['scripts/catalogue-validation.tsx'],outfile:resolve(dir,'bundle.js'),bundle:true,jsx:'automatic',
  plugins:[{name:'isolated-user',setup(build) {build.onResolve({filter:/\/useUser$/},() => ({path:mock}))}}],
  define:{'process.env.NODE_ENV':'"production"'},alias:{'@':resolve('src'),
    '@/lib/supabase/catalogue':mock,'@/hooks/useUser':mock,'@/hooks/useSubscriptionOverview':mock,
    '@/lib/supabase/queries':mock,'@/lib/supabase/retail':mock,'next/link':mock}})
stop()
const css=await postcss([tailwind()]).process(await readFile('src/app/globals.css','utf8'),{from:resolve('src/app/globals.css')})
await writeFile(resolve(dir,'styles.css'),css.css)
const server=createServer(async(req,res) => {
  if(req.url==='/bundle.js'||req.url==='/styles.css') {
    res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/css')
    res.end(await readFile(resolve(dir,req.url.slice(1))))
  } else {res.setHeader('Content-Type','text/html;charset=utf-8');res.end('<!doctype html><html lang="fr"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>')}
})
server.listen(0,'127.0.0.1');await once(server,'listening')
const require=createRequire(import.meta.url)
const runtime=resolve(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')
const {chromium}=require(require.resolve('playwright',{paths:[runtime]}))
const {expect}=require(require.resolve('playwright/test',{paths:[runtime]}))

let browser
try {
  browser=await chromium.launch({channel:'msedge',headless:true})
  for(const width of [360,768,1440]) {
    const context=await browser.newContext({viewport:{width,height:900}})
    await context.route('https://**/*',route => route.abort())
    const page=await context.newPage()
    const errors=[];page.on('pageerror',error => {errors.push(error.message);console.error(error.stack)})
    await page.goto(`http://127.0.0.1:${server.address().port}/?restaurant=1`)
    const dish=page.getByRole('button',{name:'Ajouter Yassa au panier',exact:true})
    await expect(dish).toBeVisible()
    for(let i=0;i<12;i++) await dish.click()
    const drink=page.getByRole('button',{name:'Ajouter Boisson au panier',exact:true})
    await drink.click();await drink.click()
    await expect(page.getByTestId('cart')).toHaveText('dish:12,drink:2')
    await expect(page.getByRole('button',{name:'Boisson, stock epuise',exact:true})).toBeDisabled()
    await page.getByRole('button',{name:'Test actualiser',exact:true}).click()
    await expect(page.getByTestId('cart')).toHaveText('dish:12,drink:2')
    await expect(page.locator('body')).not.toContainText('Infinity')
    await page.screenshot({path:resolve(dir,`pos-${width}.png`),fullPage:true})
    await page.getByRole('button',{name:'Test inventaire',exact:true}).click()
    const article=page.locator('article').filter({hasText:'Yassa'})
    await article.getByRole('button',{name:'Variantes',exact:true}).click()
    const available=article.getByRole('checkbox',{name:'Disponibilite de Yassa',exact:true})
    await expect(available).toBeChecked()
    await expect(article.getByRole('button',{name:'Ajuster',exact:true})).toHaveCount(0)
    await available.uncheck()
    await expect(article.locator('span:visible').filter({hasText:/^Indisponible$/}).first()).toBeVisible()
    await page.screenshot({path:resolve(dir,`inventory-${width}.png`),fullPage:true})
    await page.getByRole('button',{name:'Test POS',exact:true}).click()
    await expect(page.getByTestId('cart')).toHaveText('drink:2')
    await expect(dish).toHaveCount(0)
    await page.getByRole('button',{name:'Test inventaire',exact:true}).click()
    await article.getByRole('button',{name:'Variantes',exact:true}).click()
    await available.check()
    await expect(article.locator('span:visible').filter({hasText:/^Disponible$/}).first()).toBeVisible()
    await page.getByRole('button',{name:'Test POS',exact:true}).click()
    await dish.click()
    await page.getByRole('button',{name:'Test nouveau produit',exact:true}).click()
    const dialog=page.getByRole('dialog')
    await dialog.getByLabel('Nom du produit').fill('Plat du jour')
    await dialog.getByRole('checkbox',{name:'Sans suivi de stock',exact:true}).check()
    await expect(dialog.getByLabel('Stock initial',{exact:true})).toHaveCount(0)
    await expect(dialog.getByLabel('Stock minimum',{exact:true})).toHaveCount(0)
    await dialog.getByLabel('Prix de vente',{exact:true}).fill('3000')
    await page.screenshot({path:resolve(dir,`new-dish-${width}.png`),fullPage:true})
    await dialog.getByRole('button',{name:'Enregistrer',exact:true}).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('button',{name:'Ajouter Plat du jour au panier',exact:true})).toBeVisible()
    await page.getByRole('button',{name:'Encaisser',exact:true}).click()
    await page.getByRole('dialog').getByRole('button',{name:'Confirmer',exact:true}).click()
    await page.getByRole('dialog').getByRole('button',{name:'Valider le paiement',exact:true}).click()
    await expect(page.getByRole('dialog').getByRole('button',{name:'Nouvelle vente',exact:true})).toBeVisible()
    await page.getByRole('dialog').getByRole('button',{name:'Nouvelle vente',exact:true}).click()
    await expect(page.getByTestId('cart')).toHaveText('')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth>innerWidth+1),false)
    assert.deepEqual(errors,[])
    console.log(`PASS restaurant ${width}px: untracked dishes, bounded drinks, availability changes, creation without stock and mock checkout.`)
    await context.close()
  }
} finally {await browser?.close();await new Promise(resolve => server.close(resolve))}
