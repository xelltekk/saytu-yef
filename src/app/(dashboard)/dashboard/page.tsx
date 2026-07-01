'use client'
import { useCallback, useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { MetricCard } from '@/components/ui/Card'
import { SalesChart } from '@/components/dashboard/SalesChart'
import { TopProducts } from '@/components/dashboard/TopProducts'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { LowStockAlert } from '@/components/dashboard/LowStockAlert'
import { LaunchChecklist } from '@/components/dashboard/LaunchChecklist'
import { TrendingUp, Package, ShoppingCart, AlertTriangle, RefreshCw } from 'lucide-react'
import { getDashboardMetrics } from '@/lib/supabase/queries'
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils'

interface Metrics {
  revenueToday: number
  revenueMonth: number
  dueToday: number
  dueMonth: number
  salesToday: number
  salesMonth: number
  totalProducts: number
  lowStockCount: number
  avgMargin: number
  recentSales: import('@/types').Sale[]
  salesChartData: { day: string; revenue: number }[]
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadMetrics = useCallback(async (showRefreshState = false) => {
    if (showRefreshState) setRefreshing(true)
    setError('')
    try {
      setMetrics(await getDashboardMetrics())
      setLastUpdated(new Date())
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Impossible de charger le tableau de bord')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const refreshDashboard = useCallback(() => {
    setRefreshKey((current) => current + 1)
    void loadMetrics(true)
  }, [loadMetrics])

  useEffect(() => {
    void loadMetrics()

    const handleFocus = () => {
      setRefreshKey((current) => current + 1)
      void loadMetrics()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [loadMetrics])

  const renderResponsiveCurrency = (amount: number) => (
    <>
      <span className="sm:hidden">{formatCurrencyCompact(amount)}</span>
      <span className="hidden sm:inline">{formatCurrency(amount)}</span>
    </>
  )

  return (
    <div className="min-h-screen">
      <Header title="Tableau de bord" subtitle="Aperçu de votre activité" />
      <div className="space-y-4 p-3 sm:p-4 lg:space-y-6 lg:p-6">

        <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
          <p className="text-[11px] text-[#6B7682]">
            {lastUpdated
              ? `Mis à jour à ${lastUpdated.toLocaleTimeString('fr-SN', { hour: '2-digit', minute: '2-digit' })}`
              : 'Chargement des données…'}
          </p>
          <button
            type="button"
            onClick={refreshDashboard}
            disabled={refreshing}
            className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#2D7D7D]/[0.12] bg-white px-3 text-xs font-semibold text-[#2D7D7D] transition-colors hover:bg-[#2D7D7D]/[0.05] disabled:opacity-50 min-[420px]:w-auto"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-600">
            {error}
          </div>
        )}

        <LaunchChecklist refreshKey={refreshKey} />

        {/* Métriques */}
        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          <MetricCard
            title="Ventes aujourd'hui"
            value={loading ? '…' : renderResponsiveCurrency(metrics?.revenueToday ?? 0)}
            change={loading ? '' : (
              <>
                <span className="sm:hidden">{metrics?.salesToday ?? 0} ventes · {formatCurrencyCompact(metrics?.dueToday ?? 0)} dû</span>
                <span className="hidden sm:inline">{metrics?.salesToday ?? 0} vente(s) · {formatCurrency(metrics?.dueToday ?? 0)} à encaisser</span>
              </>
            )}
            changeType="neutral"
            icon={<TrendingUp size={20} />}
            color="#2D7D7D"
            href="/sales"
          />
          <MetricCard
            title={<><span className="sm:hidden">Ce mois</span><span className="hidden sm:inline">Ce mois-ci</span></>}
            value={loading ? '…' : renderResponsiveCurrency(metrics?.revenueMonth ?? 0)}
            change={loading ? '' : (
              <>
                <span className="sm:hidden">{metrics?.salesMonth ?? 0} ventes · {formatCurrencyCompact(metrics?.dueMonth ?? 0)} dû</span>
                <span className="hidden sm:inline">{metrics?.salesMonth ?? 0} vente(s) · {formatCurrency(metrics?.dueMonth ?? 0)} à encaisser</span>
              </>
            )}
            changeType="up"
            icon={<ShoppingCart size={20} />}
            color="#6C5CE7"
            href="/sales"
          />
          <MetricCard
            title="Produits en stock"
            value={loading ? '…' : String(metrics?.totalProducts ?? 0)}
            change={loading ? '' : `${metrics?.lowStockCount ?? 0} en alerte`}
            changeType={(metrics?.lowStockCount ?? 0) > 0 ? 'down' : 'neutral'}
            icon={<Package size={20} />}
            color="#16A34A"
            href="/inventory"
          />
          <MetricCard
            title="Marge moyenne"
            value={loading ? '…' : `${(metrics?.avgMargin ?? 0).toFixed(1)}%`}
            change={loading ? '' : (
              <>
                <span className="sm:hidden">Tous produits</span>
                <span className="hidden sm:inline">Sur tous les produits</span>
              </>
            )}
            changeType="neutral"
            icon={<AlertTriangle size={20} />}
            color="#F59E0B"
            href="/reports"
          />
        </div>

        {/* Graphiques */}
        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
          <SalesChart data={metrics?.salesChartData} loading={loading} />
          <TopProducts refreshKey={refreshKey} />
        </div>

        {/* Activité */}
        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
          <RecentActivity sales={metrics?.recentSales} loading={loading} />
          <LowStockAlert refreshKey={refreshKey} />
        </div>

      </div>
    </div>
  )
}
