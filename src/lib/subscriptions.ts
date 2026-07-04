import { createClient, ensureBrowserSupabaseSession } from '@/lib/supabase/client'
import type {
  BillingCycle,
  SubscriptionPlan,
  SubscriptionPaymentMethod,
  SubscriptionRequestStatus,
  SubscriptionRequestType,
  SubscriptionStatus,
} from '@/types'

type PlanLimitKey = 'products' | 'teamMembers' | 'monthlySales'

type RawBillingProfile = {
  business_name?: string | null
  created_at?: string | null
  subscription_plan?: string | null
  subscription_status?: string | null
  billing_cycle?: string | null
  trial_started_at?: string | null
  trial_ends_at?: string | null
  subscription_started_at?: string | null
  current_period_ends_at?: string | null
  cancelled_at?: string | null
  subscription_notes?: string | null
}

type RawSubscriptionRequest = {
  id: string
  current_plan?: string | null
  requested_plan?: string | null
  request_type?: string | null
  status?: string | null
  requested_by_email?: string | null
  business_name?: string | null
  notes?: string | null
  support_note?: string | null
  payment_method?: string | null
  payment_amount?: number | string | null
  payment_reference?: string | null
  payment_confirmed_at?: string | null
  processed_by_email?: string | null
  activated_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type SubscriptionUsage = {
  products: number
  teamMembers: number
  monthlySales: number
}

export type SubscriptionOverview = {
  businessName: string
  plan: SubscriptionPlan
  status: SubscriptionStatus
  billingCycle: BillingCycle
  createdAt?: string | null
  trialStartedAt?: string | null
  trialEndsAt?: string | null
  subscriptionStartedAt?: string | null
  currentPeriodEndsAt?: string | null
  cancelledAt?: string | null
  notes?: string | null
  usage: SubscriptionUsage
  hasAdvancedFields: boolean
}

export type SubscriptionRequestRecord = {
  id: string
  currentPlan: SubscriptionPlan
  requestedPlan: SubscriptionPlan
  requestType: SubscriptionRequestType
  status: SubscriptionRequestStatus
  requestedByEmail?: string | null
  businessName?: string | null
  notes?: string | null
  supportNote?: string | null
  paymentMethod?: SubscriptionPaymentMethod | null
  paymentAmount?: number | null
  paymentReference?: string | null
  paymentConfirmedAt?: string | null
  processedByEmail?: string | null
  activatedAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type SubmitSubscriptionRequestResult = {
  mode: 'created' | 'existing'
  request: SubscriptionRequestRecord
}

export type SupportSubscriptionRequestAction = 'mark_in_progress' | 'activate' | 'cancel'

export type SupportSubscriptionRequestActionInput = {
  note?: string | null
  paymentMethod?: SubscriptionPaymentMethod | null
  paymentAmount?: number | null
  paymentReference?: string | null
}

const PLAN_LEVELS: Record<SubscriptionPlan, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
}

export const SUBSCRIPTION_PLANS: Array<{
  id: SubscriptionPlan
  name: string
  price: number
  period: string
  desc: string
  popular?: boolean
  cta: string
  features: string[]
  limits: Record<PlanLimitKey, number | null>
}> = [
  {
    id: 'free',
    name: 'Gratuit',
    price: 0,
    period: 'sans engagement',
    desc: 'Pour demarrer les tests et valider la boutique.',
    cta: 'Rester sur gratuit',
    features: ['50 produits', '10 ventes / mois', '1 utilisateur', 'Stock, ventes, dettes'],
    limits: { products: 50, teamMembers: 1, monthlySales: 10 },
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 10000,
    period: '/ mois',
    desc: 'Le bon plan pour une boutique qui commence a vendre tous les jours.',
    cta: 'Passer a Starter',
    popular: true,
    features: ['500 produits', 'Ventes illimitees', '3 utilisateurs', 'Paiements mobiles', 'Rapports clairs'],
    limits: { products: 500, teamMembers: 3, monthlySales: null },
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 20000,
    period: '/ mois',
    desc: 'Pour accelerer avec plus d equipe, de suivi et de pilotage.',
    cta: 'Passer a Pro',
    features: ['Produits illimites', '10 utilisateurs', 'Dettes clients avancees', 'Rapports avances', 'Support prioritaire'],
    limits: { products: null, teamMembers: 10, monthlySales: null },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 0,
    period: 'sur devis',
    desc: 'Accompagnement dedie pour reseaux, franchises et gros volumes.',
    cta: 'Parler a l equipe',
    features: ['Equipe illimitee', 'Support dedie', 'Accompagnement deploiement', 'Besoins specifiques'],
    limits: { products: null, teamMembers: null, monthlySales: null },
  },
]

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  free: 'Version gratuite',
  trial: 'Essai en cours',
  active: 'Abonnement actif',
  past_due: 'Paiement attendu',
  suspended: 'Suspendu',
  cancelled: 'Resilie',
  expired: 'Expire',
}

