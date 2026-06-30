function normalizeOrigin(value?: string) {
  if (!value) return null

  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

export function getConfiguredPublicOrigin() {
  return normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL)
}

export function getBrowserEmailRedirectOrigin() {
  const configuredOrigin = getConfiguredPublicOrigin()
  if (configuredOrigin) return configuredOrigin

  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  return 'http://localhost:3000'
}
