'use client'
import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  footer?: React.ReactNode
}

export function Modal({ isOpen, onClose, title, children, size = 'md', footer }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    previousActiveElement.current = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    const frame = window.requestAnimationFrame(() => panelRef.current?.focus())

    return () => {
      window.cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      previousActiveElement.current?.focus()
    }
  }, [isOpen])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return

      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      )).filter((element) => !element.hasAttribute('hidden'))

      if (focusable.length === 0) {
        e.preventDefault()
        panelRef.current.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    if (isOpen) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full mx-4',
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end justify-center p-2 sm:items-center sm:p-6"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div aria-hidden="true" className="absolute inset-0 bg-[#1A3636]/40 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Fenêtre de dialogue'}
        tabIndex={-1}
        className={cn(
          'relative flex w-full max-h-[calc(100dvh-0.5rem)] flex-col overflow-hidden rounded-[28px] border border-[#2D7D7D]/[0.1] bg-white shadow-[0_20px_60px_rgba(26,54,54,0.25)] fade-in sm:rounded-2xl',
          sizes[size]
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-[#2D7D7D]/[0.07] p-4 sm:p-5">
            <h2 id={titleId} className="text-base font-semibold text-[#1A3636]">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#2D7D7D]/[0.07] text-[#6B7682] hover:text-[#1A3636] transition-colors"
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-[#2D7D7D]/[0.07] p-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:p-5">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
