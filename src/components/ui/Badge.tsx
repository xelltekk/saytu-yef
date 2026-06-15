import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'wave' | 'orange' | 'purple'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
  dot?: boolean
}

const variantStyles: Record<BadgeVariant, string> = {
  default:  'bg-[#2D7D7D]/[0.08] text-[#5C6B73] border border-[#2D7D7D]/[0.12]',
  primary:  'bg-[#2D7D7D]/[0.1] text-[#2D7D7D] border border-[#2D7D7D]/[0.18]',
  purple:   'bg-[#6C5CE7]/[0.1] text-[#6C5CE7] border border-[#6C5CE7]/[0.2]',
  success:  'bg-[#16A34A]/[0.1] text-[#16A34A] border border-[#16A34A]/[0.2]',
  warning:  'bg-[#F59E0B]/[0.12] text-[#B45309] border border-[#F59E0B]/[0.25]',
  danger:   'bg-[#EF4444]/[0.1] text-[#DC2626] border border-[#EF4444]/[0.2]',
  info:     'bg-[#2D7D7D]/[0.1] text-[#2D7D7D] border border-[#2D7D7D]/[0.2]',
  wave:     'bg-[#06B6D4]/[0.12] text-[#0891B2] border border-[#06B6D4]/[0.22]',
  orange:   'bg-[#F97316]/[0.12] text-[#EA580C] border border-[#F97316]/[0.22]',
}

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-[#5C6B73]',
  primary: 'bg-[#2D7D7D]',
  purple:  'bg-[#6C5CE7]',
  success: 'bg-[#16A34A]',
  warning: 'bg-[#F59E0B]',
  danger:  'bg-[#DC2626]',
  info:    'bg-[#2D7D7D]',
  wave:    'bg-[#0891B2]',
  orange:  'bg-[#EA580C]',
}

export function Badge({ children, variant = 'default', className, dot }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5',
        'text-[11px] font-semibold rounded-md',
        'leading-none whitespace-nowrap',
        variantStyles[variant],
        className
      )}
    >
      {dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotColors[variant])} />
      )}
      {children}
    </span>
  )
}
