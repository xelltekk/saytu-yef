'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  ChevronDown,
  Copy,
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
import { SALE_STATUS_LABELS, getSaleAmountDue, getSaleAmountPaid, getSaleComputedStatus } from '@/lib/sales'
import { formatCurrency, formatCurrencyCompact, formatDate } from '@/lib/utils'
import type { Sale } from '@/types'

type ClientFilter = 'all' | 'debt' | 'follow_up' | 'settled' | 'missing_phone'
type ClientSort = 'priority' | 'recent' | 'purchases' | 'name'

interface ClientSummary {
  id: string
  name: string
  phone: string
  normalizedName: string
  normalizedPhone: string
  hasExplicitName: boolean
  hasExplicitPhone: boolean
  saleCount: number
  totalPurchases: number
  totalPaid: number
  totalDue: number
  lastPurchase: string
  sales: Sale[]
}

interface ClientNextAction {
  label: string
  detail: string
  className: string
}

interface ClientDebtStats {
  debtSales: Sale[]
  amountPaid: number
  amountDue: number
  recoveryRate: number
}

function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 9 && digits.startsWith('7')) digits = `221${digits}`
  return digits
}

function normalizeClientName(name: string): string {
  return name.trim().toLocaleLowerCase('fr')
}

function getClientDebtSales(client: ClientSummary): Sale[] {
  return client.sales
    .filter((sale) => getSaleAmountDue(sale) > 0)
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
}

function getDaysSince(dateLike: string): number {
  const timestamp = new Date(dateLike).getTime()
  if (Number.isNaN(timestamp)) return 0
  return Math.max(0, Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24)))
}

function getClientOldestDebtSale(client: ClientSummary): Sale | null {
  const debtSales = getClientDebtSales(client)
  return debtSales[debtSales.length - 1] ?? null
}

function getClientRecentSales(client: ClientSummary): Sale[] {
  return [...client.sales].sort((left, right) => (
    new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  ))
}

function getClientDebtStats(client: ClientSummary): ClientDebtStats {
  const debtSales = getClientDebtSales(client)
  const amountPaid = debtSales.reduce((sum, sale) => sum + getSaleAmountPaid(sale), 0)
  const amountDue = debtSales.reduce((sum, sale) => sum + getSaleAmountDue(sale), 0)
  const totalOpenDebtAmount = amountPaid + amountDue

  if (totalOpenDebtAmount <= 0) {
    return {
      debtSales,
      amountPaid,
      amountDue,
      recoveryRate: client.totalDue > 0 ? 0 : 100,
    }
  }

  return {
    debtSales,
    amountPaid,
    amountDue,
    recoveryRate: Math.max(0, Math.min(99, Math.floor((amountPaid / totalOpenDebtAmount) * 100))),
  }
}

function getClientRecoveryRate(client: ClientSummary): number {
  return getClientDebtStats(client).recoveryRate
}

function getSaleStatusClasses(status: Sale['payment_status']): string {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500/10 text-emerald-700'
    case 'partial':
      return 'bg-amber-500/10 text-amber-700'
    case 'pending':
      return 'bg-slate-500/10 text-slate-700'
    case 'refunded':
      return 'bg-sky-500/10 text-sky-700'
    case 'cancelled':
    default:
      return 'bg-red-500/10 text-red-600'
  }
}

function getDebtAgeBadge(days: number): { label: string; className: string } {
  if (days >= 30) {
    return {
      label: `${days} j · urgent`,
      className: 'bg-red-500/10 text-red-600',
    }
  }

  if (days >= 8) {
    return {
      label: `${days} j · a suivre`,
      className: 'bg-amber-500/10 text-amber-700',
    }
  }

  return {
    label: `${days} j · recent`,
    className: 'bg-emerald-500/10 text-emerald-700',
  }
}

function getClientPriorityScore(client: ClientSummary): number {
  const oldestDebtSale = getClientOldestDebtSale(client)
  const oldestDebtAgeDays = oldestDebtSale ? getDaysSince(oldestDebtSale.created_at) : 0
  const debtCount = getClientDebtSales(client).length
  const hasPhone = normalizePhone(client.phone).length > 0

  return (
    oldestDebtAgeDays * 1_000_000
    + debtCount * 100_000
    + Math.round(client.totalDue)
    + (hasPhone ? 10_000 : 50_000)
  )
}

