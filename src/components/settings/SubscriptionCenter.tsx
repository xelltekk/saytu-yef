'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useAccountRole } from '@/hooks/useAccountRole'
import {
  BILLING_CYCLE_LABELS,
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_STYLES,
  buildSubscriptionRequestMailto,
  formatSubscriptionDate,
  formatSubscriptionPrice,
  getPlanDefinition,
  getRecommendedPlan,
  getRemainingDays,
  getSubscriptionHeadline,
  getSubscriptionOverview,
  getUsageLimit,
  getUsageRatio,
  type SubscriptionOverview,
} from '@/lib/subscriptions'
import type { SubscriptionPlan } from '@/types'
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

export function SubscriptionCenter() {
  const { isAdmin, loading: roleLoading } = useAccountRole()
  const [overview, setOverview] = useState<SubscriptionOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadOverview = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const nextOverview = await getSubscriptionOverview()
      setOverview(nextOverview)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger l'abonnement.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  const recommendation = useMemo(() => {
    if (!overview) return null
    return getRecommendedPlan(overview.plan, overview.usage)
  }, [overview])

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
              onClick={() => { window.location.href = buildSubscriptionRequestMailto(recommendation ?? 'starter', overview) }}
              disabled={!isAdmin}
              fullWidth
            >
              <CreditCard size={16} />
              {recommendation ? `Demander ${getPlanDefinition(recommendation).name}` : 'Demander une activation'}
            </Button>
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
                onClick={() => { window.location.href = buildSubscriptionRequestMailto(recommendation, overview) }}
                disabled={!isAdmin}
              >
                <Crown size={15} />
                Demander {getPlanDefinition(recommendation).name}
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
        </Card>
      </div>

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
                      disabled={!isAdmin}
                      onClick={() => { window.location.href = buildSubscriptionRequestMailto(plan.id as SubscriptionPlan, overview) }}
                    >
                      {isAdmin ? plan.cta : 'Admin requis'}
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
