'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-[70dvh] items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg rounded-[28px] border border-red-500/15 bg-white p-6 text-center shadow-[0_18px_50px_rgba(26,54,54,0.10)] sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-600">
          <AlertTriangle size={30} />
        </div>

        <h1 className="mt-5 text-xl font-bold text-[#1A3636] sm:text-2xl">
          Un problème est survenu
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-[#5C6B73]">
          Vos données ne sont pas perdues. Vous pouvez relancer cet écran ou revenir au tableau de bord.
        </p>

        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={reset} leftIcon={<RefreshCw size={16} />}>
            Réessayer
          </Button>
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#2D7D7D]/25 px-6 text-sm font-semibold text-[#2D7D7D] transition-colors hover:bg-[#2D7D7D]/5"
          >
            <Home size={16} />
            Tableau de bord
          </Link>
        </div>
      </div>
    </main>
  )
}
