'use client'
import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { getCustomerAccounts, type CustomerAccount } from '@/lib/supabase/retail'

export function CustomerPicker({ onSelect }: { onSelect: (name: string, phone: string) => void }) {
  const [query,setQuery] = useState('')
  const [rows,setRows] = useState<CustomerAccount[]>([])
  const [error,setError] = useState('')
  const [loading,setLoading] = useState(false)
  useEffect(() => {
    let active = true
    if (query.trim().length < 2) { setRows([]); setError(''); setLoading(false); return }
    const timer = setTimeout(() => {
      setLoading(true); setError('')
      getCustomerAccounts(query,'all','name',0).then((result) => { if (active) setRows(result.customers.slice(0,8)) })
        .catch(() => { if (active) { setRows([]); setError('Recherche client indisponible') } })
        .finally(() => { if (active) setLoading(false) })
    },250)
    return () => { active = false; clearTimeout(timer) }
  },[query])
  return <div className="min-w-0">
    <Input aria-label="Rechercher un client existant" placeholder="Rechercher un client existant" value={query}
      leftAddon={<Search size={14} />} onChange={(event) => { setQuery(event.target.value); setRows([]) }} />
    {loading && <p role="status" className="mt-1 text-xs">Recherche...</p>}
    {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    {!!rows.length && <ul className="mt-1 max-h-48 overflow-y-auto border bg-white">
      {rows.map((customer) => <li key={customer.id}><button type="button" className="w-full break-words px-3 py-2 text-left text-sm hover:bg-gray-50"
        onClick={() => { onSelect(customer.name,customer.phone); setQuery(''); setRows([]) }}>
        {customer.name || 'Client'}<span className="ml-2 text-xs text-[#5C6B73]">{customer.phone}</span>
      </button></li>)}
    </ul>}
  </div>
}
