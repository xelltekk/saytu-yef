'use client'

import { useState } from 'react'
import Link from 'next/link'
import { TrendingUp, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/lib/supabase/client'

type LoginResponse = {
  error?: string
  redirectTo?: string
}

const GENERIC_LOGIN_ERROR =
  'Impossible de se connecter pour le moment. Verifiez votre connexion et reessayez.'

function getFriendlyError(message?: string) {
  if (message === 'Invalid login credentials') {
    return 'Email ou mot de passe incorrect.'
  }

  if (message === 'Email not confirmed') {
    return 'Veuillez confirmer votre email avant de vous connecter.'
  }

  return GENERIC_LOGIN_ERROR
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ email: '', password: '' })

  const signInInBrowser = async (redirectPath: string) => {
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })

    if (signInError) {
      setError(getFriendlyError(signInError.message))
      return
    }

    window.location.assign(redirectPath)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const nextPath = new URLSearchParams(window.location.search).get('next')
    const redirectPath = nextPath?.startsWith('/') ? nextPath : '/dashboard'

    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          next: redirectPath,
        }),
      })

      let payload: LoginResponse | null = null

      try {
        payload = (await response.json()) as LoginResponse
      } catch {
        payload = null
      }

      if (!response.ok) {
        if (response.status >= 500) {
          await signInInBrowser(redirectPath)
          return
        }

        setError(payload?.error ?? GENERIC_LOGIN_ERROR)
        return
      }

      window.location.assign(payload?.redirectTo ?? redirectPath)
    } catch {
      await signInInBrowser(redirectPath)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogle = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#6C5CE7]/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-3 mb-4">
            <div className="w-16 h-16 rounded-3xl bg-white flex items-center justify-center shadow-[0_8px_24px_rgba(45,125,125,0.18)] border border-[#2D7D7D]/[0.08]">
              <TrendingUp size={30} className="text-[#2D7D7D]" strokeWidth={2.5} />
            </div>
            <div>
              <span className="block font-bold text-2xl text-[#1A3636]">Saytu Yef</span>
              <span className="block text-sm text-[#2D7D7D] font-medium mt-0.5">
                Gestion intelligente
              </span>
            </div>
          </Link>
          <h1 className="text-xl font-bold text-[#1A3636] mb-1 mt-6">Bon retour !</h1>
          <p className="text-sm text-[#6B7682]">Connectez-vous a votre compte</p>
        </div>

        <div className="rounded-3xl border border-[#2D7D7D]/[0.08] bg-white p-6 shadow-[0_12px_40px_rgba(26,54,54,0.08)]">
          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-600">
              <AlertCircle size={15} className="flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="votre@email.com"
              value={form.email}
              onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
              leftAddon={<Mail size={14} />}
              required
            />
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between ml-1">
                <label className="text-[11px] font-semibold text-[#5C6B73] uppercase tracking-[0.06em]">
                  Mot de passe
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-[#6C5CE7] hover:text-[#5A4BD4] font-medium transition-colors"
                >
                  Mot de passe oublie ?
                </Link>
              </div>
              <div className="relative flex items-center">
                <Lock size={14} className="absolute left-4 text-[#6B7682] z-10" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Saisissez votre mot de passe"
                  value={form.password}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, password: e.target.value }))
                  }
                  className="w-full h-12 pl-10 pr-11 rounded-full bg-white border border-[#2D7D7D]/[0.14] text-sm text-[#1A3636] placeholder:text-[#6B7682] focus:border-[#6C5CE7]/60 focus:shadow-[0_0_0_4px_rgba(108,92,231,0.10)] hover:border-[#2D7D7D]/[0.24] transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 text-[#6B7682] hover:text-[#1A3636] transition-colors z-10"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <Button variant="primary" fullWidth size="lg" isLoading={isLoading} type="submit">
              Se connecter <ArrowRight size={16} />
            </Button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#2D7D7D]/[0.08]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-[#6B7682]">ou continuer avec</span>
            </div>
          </div>

          <button
            onClick={handleGoogle}
            className="flex items-center justify-center gap-2 w-full h-12 rounded-full border border-[#2D7D7D]/[0.14] hover:border-[#2D7D7D]/[0.24] text-sm font-medium text-[#1A3636] hover:bg-[#2D7D7D]/[0.04] transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continuer avec Google
          </button>
        </div>

        <p className="text-center text-sm text-[#6B7682] mt-6">
          Pas encore de compte ?{' '}
          <Link
            href="/signup"
            className="text-[#6C5CE7] hover:text-[#5A4BD4] font-semibold transition-colors"
          >
            Creer un compte gratuit
          </Link>
        </p>
      </div>
    </div>
  )
}
