import JsBarcode from 'jsbarcode'
import type { Product } from '@/types'
import { formatCurrency, formatProductLabel, getProductVariantSummary } from '@/lib/utils'

type BarcodeFormat = 'CODE128' | 'EAN13' | 'EAN8' | 'UPC'

type VariantSeed = {
  size?: string
  color?: string
}

export type BarcodeLabelEntry = {
  id: string
  name: string
  size?: string | null
  color?: string | null
  sku?: string | null
  barcode: string
  selling_price: number
  currency?: string | null
  copies: number
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const INTERNAL_EAN_PREFIX = '29'

function sanitizeBarcodeSeed(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

function createEntropy(length = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(length))
    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
  }

  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
}

function createNumericEntropy(length = 6) {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(length))
    return Array.from(bytes, (byte) => String(byte % 10)).join('')
  }

  return Array.from({ length }, () => String(Math.floor(Math.random() * 10))).join('')
}

function hashSeedToDigits(value: string, length: number) {
  let hash = 0

  for (const char of value) {
    hash = ((hash * 31) + char.charCodeAt(0)) >>> 0
  }

  let digits = ''
  while (digits.length < length) {
    hash = ((hash * 1664525) + 1013904223) >>> 0
    digits += String(hash % 10)
  }

  return digits.slice(0, length)
}

function getEan13CheckDigit(value12: string) {
  const digits = value12.replace(/\D/g, '')
  if (digits.length !== 12) {
    throw new Error('Un code EAN13 doit contenir 12 chiffres avant la cle de controle.')
  }

  const sum = digits
    .split('')
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0)

  return String((10 - (sum % 10)) % 10)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function slugifyFilename(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'etiquettes-code-barres'
}

function mmToPt(value: number) {
  return (value * 72) / 25.4
}

function printHTMLDocument(title: string, html: string) {
  if (typeof document === 'undefined') {
    throw new Error("L'impression n'est disponible que dans le navigateur.")
  }

  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  iframe.title = title
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow?.document
  if (!doc) {
    document.body.removeChild(iframe)
    throw new Error("Impossible d'ouvrir la fenetre d'impression.")
  }

  doc.open()
  doc.write(html)
  doc.close()

  const printWindow = iframe.contentWindow
  window.setTimeout(() => {
    printWindow?.focus()
    printWindow?.print()
    window.setTimeout(() => {
      if (iframe.isConnected) document.body.removeChild(iframe)
    }, 1500)
  }, 250)
}

export function normalizeBarcodeValue(value: string) {
  return value.trim().replace(/\s+/g, '').toUpperCase()
}

export function normalizeBarcodeLookupValue(value?: string | null) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

export function getBarcodeFormat(value: string): BarcodeFormat {
  const normalized = normalizeBarcodeValue(value)
  if (/^\d{13}$/.test(normalized)) return 'EAN13'
  if (/^\d{12}$/.test(normalized)) return 'UPC'
  if (/^\d{8}$/.test(normalized)) return 'EAN8'
  return 'CODE128'
}

export function generateVariantBarcode(productName: string, variant: VariantSeed = {}, index = 0) {
  const seed = [
    sanitizeBarcodeSeed(productName),
    sanitizeBarcodeSeed(variant.size?.trim() || ''),
    sanitizeBarcodeSeed(variant.color?.trim() || ''),
    String(index + 1).padStart(2, '0'),
    createEntropy(4),
    createNumericEntropy(4),
  ]
    .filter(Boolean)
    .join('|')

  const body = `${INTERNAL_EAN_PREFIX}${hashSeedToDigits(seed, 10)}`
  return `${body}${getEan13CheckDigit(body)}`
}

export function renderBarcodeSvg(value: string) {
  if (typeof document === 'undefined') {
    throw new Error('Le rendu barcode demande un contexte navigateur.')
  }

  const normalized = normalizeBarcodeValue(value)
  if (!normalized) {
    throw new Error('Code-barres vide.')
  }

  const svg = document.createElementNS(SVG_NAMESPACE, 'svg')
  const format = getBarcodeFormat(normalized)
  JsBarcode(svg, normalized, {
    format,
    lineColor: '#1A3636',
    background: '#ffffff',
    width: format === 'CODE128' ? 2 : 2.4,
    height: format === 'CODE128' ? 52 : 64,
    margin: 2,
    displayValue: false,
  })

  return svg.outerHTML
}

function expandBarcodeLabels(labels: BarcodeLabelEntry[]) {
  return labels.flatMap((label) => (
    Array.from({ length: Math.max(1, label.copies) }, (_, index) => ({
      ...label,
      copyKey: `${label.id}-${index}`,
      variantLabel: getProductVariantSummary(label),
      barcodeValue: normalizeBarcodeValue(label.barcode),
      priceLabel: formatCurrency(label.selling_price, label.currency || 'XOF'),
      productLabel: formatProductLabel(label),
    }))
  ))
}

