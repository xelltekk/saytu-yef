'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { formatCurrency } from '@/lib/utils'
import {
  applySupportSubscriptionRequestAction,
  BILLING_CYCLE_LABELS,
  doesSubscriptionActivationRequirePayment,
  formatSubscriptionDate,
  formatSubscriptionDateTime,
  getRemainingDays,
  getSubscriptionExpectedPaymentAmount,
  getSubscriptionRequestReference,
  getSubscriptionRequestSummary,
  getSupportActionLabel,
  getSupportPlatformMembers,
  getSupportConsoleOverview,
  getSupportPlatformAccounts,
  getSupportSubscriptionAudit,
  getSupportSubscriptionRequests,
  hasSupportOperatorAccess,
  SUPPORT_ACCESS_STATUS_LABELS,
  SUPPORT_ACCESS_STATUS_STYLES,
  SUPPORT_WATCH_LEVEL_LABELS,
  SUPPORT_WATCH_LEVEL_STYLES,
  SUBSCRIPTION_PAYMENT_METHOD_LABELS,
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_REQUEST_STATUS_LABELS,
  SUBSCRIPTION_REQUEST_STATUS_STYLES,
  SUBSCRIPTION_REQUEST_TYPE_LABELS,
  SUBSCRIPTION_REQUEST_TYPE_STYLES,
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_STYLES,
  toDateInputValue,
  type SubscriptionRequestRecord,
  type SupportAccountControlInput,
  type SupportConsoleOverview,
  type SupportPlatformAccount,
  type SupportPlatformMember,
  type SupportSubscriptionAuditEntry,
  upsertSupportAccountControl,
} from '@/lib/subscriptions'
import type {
  SubscriptionPaymentMethod,
  SubscriptionPlan,
  SubscriptionStatus,
  SupportAccessStatus,
  SupportWatchLevel,
} from '@/types'
import {
  Ban,
  BadgeDollarSign,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  CreditCard,
  Eye,
  History,
  LifeBuoy,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundCog,
  Users,
  Wallet,
} from 'lucide-react'

type SupportPaymentDraft = {
  method: SubscriptionPaymentMethod | ''
  amount: string
  reference: string
}

type SupportAccountControlDraft = {
  accessStatus: SupportAccessStatus
  watchLevel: SupportWatchLevel
  internalNote: string
  followUpNote: string
  nextFollowUpAt: string
  lastContactedAt?: string | null
}

const SUBSCRIPTION_PAYMENT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'wave', label: SUBSCRIPTION_PAYMENT_METHOD_LABELS.wave },
  { value: 'orange_money', label: SUBSCRIPTION_PAYMENT_METHOD_LABELS.orange_money },
  { value: 'card', label: SUBSCRIPTION_PAYMENT_METHOD_LABELS.card },
  { value: 'cash', label: SUBSCRIPTION_PAYMENT_METHOD_LABELS.cash },
  { value: 'bank_transfer', label: SUBSCRIPTION_PAYMENT_METHOD_LABELS.bank_transfer },
  { value: 'other', label: SUBSCRIPTION_PAYMENT_METHOD_LABELS.other },
]

const AUDIT_ACTION_LABELS: Record<string, string> = {
  requested: 'Nouvelle demande',
  mark_in_progress: 'Prise en charge',
  activate: 'Activation',
  cancel: 'Annulation',
}

const AUDIT_ACTION_STYLES: Record<string, string> = {
  requested: 'bg-violet-500/10 text-violet-700 border border-violet-500/15',
  mark_in_progress: 'bg-amber-500/10 text-amber-700 border border-amber-500/15',
  activate: 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/15',
  cancel: 'bg-red-500/10 text-red-700 border border-red-500/15',
}

