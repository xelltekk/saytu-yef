'use client'
import { cn } from '@/lib/utils'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'glass'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading,
      leftIcon,
      rightIcon,
      fullWidth,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const base =
      'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f6ef7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080b14] disabled:opacity-50 disabled:cursor-not-allowed select-none'

    const variants = {
      primary:
        'bg-[#4f6ef7] hover:bg-[#3d5ce5] text-white shadow-lg shadow-[rgba(79,110,247,0.3)] hover:shadow-[rgba(79,110,247,0.5)] active:scale-[0.98]',
      secondary:
        'bg-[#8b5cf6] hover:bg-[#7c3aed] text-white shadow-lg shadow-[rgba(139,92,246,0.3)] active:scale-[0.98]',
      ghost: 'text-[#8892aa] hover:text-[#f0f2f8] hover:bg-white/5 active:scale-[0.98]',
      danger:
        'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 active:scale-[0.98]',
      outline:
        'border border-white/10 hover:border-white/20 text-[#f0f2f8] hover:bg-white/5 active:scale-[0.98]',
      glass:
        'glass text-[#f0f2f8] hover:bg-white/10 active:scale-[0.98]',
    }

    const sizes = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-4 text-sm',
      lg: 'h-12 px-6 text-base',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
        {...props}
      >
        {isLoading ? (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    )
  }
)
Button.displayName = 'Button'
