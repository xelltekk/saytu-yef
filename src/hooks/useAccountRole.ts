'use client'

import { useEffect } from 'react'
import { startAccountSubscription, useAccountStore } from '@/store/accountStore'
import { normalizeAccountRole } from '@/lib/accountRoles'

export function useAccountRole() {
  const { member, loading, error } = useAccountStore()
  const role = member ? normalizeAccountRole(member.role) : null

  useEffect(() => {
    startAccountSubscription()
  }, [])

  return {
    role,
    isAdmin: role === 'admin',
    isCashier: role === 'cashier',
    loading,
    error,
  }
}
