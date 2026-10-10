import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'public/brand/logo-saytu-yef-mark-v2.png')
const icons = join(root, 'public/icons')
await mkdir(icons, { recursive: true })

const sizes = [16, 32, 48]
const images = await Promise.all(sizes.map((size) => sharp(source)
  .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer()))

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
await sharp(source)
  .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(join(root, 'src/app/icon.png'))
console.log('Generated Saytu Yef browser icons (16, 32, 48 and 192 pixels).')