export const SUBSCRIPTION_STATUS_STYLES: Record<SubscriptionStatus, string> = {
  free: 'bg-slate-500/10 text-slate-700 border border-slate-500/15',
  trial: 'bg-violet-500/10 text-violet-700 border border-violet-500/15',
  active: 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/15',
  past_due: 'bg-amber-500/10 text-amber-700 border border-amber-500/15',
  suspended: 'bg-red-500/10 text-red-700 border border-red-500/15',
  cancelled: 'bg-slate-500/10 text-slate-700 border border-slate-500/15',
  expired: 'bg-red-500/10 text-red-700 border border-red-500/15',
}

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: 'Mensuel',
  quarterly: 'Trimestriel',
  yearly: 'Annuel',
  manual: 'Activation manuelle',
}

export const SUBSCRIPTION_PAYMENT_METHOD_LABELS: Record<SubscriptionPaymentMethod, string> = {
  cash: 'Especes',
  wave: 'Wave',
  orange_money: 'Orange Money',
  card: 'Carte',
  bank_transfer: 'Virement',
  other: 'Autre',
}

export const SUBSCRIPTION_REQUEST_STATUS_LABELS: Record<SubscriptionRequestStatus, string> = {
  sent: 'Envoyee',
  in_progress: 'En cours',
  activated: 'Activee',
  cancelled: 'Annulee',
}

export const SUBSCRIPTION_REQUEST_STATUS_STYLES: Record<SubscriptionRequestStatus, string> = {
  sent: 'bg-violet-500/10 text-violet-700 border border-violet-500/15',
  in_progress: 'bg-amber-500/10 text-amber-700 border border-amber-500/15',
  activated: 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/15',
  cancelled: 'bg-slate-500/10 text-slate-700 border border-slate-500/15',
}

export const SUBSCRIPTION_REQUEST_TYPE_LABELS: Record<SubscriptionRequestType, string> = {
  activation: 'Activation',
  upgrade: 'Upgrade',
  renewal: 'Renouvellement',
  reactivation: 'Reactivation',
  downgrade: 'Ajustement',
}

export const SUBSCRIPTION_REQUEST_TYPE_STYLES: Record<SubscriptionRequestType, string> = {
  activation: 'bg-[#2D7D7D]/10 text-[#2D7D7D] border border-[#2D7D7D]/15',
  upgrade: 'bg-[#6C5CE7]/10 text-[#6C5CE7] border border-[#6C5CE7]/15',
  renewal: 'bg-sky-500/10 text-sky-700 border border-sky-500/15',
  reactivation: 'bg-amber-500/10 text-amber-700 border border-amber-500/15',
  downgrade: 'bg-slate-500/10 text-slate-700 border border-slate-500/15',
}

function normalizePlan(value: string | null | undefined): SubscriptionPlan {
  return SUBSCRIPTION_PLANS.some((plan) => plan.id === value)
    ? (value as SubscriptionPlan)
    : 'free'
}

