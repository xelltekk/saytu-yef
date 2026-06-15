'use client'
import { useEffect, useState } from 'react'
import { Download, X, Zap } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'saytu-yef-pwa-dismissed-at'
const DISMISS_DAYS = 7

export function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOS, setShowIOS] = useState(false)

  useEffect(() => {
    const nav = navigator as Navigator & { standalone?: boolean }
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
    if (isStandalone) return

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0)
    const dismissDuration = DISMISS_DAYS * 24 * 60 * 60 * 1000
    if (dismissedAt && Date.now() - dismissedAt < dismissDuration) return

    // iOS Safari — pas de beforeinstallprompt
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as { MSStream?: unknown }).MSStream
    if (ios) {
      setIsIOS(true)
      setTimeout(() => setShowIOS(true), 3000)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
      setTimeout(() => setShow(true), 3000)
    }
    const installedHandler = () => {
      setShow(false)
      setShowIOS(false)
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const handleInstall = async () => {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setShow(false)
    setPrompt(null)
  }

  const dismiss = () => {
    setShow(false)
    setShowIOS(false)
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  }

  if (!show && !showIOS) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 lg:left-auto lg:right-6 lg:w-80 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="rounded-2xl border border-[#2D7D7D]/[0.1] bg-white/95 backdrop-blur-xl shadow-[0_16px_48px_rgba(26,54,54,0.18)] p-4">
        <button
          onClick={dismiss}
          aria-label="Fermer"
          className="absolute top-3 right-3 p-1 rounded-lg text-[#6B7682] hover:text-[#1A3636] hover:bg-[#2D7D7D]/[0.06] transition-colors"
        >
          <X size={14} />
        </button>

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2D7D7D] to-[#4FA3A3] flex items-center justify-center flex-shrink-0 shadow-[0_4px_14px_rgba(45,125,125,0.3)]">
            <Zap size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-sm font-semibold text-[#1A3636] leading-tight">Installer Saytu Yëf</p>
            {isIOS ? (
              <p className="text-xs text-[#5C6B73] mt-1 leading-relaxed">
                Appuyez sur <span className="text-[#1A3636] font-medium">Partager</span> puis{' '}
                <span className="text-[#1A3636] font-medium">&laquo; Sur l&apos;écran d&apos;accueil &raquo;</span>
              </p>
            ) : (
              <p className="text-xs text-[#5C6B73] mt-1 leading-relaxed">
                Accédez rapidement à votre caisse et stock depuis l&apos;écran d&apos;accueil
              </p>
            )}
          </div>
        </div>

        {!isIOS && (
          <button
            onClick={handleInstall}
            className="mt-3 flex items-center justify-center gap-2 w-full h-10 rounded-full bg-gradient-to-r from-[#6C5CE7] to-[#8B7DF0] hover:brightness-105 text-white text-sm font-semibold transition-all shadow-[0_4px_14px_rgba(108,92,231,0.3)]"
          >
            <Download size={14} /> Installer l&apos;application
          </button>
        )}
      </div>
    </div>
  )
}
