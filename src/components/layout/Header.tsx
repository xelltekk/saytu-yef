'use client'
import { Bell, ChevronDown, LogOut, Package2, RefreshCw, Search, Settings, User, X } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useUser } from '@/hooks/useUser'
import { useAccountRole } from '@/hooks/useAccountRole'
import { useNotifications, type HeaderNotificationItem, type HeaderNotificationTone } from '@/hooks/useNotifications'
import { canOpenSettings } from '@/lib/accountRoles'

interface HeaderProps {
  title: string
  subtitle?: string
}

function formatNotificationDate(value?: string | null) {
  if (!value) return 'A l instant'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'A l instant'

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000))

  if (diffMinutes < 1) return 'A l instant'
  if (diffMinutes < 60) return `Il y a ${diffMinutes} min`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `Il y a ${diffHours} h`

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getNotificationToneStyles(tone: HeaderNotificationTone) {
  if (tone === 'warning') {
    return 'border-amber-500/15 bg-amber-500/[0.06]'
  }

  return 'border-red-500/15 bg-red-500/[0.06]'
}

function getNotificationIcon(item: HeaderNotificationItem) {
  const iconClassName =
    item.tone === 'warning' ? 'text-amber-600' : 'text-red-500'

  return <Package2 size={15} className={iconClassName} />
}

export function Header({ title, subtitle }: HeaderProps) {
  const [showSearch, setShowSearch] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const { user, displayName, businessName, initials, email, loading } = useUser()
  const { role } = useAccountRole()
  const {
    items: notifications,
    loading: notificationsLoading,
    error: notificationsError,
    unreadCount,
    reload: reloadNotifications,
    markRead,
    markAllRead,
    isRead,
  } = useNotifications({
    userId: user?.id ?? null,
    role,
  })

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (showSearch) searchRef.current?.focus()
  }, [showSearch])

  return (
    <header
      className="sticky top-0 z-20 flex min-h-14 items-center justify-between gap-4 border-b border-[#2D7D7D]/[0.07] bg-white/85 px-4 py-2 backdrop-blur-2xl lg:px-6"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 0px)' }}
    >
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

          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => {
                setShowNotifications((current) => {
                  const nextValue = !current
                  if (nextValue) {
                    void reloadNotifications()
                  }
                  return nextValue
                })
                setShowMenu(false)
              }}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl text-[#6B7682] hover:bg-[#2D7D7D]/[0.06] hover:text-[#5C6B73] transition-all duration-150"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-[#6C5CE7] px-1 text-[10px] font-semibold leading-none text-white shadow-[0_2px_8px_rgba(108,92,231,0.28)]">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 z-50 w-[min(92vw,380px)] overflow-hidden rounded-3xl border border-[#2D7D7D]/10 bg-white shadow-[0_16px_48px_rgba(26,54,54,0.16)]">
                <div className="flex items-center justify-between gap-3 border-b border-[#2D7D7D]/[0.07] px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#1A3636]">Notifications</p>
                    <p className="text-[11px] text-[#6B7682]">
                      {unreadCount > 0 ? `${unreadCount} non lue(s)` : 'Tout est a jour'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void reloadNotifications()}
                      className="inline-flex items-center gap-1 rounded-full border border-[#2D7D7D]/10 px-2.5 py-1 text-[11px] font-medium text-[#2D7D7D] hover:bg-[#2D7D7D]/[0.05] transition-colors"
                    >
                      <RefreshCw size={12} />
                      Actualiser
                    </button>
                    {notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={() => markAllRead()}
                        className="text-[11px] font-medium text-[#6C5CE7] hover:text-[#5B4CCF] transition-colors"
                      >
                        Tout lire
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-[420px] overflow-y-auto px-3 py-3">
                  {notificationsLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="animate-pulse rounded-2xl border border-[#2D7D7D]/10 bg-[#F8FBFC] p-3">
                          <div className="h-3 w-32 rounded-full bg-[#2D7D7D]/10" />
                          <div className="mt-2 h-3 w-full rounded-full bg-[#2D7D7D]/10" />
                          <div className="mt-2 h-3 w-24 rounded-full bg-[#2D7D7D]/10" />
                        </div>
                      ))}
                    </div>
                  ) : notificationsError ? (
                    <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.06] px-3 py-3 text-[12px] text-red-600">
                      {notificationsError}
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#2D7D7D]/15 bg-[#F8FBFC] px-4 py-4 text-[12px] text-[#6B7682]">
                      Aucune notification utile pour le moment.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {notifications.map((notification) => {
                        const unread = !isRead(notification.id)

                        return (
                          <Link
                            key={notification.id}
                            href={notification.href}
                            onClick={() => {
                              markRead(notification.id)
                              setShowNotifications(false)
                            }}
                            className={`block rounded-2xl border p-3 transition-all hover:border-[#6C5CE7]/25 hover:bg-white ${getNotificationToneStyles(notification.tone)} ${unread ? 'shadow-[0_4px_18px_rgba(108,92,231,0.08)]' : 'opacity-90'}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
                                {getNotificationIcon(notification)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <p className="text-[12px] font-semibold leading-snug text-[#1A3636]">{notification.title}</p>
                                  {unread && <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-[#6C5CE7]" />}
                                </div>
                                <p className="mt-1 text-[11px] leading-relaxed text-[#5C6B73]">{notification.message}</p>
                                <p className="mt-2 text-[10px] font-medium text-[#6B7682]">{formatNotificationDate(notification.createdAt)}</p>
                              </div>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

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
                  {loading ? '...' : displayName}
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

                {canOpenSettings(role) && (
                  <Link
                    href="/settings"
                    onClick={() => setShowMenu(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#5C6B73] hover:text-[#1A3636] hover:bg-[#2D7D7D]/[0.06] transition-colors rounded-lg mx-1"
                  >
                    <Settings size={13} /> Parametres du compte
                  </Link>
                )}

                <div className="border-t border-[#2D7D7D]/[0.07] mt-1 pt-1">
                  <form action="/auth/signout" method="POST">
                    <button
                      type="submit"
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-red-500/70 hover:text-red-600 hover:bg-red-500/[0.06] transition-colors rounded-lg mx-1 max-w-[calc(100%-8px)]"
                    >
                      <LogOut size={13} /> Deconnexion
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
