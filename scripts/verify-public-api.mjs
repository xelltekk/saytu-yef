import nextEnv from '@next/env'
nextEnv.loadEnvConfig(process.cwd())
const base=process.env.NEXT_PUBLIC_SUPABASE_URL
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
if (!base || new URL(base).hostname !== 'lptxzfjdluupngqqqfrz.supabase.co') throw new Error('Projet de validation inattendu')
if (!key.startsWith('sb_publishable_')) {
  let role
  try { role=JSON.parse(Buffer.from(key.split('.')[1] || '', 'base64url').toString()).role } catch { /* Invalid keys must not be used. */ }
  if (role !== 'anon') throw new Error('Une cle publique anonyme est obligatoire')
}
for (const [name,healthy] of [['database_health',true],['current_account_id',false],['list_support_admins',false]]) {
  const started=performance.now()
  const response=await fetch(`${base}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:'{}',signal:AbortSignal.timeout(10000)})
  const body=await response.json()
  if (healthy ? !response.ok || body !== true : response.ok || ![401,403,404].includes(response.status)) throw new Error(`Controle public inattendu: ${name}`)
  console.log(JSON.stringify({rpc:name,status:response.status,ms:Math.round(performance.now()-started),passed:true}))
}
