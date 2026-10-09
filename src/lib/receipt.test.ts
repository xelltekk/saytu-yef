import { describe, expect, it } from 'vitest'
import { buildInvoiceHTML, buildReceiptHTML, type InvoiceData, type ReceiptData } from './receipt'

const sale: ReceiptData & InvoiceData = {
  businessName: 'Boutique <Test>', businessLogoUrl: 'https://example.com/logo.png',
  reference: 'TEST123', invoiceNumber: 'FAC-TEST123', date: '09/10/2026',
  methodLabel: 'Especes', statusLabel: 'Partiel',
  items: [{ name: 'Article', qty: 1, unitPrice: 350000, total: 350000 }],
  subtotal: 350000, discountAmount: 35000, taxAmount: 0, total: 315000,
  amountPaid: 120000, amountDue: 195000,
}

describe('branded sales documents', () => {
  for (const build of [buildReceiptHTML, buildInvoiceHTML]) {
    it(`includes bounded logo and escaped business name in ${build.name}`, () => {
      const html = build(sale)
      expect(html).toContain('class="business-logo" src="https://example.com/logo.png"')
      expect(html).toContain('object-fit: contain')
      expect(html).toContain('Boutique &lt;Test&gt;')
      expect(html).toContain('195')
    })
    it(`omits unsafe or missing logos in ${build.name}`, () => {
      expect(build({ ...sale, businessLogoUrl: undefined })).not.toContain('<img')
      expect(build({ ...sale, businessLogoUrl: 'javascript:alert(1)' })).not.toContain('<img')
    })
  }
  it('keeps receipt paper width and A4 invoice format', () => {
    expect(buildReceiptHTML(sale)).toContain('size: 80mm auto')
    expect(buildInvoiceHTML(sale)).toContain('size: A4')
  })
})
