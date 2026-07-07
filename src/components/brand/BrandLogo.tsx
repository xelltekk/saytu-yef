import Image from 'next/image'
import { cn } from '@/lib/utils'

type BrandLogoVariant = 'full' | 'mark'

interface BrandLogoProps {
  variant?: BrandLogoVariant
  className?: string
  imageClassName?: string
  alt?: string
  priority?: boolean
}

const SOURCES: Record<BrandLogoVariant, string> = {
  full: '/brand/logo-saytu-yef.png',
  mark: '/brand/logo-saytu-yef-mark.png',
}

const SIZES: Record<BrandLogoVariant, string> = {
  full: '(max-width: 768px) 180px, 260px',
  mark: '(max-width: 768px) 48px, 64px',
}

export function BrandLogo({
  variant = 'mark',
  className,
  imageClassName,
  alt = 'Logo Saytu Yef',
  priority = false,
}: BrandLogoProps) {
  return (
    <div className={cn('relative shrink-0', className)}>
      <Image
        src={SOURCES[variant]}
        alt={alt}
        fill
        priority={priority}
        sizes={SIZES[variant]}
        className={cn('object-contain', imageClassName)}
      />
    </div>
  )
}
