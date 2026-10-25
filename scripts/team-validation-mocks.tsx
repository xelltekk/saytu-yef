import { useSyncExternalStore, type ComponentProps } from 'react'
import type { TeamMember } from '../src/types'
import { validateTeamMember, canEditTeamMember, type TeamMemberDraft } from '../src/lib/team'
const owner='10000000-0000-0000-0000-000000000001'
let actor=owner
let role:TeamMember['role']='admin'
let failing=false
let readFail=false
let version=0
let writes=0
let plan='lifetime'
const listeners=new Set<() => void>()
const subscribe=(listener:() => void) => { listeners.add(listener);return () => { listeners.delete(listener) } }
const useVersion=() => useSyncExternalStore(subscribe,() => version)
const rows:TeamMember[]=[
  {id:owner,account_owner_id:owner,full_name:'Proprietaire',email:'owner@example.test',role:'admin',created_at:'2026-01-01',updated_at:'2026-10-01'},
  {id:'staff',account_owner_id:owner,full_name:'Fatou Diene',email:'fatou@example.test',role:'cashier',created_at:'2026-02-01',updated_at:'2026-10-01'},
  {id:'admin',account_owner_id:owner,full_name:'Samba Ndiaye',email:'samba@example.test',role:'admin',created_at:'2026-03-01',updated_at:'2026-10-01'},
  {id:'long',account_owner_id:owner,full_name:'Un nom de membre tres long pour verifier le retour a la ligne sur un telephone',email:'une.adresse.email.vraiment.tres.longue.pour.la.recette@example.test',role:'employee',created_at:'2026-04-01',updated_at:'2026-10-01'},
]
Object.assign(window,{teamFixture:{
  role(next:TeamMember['role']) {role=next;actor=next==='admin' ? owner : 'long';version++;listeners.forEach((fn) => fn())},
  fail(next:boolean) {failing=next},readFail(next:boolean) {readFail=next},writes:() => writes,
  plan(next:string) {plan=next;version++;listeners.forEach((fn) => fn())},
}})
export function useUser() {useVersion();return {user:{id:actor},accountOwnerId:owner,loading:false}}
export function useAccountRole() {useVersion();return {role,loading:false}}
export function useSubscriptionOverview() {useVersion();return {overview:{plan}}}
export function refreshAccount() {return Promise.resolve()}
export function Header({title}:{title:string}) {return <header className="bg-white p-4"><h1 className="font-semibold">{title}</h1></header>}
export default function Link(props:ComponentProps<'a'>) {return <a {...props} />}
export async function getTeamContext() {
  await new Promise((resolve) => setTimeout(resolve,25))
  if(readFail) throw new Error('Connexion indisponible')
  return {current:{...rows.find((r) => r.id===actor)!,role},members:rows.map((r) => ({...r}))}
}
const check=() => {if(failing) throw new Error('Enregistrement indisponible');if(role!=='admin') throw new Error('Acces refuse')}
export async function updateTeamMember(member:TeamMember,draft:TeamMemberDraft) {
  check()
  if(!canEditTeamMember({...rows[0],id:actor,role},member)) throw new Error('Acces refuse')
  Object.assign(rows.find((r) => r.id===member.id)!,validateTeamMember(draft),{updated_at:new Date().toISOString()})
  writes++
}
export async function addTeamMember(email:string,role:TeamMember['role']) {
  check();writes++
  rows.push({id:'added',account_owner_id:owner,email,full_name:'Nouveau membre',role,created_at:'2026-10-25',updated_at:'2026-10-25'})
}
export async function removeTeamMember(id:string) {check();writes++;rows.splice(rows.findIndex((r) => r.id===id),1)}
