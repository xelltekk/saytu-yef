'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useAccountRole } from '@/hooks/useAccountRole'
import {
  applySupportSubscriptionRequestAction,
  BILLING_CYCLE_LABELS,
  doesSubscriptionActivationRequirePayment,
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_PAYMENT_METHOD_LABELS,
  SUBSCRIPTION_REQUEST_TYPE_LABELS,
  SUBSCRIPTION_REQUEST_TYPE_STYLES,
  getSubscriptionExpectedPaymentAmount,
  getSupportSubscriptionRequests,
  SUBSCRIPTION_REQUEST_STATUS_LABELS,
  SUBSCRIPTION_REQUEST_STATUS_STYLES,
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_STYLES,
  buildSubscriptionRequestMailto,
  formatSubscriptionDate,
  formatSubscriptionPrice,
  getPlanDefinition,
  getRecommendedPlan,
  getRemainingDays,
  getSubscriptionRequestButtonLabel,
  getSubscriptionHeadline,
  getSubscriptionOverview,
  getSubscriptionRequestReference,
  getSubscriptionRequestSummary,
  getSubscriptionRequestTitle,
  getSubscriptionRequestType,
  getSubscriptionRequests,
  getSupportActionLabel,
  getUsageLimit,
  getUsageRatio,
  submitSubscriptionRequest,
  type SupportSubscriptionRequestAction,
  type SubscriptionRequestRecord,
  type SubscriptionOverview,
} from '@/lib/subscriptions'
import type { SubscriptionPaymentMethod, SubscriptionPlan } from '@/types'
import { AlertCircle, CalendarClock, CheckCircle2, Crown, CreditCard, LifeBuoy, Package2, RefreshCw, ShoppingCart, Sparkles, Users } from 'lucide-react'

