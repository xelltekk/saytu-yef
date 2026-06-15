'use client'
import { Bell, Search, ChevronDown, LogOut, Settings, User, X } from 'lucide-react'
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
  const searchRef = useRef<HTMLInputElement>(null)
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

  useEffect(() => {
    if (showSearch) searchRef.current?.focus()
  }, [showSearch])

  return (
    <header className="sticky top-0 z-20 border-b border-[#2D7D7D]/[0.07] bg-white/85 backdrop-blur-2xl px-4 lg:px-6 h-14 flex items-center justify-between gap-4">
      {/* Title or Search */}
      {showSearch ? (
        <div className="flex-1 flex items-center gap-2">
          <Search size={15} className="text-[#6B7682] flex-shrink-0" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Rechercher..."
            className="flex-1 bg-transparent text-sm text-[#1A3636] placeholder:text-[#6B7682] outline-none"
          />
          <button
            onClick={() => setShowSearch(false)}
            className="p-1.5 rounded-lg hover:bg-[#2D7D7D]/[0.07] text-[#6B7682] hover:text-[#5C6B73] transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      ) : (
        <div className="min-w-0">
          <h1 className="text-[14px] font-semibold text-[#1A3636] leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-[11px] text-[#6B7682] leading-tight truncate">{subtitle}</p>}
        </div>
      )}

      {!showSearch && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setShowSearch(true)}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#6B7682] hover:text-[#5C6B73] hover:bg-[#2D7D7D]/[0.06] transition-all duration-150"
            aria-label="Rechercher"
          >
            <Search size={16} />
          </button>

          <button
            className="relative w-8 h-8 rounded-xl flex items-center justify-center text-[#6B7682] hover:text-[#5C6B73] hover:bg-[#2D7D7D]/[0.06] transition-all duration-150"
            aria-label="Notifications"
          >
            <Bell size={16} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#6C5CE7] ring-2 ring-white" />
          </button>

          {/* Avatar + dropdown */}
          <div className="relative ml-1" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-[#2D7D7D]/[0.06] transition-all duration-150"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#2D7D7D] to-[#4FA3A3] flex items-center justify-center flex-shrink-0 shadow-[0_2px_8px_rgba(45,125,125,0.25)]">
                {loading ? (
                  <User size={13} className="text-white" />
                ) : (
                  <span className="text-[10px] font-bold text-white">{initials}</span>
                )}
              </div>
              <div className="hidden sm:block text-left min-w-0">
                <p className="text-[12px] font-semibold text-[#1A3636] leading-tight max-w-[96px] truncate">
                  {loading ? '…' : displayName}
                </p>
                {businessName && (
                  <p className="text-[10px] text-[#6B7682] leading-tight max-w-[96px] truncate">{businessName}</p>
                )}
              </div>
              <ChevronDown size={12} className="text-[#6B7682] hidden sm:block flex-shrink-0" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-[#2D7D7D]/[0.1] bg-white shadow-[0_16px_48px_rgba(26,54,54,0.16)] py-1.5 z-50">
                <div className="px-3 py-2.5 border-b border-[#2D7D7D]/[0.07] mb-1">
                  <p className="text-[12px] font-semibold text-[#1A3636] truncate">{displayName}</p>
                  <p className="text-[10px] text-[#6B7682] truncate mt-0.5">{email}</p>
                </div>

                <Link
                  href="/settings"
                  onClick={() => setShowMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#5C6B73] hover:text-[#1A3636] hover:bg-[#2D7D7D]/[0.06] transition-colors rounded-lg mx-1"
                >
                  <Settings size={13} /> Paramètres du compte
                </Link>

                <div className="border-t border-[#2D7D7D]/[0.07] mt-1 pt-1">
                  <form action="/auth/signout" method="POST">
                    <button
                      type="submit"
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-red-500/70 hover:text-red-600 hover:bg-red-500/[0.06] transition-colors rounded-lg mx-1 max-w-[calc(100%-8px)]"
                    >
                      <LogOut size={13} /> Déconnexion
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
