'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Zap, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ email: '', password: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })

    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'Email ou mot de passe incorrect.'
          : error.message === 'Email not confirmed'
          ? 'Veuillez confirmer votre email avant de vous connecter.'
          : 'Une erreur est survenue. Réessayez.'
      )
      setIsLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
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
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#4f6ef7]/15 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#4f6ef7] to-[#8b5cf6] flex items-center justify-center shadow-xl shadow-[rgba(79,110,247,0.4)]">
              <Zap size={20} className="text-white" />
            </div>
            <span className="font-bold text-xl text-[#f0f2f8]">Saytu Yëf</span>
          </Link>
          <h1 className="text-2xl font-bold text-[#f0f2f8] mb-2">Bon retour !</h1>
          <p className="text-sm text-[#8892aa]">Connectez-vous à votre compte</p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1120] p-6 shadow-2xl shadow-black/40">
          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
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
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              leftAddon={<Mail size={14} />}
              required
            />
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[#8892aa] uppercase tracking-wider">Mot de passe</label>
                <Link href="/forgot-password" className="text-xs text-[#4f6ef7] hover:text-[#3d5ce5] transition-colors">
                  Mot de passe oublié ?
                </Link>
              </div>
              <div className="relative flex items-center">
                <Lock size={14} className="absolute left-3 text-[#8892aa]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full h-10 pl-9 pr-10 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-[#f0f2f8] placeholder:text-[#4a5568] focus:border-[#4f6ef7] transition-all"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 text-[#8892aa] hover:text-[#f0f2f8] transition-colors">
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
              <div className="w-full border-t border-white/[0.06]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[#0d1120] px-3 text-[#8892aa]">ou continuer avec</span>
            </div>
          </div>

          <button
            onClick={handleGoogle}
            className="flex items-center justify-center gap-2 w-full h-10 rounded-xl border border-white/[0.08] hover:border-white/[0.16] text-sm text-[#f0f2f8] hover:bg-white/[0.04] transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuer avec Google
          </button>
        </div>

        <p className="text-center text-sm text-[#8892aa] mt-6">
          Pas encore de compte ?{' '}
          <Link href="/signup" className="text-[#4f6ef7] hover:text-[#3d5ce5] font-medium transition-colors">
            Créer un compte gratuit
          </Link>
        </p>
      </div>
    </div>
  )
}
