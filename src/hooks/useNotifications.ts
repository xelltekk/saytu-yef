'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ensureBrowserSupabaseSession, createClient } from '@/lib/supabase/client'
import {
  getPlanDefinition,
  getSubscriptionRequestTitle,
  getSubscriptionRequests,
  SUBSCRIPTION_REQUEST_STATUS_LABELS,
  type SubscriptionRequestRecord,
} from '@/lib/subscriptions'
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  loadNotificationPreferences,
  type NotificationPreferences,
} from '@/lib/notificationPreferences'
import type { User } from '@/types'

export type HeaderNotificationTone = 'info' | 'success' | 'warning' | 'danger'
export type HeaderNotificationKind = 'stock' | 'sale' | 'debt' | 'report' | 'abroad' | 'subscription'

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

type NotificationSaleRow = {
  id: string
  total: number | string
  amount_due?: number | string | null
  payment_status: 'completed' | 'partial' | 'pending' | 'cancelled' | 'refunded'
  payment_method: 'cash' | 'wave' | 'orange_money' | 'card'
  customer_name?: string | null
  created_at: string
}

type NotificationStockRow = {
  id: string
  name: string
  quantity: number
  min_quantity: number
  status: 'active' | 'inactive' | 'pending'
  updated_at: string
}

type NotificationAbroadRow = {
  id: string
  name: string
  activated: boolean
  synced: boolean
  created_at: string
}

function formatMoney(value: number) {
  return `${Math.round(value).toLocaleString('fr-FR')} FCFA`
}

