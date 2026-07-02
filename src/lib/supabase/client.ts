import { createBrowserClient } from '@supabase/ssr'
import type { Session, SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null
let browserSessionSync: Promise<boolean> | null = null

const SESSION_CHECK_TIMEOUT_MS = 1500
const SESSION_APPLY_TIMEOUT_MS = 2000
const SERVER_SESSION_SYNC_TIMEOUT_MS = 2500

function getSessionCheckTimeout<T>(fallback: T, timeoutMs = SESSION_CHECK_TIMEOUT_MS) {
  return new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(fallback), timeoutMs)
  })
}

function getSupabaseProjectRef(): string {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!rawUrl) return ''

  try {
    return new URL(rawUrl).hostname.split('.')[0] ?? ''
  } catch {
    return ''
  }
}

function getSupabaseAuthPrefixes(): string[] {
  const projectRef = getSupabaseProjectRef()
  if (!projectRef) return []

  return [
    `sb-${projectRef}-auth-token`,
    `sb-${projectRef}-auth-token-code-verifier`,
  ]
}

function matchesSupabasePrefix(key: string, prefixes: string[]) {
  return prefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}.`))
}

function clearBrowserSupabaseAuthLocalStorage() {
  if (typeof window === 'undefined') return

  const prefixes = getSupabaseAuthPrefixes()
  if (prefixes.length === 0) return

  Object.keys(window.localStorage)
    .filter((key) => matchesSupabasePrefix(key, prefixes))
    .forEach((key) => {
      window.localStorage.removeItem(key)
    })
}

async function getCurrentBrowserSession(supabase: SupabaseClient): Promise<Session | null> {
  if (typeof window === 'undefined') return null

  try {
    const timeoutFallback = Symbol('session-timeout')
    const result = await Promise.race([
      supabase.auth.getSession(),
      getSessionCheckTimeout(timeoutFallback),
    ])

    if (result === timeoutFallback) return null
    return result.data.session ?? null
  } catch (error) {
    console.warn('browser_session_read_failed', error)
    return null
  }
}

async function hydrateBrowserSessionFromServer(supabase: SupabaseClient): Promise<boolean> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), 2000)

  let response: Response

  try {
    response = await fetch('/api/auth/session', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return false
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }

  if (response.status === 204) return false
  if (!response.ok) return false

  const payload = (await response.json()) as {
    accessToken?: string
    refreshToken?: string
  }

  if (!payload.accessToken || !payload.refreshToken) return false

  clearBrowserSupabaseAuthLocalStorage()

  const sessionApplyTimeout = Symbol('session-apply-timeout')
  const result = await Promise.race([
    supabase.auth.setSession({
      access_token: payload.accessToken,
      refresh_token: payload.refreshToken,
    }),
    getSessionCheckTimeout(sessionApplyTimeout, SESSION_APPLY_TIMEOUT_MS),
  ])

  if (result === sessionApplyTimeout) {
    console.warn('browser_session_apply_timed_out')
    return false
  }

  if (result.error) throw result.error
  return !!result.data.session
}

async function pushBrowserSessionToServer(session: Session): Promise<boolean> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), SERVER_SESSION_SYNC_TIMEOUT_MS)

  try {
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
      }),
    })

    return response.ok
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return false
    }

    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export function clearBrowserSupabaseAuthStorage() {
  if (typeof window === 'undefined') return

  const prefixes = getSupabaseAuthPrefixes()
  if (prefixes.length === 0) return

  const cookieNames = document.cookie
    .split(';')
    .map((entry) => entry.trim().split('=')[0])
    .filter(Boolean)

  cookieNames
    .filter((name) => matchesSupabasePrefix(name, prefixes))
    .forEach((name) => {
      document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`
    })

  clearBrowserSupabaseAuthLocalStorage()
}

export async function ensureBrowserSupabaseSession(
  supabase: SupabaseClient = createClient()
): Promise<boolean> {
  if (typeof window === 'undefined') return true

  const currentSession = await getCurrentBrowserSession(supabase)
  if (currentSession?.access_token) return true

  if (!browserSessionSync) {
    browserSessionSync = hydrateBrowserSessionFromServer(supabase)
      .catch((error) => {
        console.warn('browser_session_sync_failed', error)
        clearBrowserSupabaseAuthStorage()
        return false
      })
      .finally(() => {
        browserSessionSync = null
      })
  }

  return browserSessionSync
}

export async function syncServerSessionFromBrowser(
  supabase: SupabaseClient = createClient()
): Promise<boolean> {
  if (typeof window === 'undefined') return true

  const currentSession = await getCurrentBrowserSession(supabase)
  if (!currentSession?.access_token || !currentSession.refresh_token) return false

  try {
    return await pushBrowserSessionToServer(currentSession)
  } catch (error) {
    console.warn('server_session_sync_failed', error)
    return false
  }
}

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  return browserClient
}
