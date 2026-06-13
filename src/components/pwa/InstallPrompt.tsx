'use client'
import { useEffect, useState } from 'react'
import { Download, X, Zap } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOS, setShowIOS] = useState(false)

  useEffect(() => {
    // Déjà installée
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if (sessionStorage.getItem('pwa-dismissed')) return

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
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
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
    sessionStorage.setItem('pwa-dismissed', '1')
  }

  if (!show && !showIOS) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 lg:left-auto lg:right-6 lg:w-80 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="rounded-2xl border border-white/[0.12] bg-[#0d1120]/95 backdrop-blur-xl shadow-2xl shadow-black/60 p-4">
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 p-1 rounded-lg text-[#8892aa] hover:text-[#f0f2f8] hover:bg-white/[0.06] transition-colors"
        >
          <X size={14} />
        </button>

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4f6ef7] to-[#8b5cf6] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[rgba(79,110,247,0.4)]">
            <Zap size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-sm font-semibold text-[#f0f2f8] leading-tight">Installer Saytu Yëf</p>
            {isIOS ? (
              <p className="text-xs text-[#8892aa] mt-1 leading-relaxed">
                Appuyez sur <span className="text-[#f0f2f8]">Partager</span> puis{' '}
                <span className="text-[#f0f2f8]">&laquo; Sur l&apos;écran d&apos;accueil &raquo;</span>
              </p>
            ) : (
              <p className="text-xs text-[#8892aa] mt-1 leading-relaxed">
                Accédez rapidement à votre caisse et stock depuis l&apos;écran d&apos;accueil
              </p>
            )}
          </div>
        </div>

        {!isIOS && (
          <button
            onClick={handleInstall}
            className="mt-3 flex items-center justify-center gap-2 w-full h-9 rounded-xl bg-[#4f6ef7] hover:bg-[#3d5ce5] text-white text-sm font-medium transition-colors"
          >
            <Download size={14} /> Installer l&apos;application
          </button>
        )}
      </div>
    </div>
  )
}
