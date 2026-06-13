import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  glow?: boolean
}

export function Card({ children, className, hover, glow }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/[0.06] bg-[#0d1120] p-5',
        hover && 'transition-all duration-200 hover:border-white/[0.12] hover:bg-[#111827] cursor-pointer',
        glow && 'hover:shadow-lg hover:shadow-[rgba(79,110,247,0.1)]',
        className
      )}
    >
      {children}
    </div>
  )
}

interface MetricCardProps {
  title: string
  value: string
  change?: string
  changeType?: 'up' | 'down' | 'neutral'
  icon: React.ReactNode
  color?: string
}

export function MetricCard({ title, value, change, changeType = 'neutral', icon, color = '#4f6ef7' }: MetricCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <div
        className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 blur-2xl"
        style={{ background: color }}
      />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[#8892aa] text-xs font-medium uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-[#f0f2f8] mt-1">{value}</p>
          {change && (
            <p
              className={cn(
                'text-xs mt-1 font-medium',
                changeType === 'up' && 'text-emerald-400',
                changeType === 'down' && 'text-red-400',
                changeType === 'neutral' && 'text-[#8892aa]'
              )}
            >
              {changeType === 'up' ? '↑' : changeType === 'down' ? '↓' : ''} {change}
            </p>
          )}
        </div>
        <div
          className="p-2.5 rounded-xl"
          style={{ background: `${color}20`, color }}
        >
          {icon}
        </div>
      </div>
    </Card>
  )
}
