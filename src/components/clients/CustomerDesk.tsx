'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, Download, MessageCircle, Phone, ReceiptText, RefreshCw, Search, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { SaleDetailModal } from '@/components/sales/SaleDetailModal'
import { createClient } from '@/lib/supabase/client'
import { getCustomerAccounts, getCustomerSales, type CustomerAccount, type CustomerAccounts } from '@/lib/supabase/retail'
import { formatCurrency, formatDate } from '@/lib/utils'
import { SALE_STATUS_LABELS } from '@/lib/sales'
import { buildDebtReminder } from '@/lib/debtReminders'
import { useUser } from '@/hooks/useUser'
import { useAccountStore } from '@/store/accountStore'
import type { Sale } from '@/types'

const METHODS = [{ value: 'cash', label: 'Especes' }, { value: 'wave', label: 'Wave' }, { value: 'orange_money', label: 'Orange Money' }, { value: 'card', label: 'Carte' }]
const FILTERS = [{ value: 'all', label: 'Tous les clients' }, { value: 'debt', label: 'Dettes ouvertes' }, { value: 'overdue', label: 'Echeances depassees' }, { value: 'settled', label: 'Comptes soldes' }, { value: 'missing_phone', label: 'Dettes sans telephone' }]
type Reminder = { id: string; channel: string; note: string; created_at: string }