function getClientNextAction(client: ClientSummary): ClientNextAction {
  const debtSales = getClientDebtSales(client)
  const oldestDebtSale = getClientOldestDebtSale(client)
  const oldestDebtAgeDays = oldestDebtSale ? getDaysSince(oldestDebtSale.created_at) : 0
  const hasPhone = normalizePhone(client.phone).length > 0

  if (client.totalDue <= 0 || debtSales.length === 0) {
    return {
      label: 'Compte solde',
      detail: 'Aucune relance necessaire pour ce client.',
      className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700',
    }
  }

  if (!hasPhone) {
    return {
      label: 'Completer le contact',
      detail: 'Ajouter un numero avant toute relance.',
      className: 'border-amber-500/20 bg-amber-500/10 text-amber-700',
    }
  }

  if (oldestDebtAgeDays >= 30) {
    return {
      label: 'Relance urgente',
      detail: 'Dette de plus de 30 jours : traiter en priorite aujourd hui.',
      className: 'border-red-500/20 bg-red-500/10 text-red-600',
    }
  }

  if (debtSales.length >= 2) {
    return {
      label: 'Reglement global a proposer',
      detail: 'Plusieurs ventes ouvertes, regrouper le recouvrement.',
      className: 'border-[#2D7D7D]/15 bg-[#2D7D7D]/10 text-[#2D7D7D]',
    }
  }

  return {
    label: 'Relance simple',
    detail: 'Envoyer le rappel puis enregistrer le paiement a reception.',
    className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700',
  }
}

function buildDebtReminderMessage(clientName: string, amountDue: number): string {
  return `Bonjour ${clientName}, il reste ${formatCurrency(amountDue)} a regler chez Saytu Yef. Merci de nous confirmer votre paiement.`
}

async function copyText(value: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  if (typeof document === 'undefined') {
    throw new Error('copy_unavailable')
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'absolute'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)

  if (!copied) {
    throw new Error('copy_failed')
  }
}

function finalizeClientSummary(client: ClientSummary): ClientSummary {
  const sales = [...client.sales].sort((left, right) => (
    new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  ))
  const latestSale = sales[0] ?? null
  const latestSaleWithName = sales.find((sale) => sale.customer_name?.trim()) ?? null
  const latestSaleWithPhone = sales.find((sale) => sale.customer_phone?.trim()) ?? null
  const resolvedName = latestSaleWithName?.customer_name?.trim() || client.name || latestSaleWithPhone?.customer_phone?.trim() || 'Client'
  const resolvedPhone = latestSaleWithPhone?.customer_phone?.trim() || client.phone
  const hasExplicitName = Boolean(latestSaleWithName?.customer_name?.trim()) || client.hasExplicitName
  const hasExplicitPhone = Boolean(latestSaleWithPhone?.customer_phone?.trim()) || client.hasExplicitPhone

  return {
    ...client,
    name: resolvedName,
    phone: resolvedPhone,
    normalizedName: hasExplicitName ? normalizeClientName(resolvedName) : '',
    normalizedPhone: hasExplicitPhone ? normalizePhone(resolvedPhone) : '',
    hasExplicitName,
    hasExplicitPhone,
    saleCount: sales.length,
    totalPurchases: sales.reduce((sum, sale) => sum + Number(sale.total), 0),
    totalPaid: sales.reduce((sum, sale) => sum + getSaleAmountPaid(sale), 0),
    totalDue: sales.reduce((sum, sale) => sum + getSaleAmountDue(sale), 0),
    lastPurchase: latestSale?.created_at || client.lastPurchase,
    sales,
  }
}

function mergeClientSummaries(primary: ClientSummary, secondary: ClientSummary): ClientSummary {
  return finalizeClientSummary({
    ...primary,
    sales: [...primary.sales, ...secondary.sales],
    saleCount: primary.saleCount + secondary.saleCount,
    totalPurchases: primary.totalPurchases + secondary.totalPurchases,
    totalPaid: primary.totalPaid + secondary.totalPaid,
    totalDue: primary.totalDue + secondary.totalDue,
    lastPurchase: new Date(primary.lastPurchase).getTime() >= new Date(secondary.lastPurchase).getTime()
      ? primary.lastPurchase
      : secondary.lastPurchase,
  })
}

