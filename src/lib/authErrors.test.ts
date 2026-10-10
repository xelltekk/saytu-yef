import { describe, expect, it } from 'vitest'
import { getLoginHttpErrorMessage } from './authErrors'

describe('login HTTP errors', () => {
  it.each([500, 502, 503, 504])('identifies server failure %i without blaming credentials', (status) => {
    expect(getLoginHttpErrorMessage(status)).toBe(
      `Le serveur de connexion est indisponible (erreur ${status}). Reessayez plus tard.`,
    )
  })

  it('keeps authentication errors returned as JSON', () => {
    expect(getLoginHttpErrorMessage(400, 'Email ou mot de passe incorrect.')).toBe(
      'Email ou mot de passe incorrect.',
    )
  })

  it('handles throttling even when the gateway returns HTML', () => {
    expect(getLoginHttpErrorMessage(429)).toContain('Trop de tentatives')
  })

  it.each([null, {}, 42, ''])('handles absent or malformed error fields: %j', (error) => {
    expect(getLoginHttpErrorMessage(400, error)).toContain('Impossible de se connecter')
  })
})
