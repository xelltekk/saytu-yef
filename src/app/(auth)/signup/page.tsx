'use client'
import { useState } from 'react'
import Link from 'next/link'
import { TrendingUp, Mail, Lock, User, Building, Eye, EyeOff, ArrowRight, Check, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createClient, syncServerSessionFromBrowser } from '@/lib/supabase/client'
import { getSignupErrorResponse } from '@/lib/authErrors'

const PERKS = [
  'Compte gratuit pour commencer',
  'Sans carte bancaire',
  'Wave & Orange Money inclus',
  'Saisie hors ligne depuis l\'étranger',
  'Support en français & Wolof',
]

const PRIVATE_NETWORK_HOST_PATTERN =
  /^(localhost|127\.0\.0\.1|::1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/i

function isLocalRuntime() {
  if (typeof window === 'undefined') return false

  return (
    window.location.protocol === 'http:' ||
    PRIVATE_NETWORK_HOST_PATTERN.test(window.location.hostname)
  )
}

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({ fullName: '', businessName: '', email: '', password: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      if (isLocalRuntime()) {
        const supabase = createClient()
        const { data, error: signupError } = await supabase.auth.signUp({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          options: {
            data: {
              full_name: form.fullName.trim(),
              business_name: form.businessName.trim() || undefined,
            },
          },
        })

        if (signupError) {
          setError(getSignupErrorResponse(signupError).message)
          return
        }

        if (data.session) {
          await syncServerSessionFromBrowser(supabase)
          window.location.assign('/dashboard')
          return
        }

        setSuccess(true)
        return
      }

      const response = await fetch('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const payload = await response.json() as {
        error?: string
        requiresEmailConfirmation?: boolean
        redirectTo?: string
      }

      if (!response.ok) {
        setError(payload.error ?? 'Une erreur est survenue. Réessayez.')
        return
      }

      if (payload.requiresEmailConfirmation) {
        setSuccess(true)
        return
      }

      window.location.assign(payload.redirectTo ?? '/dashboard')
    } catch {
      setError('Impossible de créer le compte pour le moment. Réessayez.')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-[#1A3636] mb-2">Compte créé !</h2>
          <p className="text-[#5C6B73] mb-6">
            Vérifiez votre email pour confirmer votre inscription, puis connectez-vous.
          </p>
          <Link href="/login" className="inline-flex items-center gap-2 bg-gradient-to-r from-[#6C5CE7] to-[#8B7DF0] text-white font-semibold px-6 py-3 rounded-full transition-all hover:brightness-105 shadow-[0_6px_18px_rgba(108,92,231,0.3)]">
            Aller à la connexion <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <div className="absolute top-1/4 right-1/4 w-80 h-80 bg-[#6C5CE7]/10 rounded-full blur-[80px] pointer-events-none" />

      <div className="w-full max-w-4xl relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Panneau gauche */}
        <div className="hidden lg:block">
          <div className="inline-flex items-center gap-2.5 mb-8">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#2D7D7D] to-[#4FA3A3] flex items-center justify-center shadow-[0_6px_18px_rgba(45,125,125,0.28)]">
              <TrendingUp size={22} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-xl text-[#1A3636]">Saytu Yëf</span>
          </div>
          <h2 className="text-3xl font-bold text-[#1A3636] mb-4 leading-tight">
            Gérez votre stock comme un pro
          </h2>
          <p className="text-[#5C6B73] mb-8 leading-relaxed">
            La première application de gestion de stock et de ventes conçue pour les commerçants sénégalais.
          </p>
          <ul className="space-y-3">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-center gap-3 text-sm text-[#5C6B73]">
                <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Check size={11} className="text-emerald-600" />
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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2D7D7D] to-[#4FA3A3] flex items-center justify-center">
                <TrendingUp size={20} className="text-white" strokeWidth={2.5} />
              </div>
              <span className="font-bold text-lg text-[#1A3636]">Saytu Yëf</span>
            </Link>
          </div>

          <div className="rounded-3xl border border-[#2D7D7D]/[0.08] bg-white p-6 shadow-[0_12px_40px_rgba(26,54,54,0.08)]">
            <h1 className="text-xl font-bold text-[#1A3636] mb-1">Créer un compte gratuit</h1>
            <p className="text-sm text-[#6B7682] mb-6">Commencez gratuitement, sans carte bancaire</p>

            {error && (
              <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-600">
                <AlertCircle size={15} className="flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                autoComplete="email"
                placeholder="votre@email.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                leftAddon={<Mail size={14} />}
                required
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-[#5C6B73] uppercase tracking-[0.06em] ml-1">Mot de passe</label>
                <div className="relative flex items-center">
                  <Lock size={14} className="absolute left-4 text-[#6B7682] z-10" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Minimum 8 caractères"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className="w-full h-12 pl-10 pr-11 rounded-full bg-white border border-[#2D7D7D]/[0.14] text-sm text-[#1A3636] placeholder:text-[#6B7682] focus:border-[#6C5CE7]/60 focus:shadow-[0_0_0_4px_rgba(108,92,231,0.10)] hover:border-[#2D7D7D]/[0.24] transition-all"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 text-[#6B7682] hover:text-[#1A3636] transition-colors z-10"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <p className="text-xs text-[#6B7682]">En créant un compte, vous confirmez que les informations saisies sont exactes.</p>

              <Button variant="primary" fullWidth size="lg" isLoading={isLoading} type="submit">
                Créer mon compte <ArrowRight size={16} />
              </Button>
            </form>
          </div>

          <p className="text-center text-sm text-[#6B7682] mt-5">
            Déjà un compte ?{' '}
            <Link href="/login" className="text-[#6C5CE7] hover:text-[#5A4BD4] font-semibold transition-colors">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
