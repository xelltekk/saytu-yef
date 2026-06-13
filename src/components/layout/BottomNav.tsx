'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, ShoppingCart, BarChart3, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Accueil' },
  { href: '/inventory', icon: Package, label: 'Stock' },
  { href: '/sales', icon: ShoppingCart, label: 'Ventes' },
  { href: '/reports', icon: BarChart3, label: 'Rapports' },
  { href: '/settings', icon: Settings, label: 'Réglages' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.06] bg-[#0a0e1a]/90 backdrop-blur-xl pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-[56px]',
                active ? 'text-[#4f6ef7]' : 'text-[#8892aa]'
              )}
            >
              <div className={cn('p-1.5 rounded-xl transition-all duration-200', active && 'bg-[#4f6ef7]/10')}>
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              </div>
              <span className="text-[10px] font-medium leading-tight">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
