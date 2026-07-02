type CookieStoreLike = {
  getAll: () => Array<{ name: string; value: string }>
  set: (name: string, value: string, options?: Record<string, unknown>) => void
}

type CookieMutation = {
  name: string
  value: string
  options?: Record<string, unknown>
}

type ResponseLike = {
  cookies: {
    set: (name: string, value: string, options?: Record<string, unknown>) => void
  }
}

export function createResponseCookieBridge(cookieStore: CookieStoreLike) {
  const mutations: CookieMutation[] = []

  const queue = (name: string, value: string, options?: Record<string, unknown>) => {
    cookieStore.set(name, value, options)
    mutations.push({ name, value, options })
  }

  return {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items: CookieMutation[]) => {
        items.forEach(({ name, value, options }) => queue(name, value, options))
      },
    },
    set: queue,
    apply<T extends ResponseLike>(response: T) {
      mutations.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options)
      })
      return response
    },
  }
}