function normalizeStatus(value: string | null | undefined): SubscriptionStatus | null {
  if (!value) return null
  if (value === 'free' || value === 'trial' || value === 'active' || value === 'past_due' || value === 'suspended' || value === 'cancelled' || value === 'expired') {
    return value
  }
  return null
}

function normalizeCycle(value: string | null | undefined, plan: SubscriptionPlan): BillingCycle {
  if (value === 'monthly' || value === 'quarterly' || value === 'yearly' || value === 'manual') {
    return value
  }
  return plan === 'free' ? 'manual' : 'monthly'
}

function normalizeRequestStatus(value: string | null | undefined): SubscriptionRequestStatus {
  if (value === 'sent' || value === 'in_progress' || value === 'activated' || value === 'cancelled') {
    return value
  }
  return 'sent'
}

function normalizeRequestType(value: string | null | undefined): SubscriptionRequestType | null {
  if (value === 'activation' || value === 'upgrade' || value === 'renewal' || value === 'reactivation' || value === 'downgrade') {
    return value
  }
  return null
}

function normalizeSubscriptionPaymentMethod(value: string | null | undefined): SubscriptionPaymentMethod | null {
  if (value === 'cash' || value === 'wave' || value === 'orange_money' || value === 'card' || value === 'bank_transfer' || value === 'other') {
    return value
  }
  return null
}

function isMissingSubscriptionRequestTable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const code = 'code' in error && typeof error.code === 'string' ? error.code : ''
  const message = 'message' in error && typeof error.message === 'string' ? error.message : ''

  return code === '42P01' || message.toLowerCase().includes('subscription_requests')
}

function isSupportAccessDenied(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const code = 'code' in error && typeof error.code === 'string' ? error.code : ''
  const message = 'message' in error && typeof error.message === 'string' ? error.message.toLowerCase() : ''

  return code === 'P0001' && message.includes('acces support requis')
}

function isMissingSupportRpc(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const code = 'code' in error && typeof error.code === 'string' ? error.code : ''
  const message = 'message' in error && typeof error.message === 'string' ? error.message.toLowerCase() : ''

  return code === '42883'
    || code === 'PGRST202'
    || message.includes('list_support_subscription_requests')
    || message.includes('apply_support_subscription_request_action')
    || message.includes('submit_subscription_request_secure')
}

function mapSubscriptionRequest(row: RawSubscriptionRequest): SubscriptionRequestRecord {
  const currentPlan = normalizePlan(row.current_plan)
  const requestedPlan = normalizePlan(row.requested_plan)
  const parsedPaymentAmount = row.payment_amount === null || row.payment_amount === undefined
    ? null
    : Number(row.payment_amount)

  return {
    id: row.id,
    currentPlan,
    requestedPlan,
    requestType: getSubscriptionRequestType(currentPlan, requestedPlan, 'active', row.request_type),
    status: normalizeRequestStatus(row.status),
    requestedByEmail: row.requested_by_email ?? null,
    businessName: row.business_name ?? null,
    notes: row.notes ?? null,
    supportNote: row.support_note ?? null,
    paymentMethod: normalizeSubscriptionPaymentMethod(row.payment_method),
    paymentAmount: parsedPaymentAmount !== null && Number.isFinite(parsedPaymentAmount) ? parsedPaymentAmount : null,
    paymentReference: row.payment_reference ?? null,
    paymentConfirmedAt: row.payment_confirmed_at ?? null,
    processedByEmail: row.processed_by_email ?? null,
    activatedAt: row.activated_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  }
}

export function getSubscriptionRequestReference(requestId: string): string {
  return requestId.slice(0, 8).toUpperCase()
}

export function getSubscriptionRequestType(
  currentPlan: SubscriptionPlan,
  requestedPlan: SubscriptionPlan,
  currentStatus: SubscriptionStatus = 'active',
  explicitType?: string | null
): SubscriptionRequestType {
  const normalizedExplicitType = normalizeRequestType(explicitType)
  if (normalizedExplicitType) {
    return normalizedExplicitType
  }

  if (requestedPlan === currentPlan) {
    if (requestedPlan === 'free') {
      return 'activation'
    }
    if (currentStatus === 'past_due' || currentStatus === 'expired' || currentStatus === 'suspended' || currentStatus === 'cancelled') {
      return 'reactivation'
    }
    return 'renewal'
  }

  if (currentPlan === 'free' || currentStatus === 'trial') {
    return 'activation'
  }

  return PLAN_LEVELS[requestedPlan] > PLAN_LEVELS[currentPlan] ? 'upgrade' : 'downgrade'
}

