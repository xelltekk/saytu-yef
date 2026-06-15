'use client'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'

const FALLBACK = [
  { day: 'Lun', revenue: 0 }, { day: 'Mar', revenue: 0 }, { day: 'Mer', revenue: 0 },
  { day: 'Jeu', revenue: 0 }, { day: 'Ven', revenue: 0 }, { day: 'Sam', revenue: 0 }, { day: 'Dim', revenue: 0 },
]

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl px-3 py-2 border border-[#2D7D7D]/[0.12] bg-white shadow-lg text-xs">
        <p className="text-[#6B7682] mb-1">{label}</p>
        <p className="text-[#1A3636] font-semibold">{formatCurrency(payload[0].value)}</p>
      </div>
    )
  }
  return null
}

interface SalesChartProps {
  data?: { day: string; revenue: number }[]
  loading?: boolean
}

export function SalesChart({ data, loading }: SalesChartProps) {
  const chartData = data && data.length > 0 ? data : FALLBACK

  return (
    <Card className="col-span-full lg:col-span-2">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-[13px] font-semibold text-[#1A3636]">Revenus ce mois</h3>
          <p className="text-[11px] text-[#6B7682] mt-0.5">Comparaison journalière</p>
        </div>
      </div>
      {loading ? (
        <div className="h-[220px] flex items-center justify-center">
          <div className="animate-pulse text-[#6B7682] text-sm">Chargement…</div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6C5CE7" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#6C5CE7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,125,125,0.08)" />
            <XAxis dataKey="day" tick={{ fill: '#9AA7AE', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#9AA7AE', fontSize: 10 }} axisLine={false} tickLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={35} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(45,125,125,0.15)', strokeWidth: 1 }} />
            <Area type="monotone" dataKey="revenue" stroke="#6C5CE7" strokeWidth={2.5} fill="url(#revenueGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}