function MetricTile({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper: string
}) {
  return (
    <div className="rounded-2xl border border-[#2D7D7D]/10 bg-white p-4 shadow-[0_6px_20px_rgba(26,54,54,0.04)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7682]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[#1A3636]">{value}</p>
      <p className="mt-1 text-xs text-[#6B7682]">{helper}</p>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-3 sm:p-4 lg:p-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="p-4">
            <div className="animate-pulse space-y-3">
              <div className="h-3 w-20 rounded-full bg-[#2D7D7D]/10" />
              <div className="h-7 w-28 rounded-full bg-[#2D7D7D]/10" />
              <div className="h-3 w-24 rounded-full bg-[#2D7D7D]/10" />
            </div>
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-48 rounded-full bg-[#2D7D7D]/10" />
          <div className="h-12 w-full rounded-full bg-[#2D7D7D]/10" />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="h-32 rounded-2xl bg-[#2D7D7D]/10" />
            <div className="h-32 rounded-2xl bg-[#2D7D7D]/10" />
          </div>
        </div>
      </Card>
    </div>
  )
}

function normalizeSupportText(value?: string | null) {
  return value?.trim().toLowerCase() ?? ''
}

function accountMatchesSupportEntry(
  account: SupportPlatformAccount,
  input?: { email?: string | null; businessName?: string | null }
) {
  const ownerEmail = normalizeSupportText(account.ownerEmail)
  const businessName = normalizeSupportText(account.businessName)
  const entryEmail = normalizeSupportText(input?.email)
  const entryBusiness = normalizeSupportText(input?.businessName)

  return (
    (ownerEmail.length > 0 && ownerEmail === entryEmail) ||
    (businessName.length > 0 && businessName === entryBusiness)
  )
}

function getPlanDefinition(plan: SubscriptionPlan) {
  return SUBSCRIPTION_PLANS.find((item) => item.id === plan) ?? SUBSCRIPTION_PLANS[0]
}

function getLimitLabel(limit: number | null) {
  return limit === null ? 'Illimite' : `${limit}`
}

function getUsageRatio(value: number, limit: number | null) {
  if (limit === null || limit <= 0) return 0
  return Math.round((value / limit) * 100)
}

function getUsageTone(ratio: number, limit: number | null) {
  if (limit === null) {
    return {
      badge: 'Sans plafond',
      track: 'bg-[#2D7D7D]/10',
      fill: 'bg-[#2D7D7D]',
      text: 'text-[#2D7D7D]',
    }
  }

  if (ratio >= 100) {
    return {
      badge: 'Au plafond',
      track: 'bg-red-500/10',
      fill: 'bg-red-500',
      text: 'text-red-700',
    }
  }

  if (ratio >= 80) {
    return {
      badge: 'A surveiller',
      track: 'bg-amber-500/10',
      fill: 'bg-amber-500',
      text: 'text-amber-700',
    }
  }

  return {
    badge: 'Confortable',
    track: 'bg-emerald-500/10',
    fill: 'bg-emerald-500',
    text: 'text-emerald-700',
  }
}

function getSupportRecommendation(account: SupportPlatformAccount) {
  const planDefinition = getPlanDefinition(account.plan)
  const teamRatio = getUsageRatio(account.teamMembersCount, planDefinition.limits.teamMembers)
  const productsRatio = getUsageRatio(account.productsCount, planDefinition.limits.products)

  if (account.pendingRequestsCount > 0) {
    return {
      title: 'Demande support ouverte',
      body: 'Une demande est deja en file. Priorite a son traitement avant toute relance commerciale.',
      tone: 'border-amber-500/20 bg-amber-500/10 text-amber-700',
    }
  }

  if (
    account.plan !== 'free' &&
    account.plan !== 'lifetime' &&
    account.currentPeriodEndsAt &&
    (getRemainingDays(account.currentPeriodEndsAt) ?? 999) <= 7
  ) {
    return {
      title: 'Renouvellement a anticiper',
      body: 'La boutique arrive proche de l echeance. Bon candidat pour relance proactive ou renouvellement.',
      tone: 'border-red-500/20 bg-red-500/10 text-red-700',
    }
  }

  if (account.plan === 'free' && (productsRatio >= 80 || account.monthlySalesCount >= 7)) {
    return {
      title: 'Candidat Starter',
      body: 'L usage actuel approche les limites du plan gratuit. Une proposition Starter a du sens.',
      tone: 'border-violet-500/20 bg-violet-500/10 text-violet-700',
    }
  }

  if (account.plan === 'starter' && (teamRatio >= 100 || productsRatio >= 90)) {
    return {
      title: 'Candidat Pro',
      body: 'Le compte commence a toucher les limites Starter. Une montee en Pro peut eviter un blocage.',
      tone: 'border-[#2D7D7D]/20 bg-[#2D7D7D]/10 text-[#2D7D7D]',
    }
  }

  return {
    title: 'Compte stable',
    body: 'Aucun point critique detecte pour le moment. Le suivi peut rester sur un rythme normal.',
    tone: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700',
  }
}

function getSupportWatchRank(level: SupportWatchLevel) {
  switch (level) {
    case 'critical':
      return 3
    case 'priority':
      return 2
    default:
      return 1
  }
}

function getMemberRoleStyle(role: SupportPlatformMember['role']) {
  if (role === 'admin') return 'bg-violet-500/10 text-violet-700 border border-violet-500/15'
  if (role === 'cashier') return 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/15'
  return 'bg-sky-500/10 text-sky-700 border border-sky-500/15'
}

function buildAccountPriorityScore(account: SupportPlatformAccount) {
  const daysLeft = getRemainingDays(account.currentPeriodEndsAt)
  let score = getSupportWatchRank(account.watchLevel) * 10

  if (account.accessStatus === 'restricted') score += 100
  if (account.pendingRequestsCount > 0) score += 35
  if (account.status === 'past_due' || account.status === 'expired' || account.status === 'suspended') score += 24
  if (
    account.plan !== 'free'
    && account.plan !== 'lifetime'
    && daysLeft !== null
    && daysLeft >= 0
    && daysLeft <= 7
  ) {
    score += 18
  }

  return score
}

function needsBillingAttention(account: SupportPlatformAccount) {
  if (account.plan === 'free' || account.plan === 'lifetime') {
    return account.pendingRequestsCount > 0
  }

  const daysLeft = getRemainingDays(account.currentPeriodEndsAt)

  return (
    account.pendingRequestsCount > 0
    || account.status === 'past_due'
    || account.status === 'expired'
    || account.status === 'suspended'
    || (daysLeft !== null && daysLeft <= 10)
  )
}

function getBillingFollowUpLabel(account: SupportPlatformAccount) {
  if (account.pendingRequestsCount > 0) {
    return `${account.pendingRequestsCount} demande(s) en attente`
  }

  if (account.status === 'past_due') {
    return 'Paiement a confirmer'
  }

  if (account.status === 'suspended') {
    return 'Compte suspendu a reevaluer'
  }

  if (account.status === 'expired') {
    return 'Abonnement expire'
  }

  const daysLeft = getRemainingDays(account.currentPeriodEndsAt)
  if (daysLeft !== null && daysLeft >= 0) {
    return daysLeft <= 0 ? 'Echeance aujourd hui' : `Echeance dans ${daysLeft} jour(s)`
  }

  return 'Suivi support recommande'
}

export function SupportConsole() {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [bootLoading, setBootLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [overview, setOverview] = useState<SupportConsoleOverview | null>(null)
  const [accounts, setAccounts] = useState<SupportPlatformAccount[]>([])
  const [members, setMembers] = useState<SupportPlatformMember[]>([])
  const [queue, setQueue] = useState<SubscriptionRequestRecord[]>([])
  const [auditEntries, setAuditEntries] = useState<SupportSubscriptionAuditEntry[]>([])

  const [accountsLoading, setAccountsLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(true)
  const [queueLoading, setQueueLoading] = useState(true)
  const [auditLoading, setAuditLoading] = useState(true)

  const [pageError, setPageError] = useState('')
  const [accountsError, setAccountsError] = useState('')
  const [membersError, setMembersError] = useState('')
  const [queueError, setQueueError] = useState('')
  const [auditError, setAuditError] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const [search, setSearch] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [planFilter, setPlanFilter] = useState<SubscriptionPlan | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | 'all'>('all')
  const [memberRoleFilter, setMemberRoleFilter] = useState<'all' | SupportPlatformMember['role']>('all')
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)

  const [supportActionTarget, setSupportActionTarget] = useState<string | null>(null)
  const [accountControlTarget, setAccountControlTarget] = useState<string | null>(null)
  const [supportNotes, setSupportNotes] = useState<Record<string, string>>({})
  const [supportPayments, setSupportPayments] = useState<Record<string, SupportPaymentDraft>>({})
  const [accountControlDrafts, setAccountControlDrafts] = useState<Record<string, SupportAccountControlDraft>>({})

  const seedSupportDrafts = useCallback((requests: SubscriptionRequestRecord[]) => {
    setSupportNotes(
      Object.fromEntries(
        requests.map((request) => [request.id, request.supportNote || request.notes || ''])
      )
    )
    setSupportPayments(
      Object.fromEntries(
        requests.map((request) => [
          request.id,
          {
            method: request.paymentMethod ?? '',
            amount: request.paymentAmount ? String(Math.round(request.paymentAmount)) : '',
            reference: request.paymentReference ?? '',
          },
        ])
      )
    )
  }, [])

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true)
    setAccountsError('')

    try {
      const nextAccounts = await getSupportPlatformAccounts({
        search,
        plan: planFilter,
        status: statusFilter,
        limit: 80,
      })
      setAccounts(nextAccounts)
      setAccountControlDrafts(
        Object.fromEntries(
          nextAccounts.map((account) => [
            account.accountId,
            {
              accessStatus: account.accessStatus,
              watchLevel: account.watchLevel,
              internalNote: account.internalNote ?? '',
              followUpNote: account.followUpNote ?? '',
              nextFollowUpAt: toDateInputValue(account.nextFollowUpAt),
              lastContactedAt: account.lastContactedAt ?? null,
            },
          ])
        )
      )
    } catch (error) {
      setAccountsError(error instanceof Error ? error.message : 'Impossible de charger les boutiques.')
    } finally {
      setAccountsLoading(false)
    }
  }, [planFilter, search, statusFilter])

  const loadMembers = useCallback(async () => {
    setMembersLoading(true)
    setMembersError('')

    try {
      const nextMembers = await getSupportPlatformMembers({
        search: memberSearch,
        role: memberRoleFilter,
        limit: 120,
      })
      setMembers(nextMembers)
    } catch (error) {
      setMembersError(error instanceof Error ? error.message : 'Impossible de charger les utilisateurs.')
    } finally {
      setMembersLoading(false)
    }
  }, [memberRoleFilter, memberSearch])

  const focusAccountInList = useCallback(async (account: SupportPlatformAccount) => {
    const nextSearch = account.ownerEmail
    setSearch(nextSearch)
    setPlanFilter('all')
    setStatusFilter('all')
    setAccountsLoading(true)
    setAccountsError('')

    try {
      const nextAccounts = await getSupportPlatformAccounts({
        search: nextSearch,
        plan: 'all',
        status: 'all',
        limit: 80,
      })
      setAccounts(nextAccounts)
    } catch (error) {
      setAccountsError(error instanceof Error ? error.message : 'Impossible de filtrer cette boutique.')
    } finally {
      setAccountsLoading(false)
    }
  }, [])

  const loadPanels = useCallback(async () => {
    setQueueLoading(true)
    setAuditLoading(true)
    setQueueError('')
    setAuditError('')
    setPageError('')

    try {
      const [nextOverview, nextQueue, nextAudit] = await Promise.all([
        getSupportConsoleOverview(),
        getSupportSubscriptionRequests(18),
        getSupportSubscriptionAudit(24),
      ])

      setOverview(nextOverview)
      setQueue(nextQueue ?? [])
      seedSupportDrafts(nextQueue ?? [])
      setAuditEntries(nextAudit)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible de charger la console SaaS.'
      setQueueError(message)
      setAuditError(message)
      setPageError(message)
    } finally {
      setQueueLoading(false)
      setAuditLoading(false)
    }
  }, [seedSupportDrafts])

  const initialize = useCallback(async () => {
    setBootLoading(true)
    setPageError('')

    try {
      const access = await hasSupportOperatorAccess()
      setHasAccess(access)

      if (!access) {
        setOverview(null)
        setAccounts([])
        setMembers([])
        setQueue([])
        setAuditEntries([])
        return
      }

      await Promise.all([loadPanels(), loadAccounts(), loadMembers()])
    } catch (error) {
      setHasAccess(false)
      setPageError(error instanceof Error ? error.message : 'Impossible d ouvrir la console SaaS.')
    } finally {
      setBootLoading(false)
    }
  }, [loadAccounts, loadMembers, loadPanels])

  useEffect(() => {
    void initialize()
  }, [initialize])

  const refreshAll = useCallback(async () => {
    setRefreshing(true)
    setFeedback(null)
    await initialize()
    setRefreshing(false)
  }, [initialize])

  const handleFilters = async () => {
    if (hasAccess !== true) return
    await loadAccounts()
  }

  const handleMemberFilters = async () => {
    if (hasAccess !== true) return
    await loadMembers()
  }

  const getSupportPaymentDraft = useCallback((request: SubscriptionRequestRecord): SupportPaymentDraft => {
    return supportPayments[request.id] ?? {
      method: request.paymentMethod ?? '',
      amount: request.paymentAmount ? String(Math.round(request.paymentAmount)) : '',
      reference: request.paymentReference ?? '',
    }
  }, [supportPayments])

  const handleSupportNoteChange = useCallback((requestId: string, value: string) => {
    setSupportNotes((current) => ({ ...current, [requestId]: value }))
  }, [])

  const handleSupportPaymentChange = useCallback(
    (request: SubscriptionRequestRecord, field: keyof SupportPaymentDraft, value: string) => {
      setSupportPayments((current) => ({
        ...current,
        [request.id]: {
          ...getSupportPaymentDraft(request),
          [field]: value,
        },
      }))
    },
    [getSupportPaymentDraft]
  )

  const getAccountControlDraft = useCallback((account: SupportPlatformAccount): SupportAccountControlDraft => {
    return accountControlDrafts[account.accountId] ?? {
      accessStatus: account.accessStatus,
      watchLevel: account.watchLevel,
      internalNote: account.internalNote ?? '',
      followUpNote: account.followUpNote ?? '',
      nextFollowUpAt: toDateInputValue(account.nextFollowUpAt),
      lastContactedAt: account.lastContactedAt ?? null,
    }
  }, [accountControlDrafts])

  const handleAccountControlChange = useCallback((
    account: SupportPlatformAccount,
    field: keyof SupportAccountControlDraft,
    value: string
  ) => {
    setAccountControlDrafts((current) => ({
      ...current,
      [account.accountId]: {
        ...getAccountControlDraft(account),
        [field]: value,
      },
    }))
  }, [getAccountControlDraft])

  const saveAccountControl = useCallback(async (
    account: SupportPlatformAccount,
    override?: Partial<SupportAccountControlInput>
  ) => {
    setAccountControlTarget(account.accountId)
    setFeedback(null)

    try {
      const currentDraft = getAccountControlDraft(account)
      await upsertSupportAccountControl(account.accountId, {
        accessStatus: override?.accessStatus ?? currentDraft.accessStatus,
        watchLevel: override?.watchLevel ?? currentDraft.watchLevel,
        internalNote: override?.internalNote ?? currentDraft.internalNote,
        followUpNote: override?.followUpNote ?? currentDraft.followUpNote,
        nextFollowUpAt: override?.nextFollowUpAt ?? currentDraft.nextFollowUpAt,
        lastContactedAt: override?.lastContactedAt ?? currentDraft.lastContactedAt ?? null,
      })

      setFeedback({ type: 'success', msg: 'Fiche boutique mise a jour.' })
      await Promise.all([loadAccounts(), loadMembers()])
    } catch (error) {
      setFeedback({
        type: 'error',
        msg: error instanceof Error ? error.message : 'Mise a jour support impossible.',
      })
    } finally {
      setAccountControlTarget(null)
    }
  }, [getAccountControlDraft, loadAccounts, loadMembers])

  const handleSupportAction = useCallback(
    async (request: SubscriptionRequestRecord, action: 'mark_in_progress' | 'activate' | 'cancel') => {
      setSupportActionTarget(request.id)
      setFeedback(null)

      try {
        const paymentDraft = getSupportPaymentDraft(request)
        const paymentAmount = paymentDraft.amount.trim().length > 0 ? Number(paymentDraft.amount) : null
        const requiresPaymentProof = doesSubscriptionActivationRequirePayment(request.requestType, request.requestedPlan)
        const expectedPayment = getSubscriptionExpectedPaymentAmount(request.requestType, request.requestedPlan)

        if (action === 'activate' && requiresPaymentProof) {
          if (!paymentDraft.method) {
            throw new Error('Mode de paiement obligatoire avant activation.')
          }
          if (paymentAmount === null || !Number.isFinite(paymentAmount) || paymentAmount <= 0) {
            throw new Error('Montant de paiement invalide.')
          }
          if (expectedPayment !== null && paymentAmount < expectedPayment) {
            throw new Error(`Montant insuffisant. Attendu au moins ${formatCurrency(expectedPayment)}.`)
          }
          if (paymentDraft.reference.trim().length < 4) {
            throw new Error('Reference de paiement obligatoire avant activation.')
          }
        }

        await applySupportSubscriptionRequestAction(request.id, action, {
          note: supportNotes[request.id] ?? '',
          paymentMethod: paymentDraft.method || null,
          paymentAmount: paymentAmount,
          paymentReference: paymentDraft.reference || null,
        })

        const successMessage: Record<'mark_in_progress' | 'activate' | 'cancel', string> = {
          mark_in_progress: 'Demande prise en charge.',
          activate: 'Demande activee et profil mis a jour.',
          cancel: 'Demande annulee.',
        }

        setFeedback({ type: 'success', msg: successMessage[action] })
        await Promise.all([loadPanels(), loadAccounts()])
      } catch (error) {
        setFeedback({
          type: 'error',
          msg: error instanceof Error ? error.message : 'Action support impossible.',
        })
      } finally {
        setSupportActionTarget(null)
      }
    },
    [getSupportPaymentDraft, loadAccounts, loadPanels, supportNotes]
  )

  const planOptions = useMemo(
    () => [
      { value: 'all', label: 'Tous les plans' },
      ...SUBSCRIPTION_PLANS.map((plan) => ({ value: plan.id, label: plan.name })),
    ],
    []
  )

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: 'Tous les statuts' },
      { value: 'trial', label: SUBSCRIPTION_STATUS_LABELS.trial },
      { value: 'active', label: SUBSCRIPTION_STATUS_LABELS.active },
      { value: 'free', label: SUBSCRIPTION_STATUS_LABELS.free },
      { value: 'past_due', label: SUBSCRIPTION_STATUS_LABELS.past_due },
      { value: 'suspended', label: SUBSCRIPTION_STATUS_LABELS.suspended },
      { value: 'cancelled', label: SUBSCRIPTION_STATUS_LABELS.cancelled },
      { value: 'expired', label: SUBSCRIPTION_STATUS_LABELS.expired },
    ],
    []
  )

  const memberRoleOptions = useMemo(
    () => [
      { value: 'all', label: 'Tous les roles' },
      { value: 'admin', label: 'Administrateurs' },
      { value: 'employee', label: 'Employes' },
      { value: 'cashier', label: 'Caisse' },
    ],
    []
  )

  const adminAccounts = useMemo(
    () => [...accounts].sort((left, right) => buildAccountPriorityScore(right) - buildAccountPriorityScore(left)).slice(0, 6),
    [accounts]
  )

  const billingAccounts = useMemo(
    () => [...accounts]
      .filter((account) => needsBillingAttention(account))
      .sort((left, right) => buildAccountPriorityScore(right) - buildAccountPriorityScore(left))
      .slice(0, 6),
    [accounts]
  )

  const memberSummary = useMemo(() => ({
    admins: members.filter((member) => member.role === 'admin').length,
    cashiers: members.filter((member) => member.role === 'cashier').length,
    restricted: members.filter((member) => member.accessStatus === 'restricted').length,
  }), [members])

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.accountId === selectedAccountId) ?? null,
    [accounts, selectedAccountId]
  )

  const relatedAccountRequests = useMemo(() => {
    if (!selectedAccount) return []
    return queue.filter((request) =>
      accountMatchesSupportEntry(selectedAccount, {
        email: request.requestedByEmail,
        businessName: request.businessName,
      })
    )
  }, [queue, selectedAccount])

  const relatedAccountAudit = useMemo(() => {
    if (!selectedAccount) return []
    return auditEntries.filter((entry) =>
      accountMatchesSupportEntry(selectedAccount, {
        email: entry.requestedByEmail,
        businessName: entry.businessName,
      })
    )
  }, [auditEntries, selectedAccount])

  if (bootLoading) {
    return <LoadingSkeleton />
  }

  if (hasAccess === false) {
    return (
      <div className="space-y-4 p-3 sm:p-4 lg:p-6">
        <Card className="p-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700">
              <ShieldCheck size={14} />
              Acces restreint
            </div>
            <h2 className="mt-4 text-2xl font-bold text-[#1A3636]">Console SaaS reservee au support XELLTEKK</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#5C6B73]">
              Cette page centralise les boutiques, les demandes d&apos;abonnement et les validations support.
              Votre session actuelle n&apos;a pas l&apos;autorisation necessaire.
            </p>
            {pageError && (
              <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
                {pageError}
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/settings?tab=billing"
                className="inline-flex h-11 items-center justify-center rounded-full border border-[#2D7D7D]/20 px-5 text-sm font-semibold text-[#2D7D7D] transition-colors hover:bg-[#2D7D7D]/5"
              >
                Retour a l&apos;abonnement
              </Link>
              <Link
                href="/support"
                className="inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-[#2D7D7D] to-[#4FA3A3] px-5 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(45,125,125,0.28)]"
              >
                Contacter le support
              </Link>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-3 sm:p-4 lg:p-6">
      {pageError && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          {pageError}
        </div>
      )}

      {feedback && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700'
              : 'border-red-500/20 bg-red-500/10 text-red-700'
          }`}
        >
          {feedback.msg}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Boutiques"
          value={`${overview?.totalAccounts ?? 0}`}
          helper={`${overview?.totalMembers ?? 0} utilisateur(s) inscrits`}
        />
        <MetricTile
          label="Demandes ouvertes"
          value={`${overview?.pendingRequests ?? 0}`}
          helper={`${overview?.expiringSoonAccounts ?? 0} echeance(s) a surveiller`}
        />
        <MetricTile
          label="Plans payants actifs"
          value={`${overview?.activePaidAccounts ?? 0}`}
          helper={`${overview?.lifetimeAccounts ?? 0} plan(s) a vie`}
        />
        <MetricTile
          label="MRR estime"
          value={formatCurrency(overview?.monthlyRecurringRevenue ?? 0)}
          helper={`${overview?.trialAccounts ?? 0} essai(s) en cours`}
        />
      </div>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#1A3636]">Pilotage global du SaaS</h2>
            <p className="mt-1 text-sm text-[#6B7682]">
              Vue d&apos;ensemble des comptes, file d&apos;abonnement et historique des validations support.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/settings?tab=billing"
              className="inline-flex h-11 items-center justify-center rounded-full border border-[#2D7D7D]/20 px-5 text-sm font-semibold text-[#2D7D7D] transition-colors hover:bg-[#2D7D7D]/5"
            >
              Centre abonnement
            </Link>
            <Button variant="outline" onClick={() => { window.location.href = '/support' }}>
              <LifeBuoy size={16} />
              Support public
            </Button>
            <Button variant="ghost" onClick={() => void refreshAll()} disabled={refreshing}>
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              Actualiser
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <Input
              label="Recherche"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Boutique, proprietaire ou email..."
              leftAddon={<Search size={16} />}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:w-[430px] lg:grid-cols-3">
            <Select
              label="Plan"
              value={planFilter}
              onChange={(event) => setPlanFilter(event.target.value as SubscriptionPlan | 'all')}
              options={planOptions}
            />
            <Select
              label="Statut"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as SubscriptionStatus | 'all')}
              options={statusOptions}
            />
            <Button className="lg:mb-[2px]" onClick={() => void handleFilters()}>
              Filtrer
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[#1A3636]">Administration des boutiques</h3>
              <p className="mt-1 text-sm text-[#6B7682]">
                Suspendre ou reactiver un compte, definir le niveau de suivi et garder une note interne.
              </p>
            </div>
            <div className="rounded-full bg-[#F4F7FB] px-3 py-1 text-xs font-semibold text-[#5C6B73]">
              {adminAccounts.length} priorite(s)
            </div>
          </div>

          {accountsLoading ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="animate-pulse rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-4">
                  <div className="h-4 w-44 rounded-full bg-[#2D7D7D]/10" />
                  <div className="mt-3 h-20 rounded-2xl bg-[#2D7D7D]/10" />
                </div>
              ))}
            </div>
          ) : adminAccounts.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#2D7D7D]/15 bg-[#F8FBFC] px-4 py-4 text-sm text-[#6B7682]">
              Aucune boutique a piloter avec les filtres actuels.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {adminAccounts.map((account) => {
                const draft = getAccountControlDraft(account)
                const isSaving = accountControlTarget === account.accountId

                return (
                  <div key={account.accountId} className="rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-[#1A3636]">{account.businessName}</span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${SUPPORT_ACCESS_STATUS_STYLES[account.accessStatus]}`}>
                            {SUPPORT_ACCESS_STATUS_LABELS[account.accessStatus]}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${SUPPORT_WATCH_LEVEL_STYLES[account.watchLevel]}`}>
                            {SUPPORT_WATCH_LEVEL_LABELS[account.watchLevel]}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-[#1A3636]">{account.ownerName}</p>
                        <p className="mt-1 text-xs text-[#6B7682]">{account.ownerEmail}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={draft.accessStatus === 'restricted' ? 'teal' : 'danger'}
                          size="sm"
                          onClick={() => void saveAccountControl(account, {
                            accessStatus: draft.accessStatus === 'restricted' ? 'active' : 'restricted',
                          })}
                          disabled={isSaving}
                        >
                          <Ban size={14} />
                          {draft.accessStatus === 'restricted' ? 'Reactiver' : 'Suspendre'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setSelectedAccountId(account.accountId)}>
                          <Eye size={14} />
                          Fiche
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                      <Select
                        label="Niveau de suivi"
                        value={draft.watchLevel}
                        onChange={(event) => handleAccountControlChange(account, 'watchLevel', event.target.value)}
                        options={[
                          { value: 'normal', label: 'Normal' },
                          { value: 'priority', label: 'Priorite' },
                          { value: 'critical', label: 'Critique' },
                        ]}
                      />
                      <Textarea
                        label="Note interne support"
                        rows={3}
                        value={draft.internalNote}
                        onChange={(event) => handleAccountControlChange(account, 'internalNote', event.target.value)}
                        placeholder="Contexte de la boutique, decision prise, element a surveiller..."
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B7682]">
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#2D7D7D]/10 bg-white px-2.5 py-1">
                          <Clock3 size={13} />
                          Derniere vente {formatSubscriptionDate(account.lastSaleAt) || 'aucune'}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#2D7D7D]/10 bg-white px-2.5 py-1">
                          <Users size={13} />
                          {account.teamMembersCount} membre(s)
                        </span>
                      </div>
                      <Button
                        variant="glass"
                        size="sm"
                        onClick={() => void saveAccountControl(account)}
                        disabled={isSaving}
                      >
                        {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[#1A3636]">Facturation & relances</h3>
              <p className="mt-1 text-sm text-[#6B7682]">
                Echeances proches, paiements a confirmer et prochaines relances du support.
              </p>
            </div>
            <div className="rounded-full bg-[#F4F7FB] px-3 py-1 text-xs font-semibold text-[#5C6B73]">
              {billingAccounts.length} suivi(s)
            </div>
          </div>

          {accountsLoading ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="animate-pulse rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-4">
                  <div className="h-4 w-40 rounded-full bg-[#2D7D7D]/10" />
                  <div className="mt-3 h-24 rounded-2xl bg-[#2D7D7D]/10" />
                </div>
              ))}
            </div>
          ) : billingAccounts.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#2D7D7D]/15 bg-[#F8FBFC] px-4 py-4 text-sm text-[#6B7682]">
              Aucun renouvellement ou relance urgente detecte pour l&apos;instant.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {billingAccounts.map((account) => {
                const draft = getAccountControlDraft(account)
                const isSaving = accountControlTarget === account.accountId

                return (
                  <div key={account.accountId} className="rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[#1A3636]">{account.businessName}</span>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${SUBSCRIPTION_STATUS_STYLES[account.status]}`}>
                          {SUBSCRIPTION_STATUS_LABELS[account.status]}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${SUPPORT_WATCH_LEVEL_STYLES[account.watchLevel]}`}>
                          {SUPPORT_WATCH_LEVEL_LABELS[account.watchLevel]}
                        </span>
                      </div>

                      <div className="rounded-2xl border border-white/70 bg-white px-3 py-3 text-sm text-[#5C6B73]">
                        <p className="font-semibold text-[#1A3636]">{getBillingFollowUpLabel(account)}</p>
                        <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock size={13} className="text-[#2D7D7D]" />
                            Echeance {formatSubscriptionDate(account.currentPeriodEndsAt) || 'non definie'}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Mail size={13} className="text-[#2D7D7D]" />
                            Dernier contact {formatSubscriptionDateTime(account.lastContactedAt) || 'aucun'}
                          </span>
                        </div>
                      </div>

                      <Input
                        label="Prochaine relance"
                        type="date"
                        value={draft.nextFollowUpAt}
                        onChange={(event) => handleAccountControlChange(account, 'nextFollowUpAt', event.target.value)}
                      />
                      <Textarea
                        label="Note de relance"
                        rows={2}
                        value={draft.followUpNote}
                        onChange={(event) => handleAccountControlChange(account, 'followUpNote', event.target.value)}
                        placeholder="Paiement attendu, canal de relance, retour client..."
                      />

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void saveAccountControl(account, {
                            lastContactedAt: new Date().toISOString(),
                          })}
                          disabled={isSaving}
                        >
                          <Mail size={14} />
                          Relance faite aujourd&apos;hui
                        </Button>
                        <Button
                          variant="glass"
                          size="sm"
                          onClick={() => void saveAccountControl(account)}
                          disabled={isSaving}
                        >
                          {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setSelectedAccountId(account.accountId)}>
                          <Eye size={14} />
                          Voir la boutique
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-[#1A3636]">Gestion globale des utilisateurs</h3>
            <p className="mt-1 text-sm text-[#6B7682]">
              Membres par boutique, role actuel et derniere activite commerciale visible par le support.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-[#6B7682]">
            <span className="rounded-full bg-[#F4F7FB] px-3 py-1 font-semibold">{memberSummary.admins} admin</span>
            <span className="rounded-full bg-[#F4F7FB] px-3 py-1 font-semibold">{memberSummary.cashiers} caisse</span>
            <span className="rounded-full bg-[#F4F7FB] px-3 py-1 font-semibold">{memberSummary.restricted} acces suspendu(s)</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_140px]">
          <Input
            label="Recherche membre"
            value={memberSearch}
            onChange={(event) => setMemberSearch(event.target.value)}
            placeholder="Nom, email ou boutique..."
            leftAddon={<Search size={16} />}
          />
          <Select
            label="Role"
            value={memberRoleFilter}
            onChange={(event) => setMemberRoleFilter(event.target.value as 'all' | SupportPlatformMember['role'])}
            options={memberRoleOptions}
          />
          <Button className="lg:mb-[2px]" onClick={() => void handleMemberFilters()}>
            Filtrer
          </Button>
        </div>

        {membersError && (
          <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">
            {membersError}
          </div>
        )}

        {membersLoading ? (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-4">
                <div className="h-4 w-48 rounded-full bg-[#2D7D7D]/10" />
                <div className="mt-3 h-10 rounded-2xl bg-[#2D7D7D]/10" />
              </div>
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[#2D7D7D]/15 bg-[#F8FBFC] px-4 py-4 text-sm text-[#6B7682]">
            Aucun utilisateur ne correspond aux filtres actuels.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {members.map((member) => {
              const linkedAccount = accounts.find((account) => account.accountId === member.accountId) ?? null

              return (
                <div key={member.memberId} className="rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-[#1A3636]">{member.fullName}</span>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getMemberRoleStyle(member.role)}`}>
                          {member.role}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${SUPPORT_ACCESS_STATUS_STYLES[member.accessStatus]}`}>
                          {SUPPORT_ACCESS_STATUS_LABELS[member.accessStatus]}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[#6B7682]">{member.email}</p>
                      <p className="mt-1 text-sm text-[#1A3636]">{member.businessName}</p>
                    </div>

                    <div className="grid gap-2 text-xs text-[#5C6B73] sm:grid-cols-3 lg:min-w-[420px]">
                      <div className="rounded-2xl border border-white/70 bg-white px-3 py-2">
                        <p className="font-semibold text-[#1A3636]">{formatSubscriptionDate(member.lastSaleAt) || 'Aucune vente'}</p>
                        <p className="mt-1">Derniere activite</p>
                      </div>
                      <div className="rounded-2xl border border-white/70 bg-white px-3 py-2">
                        <p className="font-semibold text-[#1A3636]">{member.monthlySalesCount}</p>
                        <p className="mt-1">Vente(s) ce mois</p>
                      </div>
                      <div className="rounded-2xl border border-white/70 bg-white px-3 py-2">
                        <p className="font-semibold text-[#1A3636]">{formatSubscriptionDate(member.createdAt) || 'Date indisponible'}</p>
                        <p className="mt-1">Cree le</p>
                      </div>
                    </div>
                  </div>

                  {linkedAccount && (
                    <div className="mt-3 flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => setSelectedAccountId(linkedAccount.accountId)}>
                        <UserRoundCog size={14} />
                        Ouvrir la fiche boutique
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.2fr)_minmax(380px,0.9fr)]">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[#1A3636]">Boutiques et comptes inscrits</h3>
              <p className="mt-1 text-sm text-[#6B7682]">
                Comptes proprietaires, formules actives et niveaux d&apos;usage actuels.
              </p>
            </div>
            <div className="rounded-full bg-[#F4F7FB] px-3 py-1 text-xs font-semibold text-[#5C6B73]">
              {accounts.length} resultat(s)
            </div>
          </div>

          {accountsError && (
            <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">
              {accountsError}
            </div>
          )}

          {accountsLoading ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="animate-pulse rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-4">
                  <div className="h-4 w-40 rounded-full bg-[#2D7D7D]/10" />
                  <div className="mt-2 h-3 w-56 rounded-full bg-[#2D7D7D]/10" />
                  <div className="mt-4 grid gap-2 sm:grid-cols-4">
                    <div className="h-14 rounded-2xl bg-[#2D7D7D]/10" />
                    <div className="h-14 rounded-2xl bg-[#2D7D7D]/10" />
                    <div className="h-14 rounded-2xl bg-[#2D7D7D]/10" />
                    <div className="h-14 rounded-2xl bg-[#2D7D7D]/10" />
                  </div>
                </div>
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#2D7D7D]/15 bg-[#F8FBFC] px-4 py-4 text-sm text-[#6B7682]">
              Aucun compte ne correspond aux filtres actuels.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {accounts.map((account) => {
                const daysLeft = getRemainingDays(account.currentPeriodEndsAt)
                const expiringSoon =
                  account.plan !== 'free' &&
                  account.plan !== 'lifetime' &&
                  daysLeft !== null &&
                  daysLeft >= 0 &&
                  daysLeft <= 7

                return (
                  <div key={account.accountId} className="rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-base font-semibold text-[#1A3636]">
                            {account.businessName}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${SUBSCRIPTION_STATUS_STYLES[account.status]}`}>
                            {SUBSCRIPTION_STATUS_LABELS[account.status]}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${SUPPORT_ACCESS_STATUS_STYLES[account.accessStatus]}`}>
                            {SUPPORT_ACCESS_STATUS_LABELS[account.accessStatus]}
                          </span>
                          <span className="rounded-full border border-[#2D7D7D]/10 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#2D7D7D]">
                            {account.plan === 'lifetime' ? 'A vie' : account.plan}
                          </span>
                          {account.watchLevel !== 'normal' && (
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${SUPPORT_WATCH_LEVEL_STYLES[account.watchLevel]}`}>
                              {SUPPORT_WATCH_LEVEL_LABELS[account.watchLevel]}
                            </span>
                          )}
                          {account.pendingRequestsCount > 0 && (
                            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                              {account.pendingRequestsCount} demande(s) ouverte(s)
                            </span>
                          )}
                          {expiringSoon && (
                            <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                              Echeance proche
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm text-[#1A3636]">{account.ownerName}</p>
                        <p className="mt-1 text-xs text-[#6B7682]">{account.ownerEmail}</p>
                      </div>
                      <div className="rounded-2xl border border-white/70 bg-white/80 px-3 py-2 text-xs text-[#5C6B73]">
                        {BILLING_CYCLE_LABELS[account.billingCycle]}
                        {account.currentPeriodEndsAt ? ` - ${formatSubscriptionDate(account.currentPeriodEndsAt)}` : ''}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl border border-white/70 bg-white px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7682]">Equipe</p>
                        <p className="mt-1 text-lg font-semibold text-[#1A3636]">{account.teamMembersCount}</p>
                      </div>
                      <div className="rounded-2xl border border-white/70 bg-white px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7682]">Produits</p>
                        <p className="mt-1 text-lg font-semibold text-[#1A3636]">{account.productsCount}</p>
                      </div>
                      <div className="rounded-2xl border border-white/70 bg-white px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7682]">Ventes / mois</p>
                        <p className="mt-1 text-lg font-semibold text-[#1A3636]">{account.monthlySalesCount}</p>
                      </div>
                      <div className="rounded-2xl border border-white/70 bg-white px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7682]">Derniere demande</p>
                        <p className="mt-1 text-sm font-semibold text-[#1A3636]">
                          {formatSubscriptionDate(account.lastRequestAt) || 'Aucune'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#6B7682]">
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#2D7D7D]/10 bg-white px-2.5 py-1">
                        <Building2 size={13} />
                        Cree le {formatSubscriptionDate(account.createdAt) || 'date indisponible'}
                      </span>
                      {account.currentPeriodEndsAt && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#2D7D7D]/10 bg-white px-2.5 py-1">
                          <Clock3 size={13} />
                          Echeance {formatSubscriptionDate(account.currentPeriodEndsAt)}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedAccountId(account.accountId)}>
                        <Eye size={14} />
                        Voir la fiche support
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[#1A3636]">File support abonnements</h3>
                <p className="mt-1 text-sm text-[#6B7682]">
                  Prise en charge, validation ou refus des demandes boutiques.
                </p>
              </div>
              <div className="rounded-full bg-[#F4F7FB] px-3 py-1 text-xs font-semibold text-[#5C6B73]">
                {queue.length} demande(s)
              </div>
            </div>

            {queueError && (
              <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">
                {queueError}
              </div>
            )}

            {queueLoading ? (
              <div className="mt-4 space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="animate-pulse rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-4">
                    <div className="h-4 w-36 rounded-full bg-[#2D7D7D]/10" />
                    <div className="mt-2 h-3 w-56 rounded-full bg-[#2D7D7D]/10" />
                    <div className="mt-4 h-24 rounded-2xl bg-[#2D7D7D]/10" />
                  </div>
                ))}
              </div>
            ) : queue.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-[#2D7D7D]/15 bg-[#F8FBFC] px-4 py-4 text-sm text-[#6B7682]">
                Aucune demande support a traiter pour le moment.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {queue.map((request) => {
                  const isBusy = supportActionTarget === request.id
                  const canProcess = request.status === 'sent'
                  const canActivate = request.status === 'sent' || request.status === 'in_progress'
                  const canCancel = request.status === 'sent' || request.status === 'in_progress'
                  const paymentDraft = getSupportPaymentDraft(request)
                  const expectedPaymentAmount = getSubscriptionExpectedPaymentAmount(request.requestType, request.requestedPlan)
                  const requiresPaymentProof = doesSubscriptionActivationRequirePayment(request.requestType, request.requestedPlan)
                  const paymentAmount = paymentDraft.amount.trim().length > 0 ? Number(paymentDraft.amount) : null
                  const paymentAmountReady = paymentAmount !== null && Number.isFinite(paymentAmount) && paymentAmount > 0
                  const paymentReferenceReady = paymentDraft.reference.trim().length >= 4
                  const paymentMethodReady = paymentDraft.method !== ''
                  const paymentAmountMatchesPlan = expectedPaymentAmount === null || (paymentAmountReady && paymentAmount >= expectedPaymentAmount)
                  const activationSecurityReady = !requiresPaymentProof || (paymentAmountMatchesPlan && paymentMethodReady && paymentReferenceReady)

                  return (
                    <div key={request.id} className="rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[#1A3636]">
                          {request.businessName || 'Boutique sans nom'}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${SUBSCRIPTION_REQUEST_TYPE_STYLES[request.requestType]}`}>
                          {SUBSCRIPTION_REQUEST_TYPE_LABELS[request.requestType]}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${SUBSCRIPTION_REQUEST_STATUS_STYLES[request.status]}`}>
                          {SUBSCRIPTION_REQUEST_STATUS_LABELS[request.status]}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-[#1A3636]">
                        {getSubscriptionRequestSummary(request.requestType, request.currentPlan, request.requestedPlan)}
                      </p>
                      <p className="mt-1 text-xs text-[#6B7682]">
                        Ref {getSubscriptionRequestReference(request.id)} - {request.requestedByEmail || 'email indisponible'}
                      </p>
                      <p className="mt-1 text-xs text-[#6B7682]">
                        Creee le {formatSubscriptionDate(request.createdAt) || 'date indisponible'}
                        {request.processedByEmail ? ` - suivi par ${request.processedByEmail}` : ''}
                      </p>

                      {(request.supportNote || request.notes) && (
                        <div className="mt-3 rounded-2xl border border-[#2D7D7D]/10 bg-white px-3 py-2 text-xs text-[#5C6B73]">
                          {request.supportNote || request.notes}
                        </div>
                      )}

                      {(request.paymentReference || request.paymentAmount || request.paymentMethod) && (
                        <div className="mt-3 rounded-2xl border border-emerald-500/15 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700">
                          Paiement
                          {request.paymentAmount ? ` ${formatCurrency(request.paymentAmount)}` : ''}
                          {request.paymentMethod ? ` via ${SUBSCRIPTION_PAYMENT_METHOD_LABELS[request.paymentMethod]}` : ''}
                          {request.paymentReference ? ` - ref ${request.paymentReference}` : ''}
                          {request.paymentConfirmedAt ? ` - confirme le ${formatSubscriptionDate(request.paymentConfirmedAt)}` : ''}
                        </div>
                      )}

                      <div className="mt-3">
                        <Textarea
                          rows={3}
                          value={supportNotes[request.id] ?? ''}
                          onChange={(event) => handleSupportNoteChange(request.id, event.target.value)}
                          placeholder="Note support, commentaire, prochaine etape..."
                          hint="La note est reprise dans le profil apres activation."
                        />
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <Select
                          value={paymentDraft.method}
                          onChange={(event) => handleSupportPaymentChange(request, 'method', event.target.value)}
                          options={[
                            { value: '', label: 'Mode paiement' },
                            ...SUBSCRIPTION_PAYMENT_OPTIONS,
                          ]}
                          hint={requiresPaymentProof ? 'Requis pour activation payante' : 'Optionnel'}
                        />
                        <Input
                          inputMode="numeric"
                          value={paymentDraft.amount}
                          onChange={(event) => handleSupportPaymentChange(request, 'amount', event.target.value)}
                          placeholder={expectedPaymentAmount ? `${expectedPaymentAmount}` : 'Montant'}
                          hint={expectedPaymentAmount ? `Attendu >= ${formatCurrency(expectedPaymentAmount)}` : 'Optionnel'}
                        />
                        <Input
                          value={paymentDraft.reference}
                          onChange={(event) => handleSupportPaymentChange(request, 'reference', event.target.value)}
                          placeholder="Reference paiement"
                          hint={requiresPaymentProof ? 'Minimum 4 caracteres' : 'Optionnel'}
                        />
                      </div>

                      {requiresPaymentProof && canActivate && !activationSecurityReady && (
                        <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
                          Activation bloquee tant que le mode, le montant et la reference de paiement ne sont pas complets.
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        {canProcess && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleSupportAction(request, 'mark_in_progress')}
                            disabled={isBusy}
                          >
                            Prendre en charge
                          </Button>
                        )}
                        {canActivate && (
                          <Button
                            variant="teal"
                            size="sm"
                            onClick={() => void handleSupportAction(request, 'activate')}
                            disabled={isBusy || !activationSecurityReady}
                          >
                            {getSupportActionLabel(request.requestType, request.requestedPlan)}
                          </Button>
                        )}
                        {canCancel && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => void handleSupportAction(request, 'cancel')}
                            disabled={isBusy}
                          >
                            Refuser
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <BadgeDollarSign size={16} className="text-[#2D7D7D]" />
              <h3 className="text-base font-semibold text-[#1A3636]">Lecture rapide</h3>
            </div>
            <div className="mt-4 grid gap-2">
              <div className="rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] px-3 py-3 text-sm text-[#5C6B73]">
                <div className="flex items-center gap-2 text-[#1A3636]">
                  <Users size={15} className="text-[#2D7D7D]" />
                  <span className="font-semibold">Utilisateurs inscrits</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed">
                  {overview?.totalMembers ?? 0} comptes attaches a la plateforme, dont {overview?.totalAccounts ?? 0} boutiques proprietaires.
                </p>
              </div>
              <div className="rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] px-3 py-3 text-sm text-[#5C6B73]">
                <div className="flex items-center gap-2 text-[#1A3636]">
                  <Wallet size={15} className="text-[#2D7D7D]" />
                  <span className="font-semibold">Recette recurrente</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed">
                  MRR estime a {formatCurrency(overview?.monthlyRecurringRevenue ?? 0)} hors plans entreprise et achats a vie.
                </p>
              </div>
              <div className="rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] px-3 py-3 text-sm text-[#5C6B73]">
                <div className="flex items-center gap-2 text-[#1A3636]">
                  <CreditCard size={15} className="text-[#2D7D7D]" />
                  <span className="font-semibold">Priorites support</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed">
                  {overview?.pendingRequests ?? 0} demande(s) a traiter, {overview?.expiringSoonAccounts ?? 0} boutique(s) a relancer sur une echeance proche.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <History size={16} className="text-[#2D7D7D]" />
          <div>
            <h3 className="text-base font-semibold text-[#1A3636]">Historique support</h3>
            <p className="mt-1 text-sm text-[#6B7682]">
              Actions recentes sur les demandes d&apos;abonnement et renouvellement.
            </p>
          </div>
        </div>

        {auditError && (
          <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">
            {auditError}
          </div>
        )}

        {auditLoading ? (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-4">
                <div className="h-4 w-32 rounded-full bg-[#2D7D7D]/10" />
                <div className="mt-2 h-3 w-56 rounded-full bg-[#2D7D7D]/10" />
                <div className="mt-3 h-10 rounded-2xl bg-[#2D7D7D]/10" />
              </div>
            ))}
          </div>
        ) : auditEntries.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[#2D7D7D]/15 bg-[#F8FBFC] px-4 py-4 text-sm text-[#6B7682]">
            Aucun historique support disponible pour le moment.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {auditEntries.map((entry) => (
              <div key={entry.auditId} className="rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-[#1A3636]">
                        {entry.businessName || 'Boutique sans nom'}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${AUDIT_ACTION_STYLES[entry.action] ?? 'bg-slate-500/10 text-slate-700 border border-slate-500/15'}`}>
                        {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${SUBSCRIPTION_REQUEST_TYPE_STYLES[entry.requestType]}`}>
                        {SUBSCRIPTION_REQUEST_TYPE_LABELS[entry.requestType]}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#1A3636]">
                      {getSubscriptionRequestSummary(entry.requestType, entry.currentPlan, entry.requestedPlan)}
                    </p>
                    <p className="mt-1 text-xs text-[#6B7682]">
                      Ref {getSubscriptionRequestReference(entry.requestId)} - {entry.requestedByEmail || 'email indisponible'}
                    </p>
                    {entry.note && (
                      <div className="mt-3 rounded-2xl border border-[#2D7D7D]/10 bg-white px-3 py-2 text-xs text-[#5C6B73]">
                        {entry.note}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-[#6B7682] lg:text-right">
                    <p>{formatSubscriptionDate(entry.createdAt) || 'date indisponible'}</p>
                    <p className="mt-1">{entry.actorEmail || 'systeme'}</p>
                    <p className="mt-1 inline-flex rounded-full border border-[#2D7D7D]/10 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#5C6B73]">
                      {SUBSCRIPTION_REQUEST_STATUS_LABELS[entry.status]}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        isOpen={selectedAccount !== null}
        onClose={() => setSelectedAccountId(null)}
        size="xl"
        title={selectedAccount ? `Fiche support - ${selectedAccount.businessName}` : 'Fiche support'}
      >
        {selectedAccount && (() => {
          const planDefinition = getPlanDefinition(selectedAccount.plan)
          const recommendation = getSupportRecommendation(selectedAccount)
          const usageBlocks = [
            {
              key: 'team',
              label: 'Equipe',
              value: selectedAccount.teamMembersCount,
              limit: planDefinition.limits.teamMembers,
            },
            {
              key: 'products',
              label: 'Produits',
              value: selectedAccount.productsCount,
              limit: planDefinition.limits.products,
            },
            {
              key: 'sales',
              label: 'Ventes / mois',
              value: selectedAccount.monthlySalesCount,
              limit: planDefinition.limits.monthlySales,
            },
          ]

          return (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold text-[#1A3636]">{selectedAccount.businessName}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${SUBSCRIPTION_STATUS_STYLES[selectedAccount.status]}`}>
                      {SUBSCRIPTION_STATUS_LABELS[selectedAccount.status]}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${SUPPORT_ACCESS_STATUS_STYLES[selectedAccount.accessStatus]}`}>
                      {SUPPORT_ACCESS_STATUS_LABELS[selectedAccount.accessStatus]}
                    </span>
                    <span className="rounded-full border border-[#2D7D7D]/10 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#2D7D7D]">
                      {planDefinition.name}
                    </span>
                    {selectedAccount.watchLevel !== 'normal' && (
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${SUPPORT_WATCH_LEVEL_STYLES[selectedAccount.watchLevel]}`}>
                        {SUPPORT_WATCH_LEVEL_LABELS[selectedAccount.watchLevel]}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-[#5C6B73]">
                    <p className="font-medium text-[#1A3636]">{selectedAccount.ownerName}</p>
                    <p className="inline-flex items-center gap-2">
                      <Mail size={14} className="text-[#2D7D7D]" />
                      {selectedAccount.ownerEmail}
                    </p>
                    <p>
                      Cree le {formatSubscriptionDate(selectedAccount.createdAt) || 'date indisponible'}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] px-4 py-3 text-sm text-[#5C6B73]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7682]">
                    Abonnement
                  </p>
                  <p className="mt-2 font-semibold text-[#1A3636]">
                    {planDefinition.price > 0 ? `${formatCurrency(planDefinition.price)} ${planDefinition.period}` : planDefinition.period}
                  </p>
                  <p className="mt-1">{BILLING_CYCLE_LABELS[selectedAccount.billingCycle]}</p>
                  <p className="mt-1">
                    {selectedAccount.currentPeriodEndsAt
                      ? `Echeance ${formatSubscriptionDate(selectedAccount.currentPeriodEndsAt)}`
                      : selectedAccount.plan === 'lifetime'
                        ? 'Validite a vie'
                        : 'Aucune echeance definie'}
                  </p>
                </div>
              </div>

              <div className={`rounded-2xl border px-4 py-3 text-sm ${recommendation.tone}`}>
                <div className="flex items-start gap-2">
                  <Sparkles size={16} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">{recommendation.title}</p>
                    <p className="mt-1 leading-relaxed">{recommendation.body}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <MetricTile
                  label="Demandes ouvertes"
                  value={`${selectedAccount.pendingRequestsCount}`}
                  helper="file support en cours"
                />
                <MetricTile
                  label="Derniere demande"
                  value={formatSubscriptionDate(selectedAccount.lastRequestAt) || 'Aucune'}
                  helper="historique abonnement"
                />
                <MetricTile
                  label="Plan"
                  value={planDefinition.name}
                  helper={selectedAccount.plan === 'lifetime' ? 'perpetuel' : planDefinition.desc}
                />
                <MetricTile
                  label="Statut"
                  value={SUBSCRIPTION_STATUS_LABELS[selectedAccount.status]}
                  helper={selectedAccount.currentPeriodEndsAt ? `echeance ${formatSubscriptionDate(selectedAccount.currentPeriodEndsAt)}` : 'sans date limite'}
                />
              </div>

              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-[#2D7D7D]" />
                  <div>
                    <h3 className="text-sm font-semibold text-[#1A3636]">Usage et limites du plan</h3>
                    <p className="mt-1 text-xs text-[#6B7682]">
                      Lecture rapide pour voir si la boutique approche d une montee de formule.
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {usageBlocks.map((item) => {
                    const ratio = getUsageRatio(item.value, item.limit)
                    const tone = getUsageTone(ratio, item.limit)
                    return (
                      <div key={item.key} className="rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7682]">
                            {item.label}
                          </p>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone.text} ${tone.track}`}>
                            {tone.badge}
                          </span>
                        </div>
                        <p className="mt-2 text-2xl font-bold text-[#1A3636]">{item.value}</p>
                        <p className="mt-1 text-xs text-[#6B7682]">
                          Limite {getLimitLabel(item.limit)}
                        </p>
                        <div className={`mt-3 h-2 rounded-full ${tone.track}`}>
                          <div
                            className={`h-2 rounded-full ${tone.fill}`}
                            style={{ width: `${Math.min(item.limit === null ? 20 : ratio, 100)}%` }}
                          />
                        </div>
                        <p className="mt-2 text-xs font-medium text-[#5C6B73]">
                          {item.limit === null ? 'Sans plafond' : `${Math.max(ratio, 0)}% de la limite`}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </Card>

              <div className="grid gap-3 xl:grid-cols-2">
                <div className="rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7682]">Note interne support</p>
                  <p className="mt-2 text-sm leading-relaxed text-[#1A3636]">
                    {selectedAccount.internalNote || 'Aucune note interne enregistree pour cette boutique.'}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7682]">Relance & suivi</p>
                  <p className="mt-2 text-sm leading-relaxed text-[#1A3636]">
                    {selectedAccount.followUpNote || 'Aucune relance en attente pour le moment.'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#5C6B73]">
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white px-2.5 py-1">
                      <CalendarClock size={13} />
                      Prochaine relance {formatSubscriptionDate(selectedAccount.nextFollowUpAt) || 'non planifiee'}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white px-2.5 py-1">
                      <Mail size={13} />
                      Dernier contact {formatSubscriptionDateTime(selectedAccount.lastContactedAt) || 'aucun'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <CreditCard size={16} className="text-[#2D7D7D]" />
                    <div>
                      <h3 className="text-sm font-semibold text-[#1A3636]">Demandes liees a cette boutique</h3>
                      <p className="mt-1 text-xs text-[#6B7682]">
                        File en cours visible directement depuis la fiche support.
                      </p>
                    </div>
                  </div>

                  {relatedAccountRequests.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-[#2D7D7D]/15 bg-[#F8FBFC] px-4 py-4 text-sm text-[#6B7682]">
                      Aucune demande ouverte liee a cette boutique.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {relatedAccountRequests.map((request) => (
                        <div key={request.id} className="rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${SUBSCRIPTION_REQUEST_TYPE_STYLES[request.requestType]}`}>
                              {SUBSCRIPTION_REQUEST_TYPE_LABELS[request.requestType]}
                            </span>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${SUBSCRIPTION_REQUEST_STATUS_STYLES[request.status]}`}>
                              {SUBSCRIPTION_REQUEST_STATUS_LABELS[request.status]}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-[#1A3636]">
                            {getSubscriptionRequestSummary(request.requestType, request.currentPlan, request.requestedPlan)}
                          </p>
                          <p className="mt-1 text-xs text-[#6B7682]">
                            Ref {getSubscriptionRequestReference(request.id)} - {formatSubscriptionDate(request.createdAt) || 'date indisponible'}
                          </p>
                          {(request.supportNote || request.notes) && (
                            <div className="mt-2 rounded-2xl border border-white/70 bg-white px-3 py-2 text-xs text-[#5C6B73]">
                              {request.supportNote || request.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <History size={16} className="text-[#2D7D7D]" />
                    <div>
                      <h3 className="text-sm font-semibold text-[#1A3636]">Historique recent</h3>
                      <p className="mt-1 text-xs text-[#6B7682]">
                        Les dernieres actions support pour cette boutique.
                      </p>
                    </div>
                  </div>

                  {relatedAccountAudit.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-[#2D7D7D]/15 bg-[#F8FBFC] px-4 py-4 text-sm text-[#6B7682]">
                      Aucun historique support lie a ce compte pour le moment.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {relatedAccountAudit.slice(0, 5).map((entry) => (
                        <div key={entry.auditId} className="rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${AUDIT_ACTION_STYLES[entry.action] ?? 'bg-slate-500/10 text-slate-700 border border-slate-500/15'}`}>
                              {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                            </span>
                            <span className="text-xs text-[#6B7682]">
                              {formatSubscriptionDate(entry.createdAt) || 'date indisponible'}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-medium text-[#1A3636]">
                            {getSubscriptionRequestSummary(entry.requestType, entry.currentPlan, entry.requestedPlan)}
                          </p>
                          <p className="mt-1 text-xs text-[#6B7682]">
                            {entry.actorEmail || 'systeme'}
                          </p>
                          {entry.note && (
                            <div className="mt-2 rounded-2xl border border-white/70 bg-white px-3 py-2 text-xs text-[#5C6B73]">
                              {entry.note}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 rounded-2xl border border-[#2D7D7D]/10 bg-white px-4 py-3 text-sm text-[#5C6B73]">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 size={16} className="mt-0.5 text-[#2D7D7D]" />
                      <div>
                        <p className="font-semibold text-[#1A3636]">Actions rapides</p>
                        <p className="mt-1 leading-relaxed">
                          Utilise le filtre principal pour isoler cette boutique ou contacte directement le proprietaire pour suivi.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            variant="glass"
                            size="sm"
                            onClick={() => {
                              void focusAccountInList(selectedAccount)
                              setSelectedAccountId(null)
                            }}
                          >
                            Isoler dans la liste
                          </Button>
                          <Link
                            href={`mailto:${selectedAccount.ownerEmail}?subject=${encodeURIComponent(`Suivi support Saytu Yef - ${selectedAccount.businessName}`)}`}
                            className="inline-flex h-8 items-center justify-center rounded-full border border-[#2D7D7D]/20 px-4 text-xs font-semibold text-[#2D7D7D] transition-colors hover:bg-[#2D7D7D]/5"
                          >
                            Envoyer un email
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )
        })()}
      </Modal>

    </div>
  )
}
