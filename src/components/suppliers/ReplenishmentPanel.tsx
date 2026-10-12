'use client'
import { useCallback, useEffect, useState } from 'react'
import { Check, Plus, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { readAllPages } from '@/lib/pagination'
import type { Supplier } from '@/types'

type SuggestedItem = { id: string; name: string; size?: string; color?: string; quantity: number; min_quantity: number; buying_price: number; supplier_id: string | null; requested: number }
type Order = { id: string; supplier_id: string; status: string; created_at: string; items: { product_id: string; quantity: number; unit_cost: number }[] }

export function ReplenishmentPanel({ suppliers }: { suppliers: Supplier[] }) {
  const [suggestions, setSuggestions] = useState<SuggestedItem[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [supplier, setSupplier] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string[]>([])
  const [offset, setOffset] = useState(0)
  const [more, setMore] = useState(false)
  const load = useCallback(async (from = 0) => {
    setLoading(true)
    try {
      const client = createClient()
      const [products, history] = await Promise.all([
        readAllPages((start,end) => client.from('products').select('id,name,size,color,quantity,min_quantity,buying_price,supplier_id')
          .eq('status','active').eq('currency','XOF').order('id').range(start,end)),
        client.from('purchase_orders').select('id,supplier_id,status,created_at,items:purchase_order_items(product_id,quantity,unit_cost)')
          .order('created_at',{ ascending:false }).order('id').range(from,from + 19),
      ])
      if (history.error) throw new Error(history.error.message)
      setSuggestions(products.data.filter((product) => product.quantity <= product.min_quantity).map((product) => ({ ...product, requested: Math.max(1,product.min_quantity * 2 - product.quantity) })))
      setOrders(history.data ?? []); setMore((history.data ?? []).length === 20); setSelected([]); setOffset(from)
    } catch (err) { setError(err instanceof Error ? err.message : 'Chargement impossible') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const createOrder = async () => {
    if (busy || !supplier) return
    const items = suggestions.filter((item) => item.supplier_id === supplier && selected.includes(item.id))
    if (!items.length || items.some((item) => !Number.isInteger(item.requested) || item.requested <= 0)) { setError('Selectionnez des produits et des quantites valides'); return }
    setBusy(true); setError('')
    try {
      const { error: orderError } = await createClient().rpc('create_purchase_order',{ p_supplier_id:supplier,
        p_items:items.map((item) => ({ product_id:item.id,quantity:item.requested,unit_cost:Number(item.buying_price) })),p_notes:null })
      if (orderError) throw new Error(orderError.message)
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Commande impossible') }
    finally { setBusy(false) }
  }
  const updateOrder = async (order: Order, status: 'received' | 'cancelled') => {
    if (busy || !window.confirm(status === 'received' ? 'Confirmer la reception de tous les articles et leur entree en stock ?' : 'Annuler cette commande ?')) return
    setBusy(true); setError('')
    try {
      const { error: updateError } = await createClient().rpc('update_purchase_order',{ p_order_id:order.id,p_status:status })
      if (updateError) throw new Error(updateError.message)
      await load(offset)
    } catch (err) { setError(err instanceof Error ? err.message : 'Mise a jour impossible') }
    finally { setBusy(false) }
  }
  const visible = suggestions.filter((item) => item.supplier_id === supplier)
  return <section className="space-y-3 border-t pt-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold">Reapprovisionnement</h2><Button size="sm" variant="outline" disabled={loading || busy} title="Actualiser les commandes" aria-label="Actualiser les commandes" onClick={() => void load(offset)}><RefreshCw size={16} /></Button></div>
    {error && <p role="alert" className="break-words text-sm text-red-600">{error}</p>}
    <Select label="Fournisseur" value={supplier} options={[{ value:'',label:'Choisir un fournisseur' },...suppliers.map((entry) => ({ value:entry.id,label:entry.name }))]} onChange={(event) => { setSupplier(event.target.value); setSelected([]) }} />
    {loading && <p role="status" className="text-sm">Chargement...</p>}
    {!loading && supplier && <div className="divide-y">{visible.map((item) => <div key={item.id} className="grid min-w-0 grid-cols-[1.25rem_minmax(0,1fr)_5rem] items-center gap-3 py-2">
      <input type="checkbox" aria-label={`Commander ${item.name}`} checked={selected.includes(item.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current,item.id] : current.filter((id) => id !== item.id))} />
      <div className="min-w-0"><p className="break-words text-sm">{[item.name,item.size,item.color].filter(Boolean).join(' · ')}</p><p className="text-xs text-[#5C6B73]">Stock {item.quantity} · Seuil {item.min_quantity} · Achat {formatCurrency(Number(item.buying_price))}</p></div>
      <Input aria-label={`Quantite a commander pour ${item.name}`} type="number" min="1" step="1" value={item.requested} onChange={(event) => setSuggestions((current) => current.map((entry) => entry.id === item.id ? { ...entry,requested:Number(event.target.value) } : entry))} />
    </div>)}{!visible.length && <p className="py-2 text-sm">Aucun produit sous le seuil pour ce fournisseur.</p>}</div>}
    <Button size="sm" disabled={!selected.length || loading} isLoading={busy} leftIcon={<Plus size={14} />} onClick={() => void createOrder()}>Creer la commande</Button>
    <h3 className="pt-2 text-sm font-semibold">Commandes fournisseurs</h3>
    <div className="divide-y">{orders.map((order) => <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0"><p className="break-words text-sm">{suppliers.find((entry) => entry.id === order.supplier_id)?.name || 'Fournisseur'} · {order.id.slice(0,8).toUpperCase()}</p><p className="text-xs text-[#5C6B73]">{formatDate(order.created_at)} · {({ ordered:'Commandee',received:'Recue',cancelled:'Annulee' })[order.status] ?? order.status} · {formatCurrency(order.items.reduce((sum,item) => sum + item.quantity * Number(item.unit_cost),0))}</p></div>
      {order.status === 'ordered' && <div className="flex flex-wrap gap-2"><Button size="sm" variant="teal" disabled={busy} leftIcon={<Check size={14} />} onClick={() => void updateOrder(order,'received')}>Receptionner</Button><Button size="sm" variant="danger" disabled={busy} title="Annuler la commande" aria-label="Annuler la commande" onClick={() => void updateOrder(order,'cancelled')}><X size={16} /></Button></div>}
    </div>)}</div>
    {!orders.length && !loading && <p className="text-sm">Aucune commande.</p>}
    <div className="flex gap-2"><Button size="sm" variant="outline" disabled={offset === 0 || loading || busy} onClick={() => void load(Math.max(0,offset - 20))}>Precedent</Button><Button size="sm" variant="outline" disabled={!more || loading || busy} onClick={() => void load(offset + 20)}>Suivant</Button></div>
    {suggestions.some((item) => !item.supplier_id) && <p className="text-xs text-red-700">{suggestions.filter((item) => !item.supplier_id).length} produit(s) sous le seuil sans fournisseur.</p>}
  </section>
}
