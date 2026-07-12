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
  amountTendered?: number
  changeDue?: number
}

export interface SalesSummaryData {
  businessName: string
  businessAddress?: string
  businessPhone?: string
  businessNinea?: string
  title: string
  subtitle?: string
  generatedAt: string
  operatorLabel?: string
  salesCount: number
  totalItems: number
  totalInvoiced: number
  totalCollected: number
  totalDue: number
  averageTicket: number
  openDebtCount: number
  methods: Array<{
    label: string
    count: number
    amount: number
  }>
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] as string
  ))
}

function buildReceiptHTML(receipt: ReceiptData): string {
  const money = (amount: number) =>
    `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount)} FCFA`
  const tenderedAmount = receipt.amountTendered && receipt.amountTendered > 0
    ? receipt.amountTendered
    : receipt.amountPaid
  const hasChangeDue = (receipt.changeDue ?? 0) > 0.001
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
      <tr><td class="l small">${hasChangeDue ? 'Montant recu' : 'Verse'}</td><td class="r small">${money(tenderedAmount)}</td></tr>
      ${hasChangeDue ? `<tr><td class="l small">Affecte a la vente</td><td class="r small">${money(receipt.amountPaid)}</td></tr>` : ''}
      ${hasChangeDue ? `<tr><td class="l small">Monnaie rendue</td><td class="r small">${money(receipt.changeDue ?? 0)}</td></tr>` : ''}
      ${receipt.amountDue > 0 ? `<tr><td class="l small">Reste du</td><td class="r small">${money(receipt.amountDue)}</td></tr>` : ''}
      <tr><td class="l small">Paiement</td><td class="r small">${escapeHtml(receipt.methodLabel)}</td></tr>
      <tr><td class="l small">Statut</td><td class="r small">${escapeHtml(receipt.statusLabel)}</td></tr>
    </table>
    <div class="line"></div>
    <div class="center small">Merci de votre achat !</div>
    <div class="center muted">Saytu Yef</div>
  </body></html>`
}

function buildSalesSummaryHTML(summary: SalesSummaryData): string {
  const money = (amount: number) =>
    `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount)} FCFA`
  const methodRows = summary.methods.map((method) => `
    <tr>
      <td class="l">${escapeHtml(method.label)}</td>
      <td class="c">${method.count}</td>
      <td class="r">${money(method.amount)}</td>
    </tr>`).join('')

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(summary.title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; color: #000; margin: 0; padding: 10px; width: 280px; }
    h1 { font-size: 15px; text-align: center; margin: 0 0 2px; }
    h2 { font-size: 13px; text-align: center; margin: 6px 0 4px; }
    .center { text-align: center; }
    .muted { color: #555; font-size: 11px; }
    .line { border-top: 1px dashed #000; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    td { padding: 3px 0; vertical-align: top; }
    td.l { text-align: left; }
    td.c { text-align: center; white-space: nowrap; }
    td.r { text-align: right; white-space: nowrap; padding-left: 8px; }
    .tot td { font-weight: bold; font-size: 13px; }
    .small { font-size: 11px; }
    @media print { body { width: auto; } }
  </style></head><body>
    <h1>${escapeHtml(summary.businessName)}</h1>
    ${summary.businessAddress ? `<div class="center muted">${escapeHtml(summary.businessAddress)}</div>` : ''}
    ${summary.businessPhone ? `<div class="center muted">Tel: ${escapeHtml(summary.businessPhone)}</div>` : ''}
    ${summary.businessNinea ? `<div class="center muted">NINEA: ${escapeHtml(summary.businessNinea)}</div>` : ''}
    <h2>${escapeHtml(summary.title)}</h2>
    ${summary.subtitle ? `<div class="center small">${escapeHtml(summary.subtitle)}</div>` : ''}
    <div class="center muted">${escapeHtml(summary.generatedAt)}</div>
    ${summary.operatorLabel ? `<div class="center small">Responsable: ${escapeHtml(summary.operatorLabel)}</div>` : ''}
    <div class="line"></div>
    <table>
      <tr><td class="l">Ventes</td><td class="r">${summary.salesCount}</td></tr>
      <tr><td class="l">Articles</td><td class="r">${summary.totalItems}</td></tr>
      <tr><td class="l">Montant facture</td><td class="r">${money(summary.totalInvoiced)}</td></tr>
      <tr><td class="l">Encaisse</td><td class="r">${money(summary.totalCollected)}</td></tr>
      <tr><td class="l">Reste ouvert</td><td class="r">${money(summary.totalDue)}</td></tr>
      <tr><td class="l">Ticket moyen</td><td class="r">${money(summary.averageTicket)}</td></tr>
      <tr><td class="l">Dettes ouvertes</td><td class="r">${summary.openDebtCount}</td></tr>
    </table>
    <div class="line"></div>
    <table>
      <tr><td class="l"><strong>Methode</strong></td><td class="c"><strong>Nb</strong></td><td class="r"><strong>Encaisse</strong></td></tr>
      ${methodRows || '<tr><td class="l">Aucun encaissement</td><td class="c">0</td><td class="r">0 FCFA</td></tr>'}
    </table>
    <div class="line"></div>
    <div class="center small">Synthese generee depuis Saytu Yef</div>
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

export function printSalesSummary(summary: SalesSummaryData) {
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  iframe.title = summary.title
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow?.document
  if (!doc) {
    document.body.removeChild(iframe)
    return
  }

  doc.open()
  doc.write(buildSalesSummaryHTML(summary))
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
