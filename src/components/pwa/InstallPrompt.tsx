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
  const [isIOSSafari, setIsIOSSafari] = useState(false)
  const [showIOS, setShowIOS] = useState(false)

  useEffect(() => {
    const nav = navigator as Navigator & { standalone?: boolean }
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
    if (isStandalone) return

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0)
    const dismissDuration = DISMISS_DAYS * 24 * 60 * 60 * 1000
    if (dismissedAt && Date.now() - dismissedAt < dismissDuration) return

    const ios =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !(window as { MSStream?: unknown }).MSStream
    const iosSafari =
      ios &&
      /safari/i.test(navigator.userAgent) &&
      !/crios|fxios|edgios|opios/i.test(navigator.userAgent)

    if (ios) {
      setIsIOS(true)
      setIsIOSSafari(iosSafari)
      setTimeout(() => setShowIOS(true), 3000)
      return
    }

    const handler = (event: Event) => {
      event.preventDefault()
      setPrompt(event as BeforeInstallPromptEvent)
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
    if (outcome === 'accepted') {
      setShow(false)
    }
    setPrompt(null)
  }

  const dismiss = () => {
    setShow(false)
    setShowIOS(false)
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  }

  if (!show && !showIOS) return null

  return (
    <div className="animate-in slide-in-from-bottom-4 fixed bottom-20 left-4 right-4 z-50 duration-300 lg:left-auto lg:right-6 lg:w-80">
      <div className="rounded-2xl border border-[#2D7D7D]/[0.1] bg-white/95 p-4 shadow-[0_16px_48px_rgba(26,54,54,0.18)] backdrop-blur-xl">
        <button
          onClick={dismiss}
          aria-label="Fermer"
          className="absolute right-3 top-3 rounded-lg p-1 text-[#6B7682] transition-colors hover:bg-[#2D7D7D]/[0.06] hover:text-[#1A3636]"
        >
          <X size={14} />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2D7D7D] to-[#4FA3A3] shadow-[0_4px_14px_rgba(45,125,125,0.3)]">
            <Zap size={18} className="text-white" />
          </div>
          <div className="min-w-0 flex-1 pr-4">
            <p className="text-sm font-semibold leading-tight text-[#1A3636]">
              Installer Saytu Yef
            </p>
            {isIOS ? (
              <p className="mt-1 text-xs leading-relaxed text-[#5C6B73]">
                {isIOSSafari ? (
                  <>
                    Appuyez sur <span className="font-medium text-[#1A3636]">Partager</span> puis{' '}
                    <span className="font-medium text-[#1A3636]">
                      &quot;Sur l&apos;ecran d&apos;accueil&quot;
                    </span>
                  </>
                ) : (
                  <>
                    Pour installer sur iPhone, ouvrez cette page dans{' '}
                    <span className="font-medium text-[#1A3636]">Safari</span>, puis utilisez{' '}
                    <span className="font-medium text-[#1A3636]">Partager</span>.
                  </>
                )}
              </p>
            ) : (
              <p className="mt-1 text-xs leading-relaxed text-[#5C6B73]">
                Accedez rapidement a votre caisse et a votre stock depuis l&apos;ecran
                d&apos;accueil
              </p>
            )}
          </div>
        </div>

        {!isIOS && (
          <button
            onClick={handleInstall}
            className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#6C5CE7] to-[#8B7DF0] text-sm font-semibold text-white shadow-[0_4px_14px_rgba(108,92,231,0.3)] transition-all hover:brightness-105"
          >
            <Download size={14} />
            Installer l&apos;application
          </button>
        )}
      </div>
    </div>
  )
}
