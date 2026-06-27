const LOCAL_HOST_PATTERN = /^(localhost|127\.0\.0\.1|\[::1\]|::1)(:\d+)?$/i

function firstHeaderValue(value: string | null): string | null {
  return value?.split(',')[0]?.trim() || null
}

function getConfiguredOrigin(): string | null {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL
  if (!configured) return null

  try {
    return new URL(configured).origin
  } catch {
    return null
  }
}

function getRequestUrlOrigin(request: Request): string | null {
  try {
    return new URL(request.url).origin
  } catch {
    return null
  }
}

export function getRequestOrigin(request: Request): string {
  const configuredOrigin = getConfiguredOrigin()
  const forwardedHost = firstHeaderValue(request.headers.get('x-forwarded-host'))
  const forwardedProto = firstHeaderValue(request.headers.get('x-forwarded-proto'))
  const host = forwardedHost ?? firstHeaderValue(request.headers.get('host'))

  if (host && !LOCAL_HOST_PATTERN.test(host)) {
    const requestOrigin = getRequestUrlOrigin(request)
    const proto = forwardedProto ?? requestOrigin?.split('://')[0] ?? 'https'
    return `${proto}://${host}`
  }

  if (configuredOrigin) return configuredOrigin

  return getRequestUrlOrigin(request) ?? 'http://localhost:3000'
}
