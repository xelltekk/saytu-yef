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
  createSupportTicket,
  doesSubscriptionActivationRequirePayment,
  formatSubscriptionDate,
  formatSubscriptionDateTime,
  getRemainingDays,
  getSubscriptionExpectedPaymentAmount,
  getSubscriptionRequestReference,
  getSubscriptionRequestSummary,
  getSupportAdmins,
  getSupportActionLabel,
  getSupportPlatformMembers,
  getSupportConsoleOverview,
  getSupportPlatformAccounts,
  getSupportSubscriptionAudit,
  getSupportSubscriptionRequests,
  getSupportTickets,
  hasSupportOperatorAccess,
  SUPPORT_CRM_STAGE_LABELS,
  SUPPORT_CRM_STAGE_STYLES,
  SUPPORT_ACCESS_STATUS_LABELS,
  SUPPORT_ACCESS_STATUS_STYLES,
  SUPPORT_TICKET_CATEGORY_LABELS,
  SUPPORT_TICKET_CHANNEL_LABELS,
  SUPPORT_TICKET_PRIORITY_LABELS,
  SUPPORT_TICKET_PRIORITY_STYLES,
  SUPPORT_TICKET_STATUS_LABELS,
  SUPPORT_TICKET_STATUS_STYLES,
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
  type SupportCrmStage,
  type SupportAdminRecord,
  type SupportPlatformAccount,
  type SupportPlatformMember,
  type SupportSubscriptionAuditEntry,
  type SupportTicket,
  type SupportTicketCategory,
  type SupportTicketChannel,
  type SupportTicketPriority,
  type SupportTicketStatus,
  setSupportAdminAccess,
  updateSupportTicket,
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
  ArrowUpRight,
  Ban,
  BadgeDollarSign,
  BellRing,
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
  TrendingUp,
  UserRoundCog,
  UserPlus,
  UserX,
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
  crmStage: SupportCrmStage
  crmValueEstimate: string
  crmNextStep: string
  crmOwnerEmail: string
}

type SupportTicketDraft = {
  subject: string
  details: string
  category: SupportTicketCategory
  status: SupportTicketStatus
  priority: SupportTicketPriority
  requesterEmail: string
  assignedToEmail: string
  channel: SupportTicketChannel
  dueAt: string
}

const SUBSCRIPTION_PAYMENT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'wave', label: SUBSCRIPTION_PAYMENT_METHOD_LABELS.wave },
  { value: 'orange_money', label: SUBSCRIPTION_PAYMENT_METHOD_LABELS.orange_money },
  { value: 'card', label: SUBSCRIPTION_PAYMENT_METHOD_LABELS.card },
  { value: 'cash', label: SUBSCRIPTION_PAYMENT_METHOD_LABELS.cash },
  { value: 'bank_transfer', label: SUBSCRIPTION_PAYMENT_METHOD_LABELS.bank_transfer },
  { value: 'other', label: SUBSCRIPTION_PAYMENT_METHOD_LABELS.other },
]

const SUPPORT_TICKET_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'open', label: SUPPORT_TICKET_STATUS_LABELS.open },
  { value: 'in_progress', label: SUPPORT_TICKET_STATUS_LABELS.in_progress },
  { value: 'waiting_customer', label: SUPPORT_TICKET_STATUS_LABELS.waiting_customer },
  { value: 'resolved', label: SUPPORT_TICKET_STATUS_LABELS.resolved },
  { value: 'closed', label: SUPPORT_TICKET_STATUS_LABELS.closed },
]

const SUPPORT_TICKET_PRIORITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'low', label: SUPPORT_TICKET_PRIORITY_LABELS.low },
  { value: 'medium', label: SUPPORT_TICKET_PRIORITY_LABELS.medium },
  { value: 'high', label: SUPPORT_TICKET_PRIORITY_LABELS.high },
  { value: 'urgent', label: SUPPORT_TICKET_PRIORITY_LABELS.urgent },
]

const SUPPORT_TICKET_CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'billing', label: SUPPORT_TICKET_CATEGORY_LABELS.billing },
  { value: 'technical', label: SUPPORT_TICKET_CATEGORY_LABELS.technical },
  { value: 'onboarding', label: SUPPORT_TICKET_CATEGORY_LABELS.onboarding },
  { value: 'commercial', label: SUPPORT_TICKET_CATEGORY_LABELS.commercial },
  { value: 'incident', label: SUPPORT_TICKET_CATEGORY_LABELS.incident },
  { value: 'other', label: SUPPORT_TICKET_CATEGORY_LABELS.other },
]

const SUPPORT_TICKET_CHANNEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'internal', label: SUPPORT_TICKET_CHANNEL_LABELS.internal },
  { value: 'email', label: SUPPORT_TICKET_CHANNEL_LABELS.email },
  { value: 'phone', label: SUPPORT_TICKET_CHANNEL_LABELS.phone },
  { value: 'whatsapp', label: SUPPORT_TICKET_CHANNEL_LABELS.whatsapp },
  { value: 'onsite', label: SUPPORT_TICKET_CHANNEL_LABELS.onsite },
  { value: 'other', label: SUPPORT_TICKET_CHANNEL_LABELS.other },
]

const SUPPORT_CRM_STAGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'monitoring', label: SUPPORT_CRM_STAGE_LABELS.monitoring },
  { value: 'prospect', label: SUPPORT_CRM_STAGE_LABELS.prospect },
  { value: 'follow_up', label: SUPPORT_CRM_STAGE_LABELS.follow_up },
  { value: 'negotiation', label: SUPPORT_CRM_STAGE_LABELS.negotiation },
  { value: 'won', label: SUPPORT_CRM_STAGE_LABELS.won },
  { value: 'risk', label: SUPPORT_CRM_STAGE_LABELS.risk },
]

const EMPTY_TICKET_DRAFT: SupportTicketDraft = {
  subject: '',
  details: '',
  category: 'other',
  status: 'open',
  priority: 'medium',
  requesterEmail: '',
  assignedToEmail: '',
  channel: 'internal',
  dueAt: '',
}

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

function getUsagePressure(account: SupportPlatformAccount) {
  const planDefinition = getPlanDefinition(account.plan)
  const productRatio = getUsageRatio(account.productsCount, planDefinition.limits.products)
  const teamRatio = getUsageRatio(account.teamMembersCount, planDefinition.limits.teamMembers)
  const monthlySalesRatio = getUsageRatio(account.monthlySalesCount, planDefinition.limits.monthlySales)

  return Math.max(productRatio, teamRatio, monthlySalesRatio)
}

function isFollowUpDue(date?: string | null) {
  const daysLeft = getRemainingDays(date)
  return daysLeft !== null && daysLeft <= 0
}

