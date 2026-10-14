import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { mkdir } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { once } from 'node:events'

const require=createRequire(import.meta.url)
const runtime=process.env.BROWSER_RUNTIME_MODULES || resolve(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')
const {chromium}=require(require.resolve('playwright',{paths:[runtime]}))
const output=resolve('tmp/hardware-validation')
await mkdir(output,{recursive:true})
process.env.HARDWARE_TEST_PORT='0'
const {server}=await import('./hardware-validation.mjs')
if(!server.listening)await once(server,'listening')
const origin=`http://127.0.0.1:${server.address().port}`
let browser
try {
  browser=await chromium.launch({channel:'msedge',headless:true})
  for(const width of [360,768,1440]){
    const context=await browser.newContext({viewport:{width,height:900}})
    await context.addInitScript(()=>{window.print=()=>{document.documentElement.setAttribute('data-print-requested','true')}})
    const page=await context.newPage()
    await page.goto(origin)
    await page.locator('canvas').waitFor()
    const pixels=await page.locator('canvas').evaluate(canvas=>{
      const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data
      let black=0;for(let i=0;i<data.length;i+=4)if(data[i]<30&&data[i+3]>0)black++
      return black
    })
    assert.ok(pixels>1000,'Barcode bitmap must be nonblank')
    await page.keyboard.type('2901234567896',{delay:10});await page.keyboard.press('Enter')
    assert.equal(await page.getByTestId('scan-count').textContent(),'1')
    assert.equal(await page.getByTestId('scan-value').textContent(),'2901234567896')
    await page.getByRole('button',{name:'Controle paiement',exact:true}).click()
    await page.keyboard.type('2901234567896',{delay:10});await page.keyboard.press('Enter')
    assert.equal(await page.getByTestId('scan-count').textContent(),'1','A dialog must suspend the reader')
    await page.getByRole('button',{name:'Fermer',exact:true}).click()
    await page.getByLabel('Saisie libre').click();await page.keyboard.type('2901234567896',{delay:10});await page.keyboard.press('Enter')
    assert.equal(await page.getByTestId('scan-count').textContent(),'1','Inputs must keep normal typing')
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)
    assert.equal(overflow,false)
    await page.screenshot({path:resolve(output,`scanner-${width}.png`),fullPage:true})
    console.log(`PASS scanner ${width}px: bitmap, read once, modal protection, editable input, no overflow.`)
    if(width===1440){
      for(const [label,expected,file] of [['Ticket test 80 mm','TEST MATERIEL - SANS VENTE','receipt'],['Facture test A4','TEST-FACTURE','invoice'],['Etiquette test A4','TEST MATERIEL','label']]){
        await page.getByRole('button',{name:label,exact:true}).click()
        const frame=await page.locator('iframe').last().elementHandle()
        const documentFrame=await frame.contentFrame()
        await documentFrame.locator('html[data-print-requested="true"]').waitFor({state:'attached'})
        assert.ok((await documentFrame.locator('body').textContent()).includes(expected))
        const html=await documentFrame.locator('html').evaluate(node=>node.outerHTML)
        const preview=await context.newPage();await preview.setContent(html)
        await preview.screenshot({path:resolve(output,`${file}.png`),fullPage:true});await preview.close()
      }
      console.log('PASS receipt, invoice and label print documents; native printer not exercised.')
    }
    await context.close()
  }
} finally {await browser?.close(); await new Promise(resolve=>server.close(resolve))}
