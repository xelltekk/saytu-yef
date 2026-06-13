'use client'
import { Bell, Search, ChevronDown, LogOut, Settings, User } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useUser } from '@/hooks/useUser'

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const [showSearch, setShowSearch] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { displayName, businessName, initials, email, loading } = useUser()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#080b14]/80 backdrop-blur-xl px-4 lg:px-6 h-14 flex items-center justify-between">
      <div>
        <h1 className="text-sm font-semibold text-[#f0f2f8]">{title}</h1>
        {subtitle && <p className="text-xs text-[#8892aa]">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="p-2 rounded-xl hover:bg-white/[0.05] text-[#8892aa] hover:text-[#f0f2f8] transition-colors"
          aria-label="Rechercher"
        >
          <Search size={18} />
        </button>

        <button
          className="relative p-2 rounded-xl hover:bg-white/[0.05] text-[#8892aa] hover:text-[#f0f2f8] transition-colors"
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#4f6ef7]" />
        </button>

        {/* Avatar + dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-xl hover:bg-white/[0.05] transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4f6ef7] to-[#8b5cf6] flex items-center justify-center flex-shrink-0">
              {loading ? (
                <User size={14} className="text-white" />
              ) : (
                <span className="text-[10px] font-bold text-white">{initials}</span>
              )}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-medium text-[#f0f2f8] leading-tight max-w-[100px] truncate">
                {loading ? '…' : displayName}
              </p>
              {businessName && (
                <p className="text-[10px] text-[#8892aa] leading-tight max-w-[100px] truncate">{businessName}</p>
              )}
            </div>
            <ChevronDown size={13} className="text-[#8892aa] hidden sm:block" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-white/[0.08] bg-[#0d1120] shadow-2xl shadow-black/60 py-1.5 z-50">
              {/* Info utilisateur */}
              <div className="px-3 py-2.5 border-b border-white/[0.06] mb-1">
                <p className="text-xs font-medium text-[#f0f2f8] truncate">{displayName}</p>
                <p className="text-[10px] text-[#8892aa] truncate mt-0.5">{email}</p>
              </div>

              <Link
                href="/settings"
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-xs text-[#8892aa] hover:text-[#f0f2f8] hover:bg-white/[0.04] transition-colors"
              >
                <Settings size={14} /> Paramètres du compte
              </Link>

              <div className="border-t border-white/[0.06] mt-1 pt-1">
                <form action="/auth/signout" method="POST">
                  <button
                    type="submit"
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/5 transition-colors"
                  >
                    <LogOut size={14} /> Déconnexion
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
