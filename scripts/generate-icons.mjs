import sharp from 'sharp'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../public/icons')

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

function makeSVG(size) {
  const r = Math.round(size * 0.22)
  const zapSize = Math.round(size * 0.52)
  const cx = size / 2
  const cy = Math.round(size / 2 + zapSize * 0.18)

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f6ef7"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#bg)"/>
  <text x="${cx}" y="${cy}"
        text-anchor="middle"
        font-size="${zapSize}"
        fill="white"
        font-family="Arial, sans-serif">⚡</text>
</svg>`)
}

for (const size of sizes) {
  await sharp(makeSVG(size))
    .png()
    .toFile(join(outDir, `icon-${size}x${size}.png`))
  console.log(`✓ icon-${size}x${size}.png`)
}

// Also generate favicon
await sharp(makeSVG(32)).png().toFile(join(__dirname, '../public/favicon.ico'))
console.log('✓ favicon.ico')