function renderBarcodeCanvas(value: string) {
  if (typeof document === 'undefined') {
    throw new Error('Le rendu barcode demande un contexte navigateur.')
  }

  const normalized = normalizeBarcodeValue(value)
  if (!normalized) {
    throw new Error('Code-barres vide.')
  }

  const canvas = document.createElement('canvas')
  const format = getBarcodeFormat(normalized)
  JsBarcode(canvas, normalized, {
    format,
    lineColor: '#1A3636',
    background: '#ffffff',
    width: format === 'CODE128' ? 2 : 2.4,
    height: format === 'CODE128' ? 52 : 64,
    margin: 6,
    displayValue: false,
  })

  return canvas
}

function wrapPdfText(text: string, maxWidth: number, measure: (value: string) => number) {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (measure(next) <= maxWidth) {
      current = next
      continue
    }

    if (current) {
      lines.push(current)
      current = ''
    }

    if (measure(word) <= maxWidth) {
      current = word
      continue
    }

    let segment = ''
    for (const char of word) {
      const nextSegment = `${segment}${char}`
      if (measure(nextSegment) <= maxWidth) {
        segment = nextSegment
      } else {
        if (segment) lines.push(segment)
        segment = char
      }
    }
    current = segment
  }

  if (current) lines.push(current)
  return lines
}

