'use client'
import { useEffect, useRef } from 'react'
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

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
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
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center p-2 sm:items-center sm:p-6"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="absolute inset-0 bg-[#1A3636]/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          'relative w-full max-h-[calc(100dvh-0.5rem)] rounded-[28px] sm:rounded-2xl border border-[#2D7D7D]/[0.1] bg-white shadow-[0_20px_60px_rgba(26,54,54,0.25)] fade-in',
          sizes[size]
        )}
      >
        {title && (
          <div className="flex items-center justify-between p-5 border-b border-[#2D7D7D]/[0.07]">
            <h2 className="text-base font-semibold text-[#1A3636]">{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#2D7D7D]/[0.07] text-[#6B7682] hover:text-[#1A3636] transition-colors"
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="max-h-[calc(100dvh-9rem)] overflow-y-auto p-5 sm:max-h-[70vh]">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-[#2D7D7D]/[0.07] p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
