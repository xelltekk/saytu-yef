import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import sharp from 'sharp'

describe('Saytu Yef browser icons', () => {
  it('provides decodable ICO entries for each tab icon size', async () => {
    const ico = await readFile('src/app/favicon.ico')
    expect(ico.readUInt16LE(0)).toBe(0)
    expect(ico.readUInt16LE(2)).toBe(1)
    expect(ico.readUInt16LE(4)).toBe(3)
    for (const [index, size] of [16, 32, 48].entries()) {
      const entry = 6 + index * 16
      const length = ico.readUInt32LE(entry + 8)
      const offset = ico.readUInt32LE(entry + 12)
      expect(offset + length).toBeLessThanOrEqual(ico.length)
      const png = ico.subarray(offset, offset + length)
      expect(await sharp(png).metadata()).toMatchObject({ width: size, height: size, hasAlpha: true })
      expect(png.equals(await readFile(`public/icons/saytu-yef-${size}.png`))).toBe(true)
    }
  })

  it('uses the existing brand mark for the file-based app icon', async () => {
    const expected = await sharp('public/brand/logo-saytu-yef-mark-v2.png')
      .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .raw().toBuffer()
    const actual = await sharp('src/app/icon.png').raw().toBuffer()
    expect(actual.equals(expected)).toBe(true)
  })
})