export function getSubscriptionRequestTitle(type: SubscriptionRequestType, requestedPlan: SubscriptionPlan): string {
  const planName = getPlanDefinition(requestedPlan).name

  switch (type) {
    case 'renewal':
      return `Renouvellement ${planName}`
    case 'reactivation':
      return `Reactivation ${planName}`
    case 'upgrade':
      return `Upgrade vers ${planName}`
    case 'downgrade':
      return `Ajustement vers ${planName}`
    default:
      return `Activation ${planName}`
  }
}

export function getSubscriptionRequestSummary(
  type: SubscriptionRequestType,
  currentPlan: SubscriptionPlan,
  requestedPlan: SubscriptionPlan
): string {
  const currentLabel = getPlanDefinition(currentPlan).name
  const requestedLabel = getPlanDefinition(requestedPlan).name

  switch (type) {
    case 'renewal':
      return `Renouvellement du plan ${requestedLabel}`
    case 'reactivation':
      return `Reactivation du plan ${requestedLabel}`
    case 'upgrade':
      return `${currentLabel} vers ${requestedLabel}`
    case 'downgrade':
      return `${currentLabel} vers ${requestedLabel}`
    default:
      return `Activation du plan ${requestedLabel}`
  }
}

export function getSubscriptionRequestButtonLabel(type: SubscriptionRequestType, requestedPlan: SubscriptionPlan): string {
  const planName = getPlanDefinition(requestedPlan).name

  switch (type) {
    case 'renewal':
      return 'Demander le renouvellement'
    case 'reactivation':
      return 'Demander la reactivation'
    case 'upgrade':
      return `Demander ${planName}`
    case 'downgrade':
      return `Demander ${planName}`
    default:
      return `Demander ${planName}`
  }
}

export function getSupportActionLabel(type: SubscriptionRequestType, requestedPlan: SubscriptionPlan): string {
  const planName = getPlanDefinition(requestedPlan).name

  switch (type) {
    case 'renewal':
      return 'Renouveler 30 jours'
    case 'reactivation':
      return `Reactiver ${planName}`
    case 'upgrade':
      return `Valider ${planName}`
    case 'downgrade':
      return `Appliquer ${planName}`
    default:
      return `Activer ${planName}`
  }
}

export function getSubscriptionExpectedPaymentAmount(
  type: SubscriptionRequestType,
  requestedPlan: SubscriptionPlan
): number | null {
  const plan = getPlanDefinition(requestedPlan)

  if (requestedPlan === 'free' || type === 'downgrade' || plan.price <= 0) {
    return null
  }

  return plan.price
}

export function doesSubscriptionActivationRequirePayment(
  type: SubscriptionRequestType,
  requestedPlan: SubscriptionPlan
): boolean {
  return getSubscriptionExpectedPaymentAmount(type, requestedPlan) !== null
}

function inferStatus(plan: SubscriptionPlan, createdAt?: string | null, trialEndsAt?: string | null): SubscriptionStatus {
  if (plan !== 'free') return 'active'
  if (!createdAt) return 'free'

  const createdTime = new Date(createdAt).getTime()
  if (Number.isNaN(createdTime)) return 'free'

  const now = Date.now()
  const effectiveTrialEnd = trialEndsAt ? new Date(trialEndsAt).getTime() : createdTime + (14 * 24 * 60 * 60 * 1000)
  if (!Number.isNaN(effectiveTrialEnd) && now <= effectiveTrialEnd) {
    return 'trial'
  }
  return 'free'
}

