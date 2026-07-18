import Link from 'next/link'
import { AlertTriangle, LifeBuoy, Lock } from 'lucide-react'

export default function AccountStatusPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(108,92,231,0.12),_transparent_44%),linear-gradient(180deg,#F6F8FF_0%,#EEF4FF_100%)] px-4 py-10">
      <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center">
        <div className="w-full rounded-[32px] border border-[#2D7D7D]/10 bg-white/95 p-8 text-center shadow-[0_24px_80px_rgba(26,54,54,0.14)] backdrop-blur">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-600">
            <Lock size={28} />
          </div>

          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700">
            <AlertTriangle size={14} />
            Acces temporairement suspendu
          </div>

          <h1 className="mt-5 text-3xl font-bold text-[#1A3636]">Compte en revue par le support</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#5C6B73] sm:text-base">
            L&apos;acces a cette boutique a ete temporairement suspendu par l&apos;equipe XELLTEKK.
            Contactez le support pour connaitre la prochaine etape et demander la reactivation.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link
              href="/support"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#2D7D7D] to-[#4FA3A3] px-5 text-sm font-semibold text-white shadow-[0_10px_26px_rgba(45,125,125,0.24)]"
            >
              <LifeBuoy size={16} />
              Contacter le support
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-full border border-[#2D7D7D]/15 px-5 text-sm font-semibold text-[#1A3636] transition-colors hover:bg-[#2D7D7D]/5"
            >
              Retour a la connexion
            </Link>
          </div>

          <p className="mt-6 text-xs text-[#6B7682]">
            Support XELLTEKK: contact@xelltekk.com
          </p>
        </div>
      </div>
    </div>
  )
}
