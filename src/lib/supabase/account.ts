import type { User } from '@supabase/supabase-js'
import { createClient, ensureBrowserSupabaseSession } from './client'

export type AccountProfile = {
  id: string
  role?: string
  account_owner_id?: string | null
  full_name?: string | null
  business_name?: string | null
  business_address?: string | null
  business_logo_url?: string | null
  business_ninea?: string | null
  phone?: string | null
  currency?: string | null
  tax_enabled?: boolean
  [key: string]: unknown
}

let userRequest: Promise<User | null> | null = null
let accountRequest: Promise<{ user: User; member: AccountProfile | null; business: AccountProfile | null }> | null = null
let accountLoadedAt = 0
let generation = 0

export function invalidateAccountContext() {
  generation += 1
  userRequest = null
  accountRequest = null
  accountLoadedAt = 0
}

// Only coalesce overlapping identity checks; never persist credentials or roles.
export function getAuthenticatedUser(): Promise<User | null> {
  if (!userRequest) {
    const request = (async () => {
      const supabase = createClient()
      await ensureBrowserSupabaseSession(supabase)
      const { data, error } = await supabase.auth.getUser()
      if (error) throw error
      return data.user
    })()
    userRequest = request
    void request.finally(() => {
      if (userRequest === request) userRequest = null
    }).catch(() => undefined)
  }
  return userRequest
}

export function getAccountContext() {
  if (accountRequest && Date.now() - accountLoadedAt < 30_000) return accountRequest
  const version = generation
  accountLoadedAt = Infinity
  const request = (async () => {
    const user = await getAuthenticatedUser()
    if (!user) throw new Error('Non connecte')
    const supabase = createClient()
    const memberResult = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    if (memberResult.error) throw memberResult.error
    const member = memberResult.data as AccountProfile | null
    let business = member
    if (member?.account_owner_id && member.account_owner_id !== user.id) {
      const ownerResult = await supabase.from('profiles').select('*').eq('id', member.account_owner_id).maybeSingle()
      if (ownerResult.error) throw ownerResult.error
      business = ownerResult.data as AccountProfile | null
    }
    if (version !== generation) throw new Error('Session modifiee, veuillez reessayer')
    accountLoadedAt = Date.now()
    return { user, member, business }
  })()
  accountRequest = request
  void request.catch(() => {
    if (accountRequest === request) accountRequest = null
  })
  return request
}
