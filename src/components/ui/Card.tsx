import { cn } from '@/lib/utils'
import Link from 'next/link'

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  glow?: boolean
  accent?: boolean
  mint?: boolean
}

export function Card({ children, className, hover, glow, accent, mint }: CardProps) {
  return (
    <div
      className={cn(
        'relative rounded-2xl p-5',
        mint
          ? 'bg-[#E8F4F2] border border-[#2D7D7D]/[0.08]'
          : 'bg-white border border-[#2D7D7D]/[0.08]',
        'shadow-[0_6px_20px_rgba(26,54,54,0.06)]',
        hover && [
          'cursor-pointer',
          'transition-all duration-200',
          'hover:border-[#2D7D7D]/[0.16]',
          'hover:shadow-[0_10px_28px_rgba(26,54,54,0.10)]',
          'hover:-translate-y-0.5',
        ],
        glow && 'hover:shadow-[0_10px_28px_rgba(108,92,231,0.18)]',
        accent && 'card-accent',
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
  gradient?: string
  href?: string
}

export function MetricCard({
  title, value, change, changeType = 'neutral',
  icon, color = '#2D7D7D', gradient, href
}: MetricCardProps) {
  const grad = gradient || `${color}1A`
  const isUp   = changeType === 'up'
  const isDown = changeType === 'down'

  const className = cn(
    'group relative block overflow-hidden rounded-2xl bg-white border border-[#2D7D7D]/[0.08] p-4 sm:p-5 shadow-[0_6px_20px_rgba(26,54,54,0.06)] transition-all duration-200 hover:border-[#2D7D7D]/[0.16] hover:-translate-y-0.5',
    href && 'cursor-pointer hover:shadow-[0_10px_28px_rgba(26,54,54,0.12)]'
  )

  const inner = (
    <>
      {/* Background glow blob */}
      <div
        className="absolute -top-6 -right-6 w-28 h-28 rounded-full blur-3xl opacity-[0.14] pointer-events-none"
        style={{ background: color }}
      />

      {/* Top line accent */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] opacity-70"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />

      <div className="relative flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1 pr-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#5C6B73] mb-2">
            {title}
          </p>
          <p className="font-display text-[19px] sm:text-[22px] font-bold text-[#1A3636] leading-tight whitespace-normal break-words">
            {value}
          </p>
          {change && (
            <div className="mt-2 flex items-center gap-1.5">
              <span
                className={cn(
                  'inline-flex max-w-full items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-normal break-words',
                  isUp   && 'stat-up',
                  isDown && 'stat-down',
                  !isUp && !isDown && 'text-[#5C6B73] bg-[#2D7D7D]/[0.07]'
                )}
              >
                {isUp ? '↑' : isDown ? '↓' : ''} {change}
              </span>
            </div>
          )}
        </div>

        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10"
          style={{ background: grad, color }}
        >
          {icon}
        </div>
      </div>
    </>
  )

  if (href) {
    return <Link href={href} className={className}>{inner}</Link>
  }
  return <div className={className}>{inner}</div>
}
