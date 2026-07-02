'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { createClient, ensureBrowserSupabaseSession } from '@/lib/supabase/client'

type SessionBootstrapProps = {
  children: ReactNode
  initialAccessToken?: string | null
  initialRefreshToken?: string | null
}

export function SessionBootstrap({
  children,
  initialAccessToken,
  initialRefreshToken,
}: SessionBootstrapProps) {
  const hasServerSession = Boolean(initialAccessToken && initialRefreshToken)
  const [ready, setReady] = useState(hasServerSession)

  useEffect(() => {
    let active = true
    let markedReady = false
    const markReady = () => {
      if (!active || markedReady) return
      markedReady = true
      setReady(true)
    }

    const readyTimeout = window.setTimeout(markReady, 1200)

    const boot = async () => {
      try {
        const supabase = createClient()

        if (initialAccessToken && initialRefreshToken) {
          markReady()
          void ensureBrowserSupabaseSession(supabase)
        } else {
          await ensureBrowserSupabaseSession(supabase)
          markReady()
        }
      } catch (error) {
        console.warn('session_bootstrap_failed', error)
        markReady()
      } finally {
        markReady()
      }
    }

    void boot()

    return () => {
      active = false
      window.clearTimeout(readyTimeout)
    }
  }, [hasServerSession, initialAccessToken, initialRefreshToken])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F9FF] px-4">
        <div className="w-full max-w-sm rounded-3xl border border-[#2D7D7D]/[0.08] bg-white px-6 py-8 text-center shadow-[0_12px_40px_rgba(26,54,54,0.08)]">
          <div className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-2xl bg-[#6C5CE7]/15" />
          <p className="text-sm font-semibold text-[#1A3636]">Connexion locale en cours...</p>
          <p className="mt-2 text-xs text-[#6B7682]">Nous reconnectons la session avant de charger vos donnees.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
