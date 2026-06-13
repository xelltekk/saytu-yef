import Link from 'next/link'
import {
  Package, ShoppingCart, BarChart3, Globe, Zap, Shield, Smartphone,
  ArrowRight, Check, Star, ChevronRight
} from 'lucide-react'

const FEATURES = [
  { icon: <Package size={22} />, title: 'Gestion de Stock', desc: 'Suivez chaque produit en temps réel. Alertes automatiques quand votre stock est faible.', color: '#4f6ef7' },
  { icon: <Globe size={22} />, title: "Saisie depuis l'Étranger", desc: "Enregistrez vos achats en Chine, Dubaï ou ailleurs, même sans connexion. Tout se synchronise à votre retour.", color: '#8b5cf6' },
  { icon: <ShoppingCart size={22} />, title: 'Point de Vente (POS)', desc: 'Interface caisse intuitive pour encaisser rapidement. Wave, Orange Money et espèces acceptés.', color: '#f97316' },
  { icon: <Smartphone size={22} />, title: 'Wave & Orange Money', desc: 'Intégration native des paiements mobiles les plus utilisés au Sénégal.', color: '#10b981' },
  { icon: <BarChart3 size={22} />, title: 'Rapports & Analyses', desc: 'Visualisez vos performances, marges et tendances pour prendre les meilleures décisions.', color: '#06b6d4' },
  { icon: <Shield size={22} />, title: 'Sécurisé & Fiable', desc: 'Vos données sont chiffrées et sauvegardées automatiquement avec Supabase.', color: '#ec4899' },
]

const PLANS = [
  { name: 'Gratuit', price: '0 F', period: 'toujours', desc: 'Pour démarrer votre activité', features: ['50 produits', '10 ventes/mois', '1 utilisateur', 'Rapports basiques'], cta: 'Commencer gratuitement', popular: false },
  { name: 'Starter', price: '9 900 F', period: 'par mois', desc: 'Pour les commerçants actifs', features: ['500 produits', 'Ventes illimitées', '3 utilisateurs', 'Wave & Orange Money', 'Rapports avancés', 'Saisie étranger'], cta: 'Essai gratuit 14 jours', popular: true },
  { name: 'Pro', price: '24 900 F', period: 'par mois', desc: 'Pour les entreprises en croissance', features: ['Produits illimités', 'Ventes illimitées', '10 utilisateurs', 'API access', 'Toutes intégrations', 'Support prioritaire', 'Multi-boutiques'], cta: 'Contacter les ventes', popular: false },
]

