import { describe, expect, it } from 'vitest'
import { getSafeRedirectPath } from './authRedirect'

describe('redirections après authentification', () => {
  it('accepte un chemin interne avec paramètres', () => {
    expect(getSafeRedirectPath('/sales?page=2#recent')).toBe('/sales?page=2#recent')
  })

  it('refuse une URL absolue', () => {
    expect(getSafeRedirectPath('https://example.com')).toBe('/dashboard')
  })

  it('refuse une URL commençant par deux barres', () => {
    expect(getSafeRedirectPath('//example.com')).toBe('/dashboard')
  })

  it('utilise le chemin de secours demandé', () => {
    expect(getSafeRedirectPath(null, '/inventory')).toBe('/inventory')
  })
})
