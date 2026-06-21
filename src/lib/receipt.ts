export interface ReceiptData {
  businessName: string
  businessAddress?: string
  businessPhone?: string
  businessNinea?: string
  reference: string
  date: string
  customerName?: string
  phone?: string
  methodLabel: string
  statusLabel: string
  items: { name: string; qty: number; unitPrice: number; total: number }[]
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number
  amountPaid: number
  amountDue: number
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] as string
  ))
}

function buildReceiptHTML(receipt: ReceiptData): string {
  const money = (amount: number) =>
    `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount)} FCFA`
  const rows = receipt.items.map((item) => `
    <tr>
      <td class="l">${escapeHtml(item.name)}<br><span class="muted">${item.qty} x ${money(item.unitPrice)}</span></td>
      <td class="r">${money(item.total)}</td>
    </tr>`).join('')

  return `<!doctype html><html><head><meta charset="utf-8"><title>Recu ${escapeHtml(receipt.reference)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; color: #000; margin: 0; padding: 10px; width: 280px; }
    h1 { font-size: 16px; text-align: center; margin: 0 0 2px; }
    .center { text-align: center; }
    .muted { color: #555; font-size: 11px; }
    .line { border-top: 1px dashed #000; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    td { padding: 3px 0; vertical-align: top; }
    td.l { text-align: left; }
    td.r { text-align: right; white-space: nowrap; padding-left: 8px; }
    .tot td { font-weight: bold; font-size: 13px; }
    .small { font-size: 11px; }
    @media print { body { width: auto; } }
  </style></head><body>
    <h1>${escapeHtml(receipt.businessName)}</h1>
    ${receipt.businessAddress ? `<div class="center muted">${escapeHtml(receipt.businessAddress)}</div>` : ''}
    ${receipt.businessPhone ? `<div class="center muted">Tel: ${escapeHtml(receipt.businessPhone)}</div>` : ''}
    ${receipt.businessNinea ? `<div class="center muted">NINEA: ${escapeHtml(receipt.businessNinea)}</div>` : ''}
    <div class="center small">Recu N° ${escapeHtml(receipt.reference)}</div>
    <div class="center muted">${escapeHtml(receipt.date)}</div>
    ${receipt.customerName ? `<div class="center small">Client: ${escapeHtml(receipt.customerName)}</div>` : ''}
    ${receipt.phone ? `<div class="center small">Tel client: ${escapeHtml(receipt.phone)}</div>` : ''}
    <div class="line"></div>
    <table>${rows}</table>
    <div class="line"></div>
    <table>
      <tr><td class="l">Sous-total</td><td class="r">${money(receipt.subtotal)}</td></tr>
      ${receipt.discountAmount > 0 ? `<tr><td class="l">Remise</td><td class="r">-${money(receipt.discountAmount)}</td></tr>` : ''}
      ${receipt.taxAmount > 0 ? `<tr><td class="l">TVA</td><td class="r">${money(receipt.taxAmount)}</td></tr>` : ''}
      <tr class="tot"><td class="l">TOTAL</td><td class="r">${money(receipt.total)}</td></tr>
      <tr><td class="l small">Verse</td><td class="r small">${money(receipt.amountPaid)}</td></tr>
      ${receipt.amountDue > 0 ? `<tr><td class="l small">Reste du</td><td class="r small">${money(receipt.amountDue)}</td></tr>` : ''}
      <tr><td class="l small">Paiement</td><td class="r small">${escapeHtml(receipt.methodLabel)}</td></tr>
      <tr><td class="l small">Statut</td><td class="r small">${escapeHtml(receipt.statusLabel)}</td></tr>
    </table>
    <div class="line"></div>
    <div class="center small">Merci de votre achat !</div>
    <div class="center muted">Saytu Yef</div>
  </body></html>`
}

export function printReceipt(receipt: ReceiptData) {
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  iframe.title = `Reçu ${receipt.reference}`
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow?.document
  if (!doc) {
    document.body.removeChild(iframe)
    return
  }

  doc.open()
  doc.write(buildReceiptHTML(receipt))
  doc.close()
  const printWindow = iframe.contentWindow
  window.setTimeout(() => {
    printWindow?.focus()
    printWindow?.print()
    window.setTimeout(() => {
      if (iframe.isConnected) document.body.removeChild(iframe)
    }, 1500)
  }, 300)
}