const TESTIMONIALS = [
  { name: 'Aminata Diallo', role: 'Commerçante, Marché Sandaga', quote: "Avant Saytu Yëf, je notais tout sur un cahier. Maintenant je sais exactement ce que j'ai en stock et combien je gagne chaque jour.", rating: 5 },
  { name: 'Moussa Ndiaye', role: 'Importateur, Dakar', quote: "La fonctionnalité saisie étranger est incroyable. En Chine, j'enregistre tout sur mon téléphone sans internet. À mon retour, tout est dans mon inventaire.", rating: 5 },
  { name: 'Fatou Sow', role: 'Boutique en ligne & physique', quote: "Le paiement Wave intégré a changé ma façon de travailler. Mes clients paient en quelques secondes et je reçois une confirmation immédiate.", rating: 5 },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen gradient-bg">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#080b14]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#4f6ef7] to-[#8b5cf6] flex items-center justify-center shadow-lg shadow-[rgba(79,110,247,0.4)]">
              <Zap size={16} className="text-white" />
            </div>
            <span className="font-bold text-[#f0f2f8]">Saytu Yëf</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            {['Fonctionnalités', 'Tarifs'].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`} className="text-sm text-[#8892aa] hover:text-[#f0f2f8] transition-colors">{item}</a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="text-sm text-[#8892aa] hover:text-[#f0f2f8] px-3 py-1.5 transition-colors hidden sm:block">Connexion</Link>
            <Link href="/signup" className="text-sm font-medium bg-[#4f6ef7] hover:bg-[#3d5ce5] text-white px-4 py-1.5 rounded-xl transition-all shadow-lg shadow-[rgba(79,110,247,0.3)]">
              Essai gratuit
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-24 px-4">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#4f6ef7]/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-[#8b5cf6]/15 rounded-full blur-[80px] pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#4f6ef7]/30 bg-[#4f6ef7]/5 text-xs font-medium text-[#4f6ef7] mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4f6ef7] animate-pulse" />
            Conçu pour les commerçants sénégalais
          </div>

          <h1 className="text-4xl md:text-6xl font-bold text-[#f0f2f8] leading-tight mb-6">
            Gérez votre stock &amp;{' '}
            <br className="hidden md:block" />
            vos ventes,{' '}
            <span className="gradient-text">en toute simplicité</span>
          </h1>

          <p className="text-lg text-[#8892aa] max-w-2xl mx-auto mb-10 leading-relaxed">
            L&apos;application SaaS pensée pour les commerçants du Sénégal. Wave, Orange Money intégrés.
            Saisie de produits hors ligne depuis l&apos;étranger. Rapports en temps réel.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/signup" className="flex items-center gap-2 bg-[#4f6ef7] hover:bg-[#3d5ce5] text-white font-semibold px-7 py-3.5 rounded-2xl transition-all text-sm shadow-2xl shadow-[rgba(79,110,247,0.4)] hover:shadow-[rgba(79,110,247,0.6)] active:scale-[0.98]">
              Commencer gratuitement <ArrowRight size={16} />
            </Link>
            <Link href="/dashboard" className="flex items-center gap-2 border border-white/[0.1] hover:border-white/[0.2] text-[#f0f2f8] font-medium px-7 py-3.5 rounded-2xl transition-all text-sm hover:bg-white/[0.04]">
              Voir la démo <ChevronRight size={16} />
            </Link>
          </div>
          <p className="text-xs text-[#8892aa] mt-4">Gratuit pendant 14 jours · Sans carte bancaire · Annulation facile</p>
        </div>

        {/* App preview */}
        <div className="max-w-4xl mx-auto mt-16 relative">
          <div className="relative rounded-2xl border border-white/[0.08] bg-[#0d1120] overflow-hidden shadow-2xl shadow-black/50">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
              <div className="mx-auto text-xs text-[#8892aa]">saytu-yef.vercel.app/dashboard</div>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Ventes aujourd'hui", value: '678 500 F', change: '+12%', color: '#4f6ef7' },
                { label: 'Ce mois-ci', value: '14,2M F', change: '+8%', color: '#8b5cf6' },
                { label: 'Produits en stock', value: '1 248', change: '3 alertes', color: '#10b981' },
                { label: 'Bénéfice net', value: '3,8M F', change: '+5%', color: '#f97316' },
              ].map((card) => (
                <div key={card.label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                  <p className="text-[10px] text-[#8892aa] truncate">{card.label}</p>
                  <p className="text-sm font-bold text-[#f0f2f8] mt-0.5">{card.value}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: card.color }}>{card.change}</p>
                </div>
              ))}
            </div>
            <div className="px-4 pb-4">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-xs text-[#8892aa] mb-3">Revenus cette semaine</p>
                <div className="flex items-end gap-1.5 h-16">
                  {[40, 65, 50, 80, 95, 75, 88].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: i === 4 ? '#4f6ef7' : 'rgba(79,110,247,0.2)' }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="absolute inset-x-0 -bottom-6 h-16 bg-gradient-to-t from-[#080b14] to-transparent pointer-events-none" />
        </div>
      </section>

      {/* Features */}
      <section id="fonctionnalités" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-[#f0f2f8] mb-4">Tout ce dont vous avez besoin</h2>
            <p className="text-[#8892aa] max-w-xl mx-auto">Une suite complète d&apos;outils conçus spécifiquement pour les besoins des commerçants sénégalais.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="p-5 rounded-2xl border border-white/[0.06] bg-[#0d1120] hover:border-white/[0.12] hover:bg-[#111827] transition-all duration-300">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${feature.color}15`, color: feature.color }}>
                  {feature.icon}
                </div>
                <h3 className="text-sm font-semibold text-[#f0f2f8] mb-2">{feature.title}</h3>
                <p className="text-sm text-[#8892aa] leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Abroad highlight */}
      <section className="py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#4f6ef7]/5 to-[#8b5cf6]/5" />
        <div className="max-w-6xl mx-auto relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#8b5cf6]/30 bg-[#8b5cf6]/5 text-xs text-[#8b5cf6] mb-6">
                <Globe size={12} /> Fonctionnalité exclusive
              </div>
              <h2 className="text-3xl font-bold text-[#f0f2f8] mb-4">
                Saisissez vos achats depuis{' '}
                <span className="gradient-text">n&apos;importe où dans le monde</span>
              </h2>
              <p className="text-[#8892aa] mb-6 leading-relaxed">
                Vous êtes à Guangzhou, Dubaï ou Istanbul ? Enregistrez vos produits et prix d&apos;achat directement sur votre téléphone, même sans connexion internet.
              </p>
              <ul className="space-y-3">
                {['Saisie hors ligne — données stockées localement', 'Support multi-devises (Yuan, Dirham, Euro...)', 'Synchronisation automatique au retour', 'Ajout du prix de vente en FCFA avant activation'].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-[#8892aa]">
                    <Check size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-3">
              {[
                { flag: '🇨🇳', country: 'Guangzhou, Chine', product: 'Téléphone Xiaomi 14 Pro', price: '2 800 CNY', qty: 10, status: 'Hors ligne', color: 'amber' },
                { flag: '🇦🇪', country: 'Dubaï, Émirats', product: 'Montre Casio G-Shock', price: '180 AED', qty: 15, status: 'Synchronisé', color: 'blue' },
                { flag: '🇹🇷', country: 'Istanbul, Turquie', product: 'Tissu soie premium', price: '850 TRY', qty: 20, status: 'Activé', color: 'emerald' },
              ].map((item) => (
                <div key={item.product} className="flex items-center gap-4 p-4 rounded-2xl border border-white/[0.06] bg-[#0d1120]">
                  <div className="text-3xl">{item.flag}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#8892aa]">{item.country}</p>
                    <p className="text-sm font-medium text-[#f0f2f8] truncate">{item.product}</p>
                    <p className="text-xs text-[#8892aa]">{item.price} · Qté: {item.qty}</p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-1 rounded-md flex-shrink-0 ${item.color === 'amber' ? 'bg-amber-500/10 text-amber-400' : item.color === 'blue' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="tarifs" className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-[#f0f2f8] mb-4">Tarifs simples et transparents</h2>
            <p className="text-[#8892aa]">Commencez gratuitement, évoluez à votre rythme.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map((plan) => (
              <div key={plan.name} className={`relative p-6 rounded-2xl border transition-all ${plan.popular ? 'border-[#4f6ef7] bg-[#4f6ef7]/5 shadow-xl shadow-[rgba(79,110,247,0.15)]' : 'border-white/[0.08] bg-[#0d1120]'}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#4f6ef7] to-[#8b5cf6] text-xs text-white font-medium shadow-lg">
                    Le plus populaire
                  </div>
                )}
                <h3 className="text-sm font-bold text-[#f0f2f8] mb-1">{plan.name}</h3>
                <p className="text-xs text-[#8892aa] mb-4">{plan.desc}</p>
                <div className="mb-6">
                  <span className="text-3xl font-bold text-[#f0f2f8]">{plan.price}</span>
                  {plan.price !== '0 F' && <span className="text-sm text-[#8892aa] ml-1">/{plan.period}</span>}
                </div>
                <ul className="space-y-2.5 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-[#8892aa]">
                      <Check size={14} className="text-emerald-400 flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-all ${plan.popular ? 'bg-[#4f6ef7] hover:bg-[#3d5ce5] text-white shadow-lg shadow-[rgba(79,110,247,0.3)]' : 'border border-white/[0.1] hover:border-white/[0.2] text-[#f0f2f8] hover:bg-white/[0.04]'}`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-[#f0f2f8] mb-4">Ce que disent nos utilisateurs</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="p-5 rounded-2xl border border-white/[0.06] bg-[#0d1120]">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} size={14} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-[#8892aa] leading-relaxed mb-4 italic">&quot;{t.quote}&quot;</p>
                <p className="text-sm font-semibold text-[#f0f2f8]">{t.name}</p>
                <p className="text-xs text-[#8892aa]">{t.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: '500+', label: 'Commerçants actifs' },
              { value: '2M+', label: 'Transactions traitées' },
              { value: '99.9%', label: 'Disponibilité' },
              { value: '4.9/5', label: 'Note utilisateurs' },
            ].map((stat) => (
              <div key={stat.label} className="text-center p-4 rounded-2xl border border-white/[0.06] bg-[#0d1120]">
                <p className="text-2xl font-bold gradient-text">{stat.value}</p>
                <p className="text-xs text-[#8892aa] mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="relative p-10 rounded-3xl border border-[#4f6ef7]/20 bg-gradient-to-br from-[#4f6ef7]/10 to-[#8b5cf6]/10 overflow-hidden">
            <h2 className="text-3xl font-bold text-[#f0f2f8] mb-4">Prêt à digitaliser votre commerce ?</h2>
            <p className="text-[#8892aa] mb-8">Rejoignez des centaines de commerçants sénégalais qui gèrent leur stock avec Saytu Yëf.</p>
            <Link href="/signup" className="inline-flex items-center gap-2 bg-[#4f6ef7] hover:bg-[#3d5ce5] text-white font-semibold px-8 py-4 rounded-2xl transition-all shadow-2xl shadow-[rgba(79,110,247,0.4)] text-sm">
              Commencer gratuitement <ArrowRight size={16} />
            </Link>
            <p className="text-xs text-[#8892aa] mt-4">14 jours d&apos;essai · Sans carte bancaire</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#4f6ef7] to-[#8b5cf6] flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="text-sm font-bold text-[#f0f2f8]">Saytu Yëf</span>
            <span className="text-xs text-[#8892aa]">— «&nbsp;Propre et Bon&nbsp;» en Wolof</span>
          </div>
          <p className="text-xs text-[#8892aa]">© 2024 Saytu Yëf. Fait avec ❤️ pour le Sénégal.</p>
          <div className="flex gap-4 text-xs text-[#8892aa]">
            <a href="#" className="hover:text-[#f0f2f8] transition-colors">Confidentialité</a>
            <a href="#" className="hover:text-[#f0f2f8] transition-colors">CGU</a>
            <a href="#" className="hover:text-[#f0f2f8] transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
