import { describe, expect, it } from 'vitest'
import { getSafeLogoUrl, prepareBusinessLogo } from './businessLogo'

describe('business logo validation', () => {
  it('accepts normalized images and HTTPS logos', () => {
    expect(getSafeLogoUrl('data:image/png;base64,aGVsbG8=')).toBe('data:image/png;base64,aGVsbG8=')
    expect(getSafeLogoUrl('https://example.com/logo.png')).toBe('https://example.com/logo.png')
  })
  it('rejects scripts, SVG data, unencrypted URLs and credentials', () => {
    for (const url of ['javascript:alert(1)', 'data:image/svg+xml;base64,AA==', 'http://example.com/logo.png', 'https://user:pass@example.com/logo.png', '', undefined]) {
      expect(getSafeLogoUrl(url)).toBeNull()
    }
  })
  it('rejects invalid formats and large uploads before decoding', async () => {
    await expect(prepareBusinessLogo(new File(['a'], 'logo.svg', { type: 'image/svg+xml' }))).rejects.toThrow('PNG')
    await expect(prepareBusinessLogo(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'logo.png', { type: 'image/png' }))).rejects.toThrow('2 Mo')
  })
})
