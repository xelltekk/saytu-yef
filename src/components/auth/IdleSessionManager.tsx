'use client'

import { useEffect, useRef } from 'react'
import { signOutBrowserSession } from '@/lib/supabase/client'

const IDLE_TIMEOUT_MS = 60 * 60 * 1000
const ACTIVITY_WRITE_THROTTLE_MS = 15 * 1000
const IDLE_CHECK_INTERVAL_MS = 60 * 1000
const LAST_ACTIVITY_KEY = 'saytu-yef:last-activity-at'
const IDLE_LOGOUT_KEY = 'saytu-yef:idle-logout-at'

function readStoredTimestamp(key: string): number {
  if (typeof window === 'undefined') return 0

  const rawValue = window.localStorage.getItem(key)
  const parsedValue = Number(rawValue)
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0
}

export function IdleSessionManager() {
  const logoutStartedRef = useRef(false)
  const lastWriteRef = useRef(0)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const persistActivity = (timestamp: number, force = false) => {
      if (!force && timestamp - lastWriteRef.current < ACTIVITY_WRITE_THROTTLE_MS) {
        return
      }

      lastWriteRef.current = timestamp

      try {
        window.localStorage.setItem(LAST_ACTIVITY_KEY, String(timestamp))
      } catch (error) {
        console.warn('idle_activity_store_failed', error)
      }
    }

    const hasExpired = (timestamp = Date.now()) => {
      const lastActivityAt = readStoredTimestamp(LAST_ACTIVITY_KEY)
      if (!lastActivityAt) return false
      return timestamp - lastActivityAt >= IDLE_TIMEOUT_MS
    }

    const logoutForInactivity = async () => {
      if (logoutStartedRef.current) return
      logoutStartedRef.current = true

      try {
        window.localStorage.removeItem(LAST_ACTIVITY_KEY)
        window.localStorage.setItem(IDLE_LOGOUT_KEY, String(Date.now()))
      } catch (error) {
        console.warn('idle_logout_broadcast_failed', error)
      }

      await signOutBrowserSession('/login?reason=inactive')
    }

    const handleVisibleActivity = () => {
      if (document.visibilityState === 'hidden') return

      const now = Date.now()
      if (hasExpired(now)) {
        void logoutForInactivity()
        return
      }

      persistActivity(now)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return

      const now = Date.now()
      if (hasExpired(now)) {
        void logoutForInactivity()
        return
      }

      persistActivity(now, true)
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === IDLE_LOGOUT_KEY && event.newValue) {
        logoutStartedRef.current = true
        window.location.assign('/login?reason=inactive')
      }
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return
      if (hasExpired()) void logoutForInactivity()
    }, IDLE_CHECK_INTERVAL_MS)

    const passiveEvents: Array<keyof DocumentEventMap> = ['mousemove', 'scroll', 'touchstart']
    const activeEvents: Array<keyof WindowEventMap> = ['keydown', 'focus', 'click']

    passiveEvents.forEach((eventName) => {
      document.addEventListener(eventName, handleVisibleActivity, { passive: true })
    })

    activeEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleVisibleActivity)
    })

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('storage', handleStorage)

    handleVisibilityChange()

    return () => {
      window.clearInterval(intervalId)
      passiveEvents.forEach((eventName) => {
        document.removeEventListener(eventName, handleVisibleActivity)
      })
      activeEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleVisibleActivity)
      })
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  return null
}
