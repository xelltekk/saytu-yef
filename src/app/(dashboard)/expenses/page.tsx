'use client'

import Link from 'next/link'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BarChart3, ChevronLeft, ChevronRight, Image as ImageIcon, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ExpenseEditor } from '@/components/expenses/ExpenseEditor'
import { ExpenseReceipt } from '@/components/expenses/ExpenseReceipt'
import { useUser } from '@/hooks/useUser'
import { useAccountRole } from '@/hooks/useAccountRole'
import { EXPENSE_CATEGORIES, dateInputValue, expenseCategoryLabel, expenseMethodLabel, expenseMonthRange, isBusinessOwner, type Expense, type ExpensePage } from '@/lib/expenses'
import { getExpensesPage, voidExpense } from '@/lib/supabase/expenses'
import { formatCurrency } from '@/lib/utils'

export default function ExpensesPage() {
  const { user, accountOwnerId, loading: userLoading } = useUser()
  const { role, loading: roleLoading } = useAccountRole()
  const owner = !userLoading && !roleLoading && isBusinessOwner(user?.id,accountOwnerId,role)
  const scope = JSON.stringify([user?.id,accountOwnerId,role])
  const scopeRef = useRef(scope)
  useLayoutEffect(() => { scopeRef.current = scope }, [scope])
  const [month,setMonth] = useState(() => dateInputValue(new Date()).slice(0,7))
  const [category,setCategory] = useState('')
  const [offset,setOffset] = useState(0)
  const [revision,setRevision] = useState(0)
  const [view,setView] = useState<{ key:string; data:ExpensePage | null; error:string } | null>(null)
  const [editor,setEditor] = useState<{ scope:string; expense:Expense | null } | null>(null)
  const [receipt,setReceipt] = useState<{ scope:string; expense:Expense } | null>(null)
  const [cancel,setCancel] = useState<{ scope:string; expense:Expense } | null>(null)
  const [cancelling,setCancelling] = useState(false)
  const [cancelError,setCancelError] = useState('')
  const [notice,setNotice] = useState<{ scope:string; text:string } | null>(null)
  const key = JSON.stringify([scope,month,category,offset,revision])
  const current = owner && view?.key === key ? view : null
  const data = current?.data
  const loading = owner && !current
  useEffect(() => {
    if (!owner) return
    const controller = new AbortController()
    void (async () => {
      try {
        const result = await getExpensesPage({ ...expenseMonthRange(month),category,offset,limit:25 },controller.signal)
        if (!controller.signal.aborted) setView({ key,data:result,error:'' })
      } catch (cause) {
        if (!controller.signal.aborted) setView({ key,data:null,error:cause instanceof Error ? cause.message : 'Chargement impossible.' })
      }
    })()
    return () => controller.abort()
  }, [owner,key,month,category,offset])
  const cancelExpense = async () => {
    if (!cancel || cancel.scope !== scope || cancelling) return
    const captured = cancel.scope
    setCancelling(true)
    setCancelError('')
    try {
      await voidExpense(cancel.expense)
      if (scopeRef.current !== captured) return
      setCancel(null)
      setOffset(0)
      setRevision((value) => value+1)
      setNotice({ scope:captured,text:'Depense annulee.' })
    } catch (cause) { if (scopeRef.current === captured) setCancelError(cause instanceof Error ? cause.message : 'Annulation impossible.') }
    finally { setCancelling(false) }
  }
  return <div className="min-h-screen">
    <Header title="Depenses" subtitle="Frais d'exploitation payes" />
    <main className="space-y-5 p-3 sm:p-5 lg:p-6">
      {userLoading || roleLoading ? <p role="status">Chargement...</p> : !owner ? <p role="alert" className="text-sm text-[#5C6B73]">Acces reserve au proprietaire de la boutique.</p> : <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/reports" className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-[#2D7D7D]"><BarChart3 size={17} />Rapports</Link>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" aria-label="Actualiser les depenses" title="Actualiser les depenses" onClick={() => setRevision((value) => value+1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-[#2D7D7D]/20 bg-white text-[#2D7D7D]"><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></button>
            <Button leftIcon={<Plus size={16} />} onClick={() => setEditor({ scope,expense:null })}>Nouvelle depense</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-2xl">
          <Input label="Mois" type="month" min="2000-01" max="2099-12" value={month} onChange={(e) => { setMonth(e.target.value);setOffset(0) }} />
          <Select label="Categorie" value={category} options={[{ value:'',label:'Toutes les categories' },...EXPENSE_CATEGORIES]} onChange={(e) => { setCategory(e.target.value);setOffset(0) }} />
        </div>
        {notice?.scope === scope && <p role="status" className="text-sm text-emerald-700">{notice.text}</p>}
        {current?.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{current.error}</p>}
        <dl className="grid grid-cols-1 gap-4 border-y border-[#2D7D7D]/10 bg-white px-4 py-5 min-[420px]:grid-cols-3">
          <div className="min-w-0"><dt className="text-xs text-[#5C6B73]">Depenses du mois</dt><dd className="mt-1 break-words text-xl font-semibold text-[#1A3636]">{loading ? '...' : data ? formatCurrency(data.total) : '-'}</dd></div>
          <div className="min-w-0"><dt className="text-xs text-[#5C6B73]">Nombre de depenses</dt><dd className="mt-1 text-xl font-semibold text-[#1A3636]">{loading ? '...' : data?.count ?? '-'}</dd></div>
          <div className="min-w-0"><dt className="text-xs text-[#5C6B73]">Depense moyenne</dt><dd className="mt-1 break-words text-xl font-semibold text-[#1A3636]">{loading ? '...' : data ? formatCurrency(data.count ? Math.round(data.total/data.count) : 0) : '-'}</dd></div>
        </dl>
        {!!data?.byCategory.length && <section aria-label="Repartition des depenses" className="space-y-2">
          <h2 className="text-sm font-semibold text-[#1A3636]">Par categorie</h2>
          <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">{data.byCategory.map((item) => <div key={item.category} className="flex min-w-0 justify-between gap-3 border-b border-[#2D7D7D]/10 py-2 text-xs"><span className="min-w-0 break-words text-[#5C6B73]">{expenseCategoryLabel(item.category)}</span><strong className="shrink-0 font-semibold text-[#1A3636]">{formatCurrency(item.total)}</strong></div>)}</div>
        </section>}
        <section aria-label="Liste des depenses" className="min-w-0 bg-white">
          {loading ? <p role="status" className="p-5 text-sm text-[#5C6B73]">Chargement des depenses...</p> : data && !data.expenses.length ? <p className="p-5 text-sm text-[#5C6B73]">Aucune depense pour cette selection.</p> : data?.expenses.map((expense) => <article key={expense.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 border-b border-[#2D7D7D]/10 p-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] lg:items-center">
            <div className="min-w-0"><h3 className="break-words text-sm font-semibold text-[#1A3636]">{expense.label}</h3><p className="mt-1 break-words text-xs text-[#5C6B73]">{expenseCategoryLabel(expense.category)}</p></div>
            <p className="text-right text-sm font-semibold text-[#1A3636] lg:order-4">{formatCurrency(expense.amount)}</p>
            <time dateTime={expense.expense_date} className="text-xs text-[#5C6B73] lg:order-2">{new Date(`${expense.expense_date}T12:00:00`).toLocaleDateString('fr-FR')}</time>
            <p className="text-right text-xs text-[#5C6B73] lg:order-3 lg:text-left">{expenseMethodLabel(expense.payment_method)}</p>
            <div className="col-span-2 flex justify-end gap-1 lg:order-5 lg:col-span-1">
              {expense.receipt_path && <button type="button" aria-label={`Voir le justificatif de ${expense.label}`} title="Voir le justificatif" onClick={() => setReceipt({ scope,expense })} className="flex h-10 w-10 items-center justify-center rounded-lg text-[#2D7D7D] hover:bg-[#E8F4F2]"><ImageIcon size={17} /></button>}
              <button type="button" aria-label={`Modifier ${expense.label}`} title="Modifier" onClick={() => setEditor({ scope,expense })} className="flex h-10 w-10 items-center justify-center rounded-lg text-[#2D7D7D] hover:bg-[#E8F4F2]"><Pencil size={16} /></button>
              <button type="button" aria-label={`Annuler ${expense.label}`} title="Annuler la depense" onClick={() => { setCancel({ scope,expense });setCancelError('') }} className="flex h-10 w-10 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>
            </div>
          </article>)}
        </section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-[#5C6B73]">{data?.count ? `${offset+1}-${Math.min(offset+data.limit,data.count)} sur ${data.count}` : '0 depense'}</span>
          <div className="flex gap-2"><Button variant="outline" size="sm" leftIcon={<ChevronLeft size={16} />} disabled={loading || offset===0} onClick={() => setOffset((value) => Math.max(0,value-25))}>Precedent</Button><Button variant="outline" size="sm" rightIcon={<ChevronRight size={16} />} disabled={loading || !data || offset+data.limit>=data.count} onClick={() => setOffset((value) => value+25)}>Suivant</Button></div>
        </div>
        {editor?.scope === scope && <ExpenseEditor key={`${scope}:${editor.expense?.id ?? 'new'}`} expense={editor.expense} initialDate={month===dateInputValue(new Date()).slice(0,7) ? dateInputValue(new Date()) : `${month}-01`} onClose={() => setEditor(null)} onSaved={() => {
          if (scopeRef.current !== editor.scope) return
          setEditor(null);setOffset(0);setRevision((value) => value+1);setNotice({ scope,text:'Depense enregistree.' })
        }} />}
        {receipt?.scope === scope && <ExpenseReceipt key={`${scope}:${receipt.expense.id}`} expense={receipt.expense} onClose={() => setReceipt(null)} />}
        {cancel?.scope === scope && <Modal isOpen onClose={() => { if (!cancelling) setCancel(null) }} title="Annuler la depense" size="sm" footer={<div className="flex flex-wrap justify-end gap-2"><Button variant="ghost" disabled={cancelling} onClick={() => setCancel(null)}>Conserver</Button><Button variant="danger" isLoading={cancelling} onClick={() => void cancelExpense()}>Confirmer</Button></div>}>
          <p className="break-words text-sm font-medium">{cancel.expense.label} : {formatCurrency(cancel.expense.amount)}</p><p className="mt-2 text-sm text-[#5C6B73]">Cette depense sera exclue des totaux.</p>{cancelError && <p role="alert" className="mt-3 text-sm text-red-600">{cancelError}</p>}
        </Modal>}
      </>}
    </main>
  </div>
}