function getPriorityAccountSummary(account: SupportPlatformAccount) {
  const daysLeft = getRemainingDays(account.currentPeriodEndsAt)

  if (account.accessStatus === 'restricted') {
    return {
      title: 'Compte suspendu',
      detail: 'Verifier la raison du blocage et decider d une reactivation.',
      tone: 'border-red-500/20 bg-red-500/10 text-red-700',
    }
  }

  if (account.pendingRequestsCount > 0) {
    return {
      title: 'Demande a traiter',
      detail: `${account.pendingRequestsCount} demande(s) support en attente pour cette boutique.`,
      tone: 'border-amber-500/20 bg-amber-500/10 text-amber-700',
    }
  }

  if (account.status === 'past_due' || account.status === 'expired' || account.status === 'suspended') {
    return {
      title: 'Facturation critique',
      detail: `Statut actuel: ${SUBSCRIPTION_STATUS_LABELS[account.status]}.`,
      tone: 'border-red-500/20 bg-red-500/10 text-red-700',
    }
  }

  if (isFollowUpDue(account.nextFollowUpAt)) {
    return {
      title: 'Relance a faire',
      detail: 'La prochaine relance support est echue ou prevue pour aujourd hui.',
      tone: 'border-[#2D7D7D]/20 bg-[#2D7D7D]/10 text-[#2D7D7D]',
    }
  }

  if (daysLeft !== null && daysLeft <= 3) {
    return {
      title: 'Echeance proche',
      detail: daysLeft <= 0 ? 'L echeance est aujourd hui.' : `Echeance dans ${daysLeft} jour(s).`,
      tone: 'border-amber-500/20 bg-amber-500/10 text-amber-700',
    }
  }

  return {
    title: 'Surveillance active',
    detail: 'Compte a garder dans le radar support.',
    tone: 'border-slate-500/20 bg-slate-500/10 text-slate-700',
  }
}

function getGrowthOpportunity(account: SupportPlatformAccount) {
  if (account.accessStatus !== 'active') return null
  if (account.plan === 'enterprise' || account.plan === 'lifetime') return null

  const pressure = getUsagePressure(account)

  if ((account.plan === 'free' || account.status === 'trial') && (pressure >= 60 || account.monthlySalesCount >= 6)) {
    return {
      nextPlan: 'starter' as SubscriptionPlan,
      title: 'Passage conseille vers Starter',
      detail: `Usage deja bien lance: ${account.monthlySalesCount} vente(s) ce mois et ${pressure}% de pression sur les limites.`,
      tone: 'border-violet-500/20 bg-violet-500/10 text-violet-700',
    }
  }

  if (account.plan === 'starter' && (pressure >= 75 || account.teamMembersCount >= 3)) {
    return {
      nextPlan: 'pro' as SubscriptionPlan,
      title: 'Passage conseille vers Pro',
      detail: `Le plan Starter commence a se tendre avec ${pressure}% de pression.`,
      tone: 'border-[#2D7D7D]/20 bg-[#2D7D7D]/10 text-[#2D7D7D]',
    }
  }

  if (account.plan === 'pro' && account.teamMembersCount >= 8) {
    return {
      nextPlan: 'enterprise' as SubscriptionPlan,
      title: 'Compte proche d un besoin Enterprise',
      detail: 'Equipe deja large, bon candidat pour accompagnement dedie.',
      tone: 'border-sky-500/20 bg-sky-500/10 text-sky-700',
    }
  }

  return null
}

function buildAccountControlDraft(account: SupportPlatformAccount): SupportAccountControlDraft {
  return {
    accessStatus: account.accessStatus,
    watchLevel: account.watchLevel,
    internalNote: account.internalNote ?? '',
    followUpNote: account.followUpNote ?? '',
    nextFollowUpAt: toDateInputValue(account.nextFollowUpAt),
    lastContactedAt: account.lastContactedAt ?? null,
    crmStage: account.crmStage,
    crmValueEstimate: account.crmValueEstimate ? String(Math.round(account.crmValueEstimate)) : '',
    crmNextStep: account.crmNextStep ?? '',
    crmOwnerEmail: account.crmOwnerEmail ?? '',
  }
}

function buildTicketDraft(ticket?: SupportTicket | null): SupportTicketDraft {
  if (!ticket) {
    return { ...EMPTY_TICKET_DRAFT }
  }

  return {
    subject: ticket.subject,
    details: ticket.details ?? '',
    category: ticket.category,
    status: ticket.status,
    priority: ticket.priority,
    requesterEmail: ticket.requesterEmail ?? '',
    assignedToEmail: ticket.assignedToEmail ?? '',
    channel: ticket.channel,
    dueAt: toDateInputValue(ticket.dueAt),
  }
}

function getDaysSince(date?: string | null) {
  if (!date) return null
  const time = new Date(date).getTime()
  if (Number.isNaN(time)) return null
  return Math.floor((Date.now() - time) / (1000 * 60 * 60 * 24))
}

function isTicketOpenStatus(status: SupportTicketStatus) {
  return status === 'open' || status === 'in_progress' || status === 'waiting_customer'
}

function getCrmStageRank(stage: SupportCrmStage) {
  switch (stage) {
    case 'negotiation':
      return 5
    case 'follow_up':
      return 4
    case 'prospect':
      return 3
    case 'risk':
      return 2
    case 'won':
      return 1
    default:
      return 0
  }
}

