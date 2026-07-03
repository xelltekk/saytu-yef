import { createClient, ensureBrowserSupabaseSession } from '@/lib/supabase/client'
import type { BillingCycle, SubscriptionPlan, SubscriptionStatus } from '@/types'

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

export function buildSubscriptionRequestMailto(plan: SubscriptionPlan, overview: SubscriptionOverview): string {
  const targetPlan = getPlanDefinition(plan)
  const currentPlan = getPlanDefinition(overview.plan)
  const body = [
    'Bonjour equipe Saytu Yef,',
    '',
    `Je souhaite passer ma boutique sur le plan ${targetPlan.name}.`,
    overview.businessName ? `Boutique: ${overview.businessName}` : null,
    `Plan actuel: ${currentPlan.name}`,
    `Statut actuel: ${SUBSCRIPTION_STATUS_LABELS[overview.status]}`,
    `Produits actifs: ${overview.usage.products}`,
    `Membres d'equipe: ${overview.usage.teamMembers}`,
    `Ventes ce mois: ${overview.usage.monthlySales}`,
    '',
    'Merci de me confirmer les prochaines etapes d activation.',
  ].filter(Boolean).join('\n')

  const subject = `Demande abonnement Saytu Yef - ${targetPlan.name}`
  return `mailto:contact@xelltekk.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
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
