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
      <div className="glass rounded-xl px-3 py-2 border border-white/[0.08] text-xs">
        <p className="text-[#8892aa] mb-1">{label}</p>
        <p className="text-[#f0f2f8] font-medium">{formatCurrency(payload[0].value)}</p>
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
          <h3 className="text-sm font-semibold text-[#f0f2f8]">Revenus ce mois</h3>
          <p className="text-xs text-[#8892aa] mt-0.5">Comparaison journalière</p>
        </div>
      </div>
      {loading ? (
        <div className="h-[220px] flex items-center justify-center">
          <div className="animate-pulse text-[#8892aa] text-sm">Chargement…</div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f6ef7" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#4f6ef7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="day" tick={{ fill: '#8892aa', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#8892aa', fontSize: 10 }} axisLine={false} tickLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={35} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.05)', strokeWidth: 1 }} />
            <Area type="monotone" dataKey="revenue" stroke="#4f6ef7" strokeWidth={2} fill="url(#revenueGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}
