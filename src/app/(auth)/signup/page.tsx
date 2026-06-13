'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Zap, Mail, Lock, User, Building, Eye, EyeOff, ArrowRight, Check, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/lib/supabase/client'

const PERKS = [
  "14 jours d'essai gratuit",
  'Sans carte bancaire',
  'Wave & Orange Money inclus',
  'Saisie hors ligne depuis l\'étranger',
  'Support en français & Wolof',
]

export default function SignupPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({ fullName: '', businessName: '', email: '', password: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const supabase = createClient()

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName,
          business_name: form.businessName,
        },
      },
    })

    if (error) {
      setError(
        error.message === 'User already registered'
          ? 'Cet email est déjà utilisé. Connectez-vous.'
          : error.message.includes('Password')
          ? 'Le mot de passe doit contenir au moins 6 caractères.'
          : 'Une erreur est survenue. Réessayez.'
      )
      setIsLoading(false)
      return
    }

    setSuccess(true)
    setIsLoading(false)

    // Si confirmation email désactivée dans Supabase, rediriger directement
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  if (success) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-[#f0f2f8] mb-2">Compte créé !</h2>
          <p className="text-[#8892aa] mb-6">
            Vérifiez votre email pour confirmer votre inscription, puis connectez-vous.
          </p>
          <Link href="/login" className="inline-flex items-center gap-2 bg-[#4f6ef7] text-white font-medium px-6 py-3 rounded-xl transition-all hover:bg-[#3d5ce5]">
            Aller à la connexion <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <div className="absolute top-1/4 right-1/4 w-80 h-80 bg-[#8b5cf6]/15 rounded-full blur-[80px] pointer-events-none" />

      <div className="w-full max-w-4xl relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Panneau gauche */}
        <div className="hidden lg:block">
          <div className="inline-flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#4f6ef7] to-[#8b5cf6] flex items-center justify-center shadow-xl shadow-[rgba(79,110,247,0.4)]">
              <Zap size={20} className="text-white" />
            </div>
            <span className="font-bold text-xl text-[#f0f2f8]">Saytu Yëf</span>
          </div>
          <h2 className="text-3xl font-bold text-[#f0f2f8] mb-4 leading-tight">
            Gérez votre stock comme un pro
          </h2>
          <p className="text-[#8892aa] mb-8 leading-relaxed">
            La première application de gestion de stock et de ventes conçue pour les commerçants sénégalais.
          </p>
          <ul className="space-y-3">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-center gap-3 text-sm text-[#8892aa]">
                <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Check size={11} className="text-emerald-400" />
                </div>
                {perk}
              </li>
            ))}
          </ul>
        </div>

        {/* Panneau droit */}
        <div>
          <div className="text-center mb-6 lg:hidden">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4f6ef7] to-[#8b5cf6] flex items-center justify-center">
                <Zap size={18} className="text-white" />
              </div>
              <span className="font-bold text-lg text-[#f0f2f8]">Saytu Yëf</span>
            </Link>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#0d1120] p-6 shadow-2xl shadow-black/40">
            <h1 className="text-xl font-bold text-[#f0f2f8] mb-1">Créer un compte gratuit</h1>
            <p className="text-sm text-[#8892aa] mb-6">14 jours d&apos;essai gratuit, sans carte bancaire</p>

            {error && (
              <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                <AlertCircle size={15} className="flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Prénom & Nom"
                  placeholder="Moussa Diallo"
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  leftAddon={<User size={14} />}
                  required
                />
                <Input
                  label="Nom de l'entreprise"
                  placeholder="Ma Boutique"
                  value={form.businessName}
                  onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                  leftAddon={<Building size={14} />}
                />
              </div>

              <Input
                label="Email"
                type="email"
                placeholder="votre@email.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                leftAddon={<Mail size={14} />}
                required
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#8892aa] uppercase tracking-wider">Mot de passe</label>
                <div className="relative flex items-center">
                  <Lock size={14} className="absolute left-3 text-[#8892aa]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimum 6 caractères"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className="w-full h-10 pl-9 pr-10 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-[#f0f2f8] placeholder:text-[#4a5568] focus:border-[#4f6ef7] transition-all"
                    required
                    minLength={6}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 text-[#8892aa] hover:text-[#f0f2f8] transition-colors">
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <p className="text-xs text-[#8892aa]">
                En créant un compte, vous acceptez nos{' '}
                <a href="#" className="text-[#4f6ef7] hover:underline">Conditions d&apos;utilisation</a>.
              </p>

              <Button variant="primary" fullWidth size="lg" isLoading={isLoading} type="submit">
                Créer mon compte <ArrowRight size={16} />
              </Button>
            </form>
          </div>

          <p className="text-center text-sm text-[#8892aa] mt-5">
            Déjà un compte ?{' '}
            <Link href="/login" className="text-[#4f6ef7] hover:text-[#3d5ce5] font-medium transition-colors">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
