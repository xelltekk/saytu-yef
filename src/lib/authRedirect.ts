const REDIRECT_BASE = 'https://saytu-yef.local'

export function getSafeRedirectPath(value?: string | null, fallback = '/dashboard'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback

  try {
    const base = new URL(REDIRECT_BASE)
    const target = new URL(value, base)
    if (target.origin !== base.origin) return fallback
    return `${target.pathname}${target.search}${target.hash}`
  } catch {
    return fallback
  }
}
