'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  Download,
  MessageCircle,
  Phone,
  ReceiptText,
  RefreshCw,
  Search,
  UserRound,
  Users,
  WalletCards,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Card, MetricCard } from '@/components/ui/Card'
import { SaleDetailModal } from '@/components/sales/SaleDetailModal'
import { getSales } from '@/lib/supabase/queries'
import { getSaleAmountDue, getSaleAmountPaid, getSaleComputedStatus } from '@/lib/sales'
import { formatCurrency, formatCurrencyCompact, formatDate } from '@/lib/utils'
import type { Sale } from '@/types'

type ClientFilter = 'all' | 'debt'

interface ClientSummary {
  id: string
  name: string
  phone: string
  saleCount: number
  totalPurchases: number
  totalPaid: number
  totalDue: number
  lastPurchase: string
  sales: Sale[]
}

function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 9 && digits.startsWith('7')) digits = `221${digits}`
  return digits
}

function getClientDebtSales(client: ClientSummary): Sale[] {
  return client.sales
    .filter((sale) => getSaleAmountDue(sale) > 0)
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
}

function buildClientSummaries(sales: Sale[]): ClientSummary[] {
  const clients = new Map<string, ClientSummary>()

  sales.forEach((sale) => {
    const name = sale.customer_name?.trim() ?? ''
    const phone = sale.customer_phone?.trim() ?? ''
    if (!name && !phone) return

    const normalizedPhone = normalizePhone(phone)
    const key = normalizedPhone ? `phone:${normalizedPhone}` : `name:${name.toLocaleLowerCase('fr')}`
    const status = getSaleComputedStatus(sale)
    const isReversed = status === 'cancelled' || status === 'refunded'
    const current = clients.get(key) ?? {
      id: key,
      name: name || phone,
      phone,
      saleCount: 0,
      totalPurchases: 0,
      totalPaid: 0,
      totalDue: 0,
      lastPurchase: sale.created_at,
      sales: [],
    }

    if (name) current.name = name
    if (phone) current.phone = phone

    if (!isReversed) {
      current.saleCount += 1
      current.totalPurchases += Number(sale.total)
      current.totalPaid += getSaleAmountPaid(sale)
      current.totalDue += getSaleAmountDue(sale)
      current.sales.push(sale)
    }

    if (new Date(sale.created_at).getTime() > new Date(current.lastPurchase).getTime()) {
      current.lastPurchase = sale.created_at
    }

    clients.set(key, current)
  })

  return Array.from(clients.values()).sort((left, right) => (
    right.totalDue - left.totalDue
    || new Date(right.lastPurchase).getTime() - new Date(left.lastPurchase).getTime()
  ))
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ClientFilter>('all')
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)

  const loadClients = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      setClients(buildClientSummaries(await getSales(1000)))
    } catch (loadError: unknown) {
      console.error(loadError)
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les clients.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadClients()
  }, [loadClients])

  const filteredClients = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('fr')
    return clients.filter((client) => {
      if (filter === 'debt' && client.totalDue <= 0) return false
      if (!normalizedQuery) return true
      return `${client.name} ${client.phone}`.toLocaleLowerCase('fr').includes(normalizedQuery)
    })
  }, [clients, filter, query])

  const totals = useMemo(() => clients.reduce((summary, client) => ({
    purchases: summary.purchases + client.totalPurchases,
    due: summary.due + client.totalDue,
    debtors: summary.debtors + (client.totalDue > 0 ? 1 : 0),
  }), { purchases: 0, due: 0, debtors: 0 }), [clients])

  const exportCsv = () => {
    if (filteredClients.length === 0) return
    const safeCell = (value: string | number) => {
      const text = String(value)
      const protectedText = /^[=+\-@]/.test(text) ? `'${text}` : text
      return `"${protectedText.replace(/"/g, '""')}"`
    }
    const rows: Array<Array<string | number>> = [
      ['Client', 'Téléphone', 'Ventes', 'Achats (FCFA)', 'Versé (FCFA)', 'Dette (FCFA)', 'Dernière vente'],
      ...filteredClients.map((client) => [
        client.name,
        client.phone,
        client.saleCount,
        Math.round(client.totalPurchases),
        Math.round(client.totalPaid),
        Math.round(client.totalDue),
        new Date(client.lastPurchase).toLocaleString('fr-SN'),
      ]),
    ]
    const csv = rows.map((row) => row.map(safeCell).join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `clients-saytu-yef-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleSaleSaved = (message?: string) => {
    setNotice(message ?? 'La vente a été mise à jour.')
    setSelectedSale(null)
    void loadClients(true)
  }

  return (
    <div className="min-h-screen">
      <Header title="Clients & dettes" subtitle="Suivi centralisé des achats et créances" />
      <div className="space-y-4 p-3 sm:p-4 lg:space-y-6 lg:p-6">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <MetricCard title="Clients identifiés" value={loading ? '…' : String(clients.length)} change="Nom ou téléphone" changeType="neutral" icon={<Users size={20} />} color="#2D7D7D" />
          <MetricCard title="Clients débiteurs" value={loading ? '…' : String(totals.debtors)} change="Solde restant" changeType={totals.debtors > 0 ? 'down' : 'neutral'} icon={<UserRound size={20} />} color="#F59E0B" />
          <MetricCard title="Total des dettes" value={loading ? '…' : <><span className="sm:hidden">{formatCurrencyCompact(totals.due)}</span><span className="hidden sm:inline">{formatCurrency(totals.due)}</span></>} change="À recouvrer" changeType={totals.due > 0 ? 'down' : 'neutral'} icon={<WalletCards size={20} />} color="#EF4444" />
          <MetricCard title="Achats cumulés" value={loading ? '…' : <><span className="sm:hidden">{formatCurrencyCompact(totals.purchases)}</span><span className="hidden sm:inline">{formatCurrency(totals.purchases)}</span></>} change="Ventes actives" changeType="up" icon={<WalletCards size={20} />} color="#6C5CE7" />
        </div>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_auto_auto]">
          <label className="relative block">
            <span className="sr-only">Rechercher un client</span>
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7682]" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nom ou téléphone…"
              className="h-11 w-full rounded-xl border border-[#2D7D7D]/[0.12] bg-white pl-10 pr-4 text-sm text-[#1A3636]"
            />
          </label>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as ClientFilter)}
            aria-label="Filtrer les clients"
            className="h-11 rounded-xl border border-[#2D7D7D]/[0.12] bg-white px-3 text-sm text-[#1A3636]"
          >
            <option value="all">Tous les clients</option>
            <option value="debt">Avec une dette</option>
          </select>
          <button type="button" onClick={exportCsv} disabled={filteredClients.length === 0} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#2D7D7D]/[0.12] bg-white px-4 text-xs font-semibold text-[#2D7D7D] disabled:opacity-50">
            <Download size={14} /> Exporter
          </button>
          <button type="button" onClick={() => void loadClients(true)} disabled={refreshing} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#2D7D7D]/[0.12] bg-white px-4 text-xs font-semibold text-[#2D7D7D] disabled:opacity-50">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Actualiser
          </button>
        </div>

        {notice && <div role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-700">{notice}</div>}
        {error && <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-600">{error}</div>}

        {loading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="skeleton h-44 rounded-2xl" />)}</div>
        ) : filteredClients.length === 0 ? (
          <Card><div className="py-12 text-center text-[#6B7682]"><Users size={30} className="mx-auto mb-3 opacity-40" /><p className="text-sm">Aucun client ne correspond à ce filtre.</p></div></Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredClients.map((client) => {
              const contactPhone = normalizePhone(client.phone)
              const debtSales = getClientDebtSales(client)
              const isExpanded = expandedClientId === client.id
              const reminder = `Bonjour ${client.name}, nous vous rappelons qu’il reste ${formatCurrency(client.totalDue)} à régler chez Saytu Yef. Merci.`

              return (
                <Card key={client.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#1A3636]">{client.name}</p>
                      <p className="mt-0.5 text-xs text-[#6B7682]">{client.phone || 'Aucun téléphone'}</p>
                    </div>
                    <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold ${client.totalDue > 0 ? 'bg-amber-500/10 text-amber-700' : 'bg-emerald-500/10 text-emerald-700'}`}>
                      {client.totalDue > 0 ? 'Dette ouverte' : 'Soldé'}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-[#F4F7FB] p-3">
                      <p className="text-[10px] uppercase text-[#6B7682]">Achats</p>
                      <p className="mt-1 text-sm font-semibold text-[#1A3636]">{formatCurrencyCompact(client.totalPurchases)}</p>
                    </div>
                    <div className={`rounded-xl p-3 ${client.totalDue > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
                      <p className="text-[10px] uppercase text-[#6B7682]">Reste</p>
                      <p className={`mt-1 text-sm font-semibold ${client.totalDue > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{formatCurrencyCompact(client.totalDue)}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-[#6B7682]">
                    <span>{client.saleCount} vente(s)</span>
                    <span>{formatDate(client.lastPurchase)}</span>
                  </div>

                  <div className="mt-3 grid gap-2 border-t border-[#2D7D7D]/[0.07] pt-3">
                    <button
                      type="button"
                      onClick={() => setExpandedClientId(isExpanded ? null : client.id)}
                      className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#2D7D7D]/15 px-3 text-xs font-semibold text-[#2D7D7D]"
                    >
                      <ReceiptText size={14} />
                      {debtSales.length > 0 ? `Voir ${debtSales.length} dette(s)` : 'Voir les ventes'}
                      <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {client.totalDue > 0 && contactPhone && (
                      <div className="grid grid-cols-2 gap-2">
                        <a href={`https://wa.me/${contactPhone}?text=${encodeURIComponent(reminder)}`} target="_blank" rel="noreferrer" className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white">
                          <MessageCircle size={14} /> WhatsApp
                        </a>
                        <a href={`tel:+${contactPhone}`} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#2D7D7D]/15 px-3 text-xs font-semibold text-[#2D7D7D]">
                          <Phone size={14} /> Appeler
                        </a>
                      </div>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-3 space-y-2 rounded-2xl bg-[#F4F7FB] p-2">
                      {debtSales.length === 0 ? (
                        <p className="px-2 py-3 text-center text-xs text-[#6B7682]">Aucune dette ouverte pour ce client.</p>
                      ) : (
                        debtSales.map((sale) => {
                          const due = getSaleAmountDue(sale)
                          const paid = getSaleAmountPaid(sale)
                          return (
                            <div key={sale.id} className="rounded-xl bg-white p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-[#1A3636]">Reçu {sale.id.slice(0, 8).toUpperCase()}</p>
                                  <p className="mt-0.5 text-[11px] text-[#6B7682]">{formatDate(sale.created_at)} · payé {formatCurrencyCompact(paid)}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-[#6B7682]">Reste</p>
                                  <p className="text-sm font-bold text-amber-700">{formatCurrencyCompact(due)}</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedSale(sale)}
                                className="mt-3 flex min-h-9 w-full items-center justify-center rounded-lg bg-[#2D7D7D] px-3 text-xs font-semibold text-white"
                              >
                                Ouvrir / encaisser
                              </button>
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <SaleDetailModal
        sale={selectedSale}
        onClose={() => setSelectedSale(null)}
        onSaved={handleSaleSaved}
      />
    </div>
  )
}
