'use client'

import Link from 'next/link'
import { AlertTriangle, Crown } from 'lucide-react'

interface UsageLimitNoticeProps {
  title: string
  detail: string
  tone?: 'warning' | 'danger'
  compact?: boolean
}

export function UsageLimitNotice({
  title,
  detail,
  tone = 'warning',
  compact = false,
}: UsageLimitNoticeProps) {
  const styles = tone === 'danger'
    ? 'border-red-500/20 bg-red-500/10 text-red-700'
    : 'border-amber-500/20 bg-amber-500/10 text-amber-700'

  return (
    <div className={`rounded-2xl border px-4 py-3 ${styles}`}>
      <div className={`flex ${compact ? 'items-start gap-2.5' : 'flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'}`}>
        <div className="flex min-w-0 items-start gap-2.5">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-1 text-xs leading-5 opacity-90">{detail}</p>
          </div>
        </div>
        <Link
          href="/settings?tab=billing"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-current/15 bg-white/70 px-3 text-xs font-semibold"
        >
          <Crown size={14} />
          Abonnement
        </Link>
      </div>
    </div>
  )
}
