function getSupabaseProjectRef(): string {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!rawUrl) return ''

  try {
    return new URL(rawUrl).hostname.split('.')[0] ?? ''
  } catch {
    return ''
  }
}

export function getSupabaseAuthCookieNames(cookieNames: string[]): string[] {
  const projectRef = getSupabaseProjectRef()
  if (!projectRef) return []

  const prefixes = [
    `sb-${projectRef}-auth-token`,
    `sb-${projectRef}-auth-token-code-verifier`,
  ]

  return cookieNames.filter((name) =>
    prefixes.some((prefix) => name === prefix || name.startsWith(`${prefix}.`))
  )
}

export function clearSupabaseAuthCookies(
  cookieNames: string[],
  clearCookie: (name: string) => void
) {
  getSupabaseAuthCookieNames(cookieNames).forEach((name) => {
    clearCookie(name)
  })
}
