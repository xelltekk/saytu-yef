'use client'

import { useCallback, useEffect, useState } from 'react'
import { getSubscriptionOverview, type SubscriptionOverview } from '@/lib/subscriptions'

export function useSubscriptionOverview() {
  const [overview, setOverview] = useState<SubscriptionOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getSubscriptionOverview()
      setOverview(data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger l'abonnement.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return {
    overview,
    loading,
    error,
    reload,
  }
}
