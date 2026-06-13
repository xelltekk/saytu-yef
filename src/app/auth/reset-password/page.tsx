'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Zap, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'
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
    // Supabase injecte la session via le hash de l'URL au chargement
    const supabase = createClient()
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
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
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#4f6ef7]/15 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#4f6ef7] to-[#8b5cf6] flex items-center justify-center shadow-xl shadow-[rgba(79,110,247,0.4)]">
              <Zap size={20} className="text-white" />
            </div>
            <span className="font-bold text-xl text-[#f0f2f8]">Saytu Yëf</span>
          </Link>
          <h1 className="text-2xl font-bold text-[#f0f2f8] mb-2">Nouveau mot de passe</h1>
          <p className="text-sm text-[#8892aa]">Choisissez un mot de passe sécurisé</p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1120] p-6 shadow-2xl shadow-black/40">
          {success ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle size={32} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-[#f0f2f8] font-medium">Mot de passe mis à jour !</p>
                <p className="text-xs text-[#8892aa] mt-1">Redirection vers le tableau de bord…</p>
              </div>
            </div>
          ) : !ready ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
                <Lock size={18} className="text-amber-400" />
              </div>
              <p className="text-sm text-[#8892aa]">Vérification du lien en cours…</p>
              <p className="text-xs text-[#4a5568]">
                Si la page reste bloquée, le lien a peut-être expiré.{' '}
                <Link href="/forgot-password" className="text-[#4f6ef7] hover:underline">Renvoyer un lien</Link>
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                  <AlertCircle size={15} className="flex-shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#8892aa] uppercase tracking-wider">Nouveau mot de passe</label>
                  <div className="relative flex items-center">
                    <Lock size={14} className="absolute left-3 text-[#8892aa]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min. 8 caractères"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      className="w-full h-10 pl-9 pr-10 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-[#f0f2f8] placeholder:text-[#4a5568] focus:border-[#4f6ef7] transition-all"
                      required
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 text-[#8892aa] hover:text-[#f0f2f8] transition-colors">
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {form.password && (
                    <div className="flex gap-1 mt-1">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className={`h-0.5 flex-1 rounded-full transition-colors ${
                          form.password.length > i * 3
                            ? form.password.length >= 12 ? 'bg-emerald-400'
                            : form.password.length >= 8 ? 'bg-amber-400'
                            : 'bg-red-400'
                            : 'bg-white/[0.08]'
                        }`} />
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#8892aa] uppercase tracking-wider">Confirmer le mot de passe</label>
                  <div className="relative flex items-center">
                    <Lock size={14} className="absolute left-3 text-[#8892aa]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Répétez le mot de passe"
                      value={form.confirm}
                      onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
                      className={`w-full h-10 pl-9 pr-4 rounded-xl bg-white/[0.04] border text-sm text-[#f0f2f8] placeholder:text-[#4a5568] focus:border-[#4f6ef7] transition-all ${
                        form.confirm && form.confirm !== form.password ? 'border-red-500/50' : 'border-white/[0.08]'
                      }`}
                      required
                    />
                  </div>
                  {form.confirm && form.confirm === form.password && (
                    <p className="text-xs text-emerald-400 flex items-center gap-1">
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
