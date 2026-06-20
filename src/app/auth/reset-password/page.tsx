'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TrendingUp, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (form.password !== form.confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setIsLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: form.password })

    if (error) {
      setError('Erreur lors de la mise à jour. Le lien a peut-être expiré.')
      setIsLoading(false)
      return
    }

    setSuccess(true)
    setIsLoading(false)
    setTimeout(() => router.push('/dashboard'), 2500)
  }

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#6C5CE7]/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#2D7D7D] to-[#4FA3A3] flex items-center justify-center shadow-[0_6px_18px_rgba(45,125,125,0.28)]">
              <TrendingUp size={20} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-xl text-[#1A3636]">Saytu Yëf</span>
          </Link>
          <h1 className="text-2xl font-bold text-[#1A3636] mb-2">Nouveau mot de passe</h1>
          <p className="text-sm text-[#6B7682]">Choisissez un mot de passe sécurisé</p>
        </div>

        <div className="rounded-3xl border border-[#2D7D7D]/[0.08] bg-white p-6 shadow-[0_12px_40px_rgba(26,54,54,0.08)]">
          {success ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle size={32} className="text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-[#1A3636] font-medium">Mot de passe mis à jour !</p>
                <p className="text-xs text-[#6B7682] mt-1">Redirection vers le tableau de bord…</p>
              </div>
            </div>
          ) : !ready ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
                <Lock size={18} className="text-amber-500" />
              </div>
              <p className="text-sm text-[#5C6B73]">Vérification du lien en cours…</p>
              <p className="text-xs text-[#6B7682]">
                Si la page reste bloquée, le lien a peut-être expiré.{' '}
                <Link href="/forgot-password" className="text-[#6C5CE7] hover:underline">Renvoyer un lien</Link>
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-600">
                  <AlertCircle size={15} className="flex-shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-[#5C6B73] uppercase tracking-[0.06em] ml-1">Nouveau mot de passe</label>
                  <div className="relative flex items-center">
                    <Lock size={14} className="absolute left-4 text-[#6B7682] z-10" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Min. 8 caractères"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      className="w-full h-12 pl-10 pr-11 rounded-full bg-white border border-[#2D7D7D]/[0.14] text-sm text-[#1A3636] placeholder:text-[#6B7682] focus:border-[#6C5CE7]/60 focus:shadow-[0_0_0_4px_rgba(108,92,231,0.10)] hover:border-[#2D7D7D]/[0.24] transition-all"
                      required
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
                  {form.password && (
                    <div className="flex gap-1 mt-1 px-1">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                          form.password.length > i * 3
                            ? form.password.length >= 12 ? 'bg-emerald-500'
                            : form.password.length >= 8 ? 'bg-amber-500'
                            : 'bg-red-500'
                            : 'bg-[#2D7D7D]/[0.1]'
                        }`} />
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-[#5C6B73] uppercase tracking-[0.06em] ml-1">Confirmer le mot de passe</label>
                  <div className="relative flex items-center">
                    <Lock size={14} className="absolute left-4 text-[#6B7682] z-10" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Répétez le mot de passe"
                      value={form.confirm}
                      onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
                      className={`w-full h-12 pl-10 pr-4 rounded-full bg-white border text-sm text-[#1A3636] placeholder:text-[#6B7682] focus:border-[#6C5CE7]/60 focus:shadow-[0_0_0_4px_rgba(108,92,231,0.10)] transition-all ${
                        form.confirm && form.confirm !== form.password ? 'border-red-500/50' : 'border-[#2D7D7D]/[0.14]'
                      }`}
                      required
                    />
                  </div>
                  {form.confirm && form.confirm === form.password && (
                    <p className="text-xs text-emerald-600 flex items-center gap-1 ml-1">
                      <CheckCircle size={11} /> Les mots de passe correspondent
                    </p>
                  )}
                </div>

                <Button variant="primary" fullWidth size="lg" isLoading={isLoading} type="submit">
                  Mettre à jour le mot de passe
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
