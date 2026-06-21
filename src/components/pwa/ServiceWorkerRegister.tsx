'use client'

import { useEffect, useRef, useState } from 'react'

type WorkboxWindow = Window & {
  workbox?: {
    register: () => Promise<ServiceWorkerRegistration | undefined>
  }
}

export function ServiceWorkerRegister() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const [registrationError, setRegistrationError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const refreshing = useRef(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const shouldRegisterWorker =
      process.env.NODE_ENV === 'production' &&
      (window.location.protocol === 'https:' || window.location.hostname === 'localhost')

    const cleanupLegacyPwa = async () => {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))

      if ('caches' in window) {
        const cacheKeys = await caches.keys()
        await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)))
      }

      if (navigator.serviceWorker.controller) {
        window.location.reload()
      }
    }

    if (!shouldRegisterWorker) {
      cleanupLegacyPwa().catch((error) => console.error(error))
      return
    }

    const onControllerChange = () => {
      if (refreshing.current) return
      refreshing.current = true
      window.location.reload()
    }

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    const trackWaitingWorker = (registration?: ServiceWorkerRegistration) => {
      if (!registration) return

      if (registration.waiting) {
        setWaitingWorker(registration.waiting)
      }

      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing
        if (!installingWorker) return

        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(installingWorker)
          }
        })
      })
    }

    const registerWorker = async () => {
      setRegistrationError('')
      const workbox = (window as WorkboxWindow).workbox

      if (workbox) {
        trackWaitingWorker(await workbox.register())
        return
      }

      trackWaitingWorker(await navigator.serviceWorker.register('/sw.js'))
    }

    const handleRegistrationError = (error: unknown) => {
      console.error(error)
      setRegistrationError(
        error instanceof Error
          ? error.message
          : 'Le mode hors ligne n’a pas pu être activé.'
      )
    }

    const checkForUpdate = () => {
      navigator.serviceWorker.getRegistration()
        .then((registration) => registration?.update())
        .catch(handleRegistrationError)
    }

    registerWorker().catch(handleRegistrationError)
    window.addEventListener('online', checkForUpdate)

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      window.removeEventListener('online', checkForUpdate)
    }
  }, [retryKey])

  useEffect(() => {
    if (!waitingWorker) return
    if (window.location.pathname !== '/offline') return

    waitingWorker.postMessage({ type: 'SKIP_WAITING' })
  }, [waitingWorker])

  if (!waitingWorker && !registrationError) return null

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[60] lg:left-auto lg:right-6 lg:w-96">
      <div className="rounded-2xl border border-[#2D7D7D]/[0.12] bg-white/95 p-4 shadow-[0_16px_48px_rgba(26,54,54,0.18)] backdrop-blur-xl">
        {waitingWorker ? (
          <>
            <p className="text-sm font-semibold text-[#1A3636]">Nouvelle version disponible</p>
            <p className="mt-1 text-xs leading-relaxed text-[#5C6B73]">
              Mettez à jour Saytu Yëf quand vous avez terminé l&apos;action en cours. Le panier sera conservé.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => waitingWorker.postMessage({ type: 'SKIP_WAITING' })}
                className="h-9 flex-1 rounded-full bg-gradient-to-r from-[#2D7D7D] to-[#4FA3A3] px-4 text-xs font-semibold text-white shadow-[0_6px_18px_rgba(45,125,125,0.25)] transition-all active:scale-[0.98]"
              >
                Mettre à jour
              </button>
              <button
                type="button"
                onClick={() => setWaitingWorker(null)}
                className="h-9 rounded-full border border-[#2D7D7D]/[0.18] px-4 text-xs font-semibold text-[#5C6B73] transition-all hover:bg-[#2D7D7D]/[0.05]"
              >
                Plus tard
              </button>
            </div>
          </>
        ) : (
          <div role="alert">
            <p className="text-sm font-semibold text-red-700">Mode hors ligne indisponible</p>
            <p className="mt-1 break-words text-xs leading-relaxed text-red-600">{registrationError}</p>
            <button
              type="button"
              onClick={() => setRetryKey((current) => current + 1)}
              className="mt-3 h-9 rounded-full border border-red-500/25 px-4 text-xs font-semibold text-red-700 transition-colors hover:bg-red-500/5"
            >
              Réessayer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
