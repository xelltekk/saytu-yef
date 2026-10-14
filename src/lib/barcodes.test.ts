import { describe, expect, it } from 'vitest'
import { BARCODE_LABEL_SIZE, buildBarcodeLabelEntries, generateVariantBarcode, getBarcodeFormat, normalizeBarcodeLookupValue } from './barcodes'
import type { Product } from '@/types'

describe('barcodes', () => {
  it('genere un code EAN13 numerique pour une variante', () => {
    const barcode = generateVariantBarcode('Iphone 17', { color: 'Noire', size: '128 Go' }, 0)

    expect(barcode).toMatch(/^\d{13}$/)
    expect(getBarcodeFormat(barcode)).toBe('EAN13')
  })

  it('normalise les valeurs scannees pour la recherche', () => {
    expect(normalizeBarcodeLookupValue(' syv-abc 123 ')).toBe('SYVABC123')
    expect(normalizeBarcodeLookupValue('éx- 42 / noir')).toBe('EX42NOIR')
  })

  it('uses a compact format that fits four labels within A4 print margins', () => {
    expect(BARCODE_LABEL_SIZE).toEqual({ width: 48, height: 30, gap: 2, columns: 4 })
    expect(BARCODE_LABEL_SIZE.width * 4 + BARCODE_LABEL_SIZE.gap * 3).toBe(210 - 12)
  })

  it('keeps variant identifiers without passing prices to print or PDF', () => {
    const products = [
      { id: 'a', name: 'Telephone', size: '128 Go', color: 'Noir', sku: 'TEL-1', barcode: ' 2901234567896 ', selling_price: 999998, currency: 'XOF' },
      { id: 'b', barcode: '' },
    ] as Product[]
    expect(buildBarcodeLabelEntries(products)).toEqual([
      { id: 'a', name: 'Telephone', size: '128 Go', color: 'Noir', sku: 'TEL-1', barcode: '2901234567896', copies: 1 },
    ])
  })
})
