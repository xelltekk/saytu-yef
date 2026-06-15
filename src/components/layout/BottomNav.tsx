'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, ShoppingCart, BarChart3, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const leftItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Accueil' },
  { href: '/inventory',  icon: Package,          label: 'Stock' },
]
const rightItems = [
  { href: '/reports',  icon: BarChart3, label: 'Rapports' },
  { href: '/settings', icon: Settings,  label: 'Réglages' },
]

export function BottomNav() {
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const NavItem = ({ href, icon: Icon, label }: { href: string; icon: typeof Package; label: string }) => {
    const active = isActive(href)
    return (
      <Link
        href={href}
        className="flex flex-col items-center gap-0.5 flex-1 py-1.5 transition-all duration-200"
      >
        <div
          className={cn(
            'flex items-center justify-center w-10 h-7 rounded-xl transition-all duration-200',
            active ? 'bg-[#6C5CE7]/[0.12]' : 'hover:bg-[#2D7D7D]/[0.06]'
          )}
        >
          <Icon
            size={19}
            strokeWidth={active ? 2.5 : 1.8}
            className={cn('transition-colors duration-200', active ? 'text-[#6C5CE7]' : 'text-[#6B7682]')}
          />
        </div>
        <span
          className={cn(
            'text-[9px] font-semibold leading-tight tracking-wide transition-colors duration-200',
            active ? 'text-[#6C5CE7]' : 'text-[#6B7682]'
          )}
        >
          {label}
        </span>
      </Link>
    )
  }

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-2xl border-t border-[#2D7D7D]/[0.07] pb-safe">
      <div className="flex items-end justify-around h-16 px-1 relative">
        {leftItems.map((item) => <NavItem key={item.href} {...item} />)}

        {/* Center floating action — Nouvelle vente */}
        <div className="flex-1 flex justify-center">
          <Link
            href="/sales"
            aria-label="Nouvelle vente"
            className="absolute -top-5 w-14 h-14 rounded-full bg-gradient-to-br from-[#2D7D7D] to-[#4FA3A3] flex items-center justify-center shadow-[0_8px_20px_rgba(45,125,125,0.4)] ring-4 ring-white active:scale-95 transition-transform"
          >
            <ShoppingCart size={22} className="text-white" strokeWidth={2.3} />
          </Link>
        </div>

        {rightItems.map((item) => <NavItem key={item.href} {...item} />)}
      </div>
    </nav>
  )
}
