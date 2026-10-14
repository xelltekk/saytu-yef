import { build, stop } from 'esbuild'
import { createServer } from 'node:http'
import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const dir=resolve('tmp/hardware-validation')
await mkdir(dir,{recursive:true})
await build({entryPoints:['scripts/hardware-validation.tsx'],outfile:resolve(dir,'bundle.js'),bundle:true,jsx:'automatic',
  define:{'process.env.NODE_ENV':'"production"'},alias:{'@':resolve('src')}})
stop()
const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Validation boutique</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f5f7fa;color:#143c38;font:15px Arial,sans-serif}main{max-width:900px;margin:auto;padding:24px}header{display:flex;align-items:center;gap:12px;border-bottom:1px solid #d5dedc;padding-bottom:18px}h1{font-size:22px;margin:0}header span{margin-left:auto;color:#626875;font-size:13px}section{padding:24px 0;border-bottom:1px solid #d5dedc}h2{font-size:18px;margin:0 0 16px}canvas{display:block;max-width:100%;height:auto}dl{display:grid;grid-template-columns:130px 1fr;gap:10px}dd{margin:0;overflow-wrap:anywhere}input{display:block;width:100%;max-width:420px;padding:10px;margin:8px 0 16px;border:1px solid #a7b7b3;border-radius:4px}button{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 14px;border:1px solid #718982;border-radius:4px;background:#fff;color:inherit;cursor:pointer}.actions{display:flex;flex-wrap:wrap;gap:10px}.overlay{position:fixed;inset:0;display:grid;place-items:center;background:#143c3866;padding:16px}.overlay>div{position:relative;width:100%;max-width:400px;background:white;padding:24px;border-radius:8px}.overlay button{position:absolute;right:12px;top:12px}@media(max-width:480px){main{padding:16px}header{flex-wrap:wrap}header span{margin:0}dl{grid-template-columns:110px 1fr}}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`
export const server=createServer(async(req,res)=>{
  if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(await readFile(resolve(dir,'bundle.js')))}
  else if(req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html)}
  else{res.statusCode=404;res.end()}
})
const port=Number(process.env.HARDWARE_TEST_PORT || 4319)
if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Port local invalide')
server.listen(port,'127.0.0.1',()=>console.log(`Validation materiel locale: http://127.0.0.1:${server.address().port}`))
