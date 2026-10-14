import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const uri = process.env.SUPABASE_DB_URL
if (!uri) throw new Error('Connexion PostgreSQL protegee absente')
const connection = new URL(uri)
if (!['postgres:','postgresql:'].includes(connection.protocol)) throw new Error('Connexion non PostgreSQL')
const sslmode = connection.searchParams.get('sslmode') || 'require'
if (['disable','allow','prefer'].includes(sslmode)) throw new Error('TLS PostgreSQL obligatoire')
const env = { ...process.env, PGHOST:connection.hostname, PGPORT:connection.port || '5432',
  PGUSER:decodeURIComponent(connection.username), PGPASSWORD:decodeURIComponent(connection.password),
  PGDATABASE:decodeURIComponent(connection.pathname.slice(1)), PGSSLMODE:sslmode, PGCONNECT_TIMEOUT:'10' }
const samples = []
for (let run=0; run<3; run++) {
  const result = spawnSync('psql',['-X','-qAt','-v','ON_ERROR_STOP=1','-f',fileURLToPath(new URL('../ops/benchmark-catalog.sql',import.meta.url))],
    {env,encoding:'utf8',timeout:30000,maxBuffer:2*1024*1024})
  if (result.status !== 0) throw new Error('Mesure PostgreSQL impossible; aucune donnee modifiee')
  const start=result.stdout.indexOf('['), end=result.stdout.lastIndexOf(']')+1
  const plan=JSON.parse(result.stdout.slice(start,end))[0]
  const metadata=JSON.parse(result.stdout.slice(end).trim())
  const initPlans=(node)=> (node['Parent Relationship']==='InitPlan'?1:0) + (node.Plans??[]).reduce((sum,child)=>sum+initPlans(child),0)
  samples.push({executionMs:plan['Execution Time'],planningMs:plan['Planning Time'],initPlans:initPlans(plan.Plan),...metadata})
}
const values=samples.map(x=>x.executionMs).sort((a,b)=>a-b)
console.log(JSON.stringify({mode:'read-only SQL with simulated identity, not HTTP login',samples,medianMs:values[1]}))
