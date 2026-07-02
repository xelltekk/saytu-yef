'use client'
import { useEffect, useState } from 'react'
import {
  clearBrowserSupabaseAuthStorage,
  createClient,
  ensureBrowserSupabaseSession,
} from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const supabase = createClient()

    const loadUser = async () => {
      try {
        await ensureBrowserSupabaseSession(supabase)
        const { data, error } = await supabase.auth.getUser()
        if (!active) return

        if (error) {
          console.warn('use_user_get_user_failed', error)
          clearBrowserSupabaseAuthStorage()
          setUser(null)
          return
        }

        setUser(data.user)
      } catch (error) {
        console.warn('use_user_load_failed', error)
        if (!active) return
        clearBrowserSupabaseAuthStorage()
        setUser(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!active) return
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const displayName: string =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Utilisateur'

  const businessName: string =
    user?.user_metadata?.business_name || ''
  const businessAddress: string = user?.user_metadata?.address || ''
  const businessPhone: string = user?.user_metadata?.phone || ''
  const businessNinea: string = user?.user_metadata?.ninea || ''

  const initials: string = displayName
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return {
    user,
    loading,
    displayName,
    businessName,
    businessAddress,
    businessPhone,
    businessNinea,
    initials,
    email: user?.email ?? '',
  }
}
