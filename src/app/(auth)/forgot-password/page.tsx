'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, ArrowRight, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/lib/supabase/client'
import { getPasswordResetRequestErrorMessage } from '@/lib/authErrors'
import { getBrowserEmailRedirectOrigin } from '@/lib/publicSiteUrl'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setIsLoading(true)
    setError('')

    const supabase = createClient()
    const redirectOrigin = getBrowserEmailRedirectOrigin()
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${redirectOrigin}/auth/reset-password`,
    })

    if (error) {
      setError(getPasswordResetRequestErrorMessage(error))
      setIsLoading(false)
      return
    }

    setSent(true)
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#6C5CE7]/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex mb-6">
            <BrandLogo
              variant="full"
              className="h-[112px] w-[148px] sm:h-[124px] sm:w-[170px] drop-shadow-[0_12px_30px_rgba(108,92,231,0.12)]"
              priority
            />
          </Link>
          <h1 className="text-2xl font-bold text-[#1A3636] mb-2">Mot de passe oublie</h1>
          <p className="text-sm text-[#6B7682]">
            {sent ? 'Verifiez votre boite mail' : 'Entrez votre email pour recevoir un lien de reinitialisation'}
          </p>
        </div>

        <div className="rounded-3xl border border-[#2D7D7D]/[0.08] bg-white p-6 shadow-[0_12px_40px_rgba(26,54,54,0.08)]">
          {sent ? (
            <div className="text-center py-4 space-y-5">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle size={32} className="text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-[#1A3636] font-medium mb-1">Email envoye !</p>
                <p className="text-xs text-[#6B7682] leading-relaxed">
                  Un lien de reinitialisation a ete envoye a{' '}
                  <span className="text-[#6C5CE7]">{email}</span>.
                  Verifiez vos spams si vous ne le trouvez pas.
                </p>
              </div>
              <button
                onClick={() => {
                  setSent(false)
                  setEmail('')
                }}
                className="text-xs text-[#6B7682] hover:text-[#1A3636] transition-colors"
              >
                Renvoyer avec une autre adresse
              </button>
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
                <Input
                  label="Adresse email"
                  type="email"
                  autoComplete="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftAddon={<Mail size={14} />}
                  required
                />

                <Button variant="primary" fullWidth size="lg" isLoading={isLoading} type="submit">
                  Envoyer le lien <ArrowRight size={16} />
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-[#6B7682] mt-6">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-[#6C5CE7] hover:text-[#5A4BD4] font-semibold transition-colors"
          >
            <ArrowLeft size={14} /> Retour a la connexion
          </Link>
        </p>
      </div>
    </div>
  )
}