function getFallbackTrialEndsAt(plan: SubscriptionPlan, createdAt?: string | null): string | null {
  if (plan !== 'free' || !createdAt) return null

  const createdDate = new Date(createdAt)
  if (Number.isNaN(createdDate.getTime())) return null

  createdDate.setUTCDate(createdDate.getUTCDate() + 14)
  return createdDate.toISOString()
}

export function getPlanDefinition(plan: SubscriptionPlan) {
  return SUBSCRIPTION_PLANS.find((entry) => entry.id === plan) ?? SUBSCRIPTION_PLANS[0]
}

export function formatSubscriptionPrice(plan: SubscriptionPlan): string {
  const definition = getPlanDefinition(plan)
  if (definition.price === 0) {
    return plan === 'enterprise' ? 'Sur devis' : 'Gratuit'
  }
  return `${definition.price.toLocaleString('fr-FR')} FCFA`
}

export function formatSubscriptionDate(value?: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

export function getRemainingDays(value?: string | null): number | null {
  if (!value) return null
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return null

  const diff = time - Date.now()
  return Math.ceil(diff / (24 * 60 * 60 * 1000))
}

export function getUsageLimit(plan: SubscriptionPlan, key: PlanLimitKey): number | null {
  return getPlanDefinition(plan).limits[key]
}

export function getUsageRatio(used: number, limit: number | null): number {
  if (!limit || limit <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((used / limit) * 100)))
}

export function getRecommendedPlan(plan: SubscriptionPlan, usage: SubscriptionUsage): SubscriptionPlan | null {
  if (plan === 'free') {
    if (usage.products > 40 || usage.monthlySales > 8 || usage.teamMembers > 1) return 'starter'
    return null
  }

  if (plan === 'starter') {
    if (usage.products > 400 || usage.teamMembers > 3) return 'pro'
    return null
  }

  if (plan === 'pro') {
    if (usage.teamMembers > 10) return 'enterprise'
    return null
  }

  return null
}

export function getSubscriptionHeadline(overview: SubscriptionOverview): string {
  if (overview.status === 'trial') {
    const remainingDays = getRemainingDays(overview.trialEndsAt)
    if (remainingDays !== null && remainingDays >= 0) {
      return `Essai actif${remainingDays > 0 ? ` - ${remainingDays} jour(s) restants` : ' - dernier jour'}`
    }
    return 'Essai gratuit en cours'
  }

  if (overview.status === 'active') {
    return `Plan ${getPlanDefinition(overview.plan).name} actif`
  }

  if (overview.status === 'past_due') {
    return 'Paiement en attente de confirmation'
  }

  if (overview.status === 'expired') {
    return 'Abonnement a renouveler'
  }

  if (overview.status === 'suspended') {
    return 'Compte temporairement suspendu'
  }

  if (overview.status === 'cancelled') {
    return 'Abonnement resilie'
  }

  return 'Version gratuite active'
}