function LoadingCard() {
  return (
    <Card className="p-4 sm:p-5">
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-32 rounded-full bg-[#2D7D7D]/10" />
        <div className="h-8 w-56 rounded-full bg-[#2D7D7D]/10" />
        <div className="h-4 w-full rounded-full bg-[#2D7D7D]/10" />
        <div className="h-4 w-3/4 rounded-full bg-[#2D7D7D]/10" />
      </div>
    </Card>
  )
}

function UsageCard({
  label,
  value,
  limit,
  tone,
  icon,
}: {
  label: string
  value: number
  limit: number | null
  tone: 'default' | 'warning' | 'danger'
  icon: ReactNode
}) {
  const ratio = getUsageRatio(value, limit)
  const tones = {
    default: 'text-[#1A3636] bg-[#F4F7FB] border-[#2D7D7D]/10',
    warning: 'text-amber-700 bg-amber-500/10 border-amber-500/20',
    danger: 'text-red-700 bg-red-500/10 border-red-500/20',
  }

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6B7682]">{label}</p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
        </div>
        <div className="rounded-2xl bg-white/70 p-3 text-[#2D7D7D] shadow-sm">
          {icon}
        </div>
      </div>
      <div className="mt-3">
        <div className="mb-2 flex items-center justify-between gap-2 text-xs">
          <span className="text-[#6B7682]">
            {limit ? `Limite ${limit}` : 'Illimite'}
          </span>
          <span className="font-medium text-[#1A3636]">
            {limit ? `${ratio}%` : 'Sans plafond'}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/80">
          <div
            className={`h-full rounded-full transition-all ${tone === 'danger' ? 'bg-red-500' : tone === 'warning' ? 'bg-amber-500' : 'bg-[#6C5CE7]'}`}
            style={{ width: `${limit ? ratio : 18}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function getUsageTone(value: number, limit: number | null): 'default' | 'warning' | 'danger' {
  if (!limit) return 'default'
  const ratio = getUsageRatio(value, limit)
  if (ratio >= 100) return 'danger'
  if (ratio >= 80) return 'warning'
  return 'default'
}

type SupportPaymentDraft = {
  method: SubscriptionPaymentMethod | ''
  amount: string
  reference: string
}

const SUBSCRIPTION_PAYMENT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'wave', label: SUBSCRIPTION_PAYMENT_METHOD_LABELS.wave },
  { value: 'orange_money', label: SUBSCRIPTION_PAYMENT_METHOD_LABELS.orange_money },
  { value: 'card', label: SUBSCRIPTION_PAYMENT_METHOD_LABELS.card },
  { value: 'cash', label: SUBSCRIPTION_PAYMENT_METHOD_LABELS.cash },
  { value: 'bank_transfer', label: SUBSCRIPTION_PAYMENT_METHOD_LABELS.bank_transfer },
  { value: 'other', label: SUBSCRIPTION_PAYMENT_METHOD_LABELS.other },
]

export function SubscriptionCenter() {
  const { isAdmin, loading: roleLoading } = useAccountRole()
  const [overview, setOverview] = useState<SubscriptionOverview | null>(null)
  const [requests, setRequests] = useState<SubscriptionRequestRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestFeedback, setRequestFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [requestingPlan, setRequestingPlan] = useState<SubscriptionPlan | null>(null)
  const [supportQueue, setSupportQueue] = useState<SubscriptionRequestRecord[]>([])
  const [supportAccess, setSupportAccess] = useState(false)
  const [supportLoading, setSupportLoading] = useState(true)
  const [supportError, setSupportError] = useState('')
  const [supportFeedback, setSupportFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [supportActionTarget, setSupportActionTarget] = useState<string | null>(null)
  const [supportNotes, setSupportNotes] = useState<Record<string, string>>({})
  const [supportPayments, setSupportPayments] = useState<Record<string, SupportPaymentDraft>>({})

  const loadOverview = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextOverview, nextRequests] = await Promise.all([
        getSubscriptionOverview(),
        getSubscriptionRequests(),
      ])
      setOverview(nextOverview)
      setRequests(nextRequests)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger l'abonnement.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  const loadSupportQueue = useCallback(async () => {
    setSupportLoading(true)
    setSupportError('')
    try {
      const queue = await getSupportSubscriptionRequests()
      if (!queue) {
        setSupportAccess(false)
        setSupportQueue([])
      } else {
        setSupportAccess(true)
        setSupportQueue(queue)
      }
    } catch (loadError) {
      setSupportAccess(false)
      setSupportError(loadError instanceof Error ? loadError.message : 'Impossible de charger la file support.')
    } finally {
      setSupportLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSupportQueue()
  }, [loadSupportQueue])

  const recommendation = useMemo(() => {
    if (!overview) return null
    return getRecommendedPlan(overview.plan, overview.usage)
  }, [overview])

  const primaryRequestPlan = useMemo<SubscriptionPlan>(() => {
    if (!overview) return 'starter'

    if (overview.plan !== 'free' && (overview.status === 'active' || overview.status === 'past_due' || overview.status === 'expired' || overview.status === 'suspended' || overview.status === 'cancelled')) {
      return overview.plan
    }

    return recommendation ?? 'starter'
  }, [overview, recommendation])

  const primaryRequestType = useMemo(() => {
    if (!overview) return 'activation'
    return getSubscriptionRequestType(overview.plan, primaryRequestPlan, overview.status)
  }, [overview, primaryRequestPlan])

  const handleRequestPlan = useCallback(async (plan: SubscriptionPlan) => {
    if (!overview || !isAdmin) return

    setRequestingPlan(plan)
    setRequestFeedback(null)

    try {
      const result = await submitSubscriptionRequest(plan, overview)
      setRequests((current) => {
        const next = [result.request, ...current.filter((entry) => entry.id !== result.request.id)]
        return next
          .sort((left, right) => new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime())
          .slice(0, 5)
      })
      const requestLabel = SUBSCRIPTION_REQUEST_TYPE_LABELS[result.request.requestType].toLowerCase()
      setRequestFeedback({
        type: 'success',
        msg: result.mode === 'existing'
          ? `Une demande de ${requestLabel} est deja en cours. Le mail a ete prepare avec la meme reference.`
          : `Demande de ${requestLabel} enregistree dans la base. Le mail de suivi va s ouvrir.`,
      })
      window.location.href = buildSubscriptionRequestMailto(plan, overview, result.request)
    } catch (requestError) {
      setRequestFeedback({
        type: 'error',
        msg: requestError instanceof Error ? requestError.message : "Impossible d'enregistrer la demande.",
      })
    } finally {
      setRequestingPlan(null)
    }
  }, [isAdmin, overview])

  const handleSupportNoteChange = useCallback((requestId: string, value: string) => {
    setSupportNotes((current) => ({
      ...current,
      [requestId]: value,
    }))
  }, [])

  const getSupportPaymentDraft = useCallback((request: SubscriptionRequestRecord): SupportPaymentDraft => {
    return supportPayments[request.id] ?? {
      method: request.paymentMethod ?? '',
      amount: request.paymentAmount ? String(request.paymentAmount) : '',
      reference: request.paymentReference ?? '',
    }
  }, [supportPayments])

  const handleSupportPaymentChange = useCallback((
    request: SubscriptionRequestRecord,
    field: keyof SupportPaymentDraft,
    value: string
  ) => {
    setSupportPayments((current) => ({
      ...current,
      [request.id]: {
        ...getSupportPaymentDraft(request),
        [field]: value,
      },
    }))
  }, [getSupportPaymentDraft])

  const handleSupportAction = useCallback(async (requestId: string, action: SupportSubscriptionRequestAction) => {
    setSupportActionTarget(requestId)
    setSupportFeedback(null)

    try {
      const supportNote = supportNotes[requestId] ?? ''
      const paymentDraft = supportPayments[requestId]
      const rawAmount = paymentDraft?.amount?.trim() ?? ''
      const parsedAmount = rawAmount.length > 0 ? Number(rawAmount) : null
      const updatedRequest = await applySupportSubscriptionRequestAction(requestId, action, {
        note: supportNote,
        paymentMethod: paymentDraft?.method || null,
        paymentAmount: parsedAmount !== null && Number.isFinite(parsedAmount) ? parsedAmount : null,
        paymentReference: paymentDraft?.reference ?? null,
      })
      setSupportQueue((current) => current.map((entry) => (entry.id === updatedRequest.id ? updatedRequest : entry)))
      setRequests((current) => current.map((entry) => (entry.id === updatedRequest.id ? updatedRequest : entry)))
      setSupportNotes((current) => {
        if (!(requestId in current)) return current
        const next = { ...current }
        delete next[requestId]
        return next
      })
      setSupportPayments((current) => {
        if (!(requestId in current)) return current
        const next = { ...current }
        delete next[requestId]
        return next
      })
      setSupportFeedback({
        type: 'success',
        msg:
          action === 'activate'
            ? `${getSubscriptionRequestTitle(updatedRequest.requestType, updatedRequest.requestedPlan)} traitee et profil mis a jour.`
            : action === 'mark_in_progress'
              ? `La demande de ${SUBSCRIPTION_REQUEST_TYPE_LABELS[updatedRequest.requestType].toLowerCase()} est maintenant en cours.`
              : 'La demande a ete annulee.',
      })
      void loadOverview()
      void loadSupportQueue()
    } catch (actionError) {
      setSupportFeedback({
        type: 'error',
        msg: actionError instanceof Error ? actionError.message : "Impossible de traiter la demande.",
      })
    } finally {
      setSupportActionTarget(null)
    }
  }, [loadOverview, loadSupportQueue, supportNotes, supportPayments])

  if (loading) {
    return (
      <div className="space-y-4">
        <LoadingCard />
        <LoadingCard />
      </div>
    )
  }

  if (!overview) {
    return (
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-red-500/10 p-3 text-red-600">
              <AlertCircle size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#1A3636]">Abonnement indisponible</h3>
              <p className="mt-1 text-sm text-[#6B7682]">{error || "Les informations d'abonnement ne sont pas accessibles pour le moment."}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadOverview()}>
            <RefreshCw size={14} />
            Reessayer
          </Button>
        </div>
      </Card>
    )
  }

  const currentPlan = getPlanDefinition(overview.plan)
  const statusLabel = SUBSCRIPTION_STATUS_LABELS[overview.status]
  const statusClassName = SUBSCRIPTION_STATUS_STYLES[overview.status]
  const remainingTrialDays = getRemainingDays(overview.trialEndsAt)
  const planPrice = formatSubscriptionPrice(overview.plan)
  const startedAt = formatSubscriptionDate(overview.subscriptionStartedAt ?? overview.createdAt)
  const periodEndsAt = formatSubscriptionDate(overview.currentPeriodEndsAt)
  const trialEndsAt = formatSubscriptionDate(overview.trialEndsAt)

  const productLimit = getUsageLimit(overview.plan, 'products')
  const teamLimit = getUsageLimit(overview.plan, 'teamMembers')
  const salesLimit = getUsageLimit(overview.plan, 'monthlySales')

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border border-[#6C5CE7]/15 bg-[linear-gradient(135deg,rgba(108,92,231,0.08),rgba(45,125,125,0.04))] p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClassName}`}>
                {statusLabel}
              </span>
              <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-[#6C5CE7]">
                {currentPlan.name}
              </span>
              {!roleLoading && !isAdmin && (
                <span className="rounded-full bg-[#1A3636]/5 px-3 py-1 text-xs font-semibold text-[#5C6B73]">
                  Lecture seule employe
                </span>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#1A3636]">Centre d&apos;abonnement</h3>
              <p className="mt-1 text-2xl font-bold text-[#1A3636]">{getSubscriptionHeadline(overview)}</p>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#5C6B73]">
                Suivez votre formule, vos limites utiles et la prochaine etape pour continuer la commercialisation de votre boutique sans surprise.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6B7682]">Formule</p>
                <p className="mt-2 text-xl font-bold text-[#1A3636]">{currentPlan.name}</p>
                <p className="mt-1 text-sm text-[#5C6B73]">
                  {planPrice}{currentPlan.price > 0 ? currentPlan.period : ''}
                </p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6B7682]">Cycle</p>
                <p className="mt-2 text-xl font-bold text-[#1A3636]">{BILLING_CYCLE_LABELS[overview.billingCycle]}</p>
                <p className="mt-1 text-sm text-[#5C6B73]">
                  {overview.billingCycle === 'manual' ? 'Activation suivie par support' : 'Renouvellement a la periode'}
                </p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6B7682]">
                  {overview.status === 'trial' ? 'Fin de l essai' : 'Prochaine echeance'}
                </p>
                <p className="mt-2 text-xl font-bold text-[#1A3636]">
                  {overview.status === 'trial' ? (trialEndsAt ?? 'A definir') : (periodEndsAt ?? 'A confirmer')}
                </p>
                <p className="mt-1 text-sm text-[#5C6B73]">
                  {overview.status === 'trial' && remainingTrialDays !== null
                    ? `${Math.max(0, remainingTrialDays)} jour(s) restants`
                    : 'Suivi de renouvellement'}
                </p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6B7682]">Depuis</p>
                <p className="mt-2 text-xl font-bold text-[#1A3636]">{startedAt ?? 'Compte recent'}</p>
                <p className="mt-1 text-sm text-[#5C6B73]">{overview.businessName || 'Votre boutique Saytu Yef'}</p>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 lg:w-[260px]">
            <Button
              variant="primary"
              onClick={() => void handleRequestPlan(primaryRequestPlan)}
              disabled={!isAdmin || requestingPlan !== null}
              fullWidth
            >
              <CreditCard size={16} />
              {requestingPlan === primaryRequestPlan
                ? 'Envoi en cours...'
                : getSubscriptionRequestButtonLabel(primaryRequestType, primaryRequestPlan)}
            </Button>
            <div className="rounded-2xl border border-[#2D7D7D]/10 bg-white/70 px-3 py-2 text-xs text-[#5C6B73]">
              Action preparee: {getSubscriptionRequestSummary(primaryRequestType, overview.plan, primaryRequestPlan)}
            </div>
            <Button
              variant="outline"
              onClick={() => { window.location.href = '/support' }}
              fullWidth
            >
              <LifeBuoy size={16} />
              Contacter le support
            </Button>
            <Button
              variant="ghost"
              onClick={() => void loadOverview()}
              fullWidth
            >
              <RefreshCw size={16} />
              Actualiser
            </Button>
            {requestFeedback && (
              <div
                className={`rounded-2xl border px-3 py-2 text-xs ${
                  requestFeedback.type === 'success'
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700'
                    : 'border-red-500/20 bg-red-500/10 text-red-700'
                }`}
              >
                {requestFeedback.msg}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!overview.hasAdvancedFields && (
          <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
            Les dates fines d&apos;abonnement seront encore plus precises apres la migration de la base locale. L&apos;ecran reste utilisable en attendant.
          </div>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[#1A3636]">Usage de la boutique</h3>
              <p className="mt-1 text-sm text-[#6B7682]">Vos volumes actuels par rapport a la formule en cours.</p>
            </div>
            <div className="rounded-2xl bg-[#6C5CE7]/10 p-3 text-[#6C5CE7]">
              <Sparkles size={18} />
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            <UsageCard
              label="Produits"
              value={overview.usage.products}
              limit={productLimit}
              tone={getUsageTone(overview.usage.products, productLimit)}
              icon={<Package2 size={18} />}
            />
            <UsageCard
              label="Equipe"
              value={overview.usage.teamMembers}
              limit={teamLimit}
              tone={getUsageTone(overview.usage.teamMembers, teamLimit)}
              icon={<Users size={18} />}
            />
            <UsageCard
              label="Ventes / mois"
              value={overview.usage.monthlySales}
              limit={salesLimit}
              tone={getUsageTone(overview.usage.monthlySales, salesLimit)}
              icon={<ShoppingCart size={18} />}
            />
          </div>

          {recommendation && (
            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#6C5CE7]/15 bg-[#6C5CE7]/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1A3636]">Plan conseille: {getPlanDefinition(recommendation).name}</p>
                <p className="mt-1 text-sm text-[#5C6B73]">
                  Votre usage commence a approcher les limites de votre formule actuelle. Vous gagnerez en confort avec le plan au-dessus.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleRequestPlan(recommendation)}
                disabled={!isAdmin || requestingPlan !== null}
              >
                <Crown size={15} />
                {requestingPlan === recommendation ? 'Envoi...' : `Demander ${getPlanDefinition(recommendation).name}`}
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[#1A3636]">Activation et suivi</h3>
              <p className="mt-1 text-sm text-[#6B7682]">Tant que la facturation en ligne n&apos;est pas active, le support valide les changements de formule.</p>
            </div>
            <div className="rounded-2xl bg-[#2D7D7D]/10 p-3 text-[#2D7D7D]">
              <CalendarClock size={18} />
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {[
              'Choisir la formule adaptee a la boutique.',
              'Envoyer la demande au support avec votre plan souhaite.',
              'Confirmer le paiement si necessaire.',
              'Recevoir l activation et la date de prochaine echeance.',
            ].map((step) => (
              <div key={step} className="flex items-start gap-3 rounded-2xl border border-[#2D7D7D]/10 bg-[#F4F7FB] p-3">
                <div className="rounded-full bg-emerald-500/10 p-1 text-emerald-600">
                  <CheckCircle2 size={14} />
                </div>
                <p className="text-sm text-[#1A3636]">{step}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-[#2D7D7D]/10 bg-white/80 p-4">
            <p className="text-sm font-semibold text-[#1A3636]">Note support</p>
            <p className="mt-1 text-sm text-[#5C6B73]">
              {overview.notes || 'Aucune note particuliere pour le moment. Utilisez le support pour les upgrades, les renouvellements et la confirmation de paiement.'}
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-[#2D7D7D]/10 bg-white/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#1A3636]">Demandes enregistrees</p>
                <p className="mt-1 text-sm text-[#5C6B73]">Le suivi reste visible ici meme apres l&apos;envoi de l&apos;email.</p>
              </div>
              <div className="rounded-2xl bg-[#F4F7FB] px-3 py-1 text-xs font-semibold text-[#2D7D7D]">
                {requests.length} suivi(s)
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {requests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#2D7D7D]/15 bg-[#F8FBFC] px-4 py-3 text-sm text-[#6B7682]">
                  Aucune demande d&apos;abonnement enregistree pour le moment.
                </div>
              ) : (
                requests.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-[#1A3636]">
                            {getSubscriptionRequestTitle(request.requestType, request.requestedPlan)}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${SUBSCRIPTION_REQUEST_TYPE_STYLES[request.requestType]}`}>
                            {SUBSCRIPTION_REQUEST_TYPE_LABELS[request.requestType]}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${SUBSCRIPTION_REQUEST_STATUS_STYLES[request.status]}`}>
                            {SUBSCRIPTION_REQUEST_STATUS_LABELS[request.status]}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[#5C6B73]">
                          Ref {getSubscriptionRequestReference(request.id)} - {getSubscriptionRequestSummary(request.requestType, request.currentPlan, request.requestedPlan)}
                        </p>
                        <p className="mt-1 text-xs text-[#5C6B73]">
                          Envoyee le {formatSubscriptionDate(request.createdAt) ?? 'date indisponible'}
                          {request.activatedAt ? ` - Activee le ${formatSubscriptionDate(request.activatedAt)}` : ''}
                        </p>
                      </div>
                      {request.requestedByEmail && (
                        <div className="text-xs text-[#6B7682]">
                          {request.requestedByEmail}
                        </div>
                      )}
                    </div>
                    {(request.supportNote || request.notes) && (
                      <div className="mt-3 rounded-2xl border border-[#2D7D7D]/10 bg-white px-3 py-2 text-xs text-[#5C6B73]">
                        {request.supportNote || request.notes}
                      </div>
                    )}
                    {(request.paymentReference || request.paymentAmount || request.paymentMethod) && (
                      <div className="mt-3 rounded-2xl border border-emerald-500/15 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700">
                        Paiement
                        {request.paymentAmount ? ` ${request.paymentAmount.toLocaleString('fr-FR')} FCFA` : ''}
                        {request.paymentMethod ? ` via ${SUBSCRIPTION_PAYMENT_METHOD_LABELS[request.paymentMethod]}` : ''}
                        {request.paymentReference ? ` - ref ${request.paymentReference}` : ''}
                        {request.paymentConfirmedAt ? ` - confirme le ${formatSubscriptionDate(request.paymentConfirmedAt)}` : ''}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>

      {(supportAccess || supportError) && (
        <Card className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#1A3636]">Console support XELLTEKK</h3>
              <p className="mt-1 text-sm text-[#6B7682]">
                Suivi interne des demandes d&apos;abonnement avec prise en charge et activation manuelle.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => void loadSupportQueue()} disabled={supportLoading}>
              <RefreshCw size={15} />
              Actualiser la file
            </Button>
          </div>

          {supportFeedback && (
            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                supportFeedback.type === 'success'
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700'
                  : 'border-red-500/20 bg-red-500/10 text-red-700'
              }`}
            >
              {supportFeedback.msg}
            </div>
          )}

          {supportError && (
            <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
              {supportError}
            </div>
          )}

          {supportAccess && !supportError && (
            <div className="mt-4 space-y-3">
              {supportLoading ? (
                <div className="rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] px-4 py-4 text-sm text-[#6B7682]">
                  Chargement de la file support...
                </div>
              ) : supportQueue.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#2D7D7D]/15 bg-[#F8FBFC] px-4 py-4 text-sm text-[#6B7682]">
                  Aucune demande support a traiter pour le moment.
                </div>
              ) : (
                supportQueue.map((request) => {
                  const isBusy = supportActionTarget === request.id
                  const canProcess = request.status === 'sent'
                  const canActivate = request.status === 'sent' || request.status === 'in_progress'
                  const canCancel = request.status === 'sent' || request.status === 'in_progress'
                  const paymentDraft = getSupportPaymentDraft(request)
                  const expectedPaymentAmount = getSubscriptionExpectedPaymentAmount(request.requestType, request.requestedPlan)
                  const requiresPaymentProof = doesSubscriptionActivationRequirePayment(request.requestType, request.requestedPlan)
                  const paymentAmount = paymentDraft.amount.trim().length > 0 ? Number(paymentDraft.amount) : null
                  const paymentAmountIsValid = paymentAmount !== null && Number.isFinite(paymentAmount) && paymentAmount > 0
                  const paymentAmountMatchesPlan = expectedPaymentAmount === null || (paymentAmountIsValid && paymentAmount >= expectedPaymentAmount)
                  const paymentReferenceReady = paymentDraft.reference.trim().length >= 4
                  const paymentMethodReady = paymentDraft.method !== ''
                  const activationSecurityReady = !requiresPaymentProof || (paymentReferenceReady && paymentMethodReady && paymentAmountMatchesPlan)

                  return (
                    <div key={request.id} className="rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-semibold text-[#1A3636]">
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
                            Creee le {formatSubscriptionDate(request.createdAt) ?? 'date indisponible'}
                            {request.activatedAt ? ` - Activee le ${formatSubscriptionDate(request.activatedAt)}` : ''}
                          </p>
                          {(request.supportNote || request.notes) && (
                            <div className="mt-3 rounded-2xl border border-[#2D7D7D]/10 bg-white px-3 py-2 text-xs text-[#5C6B73]">
                              {request.supportNote || request.notes}
                            </div>
                          )}
                          {(request.paymentReference || request.paymentAmount || request.paymentMethod) && (
                            <div className="mt-3 rounded-2xl border border-emerald-500/15 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700">
                              Paiement confirme
                              {request.paymentAmount ? ` ${request.paymentAmount.toLocaleString('fr-FR')} FCFA` : ''}
                              {request.paymentMethod ? ` via ${SUBSCRIPTION_PAYMENT_METHOD_LABELS[request.paymentMethod]}` : ''}
                              {request.paymentReference ? ` - ref ${request.paymentReference}` : ''}
                              {request.processedByEmail ? ` - valide par ${request.processedByEmail}` : ''}
                            </div>
                          )}
                          <div className="mt-3">
                            <Textarea
                              rows={3}
                              value={supportNotes[request.id] ?? ''}
                              onChange={(event) => handleSupportNoteChange(request.id, event.target.value)}
                              placeholder="Reference paiement, note support, prochaine echeance..."
                              hint="Cette note sera enregistree sur la demande et recopiee dans le profil lors de l'activation."
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
                              hint={requiresPaymentProof ? 'Requis pour un plan payant' : 'Optionnel pour cette action'}
                            />
                            <Input
                              inputMode="numeric"
                              value={paymentDraft.amount}
                              onChange={(event) => handleSupportPaymentChange(request, 'amount', event.target.value)}
                              placeholder={expectedPaymentAmount ? `${expectedPaymentAmount}` : 'Montant'}
                              hint={expectedPaymentAmount ? `Attendu >= ${expectedPaymentAmount.toLocaleString('fr-FR')} FCFA` : 'Optionnel'}
                            />
                            <Input
                              value={paymentDraft.reference}
                              onChange={(event) => handleSupportPaymentChange(request, 'reference', event.target.value)}
                              placeholder="Reference paiement"
                              hint={requiresPaymentProof ? 'Reference obligatoire avant activation' : 'Optionnel'}
                            />
                          </div>
                          {requiresPaymentProof && !activationSecurityReady && canActivate && (
                            <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
                              Activation bloquee tant que le mode, le montant et la reference de paiement ne sont pas renseignes.
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 lg:w-[330px] lg:justify-end">
                          {canProcess && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleSupportAction(request.id, 'mark_in_progress')}
                              disabled={isBusy}
                            >
                              Prendre en charge
                            </Button>
                          )}
                          {canActivate && (
                            <Button
                              variant="teal"
                              size="sm"
                              onClick={() => void handleSupportAction(request.id, 'activate')}
                              disabled={isBusy || !activationSecurityReady}
                            >
                              {getSupportActionLabel(request.requestType, request.requestedPlan)}
                            </Button>
                          )}
                          {canCancel && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => void handleSupportAction(request.id, 'cancel')}
                              disabled={isBusy}
                            >
                              Annuler
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </Card>
      )}

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#1A3636]">Formules disponibles</h3>
            <p className="mt-1 text-sm text-[#6B7682]">Les limites, les usages et le prochain cran de croissance sont visibles au meme endroit.</p>
          </div>
          {!roleLoading && !isAdmin && (
            <div className="inline-flex items-center gap-2 rounded-full bg-[#1A3636]/5 px-3 py-1.5 text-xs font-medium text-[#5C6B73]">
              <LifeBuoy size={13} />
              Seul un administrateur peut demander un changement de plan
            </div>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-4">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isCurrent = plan.id === overview.plan
            const isRecommended = recommendation === plan.id

            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl border p-5 transition-all ${isCurrent ? 'border-[#6C5CE7] bg-[#6C5CE7]/5 shadow-[0_12px_30px_rgba(108,92,231,0.12)]' : 'border-[#2D7D7D]/10 bg-white'} ${isRecommended ? 'ring-2 ring-[#2D7D7D]/15' : ''}`}
              >
                {plan.popular && (
                  <span className="absolute -top-2 left-5 rounded-full bg-[#6C5CE7] px-3 py-1 text-[10px] font-semibold text-white">
                    Populaire
                  </span>
                )}
                {isRecommended && (
                  <span className="absolute -top-2 right-5 rounded-full bg-[#2D7D7D] px-3 py-1 text-[10px] font-semibold text-white">
                    Conseille
                  </span>
                )}

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-base font-bold text-[#1A3636]">{plan.name}</h4>
                    <p className="mt-1 text-sm text-[#6B7682]">{plan.desc}</p>
                  </div>
                  <div className={`rounded-2xl p-3 ${isCurrent ? 'bg-[#6C5CE7]/10 text-[#6C5CE7]' : 'bg-[#F4F7FB] text-[#2D7D7D]'}`}>
                    <Crown size={18} />
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-3xl font-bold text-[#1A3636]">{formatSubscriptionPrice(plan.id)}</p>
                  <p className="mt-1 text-sm text-[#6B7682]">{plan.price > 0 ? plan.period : plan.period}</p>
                </div>

                <ul className="mt-5 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-[#1A3636]">
                      <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0 text-emerald-600" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 rounded-2xl bg-[#F4F7FB] p-3 text-xs text-[#5C6B73]">
                  {plan.limits.products ? `${plan.limits.products} produits max` : 'Produits illimites'} · {plan.limits.teamMembers ? `${plan.limits.teamMembers} utilisateur(s)` : 'Equipe illimitee'}
                </div>

                <div className="mt-5">
                  {isCurrent ? (
                    <Button variant="glass" fullWidth size="sm" disabled>
                      Plan actuel
                    </Button>
                  ) : (
                    <Button
                      variant={plan.popular ? 'primary' : 'outline'}
                      fullWidth
                      size="sm"
                      disabled={!isAdmin || requestingPlan !== null}
                      onClick={() => void handleRequestPlan(plan.id as SubscriptionPlan)}
                    >
                      {!isAdmin
                        ? 'Admin requis'
                        : requestingPlan === plan.id
                          ? 'Envoi...'
                          : plan.cta}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
