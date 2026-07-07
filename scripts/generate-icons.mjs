import { mkdir } from 'fs/promises'
import sharp from 'sharp'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const brandDir = join(rootDir, 'public', 'brand')
const iconsDir = join(rootDir, 'public', 'icons')
const appDir = join(rootDir, 'src', 'app')

const sourceLogoPath = join(brandDir, 'logo-saytu-yef.png')
const markLogoPath = join(brandDir, 'logo-saytu-yef-mark.png')
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512]

await mkdir(brandDir, { recursive: true })
await mkdir(iconsDir, { recursive: true })
await mkdir(appDir, { recursive: true })

const markBuffer = await sharp(sourceLogoPath)
  .extract({
    left: 235,
    top: 95,
    width: 790,
    height: 690,
  })
  .resize(1024, 1024, {
    fit: 'contain',
    background: '#ffffff',
  })
  .png()
  .toBuffer()

await sharp(markBuffer).toFile(markLogoPath)
console.log('ok public/brand/logo-saytu-yef-mark.png')

for (const size of iconSizes) {
  await sharp(markBuffer)
    .resize(size, size)
    .png()
    .toFile(join(iconsDir, `icon-${size}x${size}.png`))
  console.log(`ok icon-${size}x${size}.png`)
}

await sharp(markBuffer).resize(192, 192).png().toFile(join(appDir, 'icon.png'))
console.log('ok src/app/icon.png')

await sharp(markBuffer).resize(180, 180).png().toFile(join(appDir, 'apple-icon.png'))
console.log('ok src/app/apple-icon.png')