function mergeClientSummariesByIdentity(clients: ClientSummary[]): ClientSummary[] {
  const working = new Map(clients.map((client) => [client.id, finalizeClientSummary(client)]))

  const mergeIntoTarget = (targetId: string, sourceId: string) => {
    if (targetId === sourceId) return
    const target = working.get(targetId)
    const source = working.get(sourceId)
    if (!target || !source) return

    working.set(targetId, mergeClientSummaries(target, source))
    working.delete(sourceId)
  }

  const getSnapshot = () => Array.from(working.values())

  getSnapshot()
    .filter((client) => client.hasExplicitName && !client.hasExplicitPhone && client.normalizedName)
    .forEach((client) => {
      const candidates = getSnapshot().filter((candidate) => (
        candidate.id !== client.id
        && candidate.hasExplicitName
        && candidate.hasExplicitPhone
        && candidate.normalizedName === client.normalizedName
      ))

      if (candidates.length === 1) {
        mergeIntoTarget(candidates[0].id, client.id)
      }
    })

  getSnapshot()
    .filter((client) => client.hasExplicitPhone && !client.hasExplicitName && client.normalizedPhone)
    .forEach((client) => {
      const candidates = getSnapshot().filter((candidate) => (
        candidate.id !== client.id
        && candidate.hasExplicitPhone
        && candidate.hasExplicitName
        && candidate.normalizedPhone === client.normalizedPhone
      ))

      if (candidates.length === 1) {
        mergeIntoTarget(candidates[0].id, client.id)
      }
    })

  return getSnapshot()
}

