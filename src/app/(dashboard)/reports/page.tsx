'use client'
import { useCallback, useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, MetricCard } from '@/components/ui/Card'
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils'
import { TrendingUp, Package, DollarSign, BarChart3, RefreshCw } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import { getReportsData } from '@/lib/supabase/queries'

const COLORS = ['#6C5CE7', '#8b5cf6', '#f97316', '#10b981', '#0ea5e9', '#94a3b8']

interface ReportsData {
  monthlyData: { month: string; revenue: number; profit: number }[]
  topProducts: { id: string; name: string; sold: number; revenue: number; profit: number; margin: number }[]
  totalSold: number
  avgMargin: number
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadReports = useCallback(async (showRefreshState = false) => {
    if (showRefreshState) setRefreshing(true)
    setError('')
    try {
      setData(await getReportsData(6) as ReportsData)
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Impossible de charger les rapports')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  const totalRevenue = data?.monthlyData.reduce((s, m) => s + m.revenue, 0) ?? 0
  const totalProfit = data?.monthlyData.reduce((s, m) => s + m.profit, 0) ?? 0
  const totalSold = data?.totalSold ?? 0
  const avgMargin = data?.avgMargin ?? 0

  const renderResponsiveCurrency = (amount: number) => (
    <>
      <span className="sm:hidden">{formatCurrencyCompact(amount)}</span>
      <span className="hidden sm:inline">{formatCurrency(amount)}</span>
    </>
  )

  const leadingProducts = data?.topProducts.slice(0, 5) ?? []
  const leadingRevenue = leadingProducts.reduce((sum, product) => sum + product.revenue, 0)
  const categoryData = leadingProducts.map((product, index) => ({
    id: product.id,
    name: product.name,
    value: product.revenue,
    percentage: Math.round((product.revenue / (totalRevenue || 1)) * 100),
    color: COLORS[index],
  }))
  if (totalRevenue - leadingRevenue > 0.01) {
    categoryData.push({
      id: 'other',
      name: 'Autres produits',
      value: totalRevenue - leadingRevenue,
      percentage: Math.max(0, 100 - categoryData.reduce((sum, item) => sum + item.percentage, 0)),
      color: COLORS[5],
    })
  }

  return (
    <div className="min-h-screen">
      <Header title="Rapports & Analyses" subtitle="Performances de votre activité" />
      <div className="space-y-4 p-3 sm:p-4 lg:space-y-6 lg:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-[#6B7682]">Données des 6 derniers mois</p>
          <button
            type="button"
            onClick={() => void loadReports(true)}
            disabled={refreshing}
            className="flex min-h-10 items-center gap-2 rounded-xl border border-[#2D7D7D]/[0.12] bg-white px-3 text-xs font-semibold text-[#2D7D7D] transition-colors hover:bg-[#2D7D7D]/[0.05] disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Actualiser
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-600">
            {error}
          </div>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
          <MetricCard
            title="Revenus hors taxe"
            value={loading ? '…' : renderResponsiveCurrency(totalRevenue)}
            change={<><span className="sm:hidden">6 mois</span><span className="hidden sm:inline">6 derniers mois</span></>}
            changeType="up"
            icon={<DollarSign size={20} />}
            color="#6C5CE7"
          />
          <MetricCard
            title="Bénéfice net"
            value={loading ? '…' : renderResponsiveCurrency(totalProfit)}
            change={<><span className="sm:hidden">6 mois</span><span className="hidden sm:inline">6 derniers mois</span></>}
            changeType="up"
            icon={<TrendingUp size={20} />}
            color="#10b981"
          />
          <MetricCard
            title="Articles vendus"
            value={loading ? '…' : String(totalSold)}
            change={<><span className="sm:hidden">Tous</span><span className="hidden sm:inline">tous produits</span></>}
            changeType="neutral"
            icon={<BarChart3 size={20} />}
            color="#8b5cf6"
          />
          <MetricCard
            title="Marge moyenne"
            value={loading ? '…' : `${avgMargin.toFixed(1)}%`}
            change={<><span className="sm:hidden">Top ventes</span><span className="hidden sm:inline">sur top produits</span></>}
            changeType="neutral"
            icon={<Package size={20} />}
            color="#f97316"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-4 sm:p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-[#1A3636] mb-6">Revenus HT & Bénéfices (6 derniers mois)</h3>
            {loading ? (
              <div className="h-[250px] flex items-center justify-center">
                <div className="animate-pulse text-[#6B7682] text-sm">Chargement…</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={data?.monthlyData ?? []} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" tick={{ fill: '#9AA7AE', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9AA7AE', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatCurrencyCompact(Number(value)).replace(' FCFA', '')} width={48} />
                  <Tooltip
                    contentStyle={{ background: '#F4F7FB', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', fontSize: '12px' }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => [formatCurrency(Number(value)), '']}
                  />
                  <Bar dataKey="revenue" fill="#6C5CE7" radius={[6, 6, 0, 0]} name="Revenus" />
                  <Bar dataKey="profit" fill="#10b981" radius={[6, 6, 0, 0]} name="Bénéfice" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card className="p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-[#1A3636] mb-4">Top produits</h3>
            {!loading && categoryData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#F4F7FB', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', fontSize: '12px' }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any) => [formatCurrency(Number(value)), '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {categoryData.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between gap-3 text-xs">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: cat.color }} />
                        <span className="truncate text-[#6B7682]">{cat.name}</span>
                      </div>
                      <span className="flex-shrink-0 font-medium text-[#1A3636]">{cat.percentage}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-[#6B7682]">
                <p className="text-xs">{loading ? 'Chargement…' : 'Aucune donnée'}</p>
              </div>
            )}
          </Card>
        </div>

        {/* Top products table */}
        <Card className="p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-[#1A3636] mb-4">Top produits — 6 derniers mois</h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4 animate-pulse">
                  <div className="h-3 bg-[#2D7D7D]/[0.08] rounded flex-1" />
                  <div className="h-3 bg-[#2D7D7D]/[0.08] rounded w-12" />
                  <div className="h-3 bg-[#2D7D7D]/[0.08] rounded w-20" />
                  <div className="h-3 bg-[#2D7D7D]/[0.08] rounded w-20" />
                </div>
              ))}
            </div>
          ) : (data?.topProducts ?? []).length === 0 ? (
            <div className="py-10 text-center text-sm text-[#6B7682]">Aucune donnée de ventes</div>
          ) : (
            <>
              <div className="space-y-2 sm:hidden">
                {(data?.topProducts ?? []).map((row, index) => (
                  <article key={row.id} className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-[#F4F7FB] p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-[#6C5CE7]/[0.1] text-xs font-bold text-[#6C5CE7]">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#1A3636]">{row.name}</p>
                        <p className="mt-0.5 text-xs text-[#6B7682]">{row.sold} unité(s) vendue(s)</p>
                      </div>
                      <span className={`flex-shrink-0 text-xs font-semibold ${row.margin > 40 ? 'text-emerald-600' : row.margin > 25 ? 'text-[#6C5CE7]' : 'text-amber-600'}`}>
                        {row.margin.toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#2D7D7D]/[0.07] pt-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-[#6B7682]">Revenus</p>
                        <p className="mt-0.5 text-sm font-semibold text-[#1A3636]">{formatCurrencyCompact(row.revenue)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wide text-[#6B7682]">Bénéfice</p>
                        <p className="mt-0.5 text-sm font-semibold text-emerald-600">{formatCurrencyCompact(row.profit)}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2D7D7D]/[0.08]">
                    <th className="text-left pb-3 text-xs font-medium text-[#6B7682] uppercase tracking-wider">Produit</th>
                    <th className="text-right pb-3 text-xs font-medium text-[#6B7682] uppercase tracking-wider">Vendus</th>
                    <th className="text-right pb-3 text-xs font-medium text-[#6B7682] uppercase tracking-wider">Revenus</th>
                    <th className="text-right pb-3 text-xs font-medium text-[#6B7682] uppercase tracking-wider">Bénéfice</th>
                    <th className="text-right pb-3 text-xs font-medium text-[#6B7682] uppercase tracking-wider">Marge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {(data?.topProducts ?? []).map((row) => (
                    <tr key={row.id} className="hover:bg-[#F4F7FB] transition-colors">
                      <td className="py-3 text-sm text-[#1A3636] font-medium">{row.name}</td>
                      <td className="py-3 text-sm text-[#6B7682] text-right">{row.sold}</td>
                      <td className="py-3 text-sm text-[#1A3636] text-right font-medium">{formatCurrency(row.revenue)}</td>
                      <td className="py-3 text-sm text-emerald-600 text-right">{formatCurrency(row.profit)}</td>
                      <td className="py-3 text-sm text-right">
                        <span className={`font-medium ${row.margin > 40 ? 'text-emerald-600' : row.margin > 25 ? 'text-[#6C5CE7]' : 'text-amber-600'}`}>
                          {row.margin.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
