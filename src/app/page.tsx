import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  ClipboardCheck,
  Globe,
  MessageCircle,
  Package,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Users,
  WalletCards,
  Zap,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const FEATURES = [
  {
    icon: <ShoppingCart size={22} />,
    title: 'Caisse simple',
    desc: 'Enregistrez une vente en quelques secondes, avec paiement complet, partiel ou dette client.',
    color: '#6C5CE7',
  },
  {
    icon: <Package size={22} />,
    title: 'Stock toujours clair',
    desc: 'Le stock baisse après chaque vente, remonte après un remboursement et garde un historique.',
    color: '#2D7D7D',
  },
  {
    icon: <WalletCards size={22} />,
    title: 'Clients & dettes',
    desc: 'Suivez qui doit quoi, ouvrez la vente concernée et encaissez les versements au fil du temps.',
    color: '#F59E0B',
  },
  {
    icon: <ReceiptText size={22} />,
    title: 'Reçus prêts',
    desc: 'Imprimez un reçu propre avec les informations de la boutique, du client et du paiement.',
    color: '#10B981',
  },
  {
    icon: <Globe size={22} />,
    title: 'Achats à l’étranger',
    desc: 'Préparez vos produits importés, convertissez les devises et activez-les dans l’inventaire.',
    color: '#8B7DF0',
  },
  {
    icon: <ShieldCheck size={22} />,
    title: 'Sauvegarde & suivi',
    desc: 'La production est surveillée, avec sauvegardes automatiques de la base de données.',
    color: '#EC4899',
  },
]

const PLANS = [
  {
    name: 'Pilote',
    price: '0 FCFA',
    period: '14 jours',
    desc: 'Pour tester dans une vraie boutique avant abonnement.',
    features: ['Configuration accompagnée', 'Stock et ventes', 'Clients & dettes', 'Support WhatsApp pendant le test'],
    cta: 'Démarrer le pilote',
    href: '/signup',
    popular: false,
  },
  {
    name: 'Starter',
    price: '9 900 FCFA',
    period: 'par mois',
    desc: 'Pour une boutique qui veut gérer son stock au quotidien.',
    features: ['Produits et ventes illimités', 'Reçus et exports', 'Dettes clients', 'Sauvegardes automatiques'],
    cta: 'Créer mon compte',
    href: '/signup',
    popular: true,
  },
  {
    name: 'Pro',
    price: '24 900 FCFA',
    period: 'par mois',
    desc: 'Pour une équipe avec employés, rapports et suivi plus poussé.',
    features: ['Rôles admin/employé', 'Fournisseurs', 'Rapports avancés', 'Accompagnement prioritaire'],
    cta: 'Demander une démo',
    href: 'mailto:contact@xelltekk.com?subject=Démo%20Saytu%20Yef',
    popular: false,
  },
]

const PILOT_STEPS = [
  'Créer le compte de la boutique',
  'Ajouter les premiers produits',
  'Faire 3 à 5 ventes réelles',
  'Tester une dette client et un versement',
  'Vérifier le reçu et le suivi du stock',
]

const FAQS = [
  {
    question: 'Est-ce prêt pour une grande commercialisation ?',
    answer: 'La base produit est prête pour un pilote. Avant une vente massive, il faut encore valider l’usage terrain avec plusieurs boutiques.',
  },
  {
    question: 'Est-ce que ça marche sur téléphone ?',
    answer: 'Oui, l’application est pensée mobile et peut être installée comme PWA. Les tests terrain sur Android restent une étape importante.',
  },
  {
    question: 'Peut-on suivre les dettes clients ?',
    answer: 'Oui. Les ventes partielles restent ouvertes, avec relance client et encaissement des versements.',
  },
  {
    question: 'Les données sont-elles sauvegardées ?',
    answer: 'Oui, la production dispose d’une surveillance et de sauvegardes automatiques côté serveur.',
  },
]

type LandingPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function LandingPage({ searchParams }: LandingPageProps) {
  const resolvedSearchParams = await searchParams
  const code = resolvedSearchParams.code
  const type = resolvedSearchParams.type

  if (typeof code === 'string' && code) {
    const callbackParams = new URLSearchParams()

    for (const [key, value] of Object.entries(resolvedSearchParams)) {
      if (Array.isArray(value)) {
        value.forEach((entry) => callbackParams.append(key, entry))
      } else if (typeof value === 'string') {
        callbackParams.set(key, value)
      }
    }

    if (!callbackParams.get('next') && type === 'recovery') {
      callbackParams.set('next', '/auth/reset-password')
    }

    redirect(`/auth/callback?${callbackParams.toString()}`)
  }

  return (
    <div className="min-h-screen gradient-bg">
      <nav className="sticky top-0 z-50 border-b border-[#2D7D7D]/[0.08] bg-[#EEF1FA]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3 sm:px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2 text-[15px] sm:text-base">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#2D7D7D] to-[#4FA3A3] shadow-lg shadow-[rgba(45,125,125,0.25)]">
              <Zap size={16} className="text-white" />
            </div>
            <span className="truncate font-bold text-[#1A3636]">Saytu Yëf</span>
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            <a href="#fonctionnalites" className="text-sm text-[#6B7682] transition-colors hover:text-[#1A3636]">Fonctionnalités</a>
            <a href="#pilote" className="text-sm text-[#6B7682] transition-colors hover:text-[#1A3636]">Pilote</a>
            <a href="#tarifs" className="text-sm text-[#6B7682] transition-colors hover:text-[#1A3636]">Tarifs</a>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link href="/login" className="inline-flex items-center justify-center whitespace-nowrap rounded-xl border border-[#2D7D7D]/[0.12] bg-white/70 px-2 py-1.5 text-[11px] font-medium text-[#1A3636] transition-colors hover:border-[#2D7D7D]/[0.24] hover:bg-white sm:px-3 sm:text-sm">
              Connexion
            </Link>
            <Link href="/signup" className="inline-flex items-center justify-center whitespace-nowrap rounded-xl bg-[#6C5CE7] px-2.5 py-1.5 text-[11px] font-medium text-white shadow-lg shadow-[rgba(108,92,231,0.3)] transition-all hover:bg-[#5A4BD4] sm:px-4 sm:text-sm">
              Essai gratuit
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:pt-20">
        <div className="pointer-events-none absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-[#6C5CE7]/20 blur-[100px]" />
        <div className="pointer-events-none absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-[#2D7D7D]/15 blur-[90px]" />

        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#2D7D7D]/20 bg-white/70 px-3 py-1.5 text-xs font-medium text-[#2D7D7D]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Version pilote prête pour boutiques test
          </div>

          <h1 className="mx-auto max-w-4xl text-4xl font-bold leading-tight text-[#1A3636] md:text-6xl">
            La gestion de stock simple pour les commerçants sénégalais
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[#6B7682] sm:text-lg">
            Saytu Yëf aide une boutique à vendre, suivre le stock, gérer les dettes clients,
            imprimer des reçus et garder une vue claire sur l’activité.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="flex items-center gap-2 rounded-2xl bg-[#6C5CE7] px-7 py-3.5 text-sm font-semibold text-white shadow-2xl shadow-[rgba(108,92,231,0.35)] transition-all hover:bg-[#5A4BD4] active:scale-[0.98]">
              Démarrer un essai pilote <ArrowRight size={16} />
            </Link>
            <Link href="#pilote" className="flex items-center gap-2 rounded-2xl border border-[#2D7D7D]/[0.14] px-7 py-3.5 text-sm font-medium text-[#1A3636] transition-all hover:border-[#2D7D7D]/[0.24] hover:bg-white/70">
              Voir le plan de test <ChevronRight size={16} />
            </Link>
          </div>

          <p className="mt-4 text-xs text-[#6B7682]">
            Sans carte bancaire · Installation accompagnée · Test conseillé sur téléphone
          </p>
        </div>

        <div className="relative mx-auto mt-14 max-w-5xl">
          <div className="overflow-hidden rounded-3xl border border-[#2D7D7D]/[0.1] bg-white shadow-2xl shadow-[rgba(26,54,54,0.12)]">
            <div className="flex items-center gap-1.5 border-b border-[#2D7D7D]/[0.08] bg-[#F4F7FB] px-4 py-3">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
              <div className="mx-auto text-xs text-[#6B7682]">saytu-yef.xelltekk.com/dashboard</div>
            </div>

            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Ventes du jour', value: 'À suivre', icon: <ShoppingCart size={16} />, color: '#6C5CE7' },
                { label: 'Stock faible', value: 'Alertes', icon: <Package size={16} />, color: '#F59E0B' },
                { label: 'Dettes clients', value: 'Centralisées', icon: <WalletCards size={16} />, color: '#EF4444' },
                { label: 'Reçus', value: 'Imprimables', icon: <ReceiptText size={16} />, color: '#10B981' },
              ].map((card) => (
                <div key={card.label} className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-[#F4F7FB] p-4">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${card.color}18`, color: card.color }}>
                    {card.icon}
                  </div>
                  <p className="text-[10px] uppercase tracking-[0.06em] text-[#6B7682]">{card.label}</p>
                  <p className="mt-1 text-sm font-bold text-[#1A3636]">{card.value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 px-4 pb-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-[#F4F7FB] p-4">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#1A3636]">Flux de vente simplifié</p>
                  <BarChart3 size={18} className="text-[#6C5CE7]" />
                </div>
                <div className="flex h-24 items-end gap-2">
                  {[42, 64, 48, 72, 88, 76, 94].map((height, index) => (
                    <div key={index} className="flex-1 rounded-t-xl bg-[#6C5CE7]/20" style={{ height: `${height}%` }}>
                      <div className="h-full rounded-t-xl bg-[#6C5CE7]" style={{ opacity: index === 6 ? 1 : 0.45 }} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 rounded-2xl border border-[#2D7D7D]/[0.08] bg-[#F4F7FB] p-4">
                {['Vente enregistrée', 'Stock mis à jour', 'Dette client suivie'].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-xl bg-white px-3 py-3">
                    <Check size={16} className="text-emerald-600" />
                    <span className="text-sm text-[#1A3636]">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="fonctionnalites" className="px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-[#1A3636]">Ce que la première version sait déjà faire</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[#6B7682]">
              L’objectif n’est pas de tout compliquer. L’objectif est d’aider une boutique à mieux vendre dès le premier jour.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white p-5 transition-all hover:border-[#2D7D7D]/[0.16] hover:bg-[#F4F7FB]">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `${feature.color}15`, color: feature.color }}>
                  {feature.icon}
                </div>
                <h3 className="text-sm font-semibold text-[#1A3636]">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#6B7682]">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pilote" className="relative overflow-hidden px-4 py-16">
        <div className="absolute inset-0 bg-gradient-to-r from-[#6C5CE7]/5 to-[#2D7D7D]/5" />
        <div className="relative mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#6C5CE7]/20 bg-white/70 px-3 py-1 text-xs font-medium text-[#6C5CE7]">
              <ClipboardCheck size={13} /> Plan pilote recommandé
            </div>
            <h2 className="text-3xl font-bold text-[#1A3636]">Avant de vendre largement, on valide avec quelques boutiques.</h2>
            <p className="mt-4 text-sm leading-relaxed text-[#6B7682]">
              Une commercialisation sérieuse commence par un test terrain. On observe les vrais gestes :
              vendre, corriger une erreur, suivre une dette, imprimer un reçu, utiliser le téléphone en réseau faible.
            </p>
          </div>

          <div className="rounded-3xl border border-[#2D7D7D]/[0.08] bg-white p-5 shadow-xl shadow-[rgba(26,54,54,0.08)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#1A3636]">Checklist d’une boutique pilote</p>
              <Users size={18} className="text-[#2D7D7D]" />
            </div>
            <div className="space-y-2">
              {PILOT_STEPS.map((step, index) => (
                <div key={step} className="flex items-center gap-3 rounded-2xl bg-[#F4F7FB] px-3 py-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2D7D7D] text-xs font-bold text-white">{index + 1}</span>
                  <span className="text-sm text-[#1A3636]">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="tarifs" className="px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-[#1A3636]">Tarifs de lancement</h2>
            <p className="mt-3 text-sm text-[#6B7682]">
              Prix simples pour lancer les premiers clients. À ajuster après retour terrain.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {PLANS.map((plan) => (
              <div key={plan.name} className={`relative rounded-3xl border p-6 transition-all ${plan.popular ? 'border-[#6C5CE7] bg-[#6C5CE7]/5 shadow-xl shadow-[rgba(108,92,231,0.14)]' : 'border-[#2D7D7D]/[0.1] bg-white'}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#6C5CE7] to-[#8B7DF0] px-4 py-1 text-xs font-medium text-white shadow-lg">
                    Offre conseillée
                  </div>
                )}
                <h3 className="text-sm font-bold text-[#1A3636]">{plan.name}</h3>
                <p className="mt-1 min-h-10 text-xs leading-relaxed text-[#6B7682]">{plan.desc}</p>
                <div className="mt-5">
                  <span className="text-3xl font-bold text-[#1A3636]">{plan.price}</span>
                  <p className="mt-1 text-xs text-[#6B7682]">{plan.period}</p>
                </div>
                <ul className="mt-6 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-[#6B7682]">
                      <Check size={14} className="shrink-0 text-emerald-600" /> {feature}
                    </li>
                  ))}
                </ul>
                <Link href={plan.href} className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all ${plan.popular ? 'bg-[#6C5CE7] text-white shadow-lg shadow-[rgba(108,92,231,0.28)] hover:bg-[#5A4BD4]' : 'border border-[#2D7D7D]/[0.14] text-[#1A3636] hover:border-[#2D7D7D]/[0.24] hover:bg-[#F4F7FB]'}`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold text-[#1A3636]">Questions fréquentes</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {FAQS.map((faq) => (
              <div key={faq.question} className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white p-5">
                <h3 className="text-sm font-semibold text-[#1A3636]">{faq.question}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#6B7682]">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto max-w-3xl rounded-3xl border border-[#6C5CE7]/20 bg-gradient-to-br from-[#6C5CE7]/10 to-[#2D7D7D]/10 p-8 text-center sm:p-10">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#6C5CE7] shadow-lg">
            <Smartphone size={24} />
          </div>
          <h2 className="text-3xl font-bold text-[#1A3636]">On peut tester avec une vraie boutique.</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#6B7682]">
            Le meilleur prochain pas : choisir une boutique pilote, créer son compte,
            importer quelques produits et observer une journée de vente réelle.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#6C5CE7] px-7 py-3.5 text-sm font-semibold text-white shadow-2xl shadow-[rgba(108,92,231,0.35)] transition-all hover:bg-[#5A4BD4]">
              Créer un compte pilote <ArrowRight size={16} />
            </Link>
            <Link href="/support" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#2D7D7D]/[0.14] bg-white/60 px-7 py-3.5 text-sm font-medium text-[#1A3636] transition-all hover:bg-white">
              <MessageCircle size={16} /> Contacter l’équipe
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#2D7D7D]/[0.08] px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-[#2D7D7D] to-[#4FA3A3]">
              <Zap size={14} className="text-white" />
            </div>
            <span className="text-sm font-bold text-[#1A3636]">Saytu Yëf</span>
            <span className="text-xs text-[#6B7682]">— gestion simple pour boutiques</span>
          </div>
          <p className="text-xs text-[#6B7682]">© 2026 Saytu Yëf. Version pilote commerciale.</p>
          <div className="flex gap-4 text-xs text-[#6B7682]">
            <Link href="/privacy" className="transition-colors hover:text-[#1A3636]">Confidentialité</Link>
            <Link href="/terms" className="transition-colors hover:text-[#1A3636]">CGU</Link>
            <Link href="/support" className="transition-colors hover:text-[#1A3636]">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
