import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { mkdir,writeFile } from 'node:fs/promises'

const require=createRequire(import.meta.url)
const runtime=process.env.BROWSER_RUNTIME_MODULES || resolve(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')
const {chromium}=require(require.resolve('playwright',{paths:[runtime]}))
const args=process.argv.slice(2)
const production=args.includes('--production')
const urls=args.filter(arg=>arg!=='--production')
if(urls.length>1 || urls.some(arg=>arg.startsWith('--')))throw new Error('Arguments de mesure invalides')
const productionOrigin='https://saytu-yef.xelltekk.com'
const origin=new URL(urls[0] || (production ? productionOrigin : 'http://127.0.0.1:3003'))
if(origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('Une origine sans identifiants ni parametres est obligatoire')
if(production ? origin.origin!==productionOrigin : !['http:','https:'].includes(origin.protocol)||!['localhost','127.0.0.1','[::1]'].includes(origin.hostname))throw new Error('Cible de mesure non autorisee')
const report=[]
const folder=resolve('tmp/performance-validation')
const file=resolve(folder,production ? 'production-browser-metrics.json' : 'browser-metrics.json')
await mkdir(folder,{recursive:true})
const mode=production ? 'production desktop, full navigations, not mobile' : 'local dev, not production or mobile'
const saveReport=()=>writeFile(file,JSON.stringify({generatedAt:new Date().toISOString(),viewport:'1440x900',mode,report},null,2))
const browser=await chromium.launch({channel:'msedge',headless:false})
let stage=null
try {
  const context=await browser.newContext({viewport:{width:1440,height:900}})
  await context.addInitScript(()=>{
    window.__saytuLcp=null
    window.__saytuVisibleThroughout=document.visibilityState==='visible'
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState!=='visible')window.__saytuVisibleThroughout=false
    })
    new PerformanceObserver(list=>{for(const entry of list.getEntries())window.__saytuLcp=entry.startTime}).observe({type:'largest-contentful-paint',buffered:true})
  })
  const page=await context.newPage()
  await page.bringToFront()
  page.on('requestfinished',async request=>{
    const current=stage
    if(!current)return
    const response=await request.response()
    const url=new URL(request.url())
    const path=url.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi,':id').replace(/[A-Za-z0-9_-]{40,}/g,':opaque')
    const timing=request.timing()
    // Never read headers, cookies, POST data, response bodies, credentials or HAR files.
    current.requests.push({host:url.hostname,path,method:request.method(),status:response?.status(),responseEndMs:timing.responseEnd})
  })
  console.log(`Attente du serveur ${origin.origin}; aucun serveur n'est demarre par ce script.`)
  const deadline=Date.now()+120000
  for(;;){
    try {
      await page.goto(`${origin.origin}/login`,{timeout:120000})
      break
    } catch(error) {
      if(!String(error).includes('ERR_CONNECTION_REFUSED')||Date.now()>=deadline)throw error
      await new Promise(resolve=>setTimeout(resolve,2000))
    }
  }
  console.log('Connecte le compte de test dans cette fenetre; le script ne lit pas le mot de passe.')
  await page.waitForURL(url=>!['/login','/auth/login','/auth/callback'].includes(url.pathname),{timeout:300000})
  for(const pass of ['cold','warm'])for(const path of ['/dashboard','/inventory','/sales','/clients','/reports']){
    const current={pass,path,requests:[]};stage=current
    const started=performance.now()
    await page.goto(`${origin.origin}${path}`,{timeout:120000})
    let networkSettled=true
    await page.waitForLoadState('networkidle',{timeout:15000}).catch(()=>{networkSettled=false})
    const metrics=await page.evaluate(()=>({lcpMs:window.__saytuLcp,
      visibleThroughout:window.__saytuVisibleThroughout,
      resources:performance.getEntriesByType('resource').length,
      transferBytes:performance.getEntriesByType('resource').reduce((sum,entry)=>sum+entry.transferSize,0)}))
    stage=null
    const measurementWindowMs=Math.round(performance.now()-started)
    report.push({...current,...metrics,finalPath:new URL(page.url()).pathname,networkSettled,
      measurementWindowMs,untilNetworkIdleMs:networkSettled ? measurementWindowMs : null})
    await saveReport()
    const idle=networkSettled ? `${measurementWindowMs} ms jusqu'au calme reseau (inclut 500 ms)` : 'delai de calme reseau expire, pas un temps de chargement'
    console.log(`${pass} ${path}: LCP API observe ${metrics.lcpMs ?? 'non disponible'} ms; ${idle}.`)
  }
  console.log(`Rapport sans contenus clients ni jetons: ${file}`)
} finally {stage=null;await browser.close()}
