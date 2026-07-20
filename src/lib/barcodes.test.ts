import { describe, expect, it } from 'vitest'
import { generateVariantBarcode, getBarcodeFormat, normalizeBarcodeLookupValue } from './barcodes'

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
})
