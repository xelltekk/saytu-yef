'use client'
import { cn } from '@/lib/utils'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'glass' | 'gold' | 'teal'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, leftIcon, rightIcon, fullWidth, children, disabled, ...props }, ref) => {
    const base = [
      'inline-flex items-center justify-center gap-2',
      'font-semibold rounded-full',
      'transition-all duration-200',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C5CE7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EEF1FA]',
      'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
      'select-none active:scale-[0.97]',
    ].join(' ')

    const variants = {
      primary: [
        'text-white',
        'bg-gradient-to-r from-[#6C5CE7] to-[#8B7DF0]',
        'shadow-[0_6px_18px_rgba(108,92,231,0.32)]',
        'hover:shadow-[0_8px_24px_rgba(108,92,231,0.45)]',
        'hover:brightness-105',
      ].join(' '),

      secondary: [
        'text-white',
        'bg-gradient-to-r from-[#8B7DF0] to-[#6C5CE7]',
        'shadow-[0_6px_18px_rgba(108,92,231,0.3)]',
        'hover:shadow-[0_8px_24px_rgba(108,92,231,0.45)]',
        'hover:brightness-105',
      ].join(' '),

      teal: [
        'text-white',
        'bg-gradient-to-r from-[#2D7D7D] to-[#4FA3A3]',
        'shadow-[0_6px_18px_rgba(45,125,125,0.28)]',
        'hover:shadow-[0_8px_24px_rgba(45,125,125,0.42)]',
        'hover:brightness-105',
      ].join(' '),

      gold: [
        'text-white',
        'bg-gradient-to-r from-[#F59E0B] to-[#F97316]',
        'shadow-[0_6px_18px_rgba(245,158,11,0.3)]',
        'hover:shadow-[0_8px_24px_rgba(245,158,11,0.42)]',
        'hover:brightness-105',
      ].join(' '),

      ghost: [
        'text-[#5C6B73]',
        'hover:text-[#1A3636] hover:bg-[#2D7D7D]/[0.07]',
      ].join(' '),

      danger: [
        'text-red-600',
        'bg-red-500/10 border border-red-500/20',
        'hover:bg-red-500/16 hover:border-red-500/30',
      ].join(' '),

      outline: [
        'text-[#2D7D7D]',
        'border border-[#2D7D7D]/[0.25]',
        'hover:border-[#2D7D7D]/[0.45] hover:bg-[#2D7D7D]/[0.05]',
      ].join(' '),

      glass: [
        'text-[#1A3636]',
        'bg-white/70 border border-[#2D7D7D]/[0.1]',
        'backdrop-blur-xl',
        'hover:bg-white hover:border-[#2D7D7D]/[0.2]',
      ].join(' '),
    }

    const sizes = {
      sm: 'h-8 px-4 text-xs gap-1.5',
      md: 'h-11 px-6 text-sm',
      lg: 'h-13 px-8 text-[15px] py-3.5',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
        {...props}
      >
        {isLoading ? (
          <svg className="animate-spin h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
      </button>
    )
  }
)
Button.displayName = 'Button'