export function SupportConsole() {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [bootLoading, setBootLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [overview, setOverview] = useState<SupportConsoleOverview | null>(null)
  const [accounts, setAccounts] = useState<SupportPlatformAccount[]>([])
  const [members, setMembers] = useState<SupportPlatformMember[]>([])
  const [supportAdmins, setSupportAdmins] = useState<SupportAdminRecord[]>([])
  const [queue, setQueue] = useState<SubscriptionRequestRecord[]>([])
  const [auditEntries, setAuditEntries] = useState<SupportSubscriptionAuditEntry[]>([])
  const [tickets, setTickets] = useState<SupportTicket[]>([])

  const [accountsLoading, setAccountsLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(true)
  const [supportAdminsLoading, setSupportAdminsLoading] = useState(true)
  const [queueLoading, setQueueLoading] = useState(true)
  const [auditLoading, setAuditLoading] = useState(true)
  const [ticketsLoading, setTicketsLoading] = useState(true)

  const [pageError, setPageError] = useState('')
  const [accountsError, setAccountsError] = useState('')
  const [membersError, setMembersError] = useState('')
  const [supportAdminsError, setSupportAdminsError] = useState('')
  const [queueError, setQueueError] = useState('')
  const [auditError, setAuditError] = useState('')
  const [ticketsError, setTicketsError] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const [search, setSearch] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [ticketSearch, setTicketSearch] = useState('')
  const [planFilter, setPlanFilter] = useState<SubscriptionPlan | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | 'all'>('all')
  const [memberRoleFilter, setMemberRoleFilter] = useState<'all' | SupportPlatformMember['role']>('all')
  const [ticketStatusFilter, setTicketStatusFilter] = useState<SupportTicketStatus | 'all'>('all')
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState<SupportTicketCategory | 'all'>('all')
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState<SupportTicketPriority | 'all'>('all')
  const [supportAdminEmail, setSupportAdminEmail] = useState('')
  const [supportAdminFullName, setSupportAdminFullName] = useState('')
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [newTicketAccountId, setNewTicketAccountId] = useState('')

  const [supportActionTarget, setSupportActionTarget] = useState<string | null>(null)
  const [accountControlTarget, setAccountControlTarget] = useState<string | null>(null)
  const [supportAdminActionTarget, setSupportAdminActionTarget] = useState<string | null>(null)
  const [ticketActionTarget, setTicketActionTarget] = useState<string | null>(null)
  const [supportNotes, setSupportNotes] = useState<Record<string, string>>({})
  const [supportPayments, setSupportPayments] = useState<Record<string, SupportPaymentDraft>>({})
  const [accountControlDrafts, setAccountControlDrafts] = useState<Record<string, SupportAccountControlDraft>>({})
  const [ticketDrafts, setTicketDrafts] = useState<Record<string, SupportTicketDraft>>({})
  const [newTicketDraft, setNewTicketDraft] = useState<SupportTicketDraft>(EMPTY_TICKET_DRAFT)

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
            buildAccountControlDraft(account),
          ])
        )
      )
      setNewTicketAccountId((current) => {
        if (current && nextAccounts.some((account) => account.accountId === current)) {
          return current
        }
        return nextAccounts[0]?.accountId ?? ''
      })
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

  const loadSupportAdmins = useCallback(async () => {
    setSupportAdminsLoading(true)
    setSupportAdminsError('')

    try {
      const nextSupportAdmins = await getSupportAdmins()
      setSupportAdmins(nextSupportAdmins)
    } catch (error) {
      setSupportAdminsError(error instanceof Error ? error.message : 'Impossible de charger les operateurs support.')
    } finally {
      setSupportAdminsLoading(false)
    }
  }, [])

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
      setAccountControlDrafts(
        Object.fromEntries(
          nextAccounts.map((nextAccount) => [
            nextAccount.accountId,
            buildAccountControlDraft(nextAccount),
          ])
        )
      )
    } catch (error) {
      setAccountsError(error instanceof Error ? error.message : 'Impossible de filtrer cette boutique.')
    } finally {
      setAccountsLoading(false)
    }
  }, [])

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true)
    setTicketsError('')

    try {
      const nextTickets = await getSupportTickets({
        search: ticketSearch,
        status: ticketStatusFilter,
        category: ticketCategoryFilter,
        priority: ticketPriorityFilter,
        limit: 120,
      })
      setTickets(nextTickets)
      setTicketDrafts(
        Object.fromEntries(
          nextTickets.map((ticket) => [
            ticket.ticketId,
            buildTicketDraft(ticket),
          ])
        )
      )
    } catch (error) {
      setTicketsError(error instanceof Error ? error.message : 'Impossible de charger les tickets support.')
    } finally {
      setTicketsLoading(false)
    }
  }, [ticketCategoryFilter, ticketPriorityFilter, ticketSearch, ticketStatusFilter])

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
        setSupportAdmins([])
        setQueue([])
        setAuditEntries([])
        setTickets([])
        return
      }

      await Promise.all([loadPanels(), loadAccounts(), loadMembers(), loadSupportAdmins(), loadTickets()])
    } catch (error) {
      setHasAccess(false)
      setPageError(error instanceof Error ? error.message : 'Impossible d ouvrir la console SaaS.')
    } finally {
      setBootLoading(false)
    }
  }, [loadAccounts, loadMembers, loadPanels, loadSupportAdmins, loadTickets])

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

  const handleSaveSupportAdmin = useCallback(async (input: {
    email: string
    fullName?: string | null
    active: boolean
  }) => {
    const cleanedEmail = input.email.trim().toLowerCase()
    if (!cleanedEmail) {
      setFeedback({ type: 'error', msg: 'Renseigne un email support valide.' })
      return
    }

    setSupportAdminActionTarget(cleanedEmail)
    setFeedback(null)

    try {
      await setSupportAdminAccess({
        email: cleanedEmail,
        fullName: input.fullName ?? null,
        active: input.active,
      })

      if (input.active) {
        setSupportAdminEmail('')
        setSupportAdminFullName('')
      }

      setFeedback({
        type: 'success',
        msg: input.active
          ? 'Operateur support enregistre.'
          : 'Acces support retire pour ce compte.',
      })
      await loadSupportAdmins()
    } catch (error) {
      setFeedback({
        type: 'error',
        msg: error instanceof Error ? error.message : 'Impossible de gerer cet acces support.',
      })
    } finally {
      setSupportAdminActionTarget(null)
    }
  }, [loadSupportAdmins, setFeedback, setSupportAdminEmail, setSupportAdminFullName])

  const handleTicketFilters = async () => {
    if (hasAccess !== true) return
    await loadTickets()
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
    return accountControlDrafts[account.accountId] ?? buildAccountControlDraft(account)
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
      const parsedCrmValueEstimate = currentDraft.crmValueEstimate.trim().length > 0
        ? Number(currentDraft.crmValueEstimate)
        : null

      if (currentDraft.crmValueEstimate.trim().length > 0 && (!Number.isFinite(parsedCrmValueEstimate) || (parsedCrmValueEstimate ?? 0) < 0)) {
        throw new Error('Valeur CRM invalide. Utilise un montant positif.')
      }

      await upsertSupportAccountControl(account.accountId, {
        accessStatus: override?.accessStatus ?? currentDraft.accessStatus,
        watchLevel: override?.watchLevel ?? currentDraft.watchLevel,
        internalNote: override?.internalNote ?? currentDraft.internalNote,
        followUpNote: override?.followUpNote ?? currentDraft.followUpNote,
        nextFollowUpAt: override?.nextFollowUpAt ?? currentDraft.nextFollowUpAt,
        lastContactedAt: override?.lastContactedAt ?? currentDraft.lastContactedAt ?? null,
        crmStage: override?.crmStage ?? currentDraft.crmStage,
        crmValueEstimate: override?.crmValueEstimate ?? parsedCrmValueEstimate,
        crmNextStep: override?.crmNextStep ?? currentDraft.crmNextStep,
        crmOwnerEmail: override?.crmOwnerEmail ?? currentDraft.crmOwnerEmail,
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

  const getTicketDraft = useCallback((ticket: SupportTicket): SupportTicketDraft => {
    return ticketDrafts[ticket.ticketId] ?? buildTicketDraft(ticket)
  }, [ticketDrafts])

  const handleTicketDraftChange = useCallback((
    ticket: SupportTicket,
    field: keyof SupportTicketDraft,
    value: string
  ) => {
    setTicketDrafts((current) => ({
      ...current,
      [ticket.ticketId]: {
        ...getTicketDraft(ticket),
        [field]: value,
      },
    }))
  }, [getTicketDraft])

  const handleNewTicketDraftChange = useCallback((
    field: keyof SupportTicketDraft,
    value: string
  ) => {
    setNewTicketDraft((current) => ({ ...current, [field]: value }))
  }, [])

  const handleCreateTicket = useCallback(async () => {
    if (!newTicketAccountId) {
      setFeedback({ type: 'error', msg: 'Choisis d abord la boutique concernee.' })
      return
    }

    if (newTicketDraft.subject.trim().length < 4) {
      setFeedback({ type: 'error', msg: 'Le sujet du ticket doit contenir au moins 4 caracteres.' })
      return
    }

    setTicketActionTarget('create')
    setFeedback(null)

    try {
      await createSupportTicket({
        accountId: newTicketAccountId,
        subject: newTicketDraft.subject,
        details: newTicketDraft.details,
        category: newTicketDraft.category,
        priority: newTicketDraft.priority,
        requesterEmail: newTicketDraft.requesterEmail,
        assignedToEmail: newTicketDraft.assignedToEmail,
        channel: newTicketDraft.channel,
        dueAt: newTicketDraft.dueAt,
      })

      setNewTicketDraft((current) => ({
        ...EMPTY_TICKET_DRAFT,
        requesterEmail: current.requesterEmail,
        assignedToEmail: current.assignedToEmail,
      }))
      setFeedback({ type: 'success', msg: 'Ticket support cree.' })
      await loadTickets()
    } catch (error) {
      setFeedback({
        type: 'error',
        msg: error instanceof Error ? error.message : 'Creation du ticket impossible.',
      })
    } finally {
      setTicketActionTarget(null)
    }
  }, [loadTickets, newTicketAccountId, newTicketDraft])

  const handleUpdateTicket = useCallback(async (ticket: SupportTicket) => {
    setTicketActionTarget(ticket.ticketId)
    setFeedback(null)

    try {
      const draft = getTicketDraft(ticket)
      await updateSupportTicket(ticket.ticketId, {
        status: draft.status,
        priority: draft.priority,
        assignedToEmail: draft.assignedToEmail,
        channel: draft.channel,
        dueAt: draft.dueAt,
        details: draft.details,
        subject: draft.subject,
      })

      setFeedback({ type: 'success', msg: 'Ticket support mis a jour.' })
      await loadTickets()
    } catch (error) {
      setFeedback({
        type: 'error',
        msg: error instanceof Error ? error.message : 'Mise a jour du ticket impossible.',
      })
    } finally {
      setTicketActionTarget(null)
    }
  }, [getTicketDraft, loadTickets])

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

  const priorityAccounts = useMemo(
    () => [...accounts]
      .filter((account) => {
        const daysLeft = getRemainingDays(account.currentPeriodEndsAt)

        return (
          account.accessStatus === 'restricted'
          || account.watchLevel === 'critical'
          || account.pendingRequestsCount > 0
          || account.status === 'past_due'
          || account.status === 'suspended'
          || account.status === 'expired'
          || isFollowUpDue(account.nextFollowUpAt)
          || (daysLeft !== null && daysLeft <= 3)
        )
      })
      .sort((left, right) => buildAccountPriorityScore(right) - buildAccountPriorityScore(left))
      .slice(0, 5),
    [accounts]
  )

  const growthAccounts = useMemo(
    () => [...accounts]
      .map((account) => ({
        account,
        opportunity: getGrowthOpportunity(account),
      }))
      .filter((item): item is { account: SupportPlatformAccount; opportunity: NonNullable<ReturnType<typeof getGrowthOpportunity>> } => item.opportunity !== null)
      .sort((left, right) => getUsagePressure(right.account) - getUsagePressure(left.account))
      .slice(0, 5),
    [accounts]
  )

  const queueSpotlight = useMemo(
    () => [...queue]
      .filter((request) => request.status === 'sent' || request.status === 'in_progress')
      .sort((left, right) => new Date(left.createdAt ?? 0).getTime() - new Date(right.createdAt ?? 0).getTime())
      .slice(0, 5),
    [queue]
  )

  const openTickets = useMemo(
    () => tickets.filter((ticket) => isTicketOpenStatus(ticket.status)),
    [tickets]
  )

  const urgentOpenTickets = useMemo(
    () => openTickets.filter((ticket) => ticket.priority === 'urgent'),
    [openTickets]
  )

  const crmAccounts = useMemo(
    () => [...accounts]
      .map((account) => {
        const opportunity = getGrowthOpportunity(account)
        const stage: SupportCrmStage = account.crmStage !== 'monitoring'
          ? account.crmStage
          : opportunity
            ? 'prospect'
            : 'monitoring'
        const suggestedValue = opportunity ? getPlanDefinition(opportunity.nextPlan).price : 0

        return {
          account,
          opportunity,
          stage,
          valueEstimate: account.crmValueEstimate ?? suggestedValue,
        }
      })
      .filter((item) => item.stage !== 'monitoring' || item.opportunity !== null)
      .sort((left, right) => {
        const stageDelta = getCrmStageRank(right.stage) - getCrmStageRank(left.stage)
        if (stageDelta !== 0) return stageDelta
        if (right.valueEstimate !== left.valueEstimate) {
          return right.valueEstimate - left.valueEstimate
        }
        return getUsagePressure(right.account) - getUsagePressure(left.account)
      })
      .slice(0, 8),
    [accounts]
  )

  const crmPipelineValue = useMemo(
    () => crmAccounts.reduce((sum, item) => sum + Math.max(item.valueEstimate, 0), 0),
    [crmAccounts]
  )

  const visibleTickets = useMemo(
    () => [...tickets]
      .sort((left, right) => {
        const openDelta = Number(isTicketOpenStatus(right.status)) - Number(isTicketOpenStatus(left.status))
        if (openDelta !== 0) return openDelta

        const priorityRanks: Record<SupportTicketPriority, number> = {
          urgent: 4,
          high: 3,
          medium: 2,
          low: 1,
        }

        const priorityDelta = priorityRanks[right.priority] - priorityRanks[left.priority]
        if (priorityDelta !== 0) return priorityDelta

        const leftDue = left.dueAt ? new Date(left.dueAt).getTime() : Number.POSITIVE_INFINITY
        const rightDue = right.dueAt ? new Date(right.dueAt).getTime() : Number.POSITIVE_INFINITY
        if (leftDue !== rightDue) return leftDue - rightDue

        return new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime()
      })
      .slice(0, 12),
    [tickets]
  )

  const crmStageSummary = useMemo(() => ({
    prospect: accounts.filter((account) => account.crmStage === 'prospect').length,
    followUp: accounts.filter((account) => account.crmStage === 'follow_up').length,
    negotiation: accounts.filter((account) => account.crmStage === 'negotiation').length,
    won: accounts.filter((account) => account.crmStage === 'won').length,
    risk: accounts.filter((account) => account.crmStage === 'risk').length,
  }), [accounts])

  const restrictedAccountsCount = useMemo(
    () => accounts.filter((account) => account.accessStatus === 'restricted').length,
    [accounts]
  )

  const inactiveAccountsCount = useMemo(
    () => accounts.filter((account) => {
      const daysSinceSale = getDaysSince(account.lastSaleAt)
      const daysSinceCreate = getDaysSince(account.createdAt)

      if (daysSinceSale !== null) {
        return daysSinceSale >= 30
      }

      return daysSinceCreate !== null && daysSinceCreate >= 14
    }).length,
    [accounts]
  )

  const memberSummary = useMemo(() => ({
    admins: members.filter((member) => member.role === 'admin').length,
    cashiers: members.filter((member) => member.role === 'cashier').length,
    restricted: members.filter((member) => member.accessStatus === 'restricted').length,
  }), [members])

  const supportAdminSummary = useMemo(() => ({
    active: supportAdmins.filter((admin) => admin.active).length,
    inactive: supportAdmins.filter((admin) => !admin.active).length,
  }), [supportAdmins])

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

  const selectedAccountTickets = useMemo(() => {
    if (!selectedAccount) return []
    return tickets.filter((ticket) => ticket.accountId === selectedAccount.accountId)
  }, [selectedAccount, tickets])

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
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h3 className="text-base font-semibold text-[#1A3636]">Operateurs support autorises</h3>
            <p className="mt-1 text-sm text-[#6B7682]">
              Seuls les comptes actifs listes ici peuvent ouvrir la console SaaS et valider les actions sensibles.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-[#6B7682]">
            <span className="rounded-full bg-[#F4F7FB] px-3 py-1 font-semibold">{supportAdminSummary.active} actif(s)</span>
            <span className="rounded-full bg-[#F4F7FB] px-3 py-1 font-semibold">{supportAdminSummary.inactive} retire(s)</span>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            {supportAdminsError && (
              <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">
                {supportAdminsError}
              </div>
            )}

            {supportAdminsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div key={index} className="animate-pulse rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-4">
                    <div className="h-4 w-48 rounded-full bg-[#2D7D7D]/10" />
                    <div className="mt-2 h-3 w-32 rounded-full bg-[#2D7D7D]/10" />
                    <div className="mt-3 h-9 rounded-full bg-[#2D7D7D]/10" />
                  </div>
                ))}
              </div>
            ) : supportAdmins.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#2D7D7D]/15 bg-[#F8FBFC] px-4 py-4 text-sm text-[#6B7682]">
                Aucun operateur support actif n est configure pour le moment.
              </div>
            ) : (
              <div className="space-y-3">
                {supportAdmins.map((admin) => {
                  const isBusy = supportAdminActionTarget === admin.email

                  return (
                    <div key={admin.email} className="rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-semibold text-[#1A3636]">
                              {admin.fullName || admin.email}
                            </span>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              admin.active
                                ? 'border border-emerald-500/15 bg-emerald-500/10 text-emerald-700'
                                : 'border border-slate-500/15 bg-slate-500/10 text-slate-700'
                            }`}>
                              {admin.active ? 'Acces actif' : 'Acces retire'}
                            </span>
                            {admin.isCurrentOperator && (
                              <span className="rounded-full border border-violet-500/15 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                                Session en cours
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-xs text-[#6B7682]">{admin.email}</p>
                          <p className="mt-1 text-xs text-[#6B7682]">
                            Ajoute le {formatSubscriptionDate(admin.createdAt) || 'date indisponible'}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {!admin.active && (
                            <Button
                              variant="glass"
                              size="sm"
                              onClick={() => void handleSaveSupportAdmin({
                                email: admin.email,
                                fullName: admin.fullName,
                                active: true,
                              })}
                              disabled={isBusy}
                            >
                              <CheckCircle2 size={14} />
                              {isBusy ? 'Activation...' : 'Reactiver'}
                            </Button>
                          )}
                          {admin.active && !admin.isCurrentOperator && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleSaveSupportAdmin({
                                email: admin.email,
                                fullName: admin.fullName,
                                active: false,
                              })}
                              disabled={isBusy}
                            >
                              <UserX size={14} />
                              {isBusy ? 'Mise a jour...' : 'Retirer l acces'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-[#2D7D7D]" />
              <h4 className="text-sm font-semibold text-[#1A3636]">Ajouter ou reactiver un operateur</h4>
            </div>
            <p className="mt-2 text-sm text-[#6B7682]">
              Pratique pour garder uniquement les bons comptes support autorises, sans repasser par SQL.
            </p>

            <div className="mt-4 space-y-3">
              <Input
                label="Email support"
                value={supportAdminEmail}
                onChange={(event) => setSupportAdminEmail(event.target.value)}
                placeholder="contact@xelltekk.com"
              />
              <Input
                label="Nom affiche"
                value={supportAdminFullName}
                onChange={(event) => setSupportAdminFullName(event.target.value)}
                placeholder="Support XELLTEKK"
              />
              <Button
                className="w-full"
                onClick={() => void handleSaveSupportAdmin({
                  email: supportAdminEmail,
                  fullName: supportAdminFullName,
                  active: true,
                })}
                disabled={!supportAdminEmail.trim() || supportAdminActionTarget === supportAdminEmail.trim().toLowerCase()}
              >
                <UserPlus size={16} />
                {supportAdminActionTarget === supportAdminEmail.trim().toLowerCase() ? 'Enregistrement...' : 'Ajouter / reactiver'}
              </Button>
            </div>
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

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-[#1A3636]">Analytics SaaS avancees</h3>
            <p className="mt-1 text-sm text-[#6B7682]">
              Lecture rapide du support, du risque et du pipeline commercial de la plateforme.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-[#6B7682]">
            <span className="rounded-full bg-[#F4F7FB] px-3 py-1 font-semibold">{crmStageSummary.negotiation} nego</span>
            <span className="rounded-full bg-[#F4F7FB] px-3 py-1 font-semibold">{urgentOpenTickets.length} urgent(s)</span>
            <span className="rounded-full bg-[#F4F7FB] px-3 py-1 font-semibold">{inactiveAccountsCount} inactif(s)</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Tickets ouverts"
            value={`${openTickets.length}`}
            helper={`${urgentOpenTickets.length} priorite(s) urgente(s)`}
          />
          <MetricTile
            label="Comptes restreints"
            value={`${restrictedAccountsCount}`}
            helper={`${memberSummary.restricted} membre(s) impacte(s)`}
          />
          <MetricTile
            label="Pipeline commercial"
            value={formatCurrency(crmPipelineValue)}
            helper={`${crmAccounts.length} boutique(s) suivie(s)`}
          />
          <MetricTile
            label="Boutiques inactives"
            value={`${inactiveAccountsCount}`}
            helper="30 jours sans vente ou plus"
          />
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[#1A3636]">Priorites du jour</h3>
              <p className="mt-1 text-sm text-[#6B7682]">
                Les comptes qui demandent une action support immediate.
              </p>
            </div>
            <div className="rounded-full bg-[#F4F7FB] px-3 py-1 text-xs font-semibold text-[#5C6B73]">
              {priorityAccounts.length}
            </div>
          </div>

          {accountsLoading ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="animate-pulse rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-4">
                  <div className="h-4 w-36 rounded-full bg-[#2D7D7D]/10" />
                  <div className="mt-2 h-3 w-48 rounded-full bg-[#2D7D7D]/10" />
                  <div className="mt-3 h-8 rounded-full bg-[#2D7D7D]/10" />
                </div>
              ))}
            </div>
          ) : priorityAccounts.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#2D7D7D]/15 bg-[#F8FBFC] px-4 py-4 text-sm text-[#6B7682]">
              Rien d urgent pour le moment. La file support est sous controle.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {priorityAccounts.map((account) => {
                const summary = getPriorityAccountSummary(account)
                return (
                  <div key={account.accountId} className="rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-[#1A3636]">{account.businessName}</span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${summary.tone}`}>
                            {summary.title}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-[#6B7682]">{account.ownerEmail}</p>
                        <p className="mt-2 text-sm text-[#1A3636]">{summary.detail}</p>
                      </div>
                      <BellRing size={16} className="mt-1 flex-shrink-0 text-[#2D7D7D]" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedAccountId(account.accountId)}>
                        <Eye size={14} />
                        Ouvrir la fiche
                      </Button>
                      <Button
                        variant="glass"
                        size="sm"
                        onClick={() => void focusAccountInList(account)}
                      >
                        <ArrowUpRight size={14} />
                        Isoler
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
              <h3 className="text-base font-semibold text-[#1A3636]">Opportunites commerciales</h3>
              <p className="mt-1 text-sm text-[#6B7682]">
                Les boutiques les plus proches d une montee de formule.
              </p>
            </div>
            <div className="rounded-full bg-[#F4F7FB] px-3 py-1 text-xs font-semibold text-[#5C6B73]">
              {growthAccounts.length}
            </div>
          </div>

          {accountsLoading ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="animate-pulse rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-4">
                  <div className="h-4 w-32 rounded-full bg-[#2D7D7D]/10" />
                  <div className="mt-2 h-3 w-48 rounded-full bg-[#2D7D7D]/10" />
                  <div className="mt-3 h-8 rounded-full bg-[#2D7D7D]/10" />
                </div>
              ))}
            </div>
          ) : growthAccounts.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#2D7D7D]/15 bg-[#F8FBFC] px-4 py-4 text-sm text-[#6B7682]">
              Aucune opportunite evidente de vente additionnelle sur les filtres en cours.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {growthAccounts.map(({ account, opportunity }) => {
                const nextPlan = getPlanDefinition(opportunity.nextPlan)

                return (
                  <div key={account.accountId} className="rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-[#1A3636]">{account.businessName}</span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${opportunity.tone}`}>
                            {nextPlan.name}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-medium text-[#1A3636]">{opportunity.title}</p>
                        <p className="mt-1 text-sm text-[#5C6B73]">{opportunity.detail}</p>
                      </div>
                      <TrendingUp size={16} className="mt-1 flex-shrink-0 text-[#6C5CE7]" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={`mailto:${account.ownerEmail}?subject=${encodeURIComponent(`Proposition ${nextPlan.name} - ${account.businessName}`)}`}
                        className="inline-flex h-9 items-center justify-center rounded-full border border-[#2D7D7D]/20 px-4 text-xs font-semibold text-[#2D7D7D] transition-colors hover:bg-[#2D7D7D]/5"
                      >
                        Contacter la boutique
                      </Link>
                      <Button variant="outline" size="sm" onClick={() => setSelectedAccountId(account.accountId)}>
                        <Eye size={14} />
                        Voir la fiche
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
              <h3 className="text-base font-semibold text-[#1A3636]">Demandes a traiter maintenant</h3>
              <p className="mt-1 text-sm text-[#6B7682]">
                Vue compacte de la file abonnement pour ne pas perdre le tempo.
              </p>
            </div>
            <div className="rounded-full bg-[#F4F7FB] px-3 py-1 text-xs font-semibold text-[#5C6B73]">
              {queueSpotlight.length}
            </div>
          </div>

          {queueLoading ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="animate-pulse rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-4">
                  <div className="h-4 w-40 rounded-full bg-[#2D7D7D]/10" />
                  <div className="mt-2 h-3 w-52 rounded-full bg-[#2D7D7D]/10" />
                  <div className="mt-3 h-8 rounded-full bg-[#2D7D7D]/10" />
                </div>
              ))}
            </div>
          ) : queueSpotlight.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#2D7D7D]/15 bg-[#F8FBFC] px-4 py-4 text-sm text-[#6B7682]">
              Aucune demande en attente immediate. La file est vide.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {queueSpotlight.map((request) => {
                const linkedAccount = accounts.find((account) =>
                  accountMatchesSupportEntry(account, {
                    email: request.requestedByEmail,
                    businessName: request.businessName,
                  })
                ) ?? null
                const isBusy = supportActionTarget === request.id

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
                      {formatSubscriptionDate(request.createdAt) || 'date indisponible'} - {request.requestedByEmail || 'email indisponible'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {request.status === 'sent' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleSupportAction(request, 'mark_in_progress')}
                          disabled={isBusy}
                        >
                          Prendre en charge
                        </Button>
                      )}
                      {linkedAccount && (
                        <Button variant="glass" size="sm" onClick={() => setSelectedAccountId(linkedAccount.accountId)}>
                          <Eye size={14} />
                          Fiche boutique
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

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

      <div className="grid gap-4 2xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-base font-semibold text-[#1A3636]">Pipeline commercial CRM</h3>
              <p className="mt-1 text-sm text-[#6B7682]">
                Relances, negociation et potentiel de montee en formule regroupes au meme endroit.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-[#6B7682]">
              <span className="rounded-full bg-[#F4F7FB] px-3 py-1 font-semibold">{crmStageSummary.prospect} prospect(s)</span>
              <span className="rounded-full bg-[#F4F7FB] px-3 py-1 font-semibold">{crmStageSummary.followUp} relance(s)</span>
              <span className="rounded-full bg-[#F4F7FB] px-3 py-1 font-semibold">{crmStageSummary.negotiation} nego</span>
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
          ) : crmAccounts.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#2D7D7D]/15 bg-[#F8FBFC] px-4 py-4 text-sm text-[#6B7682]">
              Aucune opportunite CRM visible pour l&apos;instant. Les prochaines boutiques a suivre apparaitront ici.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {crmAccounts.map(({ account, opportunity, stage, valueEstimate }) => {
                const draft = getAccountControlDraft(account)
                const isSaving = accountControlTarget === account.accountId

                return (
                  <div key={account.accountId} className="rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-[#1A3636]">{account.businessName}</span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${SUPPORT_CRM_STAGE_STYLES[stage]}`}>
                            {SUPPORT_CRM_STAGE_LABELS[stage]}
                          </span>
                          {opportunity && (
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${opportunity.tone}`}>
                              {opportunity.title}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-xs text-[#6B7682]">{account.ownerEmail}</p>
                        <p className="mt-2 text-sm text-[#1A3636]">
                          {draft.crmNextStep || opportunity?.detail || 'Definir la prochaine etape commerciale pour cette boutique.'}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/70 bg-white px-3 py-2 text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7682]">Valeur estimee</p>
                        <p className="mt-1 text-lg font-semibold text-[#1A3636]">{formatCurrency(valueEstimate)}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <Select
                        label="Etape CRM"
                        value={draft.crmStage}
                        onChange={(event) => handleAccountControlChange(account, 'crmStage', event.target.value)}
                        options={SUPPORT_CRM_STAGE_OPTIONS}
                      />
                      <Input
                        label="Valeur estimee"
                        inputMode="numeric"
                        value={draft.crmValueEstimate}
                        onChange={(event) => handleAccountControlChange(account, 'crmValueEstimate', event.target.value)}
                        placeholder="10000"
                      />
                      <Input
                        label="Responsable"
                        value={draft.crmOwnerEmail}
                        onChange={(event) => handleAccountControlChange(account, 'crmOwnerEmail', event.target.value)}
                        placeholder="support@xelltekk.com"
                      />
                      <Input
                        label="Prochaine relance"
                        type="date"
                        value={draft.nextFollowUpAt}
                        onChange={(event) => handleAccountControlChange(account, 'nextFollowUpAt', event.target.value)}
                      />
                    </div>

                    <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
                      <Textarea
                        label="Prochaine etape commerciale"
                        rows={2}
                        value={draft.crmNextStep}
                        onChange={(event) => handleAccountControlChange(account, 'crmNextStep', event.target.value)}
                        placeholder="Ex: appeler demain pour proposer Starter, envoyer devis Pro, planifier demo..."
                      />
                      <div className="flex flex-wrap items-end gap-2 xl:justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedAccountId(account.accountId)
                            setNewTicketAccountId(account.accountId)
                            setNewTicketDraft((current) => ({
                              ...current,
                              requesterEmail: current.requesterEmail || account.ownerEmail,
                            }))
                          }}
                        >
                          <Eye size={14} />
                          Ouvrir la fiche
                        </Button>
                        <Button
                          variant="glass"
                          size="sm"
                          onClick={() => void saveAccountControl(account)}
                          disabled={isSaving}
                        >
                          {isSaving ? 'Enregistrement...' : 'Enregistrer le suivi'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-base font-semibold text-[#1A3636]">Module support / tickets</h3>
              <p className="mt-1 text-sm text-[#6B7682]">
                Cree, assigne et fais avancer les demandes techniques, commerciales ou de facturation.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-[#6B7682]">
              <span className="rounded-full bg-[#F4F7FB] px-3 py-1 font-semibold">{openTickets.length} ouverts</span>
              <span className="rounded-full bg-[#F4F7FB] px-3 py-1 font-semibold">{urgentOpenTickets.length} urgents</span>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Select
                label="Boutique"
                value={newTicketAccountId}
                onChange={(event) => setNewTicketAccountId(event.target.value)}
                options={[
                  { value: '', label: 'Choisir une boutique' },
                  ...accounts.map((account) => ({
                    value: account.accountId,
                    label: account.businessName,
                  })),
                ]}
              />
              <Input
                label="Sujet"
                value={newTicketDraft.subject}
                onChange={(event) => handleNewTicketDraftChange('subject', event.target.value)}
                placeholder="Ex: Validation paiement Wave, bug synchro stock..."
              />
              <Select
                label="Categorie"
                value={newTicketDraft.category}
                onChange={(event) => handleNewTicketDraftChange('category', event.target.value)}
                options={SUPPORT_TICKET_CATEGORY_OPTIONS}
              />
              <Select
                label="Priorite"
                value={newTicketDraft.priority}
                onChange={(event) => handleNewTicketDraftChange('priority', event.target.value)}
                options={SUPPORT_TICKET_PRIORITY_OPTIONS}
              />
              <Select
                label="Canal"
                value={newTicketDraft.channel}
                onChange={(event) => handleNewTicketDraftChange('channel', event.target.value)}
                options={SUPPORT_TICKET_CHANNEL_OPTIONS}
              />
              <Input
                label="Email demandeur"
                value={newTicketDraft.requesterEmail}
                onChange={(event) => handleNewTicketDraftChange('requesterEmail', event.target.value)}
                placeholder="client@boutique.com"
              />
              <Input
                label="Assigne a"
                value={newTicketDraft.assignedToEmail}
                onChange={(event) => handleNewTicketDraftChange('assignedToEmail', event.target.value)}
                placeholder="contact@xelltekk.com"
              />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
              <Textarea
                label="Details"
                rows={2}
                value={newTicketDraft.details}
                onChange={(event) => handleNewTicketDraftChange('details', event.target.value)}
                placeholder="Contexte, etapes, preuve recue, attente du client..."
              />
              <Input
                label="Echeance"
                type="date"
                value={newTicketDraft.dueAt}
                onChange={(event) => handleNewTicketDraftChange('dueAt', event.target.value)}
              />
            </div>
            <div className="mt-3 flex justify-end">
              <Button onClick={() => void handleCreateTicket()} disabled={ticketActionTarget === 'create'}>
                {ticketActionTarget === 'create' ? 'Creation...' : 'Creer le ticket'}
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_180px_140px]">
            <Input
              label="Recherche ticket"
              value={ticketSearch}
              onChange={(event) => setTicketSearch(event.target.value)}
              placeholder="Sujet, boutique ou email..."
              leftAddon={<Search size={16} />}
            />
            <Select
              label="Statut"
              value={ticketStatusFilter}
              onChange={(event) => setTicketStatusFilter(event.target.value as SupportTicketStatus | 'all')}
              options={[
                { value: 'all', label: 'Tous les statuts' },
                ...SUPPORT_TICKET_STATUS_OPTIONS,
              ]}
            />
            <Select
              label="Categorie"
              value={ticketCategoryFilter}
              onChange={(event) => setTicketCategoryFilter(event.target.value as SupportTicketCategory | 'all')}
              options={[
                { value: 'all', label: 'Toutes les categories' },
                ...SUPPORT_TICKET_CATEGORY_OPTIONS,
              ]}
            />
            <Select
              label="Priorite"
              value={ticketPriorityFilter}
              onChange={(event) => setTicketPriorityFilter(event.target.value as SupportTicketPriority | 'all')}
              options={[
                { value: 'all', label: 'Toutes les priorites' },
                ...SUPPORT_TICKET_PRIORITY_OPTIONS,
              ]}
            />
            <Button className="md:mb-[2px]" onClick={() => void handleTicketFilters()}>
              Filtrer
            </Button>
          </div>

          {ticketsError && (
            <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">
              {ticketsError}
            </div>
          )}

          {ticketsLoading ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="animate-pulse rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-4">
                  <div className="h-4 w-48 rounded-full bg-[#2D7D7D]/10" />
                  <div className="mt-2 h-3 w-56 rounded-full bg-[#2D7D7D]/10" />
                  <div className="mt-3 h-24 rounded-2xl bg-[#2D7D7D]/10" />
                </div>
              ))}
            </div>
          ) : visibleTickets.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#2D7D7D]/15 bg-[#F8FBFC] px-4 py-4 text-sm text-[#6B7682]">
              Aucun ticket support pour les filtres actuels.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {visibleTickets.map((ticket) => {
                const draft = getTicketDraft(ticket)
                const isSaving = ticketActionTarget === ticket.ticketId

                return (
                  <div key={ticket.ticketId} className="rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-[#1A3636]">{draft.subject || ticket.subject}</span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${SUPPORT_TICKET_STATUS_STYLES[ticket.status]}`}>
                            {SUPPORT_TICKET_STATUS_LABELS[ticket.status]}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${SUPPORT_TICKET_PRIORITY_STYLES[ticket.priority]}`}>
                            {SUPPORT_TICKET_PRIORITY_LABELS[ticket.priority]}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-[#1A3636]">{ticket.businessName}</p>
                        <p className="mt-1 text-xs text-[#6B7682]">
                          {SUPPORT_TICKET_CATEGORY_LABELS[ticket.category]} - {ticket.requesterEmail || ticket.ownerEmail}
                        </p>
                      </div>
                      <div className="text-xs text-[#6B7682] lg:text-right">
                        <p>Ouvert le {formatSubscriptionDate(ticket.createdAt) || 'date indisponible'}</p>
                        <p className="mt-1">Echeance {formatSubscriptionDate(ticket.dueAt) || 'non definie'}</p>
                        <p className="mt-1">{ticket.assignedToEmail || 'Non assigne'}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <Select
                        label="Statut"
                        value={draft.status}
                        onChange={(event) => handleTicketDraftChange(ticket, 'status', event.target.value)}
                        options={SUPPORT_TICKET_STATUS_OPTIONS}
                      />
                      <Select
                        label="Priorite"
                        value={draft.priority}
                        onChange={(event) => handleTicketDraftChange(ticket, 'priority', event.target.value)}
                        options={SUPPORT_TICKET_PRIORITY_OPTIONS}
                      />
                      <Select
                        label="Canal"
                        value={draft.channel}
                        onChange={(event) => handleTicketDraftChange(ticket, 'channel', event.target.value)}
                        options={SUPPORT_TICKET_CHANNEL_OPTIONS}
                      />
                      <Input
                        label="Echeance"
                        type="date"
                        value={draft.dueAt}
                        onChange={(event) => handleTicketDraftChange(ticket, 'dueAt', event.target.value)}
                      />
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                      <Textarea
                        label="Details"
                        rows={2}
                        value={draft.details}
                        onChange={(event) => handleTicketDraftChange(ticket, 'details', event.target.value)}
                        placeholder="Suivi en cours, etapes, blocage..."
                      />
                      <Input
                        label="Assigne a"
                        value={draft.assignedToEmail}
                        onChange={(event) => handleTicketDraftChange(ticket, 'assignedToEmail', event.target.value)}
                        placeholder="contact@xelltekk.com"
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedAccountId(ticket.accountId)}>
                        <Eye size={14} />
                        Fiche boutique
                      </Button>
                      <Button
                        variant="glass"
                        size="sm"
                        onClick={() => void handleUpdateTicket(ticket)}
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
      </div>

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

              <Card className="p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[#1A3636]">Actions admin directes</h3>
                    <p className="mt-1 text-xs text-[#6B7682]">
                      Raccourcis support pour suspendre, reactiver, relancer ou ouvrir un ticket sur ce compte.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={selectedAccount.accessStatus === 'restricted' ? 'teal' : 'danger'}
                      size="sm"
                      onClick={() => void saveAccountControl(selectedAccount, {
                        accessStatus: selectedAccount.accessStatus === 'restricted' ? 'active' : 'restricted',
                      })}
                      disabled={accountControlTarget === selectedAccount.accountId}
                    >
                      <Ban size={14} />
                      {selectedAccount.accessStatus === 'restricted' ? 'Reactiver' : 'Suspendre'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void saveAccountControl(selectedAccount, {
                        watchLevel: 'critical',
                      })}
                      disabled={accountControlTarget === selectedAccount.accountId}
                    >
                      Suivi critique
                    </Button>
                    <Button
                      variant="glass"
                      size="sm"
                      onClick={() => {
                        setNewTicketAccountId(selectedAccount.accountId)
                        setNewTicketDraft((current) => ({
                          ...current,
                          requesterEmail: current.requesterEmail || selectedAccount.ownerEmail,
                          category: current.category === 'other' ? 'commercial' : current.category,
                        }))
                      }}
                    >
                      Preparer un ticket
                    </Button>
                  </div>
                </div>
              </Card>

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
                <MetricTile
                  label="Tickets support"
                  value={`${selectedAccountTickets.length}`}
                  helper={`${selectedAccountTickets.filter((ticket) => isTicketOpenStatus(ticket.status)).length} ouvert(s)`}
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

              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <LifeBuoy size={16} className="text-[#2D7D7D]" />
                  <div>
                    <h3 className="text-sm font-semibold text-[#1A3636]">Tickets rattaches a cette boutique</h3>
                    <p className="mt-1 text-xs text-[#6B7682]">
                      Vue rapide des incidents, demandes techniques ou suivis commerciaux deja ouverts.
                    </p>
                  </div>
                </div>

                {selectedAccountTickets.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-[#2D7D7D]/15 bg-[#F8FBFC] px-4 py-4 text-sm text-[#6B7682]">
                    Aucun ticket support lie a cette boutique pour le moment.
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {selectedAccountTickets.slice(0, 4).map((ticket) => (
                      <div key={ticket.ticketId} className="rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-[#1A3636]">{ticket.subject}</span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${SUPPORT_TICKET_STATUS_STYLES[ticket.status]}`}>
                            {SUPPORT_TICKET_STATUS_LABELS[ticket.status]}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${SUPPORT_TICKET_PRIORITY_STYLES[ticket.priority]}`}>
                            {SUPPORT_TICKET_PRIORITY_LABELS[ticket.priority]}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-[#6B7682]">
                          {SUPPORT_TICKET_CATEGORY_LABELS[ticket.category]} - {formatSubscriptionDate(ticket.createdAt) || 'date indisponible'}
                        </p>
                        {ticket.details && (
                          <p className="mt-2 text-sm text-[#1A3636]">{ticket.details}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )
        })()}
      </Modal>

    </div>
  )
}
