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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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

export function getBarcodeFormat(value: string): BarcodeFormat {
  const normalized = normalizeBarcodeValue(value)
  if (/^\d{13}$/.test(normalized)) return 'EAN13'
  if (/^\d{12}$/.test(normalized)) return 'UPC'
  if (/^\d{8}$/.test(normalized)) return 'EAN8'
  return 'CODE128'
}

export function generateVariantBarcode(productName: string, variant: VariantSeed = {}, index = 0) {
  const productSeed = sanitizeBarcodeSeed(productName).slice(0, 4) || 'PRD'
  const variantSeed = sanitizeBarcodeSeed(
    [variant.size?.trim(), variant.color?.trim()].filter(Boolean).join(' ')
  ).slice(0, 4) || `V${index + 1}`

  return `SYV-${productSeed}-${variantSeed}-${createEntropy(8)}`
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
  JsBarcode(svg, normalized, {
    format: getBarcodeFormat(normalized),
    lineColor: '#1A3636',
    background: '#ffffff',
    width: normalized.length >= 16 ? 1.35 : 1.7,
    height: 46,
    margin: 0,
    displayValue: false,
  })

  return svg.outerHTML
}

export function printBarcodeLabels(labels: BarcodeLabelEntry[], title = 'Etiquettes code-barres') {
  const expandedLabels = labels.flatMap((label) => (
    Array.from({ length: Math.max(1, label.copies) }, (_, index) => ({
      ...label,
      copyKey: `${label.id}-${index}`,
      variantLabel: getProductVariantSummary(label),
      barcodeValue: normalizeBarcodeValue(label.barcode),
      barcodeSvg: renderBarcodeSvg(label.barcode),
      priceLabel: formatCurrency(label.selling_price, label.currency || 'XOF'),
      productLabel: formatProductLabel(label),
    }))
  ))

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
          width: 100%;
          max-width: 56mm;
          height: 15mm;
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
