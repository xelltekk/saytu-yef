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

const dir=resolve('tmp/catalogue-validation')
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
async function scan(page,code) {
  await page.evaluate((value) => {
    document.activeElement?.blur()
    for(const key of [...value,'Enter']) window.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}))
  },code)
}
try {
  browser=await chromium.launch({channel:'msedge',headless:true})
  for(const width of [360,768,1440]) {
    const context=await browser.newContext({viewport:{width,height:900},acceptDownloads:true})
    await context.route('https://**/*',route => route.abort())
    const page=await context.newPage()
    const errors=[];page.on('pageerror',error => {errors.push(error.message);console.error(error.stack)})
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    await expect(page.getByRole('navigation',{name:'Pages du catalogue'})).toContainText('/ 60')
    await page.getByRole('button',{name:'Page suivante',exact:true}).click()
    await expect(page.getByRole('navigation',{name:'Pages du catalogue'})).toContainText('25 - 48')
    await page.getByRole('searchbox',{name:'Rechercher un produit'}).fill('CODE-1')
    await page.getByRole('searchbox',{name:'Rechercher un produit'}).press('Enter')
    await expect(page.getByTestId('cart')).toHaveText('p1:1')
    await scan(page,'CODE-1')
    await scan(page,'CODE-1')
    await expect(page.getByTestId('cart')).toHaveText('p1:3')
    if(width<1024) {
      const total=page.getByTestId('pos-mobile-total')
      assert.equal(await total.evaluate((element) => element.scrollWidth>element.clientWidth+1),false)
      assert.notEqual(await total.evaluate((element) => getComputedStyle(element).textOverflow),'ellipsis')
    }
    await page.getByRole('button',{name:'Test actualiser',exact:true}).click()
    await expect(page.getByTestId('cart')).toHaveText('p1:3')
    const search=page.getByRole('searchbox',{name:'Rechercher un produit'})
    await search.fill('Produit 060')
    await expect(page.getByRole('navigation',{name:'Pages du catalogue'})).toContainText('/ 1')
    await expect(page.getByTestId('cart')).toHaveText('p1:3')
    await search.fill('Produit 001')
    await page.waitForFunction(() => window.catalogueCalls.some((c) => c.search==='Produit 001'))
    await search.fill('Produit 002')
    await expect(page.getByRole('button',{name:'Choisir une variante pour Produit 002',exact:true})).toBeVisible()
    await page.waitForFunction(() => window.catalogueCalls.some((c) => c.search==='Produit 002'))
    assert.equal(await page.getByRole('button',{name:'Choisir une variante pour Produit 001',exact:true}).count(),0)
    await page.screenshot({path:resolve(dir,`pos-${width}.png`),fullPage:true})
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth>innerWidth+1),false)

    await page.getByRole('button',{name:'Test inventaire',exact:true}).click()
    await expect(page.getByRole('navigation',{name:'Pages du catalogue'})).toContainText('/ 60')
    await page.getByRole('button',{name:'Page suivante',exact:true}).click()
    await expect(page.getByRole('navigation',{name:'Pages du catalogue'})).toContainText('25 - 48')
    await page.getByRole('searchbox',{name:'Rechercher un produit'}).fill('CODE-1')
    await page.getByRole('searchbox',{name:'Rechercher un produit'}).press('Enter')
    await expect(page.getByRole('navigation',{name:'Pages du catalogue'})).toContainText('/ 1')
    await expect(page.locator('article')).toHaveCount(1)
    await page.screenshot({path:resolve(dir,`inventory-${width}.png`),fullPage:true})
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth>innerWidth+1),false)
    await page.getByRole('searchbox',{name:'Rechercher un produit'}).fill('')
    await expect(page.getByRole('navigation',{name:'Pages du catalogue'})).toContainText('/ 60')
    const downloadPromise=page.waitForEvent('download')
    await page.getByRole('button',{name:'Exporter',exact:true}).click()
    const download=await downloadPromise
    const csvPath=resolve(dir,`inventory-${width}.csv`);await download.saveAs(csvPath)
    const csv=await readFile(csvPath,'utf8')
    assert.equal(csv.trim().split('\n').length,121,'Export must include every matching variant, not just 48')
    await page.getByRole('button',{name:'Choisir etiquettes',exact:true}).click()
    const dialog=page.getByRole('dialog')
    await expect(dialog).toContainText('120 variante(s) selectionnee(s)')
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await page.getByRole('searchbox',{name:'Rechercher un produit'}).fill('Produit 001')
    await page.getByRole('button',{name:'Plan de reapprovisionnement',exact:true}).click()
    await expect(page.getByRole('button',{name:'Modifier le parent',exact:true})).toHaveCount(2)
    await page.getByRole('button',{name:'Modifier le parent',exact:true}).nth(0).click()
    await expect(page.getByTestId('edited')).toHaveText('g1:2:true')
    assert.equal(errors.length,0,errors.join('\n'))
    console.log(`PASS ${width}px: pages, simulated HID/lookup, cart, search, full CSV/labels, complete restock editing and no clipping.`)
    await context.close()
  }
} finally {await browser?.close();await new Promise(resolve => server.close(resolve))}
