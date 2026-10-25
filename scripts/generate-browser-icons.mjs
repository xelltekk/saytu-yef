import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'public/brand/logo-saytu-yef-mark-v2.png')
const icons = join(root, 'public/icons')
await mkdir(icons, { recursive: true })

const sizes = [16, 32, 48]
const gradient = '<defs><linearGradient id="border" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#8B7DF0"/><stop offset="0.48" stop-color="#6C5CE7"/><stop offset="1" stop-color="#2D7D7D"/></linearGradient></defs>'
const frame = (maskable) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${gradient}${maskable
  ? '<rect width="512" height="512" fill="white"/><circle cx="256" cy="256" r="212" fill="white" stroke="url(#border)" stroke-width="24"/>'
  : '<rect x="16" y="16" width="480" height="480" rx="108" fill="white" stroke="url(#border)" stroke-width="32"/>'}</svg>`)

// Composite the original brand mark unchanged; only its surrounding frame is new.
async function master(maskable = false) {
  const edge = maskable ? 312 : 352
  const mark = await sharp(source).resize(edge, edge, { fit: 'contain', background: '#ffffff00' }).png().toBuffer()
  return sharp(frame(maskable)).composite([{ input: mark, left: (512-edge)/2, top: (512-edge)/2 }]).png().toBuffer()
}
const artwork = await master()
const maskableArtwork = await master(true)
const render = (size) => sharp(artwork).resize(size, size).png().toBuffer()
const images = await Promise.all(sizes.map(render))

for (let index = 0; index < sizes.length; index++) {
  await writeFile(join(icons, `saytu-yef-${sizes[index]}.png`), images[index])
}

// ICO directory entries point to the PNG payload for each browser size.
const directory = Buffer.alloc(6 + sizes.length * 16)
directory.writeUInt16LE(1, 2)
directory.writeUInt16LE(sizes.length, 4)
let offset = directory.length
for (let index = 0; index < sizes.length; index++) {
  const entry = 6 + index * 16
  directory[entry] = sizes[index]
  directory[entry + 1] = sizes[index]
  directory.writeUInt16LE(1, entry + 4)
  directory.writeUInt16LE(32, entry + 6)
  directory.writeUInt32LE(images[index].length, entry + 8)
  directory.writeUInt32LE(offset, entry + 12)
  offset += images[index].length
}
await writeFile(join(root, 'src/app/favicon.ico'), Buffer.concat([directory, ...images]))
await writeFile(join(root, 'src/app/icon.png'), await render(192))
await sharp(artwork).flatten({ background: '#ffffff' }).resize(180, 180).png().toFile(join(root, 'src/app/apple-icon.png'))
for (const size of [72, 96, 128, 144, 152, 192, 384, 512]) {
  await writeFile(join(icons, `icon-${size}x${size}.png`), await render(size))
}
for (const size of [192, 512]) {
  await sharp(maskableArtwork).resize(size,size).png().toFile(join(icons, `maskable-${size}.png`))
}
console.log('Generated framed browser, Apple and PWA icons from the original Saytu Yef mark.')
