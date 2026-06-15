import Link from 'next/link'
import { Package, RefreshCw, WifiOff } from 'lucide-react'

export const metadata = {
  title: 'Hors ligne - Saytu Yëf',
}

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-[#2D7D7D]/[0.1] bg-white p-6 text-center shadow-[0_18px_56px_rgba(26,54,54,0.12)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2D7D7D]/[0.1] text-[#2D7D7D]">
          <WifiOff size={26} strokeWidth={2.2} />
        </div>

        <h1 className="mt-5 text-xl font-bold text-[#1A3636]">Connexion indisponible</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#5C6B73]">
          Saytu Yëf reste installée sur votre téléphone. Dès que le réseau revient, vos pages et vos données Supabase seront rechargées.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#2D7D7D] to-[#4FA3A3] px-4 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(45,125,125,0.25)] transition-all active:scale-[0.98]"
          >
            <RefreshCw size={16} />
            Réessayer
          </Link>
          <Link
            href="/inventory"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#2D7D7D]/[0.18] px-4 text-sm font-semibold text-[#2D7D7D] transition-all hover:bg-[#2D7D7D]/[0.05]"
          >
            <Package size={16} />
            Stock
          </Link>
        </div>
      </section>
    </main>
  )
}