function buildClientSummaries(sales: Sale[]): ClientSummary[] {
  const clients = new Map<string, ClientSummary>()
  const latestNameAt = new Map<string, number>()
  const latestPhoneAt = new Map<string, number>()

  sales.forEach((sale) => {
    const name = sale.customer_name?.trim() ?? ''
    const phone = sale.customer_phone?.trim() ?? ''
    if (!name && !phone) return

    const normalizedName = name ? normalizeClientName(name) : ''
    const normalizedPhone = normalizePhone(phone)
    const key = normalizedPhone && normalizedName
      ? `contact:${normalizedPhone}:${normalizedName}`
      : normalizedPhone
        ? `phone:${normalizedPhone}`
        : `name:${normalizedName}`
    const saleTimestamp = new Date(sale.created_at).getTime()
    const status = getSaleComputedStatus(sale)
    const isReversed = status === 'cancelled' || status === 'refunded'
    const current = clients.get(key) ?? {
      id: key,
      name: name || phone,
      phone,
      normalizedName,
      normalizedPhone,
      hasExplicitName: Boolean(name),
      hasExplicitPhone: Boolean(normalizedPhone),
      saleCount: 0,
      totalPurchases: 0,
      totalPaid: 0,
      totalDue: 0,
      lastPurchase: sale.created_at,
      sales: [],
    }

    if (name && saleTimestamp >= (latestNameAt.get(key) ?? Number.NEGATIVE_INFINITY)) {
      current.name = name
      current.normalizedName = normalizedName
      current.hasExplicitName = true
      latestNameAt.set(key, saleTimestamp)
    }

    if (phone && saleTimestamp >= (latestPhoneAt.get(key) ?? Number.NEGATIVE_INFINITY)) {
      current.phone = phone
      current.normalizedPhone = normalizedPhone
      current.hasExplicitPhone = true
      latestPhoneAt.set(key, saleTimestamp)
    }

    if (!isReversed) {
      current.saleCount += 1
      current.totalPurchases += Number(sale.total)
      current.totalPaid += getSaleAmountPaid(sale)
      current.totalDue += getSaleAmountDue(sale)
      current.sales.push(sale)
    }

    if (saleTimestamp > new Date(current.lastPurchase).getTime()) {
      current.lastPurchase = sale.created_at
    }

    clients.set(key, current)
  })

  return mergeClientSummariesByIdentity(Array.from(clients.values()))
    .map(finalizeClientSummary)
    .sort((left, right) => (
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
  const [sort, setSort] = useState<ClientSort>('priority')
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
    return clients
      .filter((client) => {
        const hasPhone = normalizePhone(client.phone).length > 0

        if (filter === 'debt' && client.totalDue <= 0) return false
        if (filter === 'follow_up' && (client.totalDue <= 0 || !hasPhone)) return false
        if (filter === 'settled' && client.totalDue > 0) return false
        if (filter === 'missing_phone' && (client.totalDue <= 0 || hasPhone)) return false
        if (!normalizedQuery) return true

        return `${client.name} ${client.phone}`.toLocaleLowerCase('fr').includes(normalizedQuery)
      })
      .sort((left, right) => {
        if (sort === 'recent') {
          return new Date(right.lastPurchase).getTime() - new Date(left.lastPurchase).getTime()
        }

        if (sort === 'purchases') {
          return right.totalPurchases - left.totalPurchases
        }

        if (sort === 'name') {
          return left.name.localeCompare(right.name, 'fr')
        }

        return (
          right.totalDue - left.totalDue
          || getClientDebtSales(right).length - getClientDebtSales(left).length
          || new Date(right.lastPurchase).getTime() - new Date(left.lastPurchase).getTime()
        )
      })
  }, [clients, filter, query, sort])

  const totals = useMemo(() => clients.reduce((summary, client) => ({
    purchases: summary.purchases + client.totalPurchases,
    due: summary.due + client.totalDue,
    debtors: summary.debtors + (client.totalDue > 0 ? 1 : 0),
  }), { purchases: 0, due: 0, debtors: 0 }), [clients])

  const filteredTotals = useMemo(() => filteredClients.reduce((summary, client) => ({
    due: summary.due + client.totalDue,
    debtors: summary.debtors + (client.totalDue > 0 ? 1 : 0),
    followUps: summary.followUps + (client.totalDue > 0 && normalizePhone(client.phone).length > 0 ? 1 : 0),
    missingPhones: summary.missingPhones + (client.totalDue > 0 && normalizePhone(client.phone).length === 0 ? 1 : 0),
    urgent: summary.urgent + (() => {
      const oldestDebtSale = getClientOldestDebtSale(client)
      return oldestDebtSale && getDaysSince(oldestDebtSale.created_at) >= 30 ? 1 : 0
    })(),
    medium: summary.medium + (() => {
      const oldestDebtSale = getClientOldestDebtSale(client)
      const age = oldestDebtSale ? getDaysSince(oldestDebtSale.created_at) : 0
      return oldestDebtSale && age >= 8 && age < 30 ? 1 : 0
    })(),
    recent: summary.recent + (() => {
      const oldestDebtSale = getClientOldestDebtSale(client)
      return oldestDebtSale && getDaysSince(oldestDebtSale.created_at) < 8 ? 1 : 0
    })(),
  }), { due: 0, debtors: 0, followUps: 0, missingPhones: 0, urgent: 0, medium: 0, recent: 0 }), [filteredClients])

  const priorityClients = useMemo(() => {
    return filteredClients
      .filter((client) => client.totalDue > 0)
      .sort((left, right) => (
        getClientPriorityScore(right) - getClientPriorityScore(left)
        || right.totalDue - left.totalDue
        || new Date(right.lastPurchase).getTime() - new Date(left.lastPurchase).getTime()
      ))
      .slice(0, 4)
  }, [filteredClients])

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
        Math.round(client.totalDue > 0 ? getClientDebtStats(client).amountPaid : client.totalPaid),
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

  const handleCopyReminder = useCallback(async (clientName: string, reminder: string) => {
    setError('')

    try {
      await copyText(reminder)
      setNotice(`Message de relance copié pour ${clientName}.`)
    } catch {
      setError("Impossible de copier le message de relance pour le moment.")
    }
  }, [])

  return (
    <div className="min-h-screen">
      <Header title="Clients & dettes" subtitle="Suivi centralisé des achats et créances" />
      <div className="space-y-4 p-3 sm:p-4 lg:space-y-6 lg:p-6">
        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Clients identifiés" value={loading ? '…' : String(clients.length)} change="Nom ou téléphone" changeType="neutral" icon={<Users size={20} />} color="#2D7D7D" />
          <MetricCard title="Clients débiteurs" value={loading ? '…' : String(totals.debtors)} change="Solde restant" changeType={totals.debtors > 0 ? 'down' : 'neutral'} icon={<UserRound size={20} />} color="#F59E0B" />
          <MetricCard title="Total des dettes" value={loading ? '…' : <><span className="sm:hidden">{formatCurrencyCompact(totals.due)}</span><span className="hidden sm:inline">{formatCurrency(totals.due)}</span></>} change="À recouvrer" changeType={totals.due > 0 ? 'down' : 'neutral'} icon={<WalletCards size={20} />} color="#EF4444" />
          <MetricCard title="Achats cumulés" value={loading ? '…' : <><span className="sm:hidden">{formatCurrencyCompact(totals.purchases)}</span><span className="hidden sm:inline">{formatCurrency(totals.purchases)}</span></>} change="Ventes actives" changeType="up" icon={<WalletCards size={20} />} color="#6C5CE7" />
        </div>

        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto_auto]">
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
            className="h-11 w-full rounded-xl border border-[#2D7D7D]/[0.12] bg-white px-3 text-sm text-[#1A3636]"
          >
            <option value="all">Tous les clients</option>
            <option value="debt">Avec une dette</option>
            <option value="follow_up">À relancer</option>
            <option value="missing_phone">Dette sans numéro</option>
            <option value="settled">Soldés</option>
          </select>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as ClientSort)}
            aria-label="Trier les clients"
            className="h-11 w-full rounded-xl border border-[#2D7D7D]/[0.12] bg-white px-3 text-sm text-[#1A3636]"
          >
            <option value="priority">Priorité recouvrement</option>
            <option value="recent">Derniers achats</option>
            <option value="purchases">Plus gros clients</option>
            <option value="name">Nom A-Z</option>
          </select>
          <button type="button" onClick={exportCsv} disabled={filteredClients.length === 0} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#2D7D7D]/[0.12] bg-white px-4 text-xs font-semibold text-[#2D7D7D] disabled:opacity-50">
            <Download size={14} /> Exporter
          </button>
          <button type="button" onClick={() => void loadClients(true)} disabled={refreshing} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#2D7D7D]/[0.12] bg-white px-4 text-xs font-semibold text-[#2D7D7D] disabled:opacity-50">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Actualiser
          </button>
        </div>

        {!loading && filteredClients.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[#5C6B73]">
              {filteredClients.length} client(s) affiché(s)
            </span>
            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${filteredTotals.debtors > 0 ? 'bg-amber-500/10 text-amber-700' : 'bg-emerald-500/10 text-emerald-700'}`}>
              {filteredTotals.debtors} débiteur(s)
            </span>
            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${filteredTotals.due > 0 ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-700'}`}>
              {filteredTotals.due > 0 ? `${formatCurrencyCompact(filteredTotals.due)} à recouvrer` : 'Aucune dette restante'}
            </span>
            {filteredTotals.followUps > 0 && (
              <span className="rounded-full bg-[#2D7D7D]/10 px-3 py-1 text-[11px] font-semibold text-[#2D7D7D]">
                {filteredTotals.followUps} prêt(s) à relancer
              </span>
            )}
            {filteredTotals.missingPhones > 0 && (
              <span className="rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-700">
                {filteredTotals.missingPhones} sans numéro
              </span>
            )}
            {filteredTotals.urgent > 0 && (
              <span className="rounded-full bg-red-500/10 px-3 py-1 text-[11px] font-semibold text-red-600">
                {filteredTotals.urgent} urgent(s) 30j+
              </span>
            )}
            {filteredTotals.medium > 0 && (
              <span className="rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-700">
                {filteredTotals.medium} a suivre 8-29j
              </span>
            )}
            {filteredTotals.recent > 0 && (
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                {filteredTotals.recent} recent(s) 0-7j
              </span>
            )}
          </div>
        )}

        {notice && <div role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-700">{notice}</div>}
        {error && <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-600">{error}</div>}

        {!loading && priorityClients.length > 0 && (
          <Card className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#1A3636]">Recouvrement prioritaire</h2>
                <p className="mt-1 text-sm text-[#6B7682]">
                  Les clients a traiter en premier pour encaisser plus vite.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#F4F7FB] px-3 py-1.5 text-xs font-semibold text-[#2D7D7D]">
                {priorityClients.length} action(s) rapides
              </div>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              {priorityClients.map((client) => {
                const debtStats = getClientDebtStats(client)
                const debtSales = debtStats.debtSales
                const latestDebtSale = debtSales[0] ?? null
                const oldestDebtSale = getClientOldestDebtSale(client)
                const oldestDebtAgeDays = oldestDebtSale ? getDaysSince(oldestDebtSale.created_at) : 0
                const debtAgeBadge = oldestDebtSale ? getDebtAgeBadge(oldestDebtAgeDays) : null
                const nextAction = getClientNextAction(client)
                const contactPhone = normalizePhone(client.phone)
                const reminder = buildDebtReminderMessage(client.name, debtStats.amountDue)

                return (
                  <div key={`${client.id}-priority`} className="rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#1A3636]">{client.name}</p>
                        <p className="mt-1 text-xs text-[#6B7682]">
                          {client.phone || 'Numero manquant'} - {client.saleCount} vente(s)
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#6B7682]">A recouvrer</p>
                        <p className="text-base font-bold text-amber-700">{formatCurrencyCompact(debtStats.amountDue)}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-[#5C6B73]">
                        {debtStats.debtSales.length} dette(s) ouverte(s)
                      </span>
                      {debtAgeBadge && (
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${debtAgeBadge.className}`}>
                          {debtAgeBadge.label}
                        </span>
                      )}
                      <span className="rounded-full bg-[#2D7D7D]/10 px-2.5 py-1 text-[11px] font-medium text-[#2D7D7D]">
                        Verse {formatCurrencyCompact(debtStats.amountPaid)}
                      </span>
                    </div>

                    <div className={`mt-3 rounded-2xl border px-3 py-2 text-xs ${nextAction.className}`}>
                      <p className="font-semibold">{nextAction.label}</p>
                      <p className="mt-1">{nextAction.detail}</p>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {latestDebtSale && (
                        <button
                          type="button"
                          onClick={() => setSelectedSale(latestDebtSale)}
                          className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#2D7D7D] px-3 text-xs font-semibold text-white"
                        >
                          <WalletCards size={14} />
                          Encaisser {formatCurrencyCompact(getSaleAmountDue(latestDebtSale))}
                        </button>
                      )}

                      {contactPhone ? (
                        <a
                          href={`https://wa.me/${contactPhone}?text=${encodeURIComponent(reminder)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white"
                        >
                          <MessageCircle size={14} />
                          Relancer sur WhatsApp
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => latestDebtSale && setSelectedSale(latestDebtSale)}
                          className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 text-xs font-semibold text-amber-700"
                        >
                          <Phone size={14} />
                          Ajouter le numero
                        </button>
                      )}

                      {contactPhone && (
                        <a
                          href={`tel:+${contactPhone}`}
                          className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#2D7D7D]/15 px-3 text-xs font-semibold text-[#2D7D7D]"
                        >
                          <Phone size={14} />
                          Appeler
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => setExpandedClientId(client.id)}
                        className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#2D7D7D]/15 px-3 text-xs font-semibold text-[#2D7D7D]"
                      >
                        <ReceiptText size={14} />
                        Voir le detail
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {loading ? (
          <div className="space-y-2">{[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="skeleton h-24 rounded-2xl" />)}</div>
        ) : filteredClients.length === 0 ? (
          <Card><div className="py-12 text-center text-[#6B7682]"><Users size={30} className="mx-auto mb-3 opacity-40" /><p className="text-sm">Aucun client ne correspond à ce filtre.</p></div></Card>
        ) : (
          <div className="space-y-2">
            {filteredClients.map((client) => {
              const contactPhone = normalizePhone(client.phone)
              const debtStats = getClientDebtStats(client)
              const debtSales = debtStats.debtSales
              const recentSales = getClientRecentSales(client)
              const latestDebtSale = debtSales[0] ?? null
              const latestSale = recentSales[0] ?? null
              const oldestDebtSale = getClientOldestDebtSale(client)
              const isExpanded = expandedClientId === client.id
              const isSettled = client.totalDue <= 0
              const recoveryRate = getClientRecoveryRate(client)
              const latestActionSale = latestDebtSale ?? latestSale
              const oldestDebtAgeDays = oldestDebtSale ? getDaysSince(oldestDebtSale.created_at) : 0
              const debtAgeBadge = oldestDebtSale ? getDebtAgeBadge(oldestDebtAgeDays) : null
              const reminder = buildDebtReminderMessage(client.name, debtStats.amountDue)
              const nextAction = getClientNextAction(client)
              const cardBorderClass = isSettled ? 'border-emerald-500/25' : 'border-red-500/25'
              const duePanelClass = isSettled ? 'bg-emerald-500/10' : 'bg-red-500/10'
              const dueTextClass = isSettled ? 'text-emerald-700' : 'text-red-600'
              const statusBadgeClass = isSettled ? 'bg-emerald-500/10 text-emerald-700' : 'bg-red-500/10 text-red-600'
              const recoveryBadgeClass = isSettled ? 'bg-emerald-500/10 text-emerald-700' : 'bg-red-500/10 text-red-600'
              const progressTrackClass = isSettled ? 'bg-emerald-500/10' : 'bg-red-500/10'
              const progressBarClass = isSettled ? 'bg-emerald-600' : 'bg-red-500'
              const latestDebtClass = isSettled ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'

              return (
                <Card key={client.id} className={`border-2 p-3 sm:p-3.5 ${cardBorderClass}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#1A3636]">{client.name}</p>
                      <p className="mt-0.5 text-xs text-[#6B7682]">{client.phone || 'Aucun téléphone'}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${statusBadgeClass}`}>
                      {isSettled ? 'Soldé' : 'Dette ouverte'}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 sm:max-w-md">
                    <div className="rounded-xl bg-[#F4F7FB] p-2.5">
                      <p className="text-[10px] uppercase text-[#6B7682]">Achats</p>
                      <p className="mt-1 text-xs font-semibold text-[#1A3636]">{formatCurrencyCompact(client.totalPurchases)}</p>
                    </div>
                    <div className={`rounded-xl p-2.5 ${duePanelClass}`}>
                      <p className="text-[10px] uppercase text-[#6B7682]">Reste</p>
                      <p className={`mt-1 text-xs font-semibold ${dueTextClass}`}>{formatCurrencyCompact(client.totalDue)}</p>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-[#F4F7FB] px-2.5 py-1 text-[11px] font-medium text-[#5C6B73]">
                      Versé {formatCurrencyCompact(isSettled ? client.totalPaid : debtStats.amountPaid)}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${isSettled ? 'bg-emerald-500/10 text-emerald-700' : 'bg-red-500/10 text-red-600'}`}>
                      {isSettled ? 'Compte soldé' : `${debtStats.debtSales.length} dette(s) ouverte(s)`}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${recoveryBadgeClass}`}>
                      {recoveryRate}% recouvré
                    </span>
                    {debtAgeBadge && (
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${debtAgeBadge.className}`}>
                        {debtAgeBadge.label}
                      </span>
                    )}
                  </div>

                  <div className="mt-2">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-[#6B7682]">
                      <span>Progression du recouvrement</span>
                      <span>{recoveryRate}%</span>
                    </div>
                    <div className={`h-1.5 overflow-hidden rounded-full ${progressTrackClass}`}>
                      <div
                        className={`h-full rounded-full transition-all ${progressBarClass}`}
                        style={{ width: `${recoveryRate}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs text-[#6B7682]">
                    <span>{client.saleCount} vente(s)</span>
                    <span>{formatDate(client.lastPurchase)}</span>
                  </div>

                  {client.totalDue > 0 && (
                    <div className={`mt-2 rounded-xl border px-3 py-2 text-[11px] ${nextAction.className}`}>
                      <p className="font-semibold">{nextAction.label}</p>
                      <p className="mt-1">{nextAction.detail}</p>
                    </div>
                  )}

                  {latestDebtSale && (
                    <div className={`mt-2 rounded-xl border px-3 py-2 ${latestDebtClass}`}>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-medium text-[#5C6B73]">Dernière dette ouverte</span>
                        <span className={`font-bold ${dueTextClass}`}>{formatCurrencyCompact(getSaleAmountDue(latestDebtSale))}</span>
                      </div>
                      <p className={`mt-1 text-[11px] ${dueTextClass}`}>
                        Reçu {latestDebtSale.id.slice(0, 8).toUpperCase()} · {formatDate(latestDebtSale.created_at)}
                      </p>
                      {oldestDebtSale && (
                        <p className="mt-1 text-[11px] text-[#5C6B73]">
                          Dette la plus ancienne: {oldestDebtAgeDays} jour(s)
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap gap-2 border-t border-[#2D7D7D]/[0.07] pt-2">
                    {latestDebtSale && (
                      <button
                        type="button"
                        onClick={() => setSelectedSale(latestDebtSale)}
                        className="flex min-h-9 items-center justify-center gap-2 rounded-xl bg-[#2D7D7D] px-3 text-[11px] font-semibold text-white"
                      >
                        <WalletCards size={14} />
                        Encaisser {formatCurrencyCompact(getSaleAmountDue(latestDebtSale))}
                      </button>
                    )}

                    {client.totalDue > 0 && !contactPhone && latestActionSale && (
                      <button
                        type="button"
                        onClick={() => setSelectedSale(latestActionSale)}
                        className="flex min-h-9 items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 text-[11px] font-semibold text-amber-700"
                      >
                        <Phone size={14} />
                        Ajouter le téléphone client
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setExpandedClientId(isExpanded ? null : client.id)}
                      className="flex min-h-9 items-center justify-center gap-2 rounded-xl border border-[#2D7D7D]/15 px-3 text-[11px] font-semibold text-[#2D7D7D]"
                    >
                      <ReceiptText size={14} />
                      {debtStats.debtSales.length > 0 ? `Voir ${debtStats.debtSales.length} dette(s)` : 'Voir les ventes'}
                      <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {client.totalDue > 0 && contactPhone && (
                      <div className="grid grid-cols-2 gap-2">
                        <a href={`https://wa.me/${contactPhone}?text=${encodeURIComponent(reminder)}`} target="_blank" rel="noreferrer" className="flex min-h-9 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-[11px] font-semibold text-white">
                          <MessageCircle size={14} /> WhatsApp
                        </a>
                        <a href={`tel:+${contactPhone}`} className="flex min-h-9 items-center justify-center gap-2 rounded-xl border border-[#2D7D7D]/15 px-3 text-[11px] font-semibold text-[#2D7D7D]">
                          <Phone size={14} /> Appeler
                        </a>
                      </div>
                    )}

                    {client.totalDue > 0 && (
                      <button
                        type="button"
                        onClick={() => void handleCopyReminder(client.name, reminder)}
                        className="flex min-h-9 items-center justify-center gap-2 rounded-xl border border-[#2D7D7D]/15 px-3 text-[11px] font-semibold text-[#2D7D7D]"
                      >
                        <Copy size={14} />
                        Copier le rappel
                      </button>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-2 space-y-2 rounded-2xl bg-[#F4F7FB] p-2">
                      {debtSales.length === 0 ? (
                        <>
                          <p className="px-2 pt-2 text-xs font-medium text-[#5C6B73]">Aucune dette ouverte. Dernières ventes du client:</p>
                          {recentSales.slice(0, 3).map((sale) => {
                            const status = getSaleComputedStatus(sale)

                            return (
                              <div key={sale.id} className="rounded-xl bg-white p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-[#1A3636]">Reçu {sale.id.slice(0, 8).toUpperCase()}</p>
                                    <p className="mt-0.5 text-[11px] text-[#6B7682]">{formatDate(sale.created_at)} · total {formatCurrencyCompact(Number(sale.total))}</p>
                                  </div>
                                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${getSaleStatusClasses(status)}`}>
                                    {SALE_STATUS_LABELS[status]}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedSale(sale)}
                                  className="mt-3 flex min-h-9 w-full items-center justify-center rounded-lg border border-[#2D7D7D]/15 px-3 text-xs font-semibold text-[#2D7D7D]"
                                >
                                  Ouvrir la vente
                                </button>
                              </div>
                            )
                          })}
                        </>
                      ) : (
                        debtSales.map((sale) => {
                          const due = getSaleAmountDue(sale)
                          const paid = getSaleAmountPaid(sale)
                          const status = getSaleComputedStatus(sale)
                          const ageBadge = getDebtAgeBadge(getDaysSince(sale.created_at))
                          return (
                            <div key={sale.id} className="rounded-xl bg-white p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-[#1A3636]">Reçu {sale.id.slice(0, 8).toUpperCase()}</p>
                                  <p className="mt-0.5 text-[11px] text-[#6B7682]">{formatDate(sale.created_at)} · payé {formatCurrencyCompact(paid)}</p>
                                  <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${ageBadge.className}`}>
                                    {ageBadge.label}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${getSaleStatusClasses(status)}`}>
                                    {SALE_STATUS_LABELS[status]}
                                  </span>
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

