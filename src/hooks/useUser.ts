'use client'
import { useEffect } from 'react'
import { startAccountSubscription, useAccountStore } from '@/store/accountStore'

export function useUser() {
  const { user, business, loading } = useAccountStore()

  useEffect(() => {
    startAccountSubscription()
  }, [])

  const displayName: string =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Utilisateur'

  const isOwnBusiness = !business || business.id === user?.id
  const businessName: string =
    business?.business_name ?? (isOwnBusiness ? user?.user_metadata?.business_name : '') ?? ''
  const businessAddress: string = business?.business_address ?? (isOwnBusiness ? user?.user_metadata?.address : '') ?? ''
  const businessPhone: string = business?.phone ?? (isOwnBusiness ? user?.user_metadata?.phone : '') ?? ''
  const businessNinea: string = business?.business_ninea ?? (isOwnBusiness ? user?.user_metadata?.ninea : '') ?? ''
  const businessLogoUrl: string = business?.business_logo_url ?? ''

  const initials: string = displayName
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return {
    user,
    accountOwnerId: business?.id ?? user?.id,
    loading,
    displayName,
    businessName,
    businessAddress,
    businessPhone,
    businessNinea,
    businessLogoUrl,
    initials,
    email: user?.email ?? '',
  }
}
