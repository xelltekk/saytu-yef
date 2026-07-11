'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Package, ShoppingCart, BarChart3,
  Settings, ChevronLeft, ChevronRight, LogOut,
  Globe, User, Users, Truck, UserRoundCog,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { useUser } from '@/hooks/useUser'
import { useAccountRole } from '@/hooks/useAccountRole'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { isCashierRole } from '@/lib/accountRoles'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord', cashier: false },
  { href: '/inventory', icon: Package, label: 'Inventaire', cashier: true },
  { href: '/sales', icon: ShoppingCart, label: 'Ventes', cashier: true },
  { href: '/clients', icon: Users, label: 'Clients & dettes', cashier: true },
  { href: '/suppliers', icon: Truck, label: 'Fournisseurs', cashier: false },
  { href: '/team', icon: UserRoundCog, label: 'Equipe & roles', cashier: false },
  { href: '/reports', icon: BarChart3, label: 'Rapports', cashier: true },
  { href: '/abroad', icon: Globe, label: 'Saisie etranger', cashier: false },
  { href: '/settings', icon: Settings, label: 'Parametres', cashier: false },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const { displayName, businessName, initials, loading } = useUser()
  const { role, loading: roleLoading } = useAccountRole()
  const visibleItems = navItems.filter((item) => item.cashier || !isCashierRole(role))

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col h-screen sticky top-0 z-30',
        'bg-white border-r border-[#2D7D7D]/[0.08]',
        'transition-all duration-300 ease-in-out',
        collapsed ? 'w-[68px]' : 'w-[232px]'
      )}
    >
      <div className={cn(
        'flex items-center gap-3 px-4 h-16 border-b border-[#2D7D7D]/[0.07] flex-shrink-0',
        collapsed && 'justify-center px-0'
      )}>
        <BrandLogo
          variant="mark"
          className="h-10 w-10 flex-shrink-0 drop-shadow-[0_6px_18px_rgba(108,92,231,0.18)]"
          priority
        />
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-[#1A3636] leading-tight tracking-tight truncate">
              Saytu Yef
            </p>
            <p className="text-[10px] text-[#6B7682] font-medium tracking-wide">Gestion Pro</p>
          </div>
        )}
      </div>

      <nav className="flex-1 py-3 px-2.5 flex flex-col gap-0.5 overflow-y-auto">
        {!collapsed && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6B7682] px-2 mb-1 mt-1">
            Menu
          </p>
        )}
        {visibleItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-xl text-[13px] font-medium',
                'transition-all duration-150',
                collapsed ? 'justify-center h-10 w-10 mx-auto' : 'px-3 h-10',
                active
                  ? 'bg-gradient-to-r from-[#6C5CE7] to-[#8B7DF0] text-white shadow-[0_4px_14px_rgba(108,92,231,0.3)]'
                  : 'text-[#5C6B73] hover:text-[#1A3636] hover:bg-[#2D7D7D]/[0.06]'
              )}
            >
              <Icon
                size={17}
                className="flex-shrink-0"
                strokeWidth={active ? 2.5 : 2}
              />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          )
        })}
        {!roleLoading && isCashierRole(role) && !collapsed && (
          <div className="mt-2 rounded-xl border border-[#2D7D7D]/[0.08] bg-[#F4F7FB] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5C6B73]">
              Mode caisse
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#6B7682]">
              Acces recentre sur la vente, le stock, les clients et vos rapports personnels.
            </p>
          </div>
        )}
      </nav>

      {!collapsed && !loading && (
        <div className="mx-2.5 mb-2 p-3 rounded-xl bg-[#E8F4F2] border border-[#2D7D7D]/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2D7D7D] to-[#4FA3A3] flex items-center justify-center flex-shrink-0">
              {initials ? (
                <span className="text-[11px] font-bold text-white">{initials}</span>
              ) : (
                <User size={13} className="text-white" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-[#1A3636] truncate leading-tight">{displayName}</p>
              {businessName && (
                <p className="text-[10px] text-[#6B7682] truncate leading-tight">{businessName}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="p-2.5 border-t border-[#2D7D7D]/[0.07] flex flex-col gap-0.5">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'flex items-center gap-2.5 rounded-xl h-9 text-[13px] text-[#6B7682]',
            'hover:text-[#5C6B73] hover:bg-[#2D7D7D]/[0.06] transition-all duration-150',
            collapsed ? 'justify-center w-10 mx-auto' : 'px-3'
          )}
        >
          {collapsed
            ? <ChevronRight size={16} />
            : <><ChevronLeft size={16} /><span>Reduire</span></>
          }
        </button>

        <form action="/auth/signout" method="POST" className="w-full">
          <button
            type="submit"
            className={cn(
              'flex items-center gap-2.5 rounded-xl h-9 text-[13px] w-full',
              'text-red-500/70 hover:text-red-600 hover:bg-red-500/[0.07]',
              'transition-all duration-150',
              collapsed ? 'justify-center' : 'px-3'
            )}
          >
            <LogOut size={16} />
            {!collapsed && <span>Deconnexion</span>}
          </button>
        </form>
      </div>
    </aside>
  )
}