export function CustomerDesk() {
  const { businessName } = useUser()
  const paymentPhone = useAccountStore((state) => state.business?.phone)
  const [data, setData] = useState<CustomerAccounts | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('priority')
  const [offset, setOffset] = useState(0)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<CustomerAccount | null>(null)
  const [history, setHistory] = useState<Sale[]>([])
  const [historyMore, setHistoryMore] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [sale, setSale] = useState<Sale | null>(null)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [note, setNote] = useState('')
  const [channel, setChannel] = useState('phone')
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [notice, setNotice] = useState('')
  const request = useRef<{ id: string; fingerprint: string } | null>(null)
  const detailVersion = useRef(0)

  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      setLoading(true); setError('')
      getCustomerAccounts(search, filter, sort, offset).then((result) => { if (active) setData(result) })
        .catch((err: Error) => { if (active) setError(err.message) })
        .finally(() => { if (active) setLoading(false) })
    }, search ? 250 : 0)
    return () => { active = false; clearTimeout(timer) }
  }, [search, filter, sort, offset, revision])

  const loadDetail = useCallback(async (customer: CustomerAccount, from = 0) => {
    const version = ++detailVersion.current
    setDetailLoading(true)
    try {
      const rows = await getCustomerSales(customer.id, from)
      if (version !== detailVersion.current) return
      setHistory((current) => from ? [...current, ...rows] : rows)
      setHistoryMore(rows.length === 20)
      if (!from) {
        const { data: logs, error: logError } = await createClient().from('customer_reminders').select('id,channel,note,created_at')
          .eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(30)
        if (logError) throw new Error(logError.message)
        if (version === detailVersion.current) setReminders(logs ?? [])
      }
    } catch (err) { if (version === detailVersion.current) setError(err instanceof Error ? err.message : 'Chargement impossible') }
    finally { if (version === detailVersion.current) setDetailLoading(false) }
  }, [])

  const openCustomer = (customer: CustomerAccount) => {
    setSelected(customer); setHistory([]); setReminders([]); setAmount(''); setNote(''); setError(''); request.current = null
    void loadDetail(customer)
  }
  const pay = async () => {
    if (!selected || saving) return
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0 || value > Number(selected.due)) { setError('Montant invalide ou superieur au reste du'); return }
    const fingerprint = JSON.stringify([selected.id, value, method])
    if (request.current?.fingerprint !== fingerprint) request.current = { id: crypto.randomUUID(), fingerprint }
    setSaving(true); setError('')
    try {
      const { error: paymentError } = await createClient().rpc('pay_customer_debts', {
        p_request_id: request.current.id, p_customer_id: selected.id, p_amount: value, p_method: method,
      })
      if (paymentError) throw new Error(paymentError.message)
      setSelected(null); setRevision((current) => current + 1); setNotice(`Versement de ${formatCurrency(value)} enregistre.`)
    } catch (err) { setError(err instanceof Error ? err.message : 'Versement impossible') }
    finally { setSaving(false) }
  }
  const logReminder = async () => {
    if (!selected || !note.trim() || saving) return
    setSaving(true); setError('')
    try {
      const { error: logError } = await createClient().rpc('log_customer_reminder', { p_customer_id: selected.id, p_channel: channel, p_note: note.trim() })
      if (logError) throw new Error(logError.message)
      setNote(''); await loadDetail(selected); setRevision((current) => current + 1)
    } catch (err) { setError(err instanceof Error ? err.message : 'Relance impossible') }
    finally { setSaving(false) }
  }
  const exportCsv = async () => {
    setExporting(true); setError('')
    try {
      const rows: CustomerAccount[] = []
      for (let from = 0; ; from += 30) {
        const page = await getCustomerAccounts(search, filter, sort, from)
        rows.push(...page.customers)
        if (rows.length >= page.count || page.customers.length === 0) break
      }
      const cell = (value: unknown) => {
        let text = String(value ?? '')
        if (/^[=+@-]/.test(text)) text = `'${text}`
        return `"${text.replaceAll('"', '""')}"`
      }
      const csv = [['Client','Telephone','Achats','Verse','Reste','Ventes'], ...rows.map((row) => [row.name,row.phone,row.purchases,row.paid,row.due,row.sale_count])]
        .map((line) => line.map(cell).join(';')).join('\r\n')
      const url = URL.createObjectURL(new Blob(['\uFEFF',csv], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a'); link.href = url; link.download = 'clients.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) { setError(err instanceof Error ? err.message : 'Export impossible') }
    finally { setExporting(false) }
  }
  const reminderText = selected ? buildDebtReminder({ customerName: selected.name, amountDue: Number(selected.due), businessName, businessPhone: paymentPhone }) : ''
  const digits = selected?.phone.replace(/\D/g,'') ?? ''
  const contact = digits.length === 9 ? `221${digits}` : digits
  return <div className="space-y-4 p-3 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
      <div><p className="text-sm text-[#5C6B73]">A recouvrer</p><p className="break-words text-xl font-semibold text-red-700">{formatCurrency(Number(data?.total_due ?? 0))}</p><p className="text-xs text-[#5C6B73]">{data?.debtors ?? 0} client(s) debiteur(s)</p></div>
      <div className="flex gap-2"><Button size="sm" variant="outline" title="Actualiser" aria-label="Actualiser" onClick={() => setRevision((current) => current + 1)}><RefreshCw size={16} /></Button><Button size="sm" variant="outline" isLoading={exporting} leftIcon={<Download size={14} />} onClick={() => void exportCsv()}>Exporter</Button></div>
    </div>
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_10rem]">
      <Input aria-label="Rechercher un client" placeholder="Nom ou telephone" leftAddon={<Search size={16} />} value={search} onChange={(event) => { setSearch(event.target.value); setOffset(0) }} />
      <Select aria-label="Filtrer les clients" options={FILTERS} value={filter} onChange={(event) => { setFilter(event.target.value); setOffset(0) }} />
      <Select aria-label="Trier les clients" options={[{ value:'priority',label:'Reste du' },{ value:'recent',label:'Recents' },{ value:'purchases',label:'Achats' },{ value:'name',label:'Nom' }]} value={sort} onChange={(event) => { setSort(event.target.value); setOffset(0) }} />
    </div>
    {error && <p role="alert" className="break-words text-sm text-red-600">{error}</p>}
    {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
    {loading ? <p role="status" className="py-8 text-sm">Chargement...</p> : !data?.customers.length ? <p className="py-8 text-sm">Aucun client.</p> : <div className="divide-y">
      {data.customers.map((customer) => {
        const ratio = Number(customer.open_debt_total) > 0 ? Math.floor(Number(customer.open_debt_paid) / Number(customer.open_debt_total) * 100) : 100
        const progress = Number(customer.due) > 0 ? Math.min(99,ratio) : 100
        return <div key={customer.id} className={`grid min-w-0 gap-3 border-l-4 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] ${Number(customer.due) > 0 ? 'border-l-red-500' : 'border-l-emerald-500'}`}>
          <div className="min-w-0"><p className="break-words font-semibold">{customer.name || 'Client'}</p><p className="text-xs text-[#5C6B73]">{customer.phone || 'Sans telephone'}</p><p className="mt-1 text-xs text-[#5C6B73]">{customer.sale_count} vente(s) · {customer.last_purchase ? formatDate(customer.last_purchase) : ''}</p></div>
          <div className="min-w-0"><div className="flex flex-wrap justify-between gap-2 text-sm"><span>Achats {formatCurrency(Number(customer.purchases))}</span><strong className={Number(customer.due) > 0 ? 'text-red-700' : 'text-emerald-700'}>Reste {formatCurrency(Number(customer.due))}</strong></div><div className="mt-2 h-1.5 overflow-hidden rounded bg-gray-100"><div className={`h-full ${Number(customer.due) > 0 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width:`${Math.max(0,progress)}%` }} /></div><p className="mt-1 text-xs text-[#5C6B73]">{progress}% regle · {customer.debt_count} dette(s){customer.overdue_count > 0 ? ` · ${customer.overdue_count} en retard` : ''}</p></div>
          <Button size="sm" variant="outline" leftIcon={<ReceiptText size={14} />} onClick={() => openCustomer(customer)}>Voir le compte</Button>
        </div>
      })}
    </div>}
    <div className="flex items-center justify-between gap-2 text-xs"><span>{data?.count ?? 0} client(s)</span><div className="flex items-center gap-2"><Button size="sm" variant="outline" aria-label="Page precedente" title="Page precedente" disabled={loading || offset === 0} onClick={() => setOffset((current) => Math.max(0,current - 30))}><ChevronLeft size={16} /></Button><span>{Math.floor(offset / 30) + 1}</span><Button size="sm" variant="outline" aria-label="Page suivante" title="Page suivante" disabled={loading || offset + 30 >= (data?.count ?? 0)} onClick={() => setOffset((current) => current + 30)}><ChevronRight size={16} /></Button></div></div>
    <Modal isOpen={!!selected && !sale} onClose={() => { if (!saving) { detailVersion.current += 1; setSelected(null) } }} title={selected?.name || 'Compte client'} size="lg">
      {selected && <div className="space-y-4">
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-wrap justify-between gap-2 text-sm"><span>{selected.phone || 'Sans telephone'}</span><strong>Reste {formatCurrency(Number(selected.due))}</strong></div>
        {Number(selected.due) > 0 && <div className="space-y-3 border-y py-3">
          <div className="grid gap-2 sm:grid-cols-2"><Input label="Reglement global" inputMode="numeric" type="number" min="1" max={Number(selected.due)} value={amount} onChange={(event) => setAmount(event.target.value)} /><Select label="Mode" value={method} options={METHODS} onChange={(event) => setMethod(event.target.value)} /></div>
          <Button size="sm" leftIcon={<Wallet size={14} />} isLoading={saving} disabled={detailLoading || !amount} onClick={() => void pay()}>Enregistrer le versement</Button>
          <div className="flex flex-wrap gap-3 text-sm">{contact && <><a className="inline-flex items-center gap-1 text-emerald-700" href={`https://wa.me/${contact}?text=${encodeURIComponent(reminderText)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} />WhatsApp</a><a className="inline-flex items-center gap-1" href={`tel:+${contact}`}><Phone size={16} />Appeler</a></>}<button type="button" className="inline-flex items-center gap-1" onClick={() => void navigator.clipboard.writeText(reminderText).then(() => setNotice('Rappel copie')).catch(() => setError('Copie impossible'))}><Copy size={16} />Copier le rappel</button></div>
          <Select label="Relance effectuee" value={channel} options={[{ value:'phone',label:'Telephone' },{ value:'whatsapp',label:'WhatsApp' },{ value:'other',label:'Autre' }]} onChange={(event) => setChannel(event.target.value)} />
          <Textarea label="Compte rendu" value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} rows={2} /><Button size="sm" variant="outline" disabled={!note.trim()} isLoading={saving} onClick={() => void logReminder()}>Enregistrer la relance</Button>
        </div>}
        <h3 className="text-sm font-semibold">Historique des ventes</h3>
        {history.map((entry) => <button key={entry.id} type="button" className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2 border-b py-2 text-left text-sm" onClick={() => setSale(entry)}><span>{entry.id.slice(0,8).toUpperCase()} · {formatDate(entry.created_at)}{entry.due_date ? ` · Echeance ${formatDate(entry.due_date)}` : ''}</span><span>{formatCurrency(entry.total)} · {SALE_STATUS_LABELS[entry.payment_status]}</span></button>)}
        {detailLoading && <p role="status" className="text-xs">Chargement...</p>}
        {historyMore && <Button size="sm" variant="outline" isLoading={detailLoading} onClick={() => void loadDetail(selected,history.length)}>Voir plus</Button>}
        <h3 className="text-sm font-semibold">Dernieres relances</h3>
        {reminders.length === 0 ? <p className="text-xs text-[#5C6B73]">Aucune relance enregistree.</p> : reminders.map((entry) => <div key={entry.id} className="border-b pb-2 text-xs"><p>{formatDate(entry.created_at)} · {entry.channel}</p><p className="mt-1 break-words">{entry.note}</p></div>)}
      </div>}
    </Modal>
    <SaleDetailModal sale={sale} onClose={() => setSale(null)} onSaved={(message) => { setSale(null); setSelected(null); setRevision((current) => current + 1); setNotice(message ?? 'Compte actualise') }} />
  </div>
}
