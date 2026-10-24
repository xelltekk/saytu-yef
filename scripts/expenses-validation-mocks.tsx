import { useSyncExternalStore, type ComponentProps } from 'react'
import { dateInputValue, isBusinessOwner, validateExpense, type Expense, type ExpenseDraft, type ExpenseOptions, type ExpensePage } from '../src/lib/expenses'
const owner='10000000-0000-0000-0000-000000000001'
let actor=owner
let role='admin'
let delay=15
let failing=false
let calls=0
let writes=0
let photo:Blob | null=null
let revision=0
const listeners=new Set<() => void>()
const subscribe=(listener:() => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const month=dateInputValue(new Date()).slice(0,7)
const rows:Expense[]=Array.from({length:56},(_,index) => ({
  id:`20000000-0000-0000-0000-${String(index+1).padStart(12,'0')}`,user_id:owner,label:`Frais fictifs ${String(index+1).padStart(2,'0')}`,
  category:index%2 ? 'transport' : 'rent',amount:1000+index,expense_date:`${month}-${String(index%20+1).padStart(2,'0')}`,
  payment_method:'cash',notes:'',receipt_path:null,currency:'XOF',created_at:'2026-01-01',updated_at:'2026-01-01',revision:1,voided_at:null,
}))
Object.assign(window,{expenseFixture:{
  role(next:string,delegated=false) { role=next;actor=delegated ? 'staff' : owner;revision++;listeners.forEach((listener) => listener()) },
  delay(value:number) { delay=value },fail(value:boolean) { failing=value },calls:() => calls,writes:() => writes,
}})
const useRevision=() => useSyncExternalStore(subscribe,() => revision)
export function useUser() { useRevision();return {user:{id:actor},accountOwnerId:owner,loading:false,displayName:'Test',businessName:'Boutique test',initials:'TT'} }
export function useAccountRole() { useRevision();return {role,loading:false} }
export const usePathname=() => '/expenses'
export default function Link(props:ComponentProps<'a'>) { return <a {...props} /> }
export function Header({title,subtitle}:{title:string;subtitle?:string}) { return <header className="border-b bg-white p-4"><h1 className="font-semibold">{title}</h1><p className="text-xs">{subtitle}</p></header> }
export function BrandLogo() { return <span>SY</span> }
const assertOwner=() => { if (!isBusinessOwner(actor,owner,role)) throw new Error('Acces reserve au proprietaire.') }
export async function getExpensesPage(options:ExpenseOptions):Promise<ExpensePage> {
  calls++
  assertOwner()
  await new Promise((resolve) => setTimeout(resolve,delay))
  if (failing) throw new Error('Connexion indisponible')
  const matching=rows.filter((row) => !row.voided_at && row.expense_date>=options.startDate && row.expense_date<options.endExclusive && (!options.category || row.category===options.category))
    .sort((a,b) => b.expense_date.localeCompare(a.expense_date) || b.id.localeCompare(a.id))
  const categoryTotals:Record<string,{category:Expense['category'];total:number;count:number}>={}
  for (const row of matching) {
    const item=categoryTotals[row.category] ??= {category:row.category,total:0,count:0}
    item.total+=row.amount;item.count++
  }
  return {ownerId:owner,version:String(writes),startDate:options.startDate,endExclusive:options.endExclusive,
    count:matching.length,total:matching.reduce((sum,row) => sum+row.amount,0),byCategory:Object.values(categoryTotals),byMonth:[],
    expenses:matching.slice(options.offset ?? 0,(options.offset ?? 0)+(options.limit ?? 25)),offset:options.offset ?? 0,limit:options.limit ?? 25}
}
export async function saveExpense(id:string,draft:ExpenseDraft,previous?:Expense) {
  assertOwner();validateExpense(draft)
  if (failing) throw new Error('Enregistrement indisponible')
  writes++
  if (previous) Object.assign(rows.find((row) => row.id===id)!,draft,{revision:previous.revision+1})
  else rows.unshift({...draft,id,user_id:owner,currency:'XOF',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),revision:1,voided_at:null})
  return rows.find((row) => row.id===id)!
}
export async function voidExpense(expense:Expense) { assertOwner();writes++;rows.find((row) => row.id===expense.id)!.voided_at=new Date().toISOString() }
export async function uploadExpenseReceipt(blob:Blob,id:string) { assertOwner();photo=blob;return `${owner}/${id}.jpg` }
export async function downloadExpenseReceipt() { assertOwner();if (!photo) throw new Error('Photo absente');return photo }