function getReadState(): NotificationReadState {
  if (typeof window === 'undefined') {
    return { readIds: [] }
  }

  try {
    const rawValue = window.localStorage.getItem(NOTIFICATION_READ_KEY)
    if (!rawValue) return { readIds: [] }

    const parsedValue = JSON.parse(rawValue) as Partial<NotificationReadState>
    const readIds = Array.isArray(parsedValue.readIds) ? parsedValue.readIds.filter((value): value is string => typeof value === 'string') : []
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

function toNumber(value: number | string | null | undefined) {
  const parsedValue = Number(value ?? 0)
  return Number.isFinite(parsedValue) ? parsedValue : 0
}

function getCustomerLabel(value?: string | null) {
  const nextValue = String(value ?? '').trim()
  return nextValue || 'Client'
}

function getPaymentLabel(value: NotificationSaleRow['payment_method']) {
  if (value === 'orange_money') return 'Orange Money'
  if (value === 'cash') return 'Especes'
  if (value === 'card') return 'Carte'
  return 'Wave'
}

function isMissingSchemaObject(error: unknown, columnName: string) {
  const message =
    typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
      ? error.message
      : ''

  return message.includes(`'${columnName}'`)
}

function buildLowStockNotification(items: NotificationStockRow[]): HeaderNotificationItem[] {
  const lowStockItems = items
    .filter((item) => item.status === 'active' && item.quantity <= item.min_quantity)
    .sort((left, right) => left.quantity - right.quantity)

  if (lowStockItems.length === 0) return []

  if (lowStockItems.length === 1) {
    const item = lowStockItems[0]
    return [
      {
        id: `stock:${item.id}:${item.quantity}:${item.min_quantity}`,
        kind: 'stock',
        tone: item.quantity === 0 ? 'danger' : 'warning',
        title: `Stock faible: ${item.name}`,
        message: `Il reste ${item.quantity} unite(s) pour un seuil de ${item.min_quantity}.`,
        href: '/inventory',
        createdAt: item.updated_at,
      },
    ]
  }

  const preview = lowStockItems
    .slice(0, 3)
    .map((item) => item.name)
    .join(', ')

  return [
    {
      id: `stock:summary:${lowStockItems.map((item) => `${item.id}:${item.quantity}`).join('|')}`,
      kind: 'stock',
      tone: lowStockItems.some((item) => item.quantity === 0) ? 'danger' : 'warning',
      title: `${lowStockItems.length} produits en alerte de stock`,
      message: `${preview}${lowStockItems.length > 3 ? '...' : ''}`,
      href: '/inventory',
      createdAt: lowStockItems[0]?.updated_at,
    },
  ]
}

function buildSalesNotifications(recentSales: NotificationSaleRow[], openDebtSales: NotificationSaleRow[]): HeaderNotificationItem[] {
  const notifications: HeaderNotificationItem[] = []

  recentSales
    .slice(0, 2)
    .forEach((sale) => {
      const total = toNumber(sale.total)
      const dueAmount = toNumber(sale.amount_due)
      const tone: HeaderNotificationTone =
        sale.payment_status === 'completed'
          ? 'success'
          : dueAmount > 0
            ? 'warning'
            : 'info'

      notifications.push({
        id: `sale:${sale.id}`,
        kind: 'sale',
        tone,
        title: `Vente enregistree: ${formatMoney(total)}`,
        message: `${getCustomerLabel(sale.customer_name)} · ${getPaymentLabel(sale.payment_method)}${dueAmount > 0 ? ` · Reste ${formatMoney(dueAmount)}` : ''}`,
        href: '/sales',
        createdAt: sale.created_at,
      })
    })

  if (openDebtSales.length > 0) {
    const totalDue = openDebtSales.reduce((sum, sale) => sum + toNumber(sale.amount_due), 0)
    const latestDebt = openDebtSales[0]
    notifications.push({
      id: `debt:${openDebtSales.map((sale) => `${sale.id}:${toNumber(sale.amount_due)}`).join('|')}`,
      kind: 'debt',
      tone: 'warning',
      title: `${openDebtSales.length} vente(s) avec reste a encaisser`,
      message: `${formatMoney(totalDue)} a recuperer. Dernier client: ${getCustomerLabel(latestDebt?.customer_name)}.`,
      href: '/clients',
      createdAt: latestDebt?.created_at,
    })
  }

  return notifications
}

function buildReportNotifications(
  preferences: NotificationPreferences,
  recentSales: NotificationSaleRow[]
): HeaderNotificationItem[] {
  if (recentSales.length === 0) return []

  const notifications: HeaderNotificationItem[] = []
  const now = new Date()
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const sevenDaysAgo = new Date(startOfToday)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)

  const todaySales = recentSales.filter((sale) => new Date(sale.created_at) >= startOfToday)
  const weekSales = recentSales.filter((sale) => new Date(sale.created_at) >= sevenDaysAgo)

  if (preferences.dailyReport && todaySales.length > 0) {
    const todayInvoiced = todaySales.reduce((sum, sale) => sum + toNumber(sale.total), 0)
    const todayDue = todaySales.reduce((sum, sale) => sum + toNumber(sale.amount_due), 0)

    notifications.push({
      id: `daily:${startOfToday.toISOString().slice(0, 10)}:${todaySales.length}:${Math.round(todayInvoiced)}:${Math.round(todayDue)}`,
      kind: 'report',
      tone: todayDue > 0 ? 'warning' : 'info',
      title: 'Bilan du jour',
      message: `${todaySales.length} vente(s), ${formatMoney(todayInvoiced)} facture(s)${todayDue > 0 ? `, ${formatMoney(todayDue)} restant` : ''}.`,
      href: '/reports',
      createdAt: todaySales[0]?.created_at,
    })
  }

  if (preferences.weeklyReport && weekSales.length > 0) {
    const weeklyInvoiced = weekSales.reduce((sum, sale) => sum + toNumber(sale.total), 0)
    const weeklyDue = weekSales.reduce((sum, sale) => sum + toNumber(sale.amount_due), 0)

    notifications.push({
      id: `weekly:${sevenDaysAgo.toISOString().slice(0, 10)}:${weekSales.length}:${Math.round(weeklyInvoiced)}:${Math.round(weeklyDue)}`,
      kind: 'report',
      tone: weeklyDue > 0 ? 'warning' : 'info',
      title: 'Resume des 7 derniers jours',
      message: `${weekSales.length} vente(s), ${formatMoney(weeklyInvoiced)} facture(s)${weeklyDue > 0 ? `, ${formatMoney(weeklyDue)} restant` : ''}.`,
      href: '/reports',
      createdAt: weekSales[0]?.created_at,
    })
  }

  return notifications
}

function buildAbroadNotifications(items: NotificationAbroadRow[]): HeaderNotificationItem[] {
  const pendingItems = items.filter((item) => !item.activated)
  if (pendingItems.length === 0) return []

  const preview = pendingItems
    .slice(0, 2)
    .map((item) => item.name)
    .join(', ')

  return [
    {
      id: `abroad:${pendingItems.map((item) => `${item.id}:${item.synced ? '1' : '0'}`).join('|')}`,
      kind: 'abroad',
      tone: 'info',
      title: `${pendingItems.length} produit(s) saisi(s) depuis l'etranger`,
      message: `${preview}${pendingItems.length > 2 ? '...' : ''} attend(ent) l'activation dans le stock principal.`,
      href: '/inventory',
      createdAt: pendingItems[0]?.created_at,
    },
  ]
}

function buildSubscriptionNotifications(requests: SubscriptionRequestRecord[]): HeaderNotificationItem[] {
  return requests.slice(0, 2).map((request) => {
    const planName = getPlanDefinition(request.requestedPlan).name
    const tone: HeaderNotificationTone =
      request.status === 'activated'
        ? 'success'
        : request.status === 'cancelled'
          ? 'danger'
          : request.status === 'in_progress'
            ? 'warning'
            : 'info'

    return {
      id: `subscription:${request.id}:${request.status}`,
      kind: 'subscription',
      tone,
      title: getSubscriptionRequestTitle(request.requestType, request.requestedPlan),
      message: `${SUBSCRIPTION_REQUEST_STATUS_LABELS[request.status]} · ${planName}${request.businessName ? ` · ${request.businessName}` : ''}`,
      href: '/settings?tab=billing',
      createdAt: request.updatedAt ?? request.createdAt,
    }
  })
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

    const supabase = createClient()
    const nextPreferences = loadNotificationPreferences()
    setPreferences(nextPreferences)

    try {
      await ensureBrowserSupabaseSession(supabase)
    } catch (sessionError) {
      setItems([])
      setError(sessionError instanceof Error ? sessionError.message : 'Session indisponible.')
      setLoading(false)
      return
    }

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    const recentSalesQuery = supabase
      .from('sales')
      .select('id,total,amount_due,payment_status,payment_method,customer_name,created_at,seller_id')
      .gte('created_at', sevenDaysAgo.toISOString())
      .in('payment_status', ['completed', 'partial', 'pending'])
      .order('created_at', { ascending: false })
      .limit(12)

    const openDebtQuery = supabase
      .from('sales')
      .select('id,total,amount_due,payment_status,payment_method,customer_name,created_at,seller_id')
      .gt('amount_due', 0)
      .in('payment_status', ['partial', 'pending'])
      .order('created_at', { ascending: false })

    if (input.role === 'cashier') {
      recentSalesQuery.eq('seller_id', input.userId)
      openDebtQuery.eq('seller_id', input.userId)
    }

    const requests = [
      nextPreferences.lowStock
        ? supabase
            .from('products')
            .select('id,name,quantity,min_quantity,status,updated_at')
            .eq('status', 'active')
            .order('updated_at', { ascending: false })
        : Promise.resolve({ data: [] as NotificationStockRow[], error: null }),
      nextPreferences.newSale || nextPreferences.dailyReport || nextPreferences.weeklyReport
        ? recentSalesQuery
        : Promise.resolve({ data: [] as NotificationSaleRow[], error: null }),
      nextPreferences.newSale
        ? openDebtQuery
        : Promise.resolve({ data: [] as NotificationSaleRow[], error: null }),
      nextPreferences.abroadSync && input.role !== 'cashier'
        ? supabase
            .from('abroad_products')
            .select('id,name,activated,synced,created_at')
            .eq('activated', false)
            .order('created_at', { ascending: false })
            .limit(12)
        : Promise.resolve({ data: [] as NotificationAbroadRow[], error: null }),
      input.role === 'admin'
        ? getSubscriptionRequests(5).then((data) => ({ data, error: null })).catch((requestError) => ({ data: [] as SubscriptionRequestRecord[], error: requestError }))
        : Promise.resolve({ data: [] as SubscriptionRequestRecord[], error: null }),
    ] as const

    const [stockResult, recentSalesResult, openDebtResult, abroadResult, subscriptionResult] = await Promise.all(requests)
    const notifications: HeaderNotificationItem[] = []

    if (stockResult.error) {
      console.warn('header_notifications_stock_failed', stockResult.error)
    } else {
      notifications.push(...buildLowStockNotification((stockResult.data ?? []) as NotificationStockRow[]))
    }

    let recentSales = (recentSalesResult.data ?? []) as NotificationSaleRow[]
    let openDebtSales = (openDebtResult.data ?? []) as NotificationSaleRow[]

    if (recentSalesResult.error) {
      console.warn('header_notifications_sales_failed', recentSalesResult.error)
      recentSales = []
    }

    if (openDebtResult.error) {
      if (input.role === 'cashier' && isMissingSchemaObject(openDebtResult.error, 'seller_id')) {
        console.warn('header_notifications_cashier_scope_missing', openDebtResult.error)
      } else {
        console.warn('header_notifications_debts_failed', openDebtResult.error)
      }
      openDebtSales = []
    }

    notifications.push(...buildSalesNotifications(recentSales, openDebtSales))
    notifications.push(...buildReportNotifications(nextPreferences, recentSales))

    if (abroadResult.error) {
      console.warn('header_notifications_abroad_failed', abroadResult.error)
    } else {
      notifications.push(...buildAbroadNotifications((abroadResult.data ?? []) as NotificationAbroadRow[]))
    }

    if (subscriptionResult.error) {
      console.warn('header_notifications_subscription_failed', subscriptionResult.error)
    } else {
      notifications.push(...buildSubscriptionNotifications(subscriptionResult.data ?? []))
    }

    notifications.sort((left, right) => {
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0
      return rightTime - leftTime
    })

    setItems(notifications)
    setLoading(false)
  }, [input.role, input.userId])

  useEffect(() => {
    void reload()
  }, [reload])

  const unreadCount = useMemo(() => {
    const unreadItems = items.filter((item) => !readIds.includes(item.id))
    return unreadItems.length
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