export function printBarcodeLabels(labels: BarcodeLabelEntry[], title = 'Etiquettes code-barres') {
  const expandedLabels = expandBarcodeLabels(labels).map((label) => ({
    ...label,
    barcodeSvg: renderBarcodeSvg(label.barcode),
  }))

  if (expandedLabels.length === 0) {
    throw new Error('Aucune etiquette a imprimer.')
  }

  const cards = expandedLabels.map((label) => `
    <article class="label-card">
      <div class="label-top">
        <div class="label-title">${escapeHtml(label.name)}</div>
        <div class="label-price">${escapeHtml(label.priceLabel)}</div>
      </div>
      ${label.variantLabel ? `<div class="label-variant">${escapeHtml(label.variantLabel)}</div>` : ''}
      <div class="barcode-wrap">${label.barcodeSvg}</div>
      <div class="barcode-value">${escapeHtml(label.barcodeValue)}</div>
      ${label.sku?.trim() ? `<div class="sku-value">Ref: ${escapeHtml(label.sku.trim())}</div>` : ''}
    </article>
  `).join('')

  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(title)}</title>
      <style>
        :root {
          color-scheme: light;
          font-family: Arial, Helvetica, sans-serif;
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          padding: 8mm;
          background: #ffffff;
          color: #1A3636;
        }

        .sheet {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(64mm, 1fr));
          gap: 4mm;
        }

        .label-card {
          border: 1px solid #dbe6ef;
          border-radius: 4mm;
          background: #ffffff;
          padding: 3.2mm;
          min-height: 34mm;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          page-break-inside: avoid;
        }

        .label-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 3mm;
        }

        .label-title {
          font-size: 11pt;
          font-weight: 700;
          line-height: 1.1;
          flex: 1;
          min-width: 0;
          word-break: break-word;
        }

        .label-price {
          font-size: 10pt;
          font-weight: 800;
          color: #6C5CE7;
          text-align: right;
          white-space: nowrap;
        }

        .label-variant {
          margin-top: 1.5mm;
          font-size: 8.5pt;
          color: #5C6B73;
          min-height: 10pt;
        }

        .barcode-wrap {
          margin-top: 2.5mm;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .barcode-wrap svg {
          width: 56mm;
          max-width: 100%;
          height: 18mm;
        }

        .barcode-value {
          margin-top: 1.2mm;
          text-align: center;
          font-size: 8.5pt;
          font-weight: 700;
          letter-spacing: 0.08em;
        }

        .sku-value {
          margin-top: 1mm;
          text-align: center;
          font-size: 7.5pt;
          color: #5C6B73;
        }

        @page {
          size: A4 portrait;
          margin: 6mm;
        }

        @media print {
          body {
            padding: 0;
          }
        }
      </style>
    </head>
    <body>
      <section class="sheet">${cards}</section>
    </body>
  </html>`

  printHTMLDocument(title, html)
}

export async function exportBarcodeLabelsPdf(labels: BarcodeLabelEntry[], title = 'Etiquettes code-barres') {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    throw new Error("L'export PDF n'est disponible que dans le navigateur.")
  }

  const expandedLabels = expandBarcodeLabels(labels)
  if (expandedLabels.length === 0) {
    throw new Error('Aucune etiquette a exporter.')
  }

  const [{ PDFDocument, StandardFonts, rgb }, barcodeImages] = await Promise.all([
    import('pdf-lib'),
    Promise.all(expandedLabels.map(async (label) => ({
      id: label.copyKey,
      pngDataUrl: renderBarcodeCanvas(label.barcode).toDataURL('image/png'),
    }))),
  ])

  const barcodeImageMap = new Map(barcodeImages.map((image) => [image.id, image.pngDataUrl]))

  const pdf = await PDFDocument.create()
  pdf.setTitle(title)
  pdf.setProducer('Saytu Yef')
  pdf.setCreator('Saytu Yef')

  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = mmToPt(210)
  const pageHeight = mmToPt(297)
  const margin = mmToPt(6)
  const gap = mmToPt(4)
  const columns = 3
  const labelWidth = (pageWidth - (margin * 2) - (gap * (columns - 1))) / columns
  const labelHeight = mmToPt(36)
  const rowsPerPage = Math.max(1, Math.floor((pageHeight - (margin * 2) + gap) / (labelHeight + gap)))
  const labelsPerPage = columns * rowsPerPage

  const colors = {
    border: rgb(0.86, 0.9, 0.94),
    text: rgb(0.1, 0.21, 0.21),
    muted: rgb(0.36, 0.42, 0.45),
    accent: rgb(0.42, 0.36, 0.91),
  }

  for (let pageIndex = 0; pageIndex * labelsPerPage < expandedLabels.length; pageIndex += 1) {
    const page = pdf.addPage([pageWidth, pageHeight])
    const pageLabels = expandedLabels.slice(pageIndex * labelsPerPage, (pageIndex + 1) * labelsPerPage)

    for (const [index, label] of pageLabels.entries()) {
      const column = index % columns
      const row = Math.floor(index / columns)
      const x = margin + (column * (labelWidth + gap))
      const y = pageHeight - margin - ((row + 1) * labelHeight) - (row * gap)

      page.drawRectangle({
        x,
        y,
        width: labelWidth,
        height: labelHeight,
        borderColor: colors.border,
        borderWidth: 0.75,
      })

      const padding = mmToPt(3)
      const titleFontSize = 10.5
      const priceFontSize = 9.5
      const variantFontSize = 7.5
      const codeFontSize = 7.5
      const skuFontSize = 6.5
      const titleWidth = labelWidth - (padding * 2) - mmToPt(22)
      const titleLines = wrapPdfText(
        label.productLabel,
        titleWidth,
        (value) => fontBold.widthOfTextAtSize(value, titleFontSize)
      ).slice(0, 2)

      let cursorY = y + labelHeight - padding - titleFontSize
      titleLines.forEach((line) => {
        page.drawText(line, {
          x: x + padding,
          y: cursorY,
          size: titleFontSize,
          font: fontBold,
          color: colors.text,
        })
        cursorY -= titleFontSize + 1
      })

      page.drawText(label.priceLabel, {
        x: x + labelWidth - padding - fontBold.widthOfTextAtSize(label.priceLabel, priceFontSize),
        y: y + labelHeight - padding - priceFontSize,
        size: priceFontSize,
        font: fontBold,
        color: colors.accent,
      })

      if (label.variantLabel) {
        const variantLines = wrapPdfText(
          label.variantLabel,
          labelWidth - (padding * 2),
          (value) => fontRegular.widthOfTextAtSize(value, variantFontSize)
        ).slice(0, 2)

        variantLines.forEach((line) => {
          page.drawText(line, {
            x: x + padding,
            y: cursorY,
            size: variantFontSize,
            font: fontRegular,
            color: colors.muted,
          })
          cursorY -= variantFontSize + 1
        })
      }

      const barcodePng = barcodeImageMap.get(label.copyKey)
      if (!barcodePng) continue

      const barcodeImage = await pdf.embedPng(barcodePng)
      const barcodeBoxWidth = labelWidth - (padding * 2)
      const barcodeBoxHeight = mmToPt(16)
      const barcodeY = y + mmToPt(9)
      const barcodeScale = Math.min(barcodeBoxWidth / barcodeImage.width, barcodeBoxHeight / barcodeImage.height)
      const barcodeWidth = barcodeImage.width * barcodeScale
      const barcodeHeight = barcodeImage.height * barcodeScale

      page.drawImage(barcodeImage, {
        x: x + ((labelWidth - barcodeWidth) / 2),
        y: barcodeY,
        width: barcodeWidth,
        height: barcodeHeight,
      })

      page.drawText(label.barcodeValue, {
        x: x + ((labelWidth - fontBold.widthOfTextAtSize(label.barcodeValue, codeFontSize)) / 2),
        y: y + mmToPt(5.6),
        size: codeFontSize,
        font: fontBold,
        color: colors.text,
      })

      if (label.sku?.trim()) {
        const skuLabel = `Ref: ${label.sku.trim()}`
        page.drawText(skuLabel, {
          x: x + ((labelWidth - fontRegular.widthOfTextAtSize(skuLabel, skuFontSize)) / 2),
          y: y + mmToPt(2.7),
          size: skuFontSize,
          font: fontRegular,
          color: colors.muted,
        })
      }
    }
  }

  const pdfBytes = await pdf.save()
  const pdfByteArray = Uint8Array.from(pdfBytes)
  const blob = new Blob([pdfByteArray.buffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${slugifyFilename(title)}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function buildBarcodeLabelEntries(products: Product[]) {
  return products
    .filter((product) => product.barcode?.trim())
    .map((product) => ({
      id: product.id,
      name: product.name,
      size: product.size,
      color: product.color,
      sku: product.sku,
      barcode: product.barcode!.trim(),
      selling_price: product.selling_price,
      currency: product.currency,
      copies: 1,
    })) satisfies BarcodeLabelEntry[]
}
