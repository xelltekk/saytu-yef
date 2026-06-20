'use client'

import { useEffect, useRef, useState } from 'react'
import { Wifi, WifiOff, X } from 'lucide-react'

export function NetworkStatus() {
  const [online, setOnline] = useState(true)
  const [showRestored, setShowRestored] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const wasOffline = useRef(false)

  useEffect(() => {
    const initialOnline = navigator.onLine
    setOnline(initialOnline)
    wasOffline.current = !initialOnline

    const handleOffline = () => {
      wasOffline.current = true
      setDismissed(false)
      setShowRestored(false)
      setOnline(false)
    }

    const handleOnline = () => {
      setOnline(true)
      if (wasOffline.current) {
        setDismissed(false)
        setShowRestored(true)
      }
      wasOffline.current = false
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  useEffect(() => {
    if (!showRestored) return
    const timer = window.setTimeout(() => setShowRestored(false), 3500)
    return () => window.clearTimeout(timer)
  }, [showRestored])

  if (dismissed || (online && !showRestored)) return null

  const restored = online && showRestored
  return (
    <div
      className="fixed left-3 right-3 z-[70] mx-auto max-w-md"
      style={{ top: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
      role="status"
      aria-live="polite"
    >
      <div className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 shadow-[0_12px_32px_rgba(26,54,54,0.16)] backdrop-blur-xl ${
        restored
          ? 'border-emerald-500/20 bg-emerald-50/95 text-emerald-800'
          : 'border-amber-500/25 bg-amber-50/95 text-amber-800'
      }`}>
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${restored ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
          {restored ? <Wifi size={17} /> : <WifiOff size={17} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{restored ? 'Connexion rétablie' : 'Vous êtes hors ligne'}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed opacity-80">
            {restored ? 'Les données peuvent être actualisées.' : 'Les actions nécessitant Internet sont momentanément indisponibles.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-black/[0.05]"
          aria-label="Fermer l'alerte de connexion"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
