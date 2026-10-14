import JsBarcode from 'jsbarcode'
import type { Product } from '@/types'
import { getProductVariantSummary } from '@/lib/utils'

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
  copies: number
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const INTERNAL_EAN_PREFIX = '29'
export const BARCODE_LABEL_SIZE = { width: 48, height: 30, gap: 2, columns: 4 } as const

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

function fitPdfText(text: string, maxWidth: number, measure: (value: string) => number) {
  if (measure(text) <= maxWidth) return text
  let shortened = text
  while (shortened && measure(`${shortened}...`) > maxWidth) shortened = shortened.slice(0, -1)
  return `${shortened}...`
}

function barcodeOptions(format: BarcodeFormat) {
  const width = format === 'CODE128' ? 2 : 3
  const leftQuietModules = format === 'EAN13' ? 11 : format === 'EAN8' ? 7 : format === 'UPC' ? 9 : 10
  const rightQuietModules = format === 'EAN13' || format === 'EAN8' ? 7 : format === 'UPC' ? 9 : 10
  return {
    format,
    lineColor: '#000000',
    background: '#ffffff',
    width,
    height: format === 'CODE128' ? 52 : 64,
    margin: 2,
    marginLeft: width * leftQuietModules,
    marginRight: width * rightQuietModules,
    displayValue: false,
  }
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
  JsBarcode(svg, normalized, barcodeOptions(format))
  svg.setAttribute('preserveAspectRatio', 'none')

  return svg.outerHTML
}

function expandBarcodeLabels(labels: BarcodeLabelEntry[]) {
  return labels.flatMap((label) => (
    Array.from({ length: Math.max(1, label.copies) }, (_, index) => ({
      ...label,
      copyKey: `${label.id}-${index}`,
      variantLabel: getProductVariantSummary(label),
      barcodeValue: normalizeBarcodeValue(label.barcode),
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
  JsBarcode(canvas, normalized, barcodeOptions(format))

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
      <div class="label-title">${escapeHtml(label.name)}</div>
      <div class="label-variant">${escapeHtml(label.variantLabel)}</div>
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
          color: #000000;
        }

        .sheet {
          display: grid;
          grid-template-columns: repeat(${BARCODE_LABEL_SIZE.columns}, ${BARCODE_LABEL_SIZE.width}mm);
          gap: ${BARCODE_LABEL_SIZE.gap}mm;
        }

        .label-card {
          border: 1px solid #dbe6ef;
          border-radius: 1mm;
          background: #ffffff;
          position: relative;
          width: ${BARCODE_LABEL_SIZE.width}mm;
          height: ${BARCODE_LABEL_SIZE.height}mm;
          padding: 1.5mm;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .label-title {
          height: 16pt;
          font-size: 7.5pt;
          font-weight: 700;
          line-height: 8pt;
          overflow: hidden;
          overflow-wrap: anywhere;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .label-variant {
          height: 7pt;
          font-size: 6.5pt;
          line-height: 7pt;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .barcode-wrap {
          position: absolute;
          top: 10.25mm;
          left: 1.5mm;
          right: 1.5mm;
          height: 13mm;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .barcode-wrap svg {
          width: 100%;
          max-width: 100%;
          height: 13mm;
        }

        .barcode-value {
          position: absolute;
          top: 23.5mm;
          left: 1.5mm;
          right: 1.5mm;
          text-align: center;
          font-size: 6.5pt;
          line-height: 8pt;
          font-weight: 700;
          letter-spacing: 0;
          white-space: nowrap;
        }

        .sku-value {
          position: absolute;
          top: 26.5mm;
          left: 1.5mm;
          right: 1.5mm;
          text-align: center;
          font-size: 5.5pt;
          line-height: 7pt;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
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
  const gap = mmToPt(BARCODE_LABEL_SIZE.gap)
  const columns = BARCODE_LABEL_SIZE.columns
  const labelWidth = mmToPt(BARCODE_LABEL_SIZE.width)
  const labelHeight = mmToPt(BARCODE_LABEL_SIZE.height)
  const rowsPerPage = Math.max(1, Math.floor((pageHeight - (margin * 2) + gap) / (labelHeight + gap)))
  const labelsPerPage = columns * rowsPerPage

  const colors = {
    border: rgb(0.86, 0.9, 0.94),
    text: rgb(0, 0, 0),
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

      const padding = mmToPt(1.5)
      const titleFontSize = 7.5
      const variantFontSize = 6.5
      const codeFontSize = 6.5
      const skuFontSize = 5.5
      const titleWidth = labelWidth - (padding * 2)
      const titleLines = wrapPdfText(
        label.name,
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
        cursorY -= 8
      })

      if (label.variantLabel) {
        page.drawText(fitPdfText(label.variantLabel, titleWidth, (value) => fontRegular.widthOfTextAtSize(value, variantFontSize)), {
          x: x + padding,
          y: y + labelHeight - mmToPt(7.15) - variantFontSize,
          size: variantFontSize,
          font: fontRegular,
          color: colors.text,
        })
      }

      const barcodePng = barcodeImageMap.get(label.copyKey)
      if (!barcodePng) continue

      const barcodeImage = await pdf.embedPng(barcodePng)
      const barcodeBoxWidth = labelWidth - (padding * 2)
      const barcodeBoxHeight = mmToPt(13)
      const barcodeY = y + labelHeight - mmToPt(23.25)
      page.drawImage(barcodeImage, {
        x: x + padding,
        y: barcodeY,
        width: barcodeBoxWidth,
        height: barcodeBoxHeight,
      })

      page.drawText(label.barcodeValue, {
        x: x + ((labelWidth - fontBold.widthOfTextAtSize(label.barcodeValue, codeFontSize)) / 2),
        y: y + labelHeight - mmToPt(23.5) - codeFontSize,
        size: codeFontSize,
        font: fontBold,
        color: colors.text,
      })

      if (label.sku?.trim()) {
        const skuLabel = fitPdfText(`Ref: ${label.sku.trim()}`, titleWidth, (value) => fontRegular.widthOfTextAtSize(value, skuFontSize))
        page.drawText(skuLabel, {
          x: x + ((labelWidth - fontRegular.widthOfTextAtSize(skuLabel, skuFontSize)) / 2),
          y: y + labelHeight - mmToPt(26.5) - skuFontSize,
          size: skuFontSize,
          font: fontRegular,
          color: colors.text,
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
      copies: 1,
    })) satisfies BarcodeLabelEntry[]
}
