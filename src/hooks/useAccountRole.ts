'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { normalizeAccountRole } from '@/lib/accountRoles'
import type { User } from '@/types'

export function useAccountRole() {
  const [role, setRole] = useState<User['role'] | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (active) setRole(normalizeAccountRole(data?.role))
    }
    void load()
    return () => { active = false }
  }, [])

  return {
    role,
    isAdmin: role === 'admin',
    isCashier: role === 'cashier',
    loading: role === null,
  }
}
