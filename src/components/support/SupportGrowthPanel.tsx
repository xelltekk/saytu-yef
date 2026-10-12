'use client'
import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'

type Account = { id: string; business_name: string; email: string; subscription_plan: string; current_period_ends_at: string | null; last_sale_at: string | null }
type Growth = { new_accounts_30d: number; active_accounts_30d: number; inactive_accounts_30d: number; expired_paid_accounts: number; mrr_estimated: number; renewals: Account[]; inactive: Account[] }
export function SupportGrowthPanel() {
  const [data,setData] = useState<Growth | null>(null)
  const [loading,setLoading] = useState(false)
  const [error,setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data: result,error: rpcError } = await createClient().rpc('support_growth_overview')
      if (rpcError) throw new Error(rpcError.message)
      setData(result as Growth)
    } catch (err) { setError(err instanceof Error ? err.message : 'Chargement impossible') }
    finally { setLoading(false) }
  },[])
  useEffect(() => { void load() },[load])
  return <section className="space-y-3 border-y py-4">
    <div className="flex items-center justify-between gap-2"><h2 className="text-base font-semibold">Activite de la plateforme</h2><Button size="sm" variant="outline" title="Actualiser les indicateurs" aria-label="Actualiser les indicateurs" isLoading={loading} onClick={() => void load()}><RefreshCw size={16} /></Button></div>
    {error && <p role="alert" className="break-words text-sm text-red-600">{error}</p>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[
      ['Nouvelles boutiques · 30 j',data?.new_accounts_30d],['Boutiques actives · 30 j',data?.active_accounts_30d],['Inactives depuis 30 j',data?.inactive_accounts_30d],['Abonnements echus',data?.expired_paid_accounts],['MRR actif estime',data ? formatCurrency(Number(data.mrr_estimated)) : undefined],
    ].map(([label,value]) => <div key={String(label)} className="min-w-0"><p className="text-xs text-[#5C6B73]">{label}</p><p className="mt-1 break-words text-lg font-semibold">{value ?? '...'}</p></div>)}</div>
    <div className="grid gap-4 lg:grid-cols-2">
      <div><h3 className="text-sm font-semibold">Renouvellements · 14 jours</h3>{data?.renewals.length === 0 && <p className="mt-2 text-xs text-[#5C6B73]">Aucune echeance.</p>}{data?.renewals.map((account) => <div key={account.id} className="flex flex-wrap justify-between gap-2 border-b py-2 text-xs"><span className="min-w-0 break-all">{account.business_name || account.email}</span><span>{account.current_period_ends_at ? formatDate(account.current_period_ends_at) : ''}</span></div>)}</div>
      <div><h3 className="text-sm font-semibold">Boutiques inactives · 20 premieres</h3>{data?.inactive.length === 0 && <p className="mt-2 text-xs text-[#5C6B73]">Aucune boutique inactive.</p>}{data?.inactive.map((account) => <div key={account.id} className="flex flex-wrap justify-between gap-2 border-b py-2 text-xs"><span className="min-w-0 break-all">{account.business_name || account.email}</span><span>{account.last_sale_at ? formatDate(account.last_sale_at) : 'Aucune vente'}</span></div>)}</div>
    </div>
  </section>
}
