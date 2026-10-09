'use client'

import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { getAccountContext, invalidateAccountContext, type AccountProfile } from '@/lib/supabase/account'

type AccountState = {
  user: User | null
  member: AccountProfile | null
  business: AccountProfile | null
  loading: boolean
  error: string
}

export const useAccountStore = create<AccountState>(() => ({
  user: null, member: null, business: null, loading: true, error: '',
}))

let request: Promise<void> | null = null
let started = false
let generation = 0

export function refreshAccount(force = false) {
  if (force) {
    generation += 1
    request = null
    invalidateAccountContext()
  }
  if (request) return request
  const version = generation
  const pending = getAccountContext().then((context) => {
    if (version === generation) useAccountStore.setState({ ...context, loading: false, error: '' })
  }).catch((error: unknown) => {
    if (version === generation) useAccountStore.setState({ loading: false, error: error instanceof Error ? error.message : 'Profil indisponible' })
  }).finally(() => {
    if (request === pending) request = null
  })
  request = pending
  return pending
}

export function startAccountSubscription() {
  if (started) return
  started = true
  const supabase = createClient()
  supabase.auth.onAuthStateChange((event, session) => {
    const current = useAccountStore.getState().user
    if (event === 'SIGNED_OUT' || (session && current && session.user.id !== current.id)) {
      generation += 1
      request = null
      invalidateAccountContext()
      useAccountStore.setState({ user: null, member: null, business: null, loading: Boolean(session), error: '' })
    }
    if (session && (event === 'USER_UPDATED' || !current || session.user.id !== current.id)) {
      if (event !== 'INITIAL_SESSION') {
        generation += 1
        request = null
        invalidateAccountContext()
      }
      useAccountStore.setState({ user: session.user })
      // Supabase callbacks must not await other auth calls while its lock is held.
      window.setTimeout(() => void refreshAccount(), 0)
    }
  })
  window.addEventListener('focus', () => {
    void refreshAccount(true)
  })
  void refreshAccount()
}
