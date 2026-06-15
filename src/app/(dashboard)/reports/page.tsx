'use client'
import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, MetricCard } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, Package, DollarSign, BarChart3 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import { getReportsData } from '@/lib/supabase/queries'

const COLORS = ['#6C5CE7', '#8b5cf6', '#f97316', '#10b981', '#6b7280']

interface ReportsData {
  monthlyData: { month: string; revenue: number; profit: number }[]
  topProducts: { id: string; name: string; sold: number; revenue: number; profit: number; margin: number }[]
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getReportsData(6)
      .then((d) => setData(d as ReportsData))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const totalRevenue = data?.monthlyData.reduce((s, m) => s + m.revenue, 0) ?? 0
  const totalProfit = data?.monthlyData.reduce((s, m) => s + m.profit, 0) ?? 0
  const totalSold = data?.topProducts.reduce((s, p) => s + p.sold, 0) ?? 0
  const avgMargin = data?.topProducts.length
    ? data.topProducts.reduce((s, p) => s + p.margin, 0) / data.topProducts.length
    : 0

  // Catégorie par ventes (basé sur top produits agrégés)
  const categoryData = data?.topProducts.slice(0, 5).map((p, i) => ({
    name: p.name.slice(0, 12),
    value: Math.round((p.revenue / (totalRevenue || 1)) * 100),
    color: COLORS[i % COLORS.length],
  })) ?? []

  return (
    <div className="min-h-screen">
      <Header title="Rapports & Analyses" subtitle="Performances de votre activité" />
      <div className="p-4 lg:p-6 space-y-6">
        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Revenus totaux"
            value={loading ? '…' : formatCurrency(totalRevenue)}
            change="6 derniers mois"
            changeType="up"
            icon={<DollarSign size={20} />}
            color="#6C5CE7"
          />
          <MetricCard
            title="Bénéfice net"
            value={loading ? '…' : formatCurrency(totalProfit)}
            change="6 derniers mois"
            changeType="up"
            icon={<TrendingUp size={20} />}
            color="#10b981"
          />
          <MetricCard
            title="Articles vendus"
            value={loading ? '…' : String(totalSold)}
            change="tous produits"
            changeType="neutral"
            icon={<BarChart3 size={20} />}
            color="#8b5cf6"
          />
          <MetricCard
            title="Marge moyenne"
            value={loading ? '…' : `${avgMargin.toFixed(1)}%`}
            change="sur top produits"
            changeType="neutral"
            icon={<Package size={20} />}
            color="#f97316"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <h3 className="text-sm font-semibold text-[#1A3636] mb-6">Revenus & Bénéfices (6 derniers mois)</h3>
            {loading ? (
              <div className="h-[250px] flex items-center justify-center">
                <div className="animate-pulse text-[#6B7682] text-sm">Chargement…</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data?.monthlyData ?? []} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" tick={{ fill: '#9AA7AE', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9AA7AE', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000000).toFixed(1)}M`} width={40} />
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

          <Card>
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
                      formatter={(value: any) => [`${value}%`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {categoryData.map((cat) => (
                    <div key={cat.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: cat.color }} />
                        <span className="text-[#6B7682] truncate max-w-[100px]">{cat.name}</span>
                      </div>
                      <span className="text-[#1A3636] font-medium">{cat.value}%</span>
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
        <Card>
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
          ) : (
            <div className="overflow-x-auto">
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
                  {(data?.topProducts ?? []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-sm text-[#6B7682]">Aucune donnée de ventes</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
