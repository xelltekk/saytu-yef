'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useAccountRole() {
  const [role, setRole] = useState<'admin' | 'employee' | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (active) setRole(data?.role === 'employee' ? 'employee' : 'admin')
    }
    void load()
    return () => { active = false }
  }, [])

  return { role, isAdmin: role === 'admin', loading: role === null }
}
