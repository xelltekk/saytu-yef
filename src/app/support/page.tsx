import Link from 'next/link'
import { ArrowLeft, Bug, CheckCircle2, LifeBuoy, Mail, MessageCircle, Phone, ShieldAlert } from 'lucide-react'

export const dynamic = 'force-dynamic'

const SUPPORT_CHANNELS = [
  {
    icon: <MessageCircle size={22} />,
    title: 'WhatsApp support',
    desc: 'Canal recommandé pour les boutiques pilotes : capture écran, question rapide, blocage pendant une vente.',
    action: 'Configurer le numéro support',
    href: 'mailto:contact@xelltekk.com?subject=Configurer%20WhatsApp%20support%20Saytu%20Yef',
  },
  {
    icon: <Mail size={22} />,
    title: 'Email',
    desc: 'Pour les demandes détaillées, incidents, questions de compte, facturation ou confidentialité.',
    action: 'Envoyer un email',
    href: 'mailto:contact@xelltekk.com?subject=Support%20Saytu%20Yef',
  },
  {
    icon: <Phone size={22} />,
    title: 'Accompagnement pilote',
    desc: 'Pendant la phase pilote, l’installation et les premiers tests peuvent être accompagnés à distance.',
    action: 'Demander un rappel',
    href: 'mailto:contact@xelltekk.com?subject=Rappel%20pilote%20Saytu%20Yef',
  },
]

const BEFORE_CONTACT = [
  'Le nom de la boutique ou l’email du compte.',
  'La page concernée : ventes, stock, clients, fournisseurs, rapports ou paramètres.',
  'Une capture écran si possible.',
  'Ce que vous faisiez juste avant le problème.',
]

const INCIDENTS = [
  {
    title: 'Vente ou dette incorrecte',
    desc: 'Ne supprimez pas la vente. Notez le reçu, le client et le montant, puis contactez le support.',
  },
  {
    title: 'Stock incohérent',
    desc: 'Vérifiez l’historique du produit. Si l’écart reste inexpliqué, envoyez le produit concerné au support.',
  },
  {
    title: 'Problème de connexion',
    desc: 'Essayez de vous reconnecter, puis utilisez la récupération de mot de passe si nécessaire.',
  },
  {
    title: 'Application lente ou indisponible',
    desc: 'Le service est surveillé. Si le problème persiste, envoyez l’heure et la page concernée.',
  },
]

export default function SupportPage() {
  return (
    <main className="min-h-screen gradient-bg px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#2D7D7D] transition-colors hover:text-[#1A3636]">
          <ArrowLeft size={16} /> Retour à l’accueil
        </Link>

        <section className="overflow-hidden rounded-3xl border border-[#2D7D7D]/[0.08] bg-white shadow-[0_18px_50px_rgba(26,54,54,0.08)]">
          <div className="border-b border-[#2D7D7D]/[0.07] bg-[#F4F7FB] p-6 sm:p-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#2D7D7D]/20 bg-white px-3 py-1.5 text-xs font-semibold text-[#2D7D7D]">
              <LifeBuoy size={14} /> Centre support
            </div>
            <h1 className="max-w-3xl text-3xl font-bold leading-tight text-[#1A3636] sm:text-4xl">
              Support Saytu Yëf
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#5C6B73]">
              Une boutique pilote doit pouvoir obtenir de l’aide rapidement. Cette page prépare les canaux,
              les informations à fournir et les premiers réflexes en cas de problème.
            </p>
          </div>

          <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-3">
            {SUPPORT_CHANNELS.map((channel) => (
              <a key={channel.title} href={channel.href} className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white p-5 transition-all hover:border-[#2D7D7D]/[0.18] hover:bg-[#F4F7FB]">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#2D7D7D]/10 text-[#2D7D7D]">
                  {channel.icon}
                </div>
                <h2 className="text-sm font-semibold text-[#1A3636]">{channel.title}</h2>
                <p className="mt-2 min-h-16 text-sm leading-relaxed text-[#5C6B73]">{channel.desc}</p>
                <span className="mt-4 inline-flex text-xs font-semibold text-[#6C5CE7]">{channel.action}</span>
              </a>
            ))}
          </div>

          <div className="grid gap-4 border-t border-[#2D7D7D]/[0.07] p-4 sm:p-6 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-[#F4F7FB] p-5">
              <div className="mb-4 flex items-center gap-3">
                <Bug size={20} className="text-[#6C5CE7]" />
                <h2 className="text-sm font-semibold text-[#1A3636]">Avant de contacter le support</h2>
              </div>
              <ul className="space-y-2">
                {BEFORE_CONTACT.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-[#5C6B73]">
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-[#F4F7FB] p-5">
              <div className="mb-4 flex items-center gap-3">
                <ShieldAlert size={20} className="text-amber-600" />
                <h2 className="text-sm font-semibold text-[#1A3636]">Réflexes en cas d’incident</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {INCIDENTS.map((incident) => (
                  <div key={incident.title} className="rounded-xl bg-white p-4">
                    <p className="text-sm font-semibold text-[#1A3636]">{incident.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-[#5C6B73]">{incident.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
