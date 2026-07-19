'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ensureBrowserSupabaseSession, createClient } from '@/lib/supabase/client'
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  loadNotificationPreferences,
  type NotificationPreferences,
} from '@/lib/notificationPreferences'
import type { User } from '@/types'

export type HeaderNotificationTone = 'warning' | 'danger'
export type HeaderNotificationKind = 'stock'

export type HeaderNotificationItem = {
  id: string
  kind: HeaderNotificationKind
  tone: HeaderNotificationTone
  title: string
  message: string
  href: string
  createdAt?: string | null
}

const NOTIFICATION_READ_KEY = 'saytu-yef:header-notifications-read:v1'

type NotificationReadState = {
  readIds: string[]
}

type NotificationStockRow = {
  id: string
  name: string
  quantity: number
  min_quantity: number
  status: 'active' | 'inactive' | 'pending'
  updated_at: string
}

function getReadState(): NotificationReadState {
  if (typeof window === 'undefined') {
    return { readIds: [] }
  }

  try {
    const rawValue = window.localStorage.getItem(NOTIFICATION_READ_KEY)
    if (!rawValue) return { readIds: [] }

    const parsedValue = JSON.parse(rawValue) as Partial<NotificationReadState>
    const readIds = Array.isArray(parsedValue.readIds)
      ? parsedValue.readIds.filter((value): value is string => typeof value === 'string')
      : []

    return { readIds }
  } catch (error) {
    console.warn('header_notifications_read_state_failed', error)
    return { readIds: [] }
  }
}

function saveReadState(readIds: string[]) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(
    NOTIFICATION_READ_KEY,
    JSON.stringify({
      readIds: Array.from(new Set(readIds)).slice(-250),
    } satisfies NotificationReadState)
  )
}

function buildLowStockNotifications(items: NotificationStockRow[]): HeaderNotificationItem[] {
  return items
    .filter((item) => item.status === 'active' && item.quantity <= item.min_quantity)
    .sort((left, right) => left.quantity - right.quantity || left.name.localeCompare(right.name, 'fr'))
    .slice(0, 8)
    .map((item) => ({
      id: `stock:${item.id}:${item.quantity}:${item.min_quantity}`,
      kind: 'stock' as const,
      tone: item.quantity === 0 ? 'danger' as const : 'warning' as const,
      title: item.quantity === 0 ? `Rupture: ${item.name}` : `Stock faible: ${item.name}`,
      message: `${item.quantity} unite(s) restantes pour un seuil minimum de ${item.min_quantity}.`,
      href: '/inventory',
      createdAt: item.updated_at,
    }))
}

export function useNotifications(input: { userId?: string | null; role?: User['role'] | null }) {
  const [items, setItems] = useState<HeaderNotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES)
  const [readIds, setReadIds] = useState<string[]>([])

  useEffect(() => {
    setPreferences(loadNotificationPreferences())
    setReadIds(getReadState().readIds)

    const handleStorage = (event: StorageEvent) => {
      if (event.key === NOTIFICATION_READ_KEY) {
        setReadIds(getReadState().readIds)
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const reload = useCallback(async () => {
    if (!input.userId || !input.role) {
      setItems([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    const nextPreferences = loadNotificationPreferences()
    setPreferences(nextPreferences)

    if (!nextPreferences.lowStock) {
      setItems([])
      setLoading(false)
      return
    }

    const supabase = createClient()

    try {
      await ensureBrowserSupabaseSession(supabase)

      const { data, error: queryError } = await supabase
        .from('products')
        .select('id,name,quantity,min_quantity,status,updated_at')
        .eq('status', 'active')
        .order('quantity', { ascending: true })
        .limit(30)

      if (queryError) throw queryError

      setItems(buildLowStockNotifications((data ?? []) as NotificationStockRow[]))
    } catch (loadError) {
      setItems([])
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les notifications de stock.')
    } finally {
      setLoading(false)
    }
  }, [input.role, input.userId])

  useEffect(() => {
    void reload()
  }, [reload])

  const unreadCount = useMemo(() => {
    return items.filter((item) => !readIds.includes(item.id)).length
  }, [items, readIds])

  const markRead = useCallback((notificationId: string) => {
    setReadIds((current) => {
      if (current.includes(notificationId)) return current
      const next = [...current, notificationId]
      saveReadState(next)
      return next
    })
  }, [])

  const markAllRead = useCallback(() => {
    const ids = items.map((item) => item.id)
    setReadIds((current) => {
      const next = Array.from(new Set([...current, ...ids]))
      saveReadState(next)
      return next
    })
  }, [items])

  return {
    items,
    loading,
    error,
    preferences,
    unreadCount,
    reload,
    markRead,
    markAllRead,
    isRead: (notificationId: string) => readIds.includes(notificationId),
  }
}
