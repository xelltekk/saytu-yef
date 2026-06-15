import { cn } from '@/lib/utils'
import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  leftAddon?: React.ReactNode
  rightAddon?: React.ReactNode
}

const inputBase = [
  'w-full h-12 px-4 rounded-full text-sm',
  'bg-white border border-[#2D7D7D]/[0.14]',
  'text-[#1A3636] placeholder:text-[#6B7682]',
  'transition-all duration-200',
  'focus:border-[#6C5CE7]/60 focus:bg-white',
  'focus:shadow-[0_0_0_4px_rgba(108,92,231,0.10)]',
  'hover:border-[#2D7D7D]/[0.24]',
].join(' ')

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, leftAddon, rightAddon, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73] ml-1">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftAddon && (
            <span className="absolute left-4 text-[#6B7682] flex items-center pointer-events-none z-10">
              {leftAddon}
            </span>
          )}
          <input
            ref={ref}
            className={cn(
              inputBase,
              leftAddon && 'pl-10',
              rightAddon && 'pr-10',
              error && 'border-[#EF4444]/50 focus:border-[#EF4444]/70 focus:shadow-[0_0_0_4px_rgba(239,68,68,0.10)]',
              className
            )}
            {...props}
          />
          {rightAddon && (
            <span className="absolute right-4 text-[#6B7682] flex items-center pointer-events-none z-10">
              {rightAddon}
            </span>
          )}
        </div>
        {error && <p className="text-[11px] text-[#DC2626] flex items-center gap-1 ml-1">⚠ {error}</p>}
        {hint && !error && <p className="text-[11px] text-[#6B7682] ml-1">{hint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
  rows?: number
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, rows = 3, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73] ml-1">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          rows={rows}
          className={cn(
            'w-full px-4 py-3 rounded-2xl text-sm resize-none',
            'bg-white border border-[#2D7D7D]/[0.14]',
            'text-[#1A3636] placeholder:text-[#6B7682]',
            'transition-all duration-200',
            'focus:border-[#6C5CE7]/60',
            'focus:shadow-[0_0_0_4px_rgba(108,92,231,0.10)]',
            'hover:border-[#2D7D7D]/[0.24]',
            error && 'border-[#EF4444]/50',
            className
          )}
          {...props}
        />
        {error && <p className="text-[11px] text-[#DC2626] ml-1">⚠ {error}</p>}
        {hint && !error && <p className="text-[11px] text-[#6B7682] ml-1">{hint}</p>}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  options: { value: string; label: string }[]
}

export function Select({ label, hint, options, className, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73] ml-1">
          {label}
        </label>
      )}
      <select
        className={cn(
          'w-full h-12 px-4 rounded-full text-sm appearance-none',
          'bg-white border border-[#2D7D7D]/[0.14]',
          'text-[#1A3636]',
          'transition-all duration-200',
          'focus:border-[#6C5CE7]/60',
          'focus:shadow-[0_0_0_4px_rgba(108,92,231,0.10)]',
          'hover:border-[#2D7D7D]/[0.24]',
          'cursor-pointer',
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-white">
            {opt.label}
          </option>
        ))}
      </select>
      {hint && <p className="text-[11px] text-[#6B7682] ml-1">{hint}</p>}
    </div>
  )
}
