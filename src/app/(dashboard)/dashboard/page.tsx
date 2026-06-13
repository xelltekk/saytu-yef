'use client'
import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { MetricCard } from '@/components/ui/Card'
import { SalesChart } from '@/components/dashboard/SalesChart'
import { TopProducts } from '@/components/dashboard/TopProducts'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { LowStockAlert } from '@/components/dashboard/LowStockAlert'
import { TrendingUp, Package, ShoppingCart, AlertTriangle } from 'lucide-react'
import { getDashboardMetrics } from '@/lib/supabase/queries'
import { formatCurrency } from '@/lib/utils'

interface Metrics {
  revenueToday: number
  revenueMonth: number
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

  useEffect(() => {
    getDashboardMetrics()
      .then(setMetrics)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen">
      <Header title="Tableau de bord" subtitle="Aperçu de votre activité" />
      <div className="p-4 lg:p-6 space-y-6">

        {/* Métriques */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Ventes aujourd'hui"
            value={loading ? '…' : formatCurrency(metrics?.revenueToday ?? 0)}
            change={loading ? '' : `${metrics?.salesToday ?? 0} transaction(s)`}
            changeType="neutral"
            icon={<TrendingUp size={20} />}
            color="#4f6ef7"
          />
          <MetricCard
            title="Ce mois-ci"
            value={loading ? '…' : formatCurrency(metrics?.revenueMonth ?? 0)}
            change={loading ? '' : `${metrics?.salesMonth ?? 0} ventes`}
            changeType="up"
            icon={<ShoppingCart size={20} />}
            color="#8b5cf6"
          />
          <MetricCard
            title="Produits en stock"
            value={loading ? '…' : String(metrics?.totalProducts ?? 0)}
            change={loading ? '' : `${metrics?.lowStockCount ?? 0} en alerte`}
            changeType={(metrics?.lowStockCount ?? 0) > 0 ? 'down' : 'neutral'}
            icon={<Package size={20} />}
            color="#10b981"
          />
          <MetricCard
            title="Marge moyenne"
            value={loading ? '…' : `${(metrics?.avgMargin ?? 0).toFixed(1)}%`}
            change={loading ? '' : 'Sur tous les produits'}
            changeType="neutral"
            icon={<AlertTriangle size={20} />}
            color="#f59e0b"
          />
        </div>

        {/* Graphiques */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SalesChart data={metrics?.salesChartData} loading={loading} />
          <TopProducts />
        </div>

        {/* Activité */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <RecentActivity sales={metrics?.recentSales} loading={loading} />
          <LowStockAlert />
        </div>

      </div>
    </div>
  )
}