export function buildSubscriptionRequestMailto(
  plan: SubscriptionPlan,
  overview: SubscriptionOverview,
  request?: SubscriptionRequestRecord | null
): string {
  const targetPlan = getPlanDefinition(plan)
  const currentPlan = getPlanDefinition(overview.plan)
  const requestType = getSubscriptionRequestType(
    overview.plan,
    plan,
    overview.status,
    request?.requestType ?? null
  )

  const firstLine = (() => {
    switch (requestType) {
      case 'renewal':
        return `Je souhaite renouveler mon plan ${targetPlan.name} pour la prochaine periode.`
      case 'reactivation':
        return `Je souhaite reactiver mon plan ${targetPlan.name}.`
      case 'upgrade':
        return `Je souhaite passer ma boutique du plan ${currentPlan.name} au plan ${targetPlan.name}.`
      case 'downgrade':
        return `Je souhaite ajuster ma boutique vers le plan ${targetPlan.name}.`
      default:
        return `Je souhaite activer le plan ${targetPlan.name} pour ma boutique.`
    }
  })()

  const body = [
    'Bonjour equipe Saytu Yef,',
    '',
    firstLine,
    request ? `Reference de demande: ${getSubscriptionRequestReference(request.id)}` : null,
    overview.businessName ? `Boutique: ${overview.businessName}` : null,
    `Plan actuel: ${currentPlan.name}`,
    `Statut actuel: ${SUBSCRIPTION_STATUS_LABELS[overview.status]}`,
    overview.currentPeriodEndsAt ? `Echeance actuelle: ${formatSubscriptionDate(overview.currentPeriodEndsAt)}` : null,
    `Produits actifs: ${overview.usage.products}`,
    `Membres d'equipe: ${overview.usage.teamMembers}`,
    `Ventes ce mois: ${overview.usage.monthlySales}`,
    '',
    requestType === 'renewal'
      ? 'Merci de me confirmer le renouvellement et la prochaine echeance.'
      : requestType === 'reactivation'
        ? 'Merci de me confirmer la reactivation et la reprise du service.'
        : 'Merci de me confirmer les prochaines etapes d activation.',
  ].filter(Boolean).join('\n')

  const subject = `Demande abonnement Saytu Yef - ${getSubscriptionRequestTitle(requestType, plan)}`
  return `mailto:contact@xelltekk.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export async function getSubscriptionRequests(limit = 5): Promise<SubscriptionRequestRecord[]> {
  const supabase = createClient()
  await ensureBrowserSupabaseSession(supabase)

  const { error, data } = await supabase
    .from('subscription_requests')
    .select('id,current_plan,requested_plan,request_type,status,requested_by_email,business_name,notes,support_note,payment_method,payment_amount,payment_reference,payment_confirmed_at,processed_by_email,activated_at,created_at,updated_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingSubscriptionRequestTable(error)) return []
    throw error
  }

  return ((data ?? []) as RawSubscriptionRequest[]).map(mapSubscriptionRequest)
}

export async function getSupportSubscriptionRequests(limit = 12): Promise<SubscriptionRequestRecord[] | null> {
  const supabase = createClient()
  await ensureBrowserSupabaseSession(supabase)

  const { error, data } = await supabase.rpc('list_support_subscription_requests', {
    p_limit: limit,
  })

  if (error) {
    if (isSupportAccessDenied(error)) return null
    if (isMissingSupportRpc(error)) {
      throw new Error("La migration support abonnement n'est pas encore appliquee dans Supabase.")
    }
    throw error
  }

  return ((data ?? []) as RawSubscriptionRequest[]).map(mapSubscriptionRequest)
}

export async function applySupportSubscriptionRequestAction(
  requestId: string,
  action: SupportSubscriptionRequestAction,
  input?: SupportSubscriptionRequestActionInput | null
): Promise<SubscriptionRequestRecord> {
  const supabase = createClient()
  await ensureBrowserSupabaseSession(supabase)

  const { error, data } = await supabase.rpc('apply_support_subscription_request_action', {
    p_request_id: requestId,
    p_action: action,
    p_support_note: input?.note?.trim() || null,
    p_payment_method: input?.paymentMethod ?? null,
    p_payment_amount: input?.paymentAmount ?? null,
    p_payment_reference: input?.paymentReference?.trim() || null,
  })

  if (error) {
    if (isSupportAccessDenied(error)) {
      throw new Error('Acces support requis pour cette action.')
    }
    if (isMissingSupportRpc(error)) {
      throw new Error("La migration support abonnement n'est pas encore appliquee dans Supabase.")
    }
    throw error
  }

  const rows = (data ?? []) as RawSubscriptionRequest[]
  if (!rows[0]) {
    throw new Error('Reponse support invalide.')
  }

  return mapSubscriptionRequest(rows[0])
}

export async function submitSubscriptionRequest(
  requestedPlan: SubscriptionPlan,
  overview: SubscriptionOverview
): Promise<SubmitSubscriptionRequestResult> {
  const supabase = createClient()
  await ensureBrowserSupabaseSession(supabase)

  const requestType = getSubscriptionRequestType(overview.plan, requestedPlan, overview.status)

  const existingResult = await supabase
    .from('subscription_requests')
    .select('id,current_plan,requested_plan,request_type,status,requested_by_email,business_name,notes,support_note,payment_method,payment_amount,payment_reference,payment_confirmed_at,processed_by_email,activated_at,created_at,updated_at')
    .eq('current_plan', overview.plan)
    .eq('requested_plan', requestedPlan)
    .eq('request_type', requestType)
    .in('status', ['sent', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingResult.error) {
    if (isMissingSubscriptionRequestTable(existingResult.error)) {
      throw new Error("La migration de securisation abonnement n'est pas encore appliquee dans Supabase.")
    }
    throw existingResult.error
  }

  if (existingResult.data) {
    return {
      mode: 'existing',
      request: mapSubscriptionRequest(existingResult.data as RawSubscriptionRequest),
    }
  }

  const { error, data } = await supabase.rpc('submit_subscription_request_secure', {
    p_requested_plan: requestedPlan,
  })

  if (error) {
    if (isMissingSubscriptionRequestTable(error) || isMissingSupportRpc(error)) {
      throw new Error("La migration de securisation abonnement n'est pas encore appliquee dans Supabase.")
    }
    throw error
  }

  const rows = (data ?? []) as RawSubscriptionRequest[]
  if (!rows[0]) {
    throw new Error('Reponse abonnement invalide.')
  }

  const request = mapSubscriptionRequest(rows[0])

  return {
    mode: 'created',
    request,
  }
}

export async function getSubscriptionOverview(): Promise<SubscriptionOverview> {
  const supabase = createClient()
  await ensureBrowserSupabaseSession(supabase)

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('Non connecte')

  const basicProfileResult = await supabase
    .from('profiles')
    .select('business_name,created_at,subscription_plan')
    .eq('id', user.id)
    .maybeSingle()

  const basicProfile = (basicProfileResult.data ?? null) as RawBillingProfile | null
  const basicProfileError = basicProfileResult.error

  if (basicProfileError) throw basicProfileError

  const advancedProfileResult = await supabase
    .from('profiles')
    .select('subscription_status,billing_cycle,trial_started_at,trial_ends_at,subscription_started_at,current_period_ends_at,cancelled_at,subscription_notes')
    .eq('id', user.id)
    .maybeSingle()

  const advancedProfile = (advancedProfileResult.data ?? null) as RawBillingProfile | null
  const advancedProfileError = advancedProfileResult.error

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString()

  const [productCountResult, teamCountResult, monthlySalesResult] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart)
      .in('payment_status', ['completed', 'partial', 'pending']),
  ])

  if (productCountResult.error) throw productCountResult.error
  if (teamCountResult.error) throw teamCountResult.error
  if (monthlySalesResult.error) throw monthlySalesResult.error

  const plan = normalizePlan(basicProfile?.subscription_plan)
  const status = normalizeStatus(advancedProfile?.subscription_status) ?? inferStatus(plan, basicProfile?.created_at, advancedProfile?.trial_ends_at)

  return {
    businessName: basicProfile?.business_name ?? '',
    plan,
    status,
    billingCycle: normalizeCycle(advancedProfile?.billing_cycle, plan),
    createdAt: basicProfile?.created_at ?? null,
    trialStartedAt: advancedProfile?.trial_started_at ?? basicProfile?.created_at ?? null,
    trialEndsAt: advancedProfile?.trial_ends_at ?? getFallbackTrialEndsAt(plan, basicProfile?.created_at),
    subscriptionStartedAt: advancedProfile?.subscription_started_at ?? null,
    currentPeriodEndsAt: advancedProfile?.current_period_ends_at ?? null,
    cancelledAt: advancedProfile?.cancelled_at ?? null,
    notes: advancedProfile?.subscription_notes ?? null,
    usage: {
      products: productCountResult.count ?? 0,
      teamMembers: teamCountResult.count ?? 0,
      monthlySales: monthlySalesResult.count ?? 0,
    },
    hasAdvancedFields: !advancedProfileError,
  }
}
