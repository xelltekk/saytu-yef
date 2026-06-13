'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Package, ShoppingCart, BarChart3,
  Settings, ChevronLeft, ChevronRight, Zap, LogOut,
  Globe, User
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { useUser } from '@/hooks/useUser'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
  { href: '/inventory', icon: Package, label: 'Inventaire' },
  { href: '/sales', icon: ShoppingCart, label: 'Ventes' },
  { href: '/reports', icon: BarChart3, label: 'Rapports' },
  { href: '/abroad', icon: Globe, label: 'Saisie Étranger' },
  { href: '/settings', icon: Settings, label: 'Paramètres' },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const { displayName, businessName, initials, loading } = useUser()

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col h-screen sticky top-0 border-r border-white/[0.06] bg-[#0a0e1a] transition-all duration-300 z-30',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className={cn('flex items-center gap-3 p-4 border-b border-white/[0.06]', collapsed && 'justify-center')}>
        <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-[#4f6ef7] to-[#8b5cf6] flex items-center justify-center">
          <Zap size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-sm font-bold text-[#f0f2f8] leading-tight">Saytu Yëf</p>
            <p className="text-[10px] text-[#8892aa]">Gestion Pro</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 flex flex-col gap-1 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-[#4f6ef7]/10 text-[#4f6ef7] border border-[#4f6ef7]/20'
                  : 'text-[#8892aa] hover:text-[#f0f2f8] hover:bg-white/[0.04]',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
              {active && !collapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#4f6ef7]" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Profil utilisateur */}
      {!collapsed && !loading && (
        <div className="mx-2 mb-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4f6ef7] to-[#8b5cf6] flex items-center justify-center flex-shrink-0">
              {initials ? (
                <span className="text-[11px] font-bold text-white">{initials}</span>
              ) : (
                <User size={14} className="text-white" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#f0f2f8] truncate leading-tight">{displayName}</p>
              {businessName && (
                <p className="text-[10px] text-[#8892aa] truncate leading-tight">{businessName}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom actions */}
      <div className={cn('p-2 border-t border-white/[0.06] flex flex-col gap-1')}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#8892aa] hover:text-[#f0f2f8] hover:bg-white/[0.04] transition-colors w-full',
            collapsed && 'justify-center'
          )}
        >
          {collapsed ? <ChevronRight size={18} /> : <><ChevronLeft size={18} /><span>Réduire</span></>}
        </button>
        <form action="/auth/signout" method="POST" className="w-full">
          <button
            type="submit"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/5 transition-colors w-full',
              collapsed && 'justify-center'
            )}
          >
            <LogOut size={18} />
            {!collapsed && <span>Déconnexion</span>}
          </button>
        </form>
      </div>
    </aside>
  )
}
