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

  it('preserves the original mark in the framed artwork without recoloring it', async () => {
    const mark = await sharp('public/brand/logo-saytu-yef-mark-v2.png')
      .resize(352, 352, { fit: 'contain', background: '#ffffff00' })
      .png().toBuffer()
    const onWhite = await sharp({create:{width:352,height:352,channels:4,background:'#ffffff'}})
      .composite([{input:mark}]).png().toBuffer()
    const expected = await sharp(onWhite).removeAlpha().raw().toBuffer()
    const actual = await sharp('public/icons/icon-512x512.png')
      .extract({left:80,top:80,width:352,height:352}).removeAlpha().raw().toBuffer()
    expect(actual.equals(expected)).toBe(true)
  })

  it('renders a colored gradient frame, white interior and transparent rounded corners',async () => {
    const {data,info}=await sharp('public/icons/icon-512x512.png').ensureAlpha().raw().toBuffer({resolveWithObject:true})
    const pixel=(x:number,y:number) => [...data.subarray((y*info.width+x)*4,(y*info.width+x)*4+4)]
    expect(pixel(0,0)[3]).toBe(0)
    expect(pixel(256,64)).toEqual([255,255,255,255])
    const top=pixel(256,16),bottom=pixel(256,495)
    expect(top[0]-bottom[0]).toBeGreaterThan(20)
    expect(top[2]-bottom[2]).toBeGreaterThan(30)
    expect(top[3]).toBe(255)
    expect(bottom[3]).toBe(255)
  })

  it('keeps browser, Apple and PWA sizes aligned and maskable icons opaque',async () => {
    for(const size of [72,96,128,144,152,192,384,512]) {
      expect(await sharp(`public/icons/icon-${size}x${size}.png`).metadata()).toMatchObject({width:size,height:size})
    }
    expect((await readFile('src/app/icon.png')).equals(await readFile('public/icons/icon-192x192.png'))).toBe(true)
    expect(await sharp('src/app/apple-icon.png').metadata()).toMatchObject({width:180,height:180})
    for(const size of [192,512]) {
      const icon=sharp(`public/icons/maskable-${size}.png`)
      expect(await icon.metadata()).toMatchObject({width:size,height:size})
      expect((await icon.ensureAlpha().stats()).channels[3].min).toBe(255)
    }
    const manifest=JSON.parse(await readFile('public/manifest.json','utf8'))
    expect(manifest.id).toBe('/')
    expect(manifest.icons.some((icon:{purpose:string}) => icon.purpose==='maskable')).toBe(true)
    expect(manifest.icons.every((icon:{src:string;purpose:string}) => icon.src.endsWith('?v=20261025-gradient') && ['any','maskable'].includes(icon.purpose))).toBe(true)
  })
})
