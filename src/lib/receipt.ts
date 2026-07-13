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

export interface InvoiceData {
  businessName: string
  businessAddress?: string
  businessPhone?: string
  businessNinea?: string
  reference: string
  invoiceNumber: string
  date: string
  customerName?: string
  customerPhone?: string
  sellerName?: string
  sellerEmail?: string
  methodLabel: string
  statusLabel: string
  items: { name: string; qty: number; unitPrice: number; total: number }[]
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number
  amountPaid: number
  amountDue: number
  notes?: string
  payments?: Array<{
    date: string
    amount: number
    methodLabel: string
    note?: string
  }>
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] as string
  ))
}

function formatMoney(amount: number): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount)} FCFA`
}

function buildReceiptHTML(receipt: ReceiptData): string {
  const tenderedAmount = receipt.amountTendered && receipt.amountTendered > 0
    ? receipt.amountTendered
    : receipt.amountPaid
  const hasChangeDue = (receipt.changeDue ?? 0) > 0.001
  const rows = receipt.items.map((item) => `
    <tr>
      <td class="l">${escapeHtml(item.name)}<br><span class="muted">${item.qty} x ${formatMoney(item.unitPrice)}</span></td>
      <td class="r">${formatMoney(item.total)}</td>
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
    <div class="center small">Recu No ${escapeHtml(receipt.reference)}</div>
    <div class="center muted">${escapeHtml(receipt.date)}</div>
    ${receipt.customerName ? `<div class="center small">Client: ${escapeHtml(receipt.customerName)}</div>` : ''}
    ${receipt.phone ? `<div class="center small">Tel client: ${escapeHtml(receipt.phone)}</div>` : ''}
    <div class="line"></div>
    <table>${rows}</table>
    <div class="line"></div>
    <table>
      <tr><td class="l">Sous-total</td><td class="r">${formatMoney(receipt.subtotal)}</td></tr>
      ${receipt.discountAmount > 0 ? `<tr><td class="l">Remise</td><td class="r">-${formatMoney(receipt.discountAmount)}</td></tr>` : ''}
      ${receipt.taxAmount > 0 ? `<tr><td class="l">TVA</td><td class="r">${formatMoney(receipt.taxAmount)}</td></tr>` : ''}
      <tr class="tot"><td class="l">TOTAL</td><td class="r">${formatMoney(receipt.total)}</td></tr>
      <tr><td class="l small">${hasChangeDue ? 'Montant recu' : 'Verse'}</td><td class="r small">${formatMoney(tenderedAmount)}</td></tr>
      ${hasChangeDue ? `<tr><td class="l small">Affecte a la vente</td><td class="r small">${formatMoney(receipt.amountPaid)}</td></tr>` : ''}
      ${hasChangeDue ? `<tr><td class="l small">Monnaie rendue</td><td class="r small">${formatMoney(receipt.changeDue ?? 0)}</td></tr>` : ''}
      ${receipt.amountDue > 0 ? `<tr><td class="l small">Reste du</td><td class="r small">${formatMoney(receipt.amountDue)}</td></tr>` : ''}
      <tr><td class="l small">Paiement</td><td class="r small">${escapeHtml(receipt.methodLabel)}</td></tr>
      <tr><td class="l small">Statut</td><td class="r small">${escapeHtml(receipt.statusLabel)}</td></tr>
    </table>
    <div class="line"></div>
    <div class="center small">Merci de votre achat !</div>
    <div class="center muted">Saytu Yef</div>
  </body></html>`
}

function buildSalesSummaryHTML(summary: SalesSummaryData): string {
  const methodRows = summary.methods.map((method) => `
    <tr>
      <td class="l">${escapeHtml(method.label)}</td>
      <td class="c">${method.count}</td>
      <td class="r">${formatMoney(method.amount)}</td>
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
      <tr><td class="l">Montant facture</td><td class="r">${formatMoney(summary.totalInvoiced)}</td></tr>
      <tr><td class="l">Encaisse</td><td class="r">${formatMoney(summary.totalCollected)}</td></tr>
      <tr><td class="l">Reste ouvert</td><td class="r">${formatMoney(summary.totalDue)}</td></tr>
      <tr><td class="l">Ticket moyen</td><td class="r">${formatMoney(summary.averageTicket)}</td></tr>
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

function buildInvoiceHTML(invoice: InvoiceData): string {
  const itemRows = invoice.items.map((item) => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td class="c">${item.qty}</td>
      <td class="r">${formatMoney(item.unitPrice)}</td>
      <td class="r">${formatMoney(item.total)}</td>
    </tr>`).join('')

  const paymentRows = (invoice.payments ?? []).map((payment) => `
    <tr>
      <td>${escapeHtml(payment.date)}</td>
      <td>${escapeHtml(payment.methodLabel)}</td>
      <td class="r">${formatMoney(payment.amount)}</td>
      <td>${payment.note ? escapeHtml(payment.note) : '-'}</td>
    </tr>`).join('')

  return `<!doctype html><html><head><meta charset="utf-8"><title>Facture ${escapeHtml(invoice.invoiceNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    @page { size: A4; margin: 12mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1A3636; margin: 0; padding: 0; background: #fff; font-size: 12px; line-height: 1.45; }
    .page { width: 100%; max-width: 190mm; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; border-bottom: 2px solid #6C5CE7; padding-bottom: 14px; }
    h1 { font-size: 26px; margin: 0 0 4px; }
    h2 { font-size: 22px; margin: 0 0 10px; color: #6C5CE7; }
    .muted { color: #5C6B73; }
    .meta { margin: 2px 0; }
    .card { border: 1px solid #D7E2F0; border-radius: 14px; padding: 14px 16px; background: #fff; }
    .title-card { min-width: 230px; background: #F7F5FF; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 18px; }
    .label { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #5C6B73; margin-bottom: 8px; font-weight: 700; }
    .badge { display: inline-block; margin-top: 8px; padding: 6px 10px; border-radius: 999px; background: #EEEAFE; color: #5F4BDB; font-size: 11px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    .lines, .payments, .totals { margin-top: 18px; border: 1px solid #D7E2F0; border-radius: 14px; overflow: hidden; }
    .lines th, .payments th { background: #F4F7FB; color: #5C6B73; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; text-align: left; padding: 12px 14px; }
    .lines td, .payments td { padding: 12px 14px; border-top: 1px solid #E5EDF5; vertical-align: top; }
    .totals td { padding: 10px 14px; border-top: 1px solid #E5EDF5; }
    .totals tr:first-child td { border-top: 0; }
    .totals .grand td { background: #F7F5FF; color: #6C5CE7; font-size: 15px; font-weight: 700; }
    .c { text-align: center; }
    .r { text-align: right; white-space: nowrap; }
    .note { margin-top: 18px; border: 1px solid #D7E2F0; border-radius: 14px; padding: 14px 16px; background: #FCFCFD; }
    .footer { margin-top: 24px; padding-top: 14px; border-top: 1px solid #D7E2F0; font-size: 11px; color: #5C6B73; }
  </style></head><body>
    <div class="page">
      <div class="header">
        <div>
          <h1>${escapeHtml(invoice.businessName)}</h1>
          ${invoice.businessAddress ? `<div class="meta muted">${escapeHtml(invoice.businessAddress)}</div>` : ''}
          ${invoice.businessPhone ? `<div class="meta muted">Tel: ${escapeHtml(invoice.businessPhone)}</div>` : ''}
          ${invoice.businessNinea ? `<div class="meta muted">NINEA: ${escapeHtml(invoice.businessNinea)}</div>` : ''}
        </div>
        <div class="card title-card">
          <h2>Facture</h2>
          <div><strong>No:</strong> ${escapeHtml(invoice.invoiceNumber)}</div>
          <div><strong>Reference:</strong> ${escapeHtml(invoice.reference)}</div>
          <div><strong>Date:</strong> ${escapeHtml(invoice.date)}</div>
          <div class="badge">${escapeHtml(invoice.statusLabel)} - ${escapeHtml(invoice.methodLabel)}</div>
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <div class="label">Facture a</div>
          <div><strong>${escapeHtml(invoice.customerName || 'Client comptoir')}</strong></div>
          ${invoice.customerPhone ? `<div class="meta muted">${escapeHtml(invoice.customerPhone)}</div>` : '<div class="meta muted">Client sans numero enregistre</div>'}
        </div>
        <div class="card">
          <div class="label">Vente suivie par</div>
          <div><strong>${escapeHtml(invoice.sellerName || 'Equipe Saytu Yef')}</strong></div>
          ${invoice.sellerEmail ? `<div class="meta muted">${escapeHtml(invoice.sellerEmail)}</div>` : ''}
        </div>
      </div>

      <div class="lines">
        <table>
          <thead>
            <tr>
              <th>Article</th>
              <th class="c">Qt</th>
              <th class="r">Prix unit.</th>
              <th class="r">Total</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
      </div>

      <table class="totals">
        <tbody>
          <tr><td>Sous-total</td><td class="r">${formatMoney(invoice.subtotal)}</td></tr>
          ${invoice.discountAmount > 0 ? `<tr><td>Remise</td><td class="r">-${formatMoney(invoice.discountAmount)}</td></tr>` : ''}
          ${invoice.taxAmount > 0 ? `<tr><td>TVA</td><td class="r">${formatMoney(invoice.taxAmount)}</td></tr>` : ''}
          <tr class="grand"><td>Total facture</td><td class="r">${formatMoney(invoice.total)}</td></tr>
          <tr><td>Montant verse</td><td class="r">${formatMoney(invoice.amountPaid)}</td></tr>
          <tr><td>Reste a payer</td><td class="r">${formatMoney(invoice.amountDue)}</td></tr>
        </tbody>
      </table>

      ${(invoice.payments ?? []).length > 0 ? `
        <div class="payments">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Methode</th>
                <th class="r">Montant</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>${paymentRows}</tbody>
          </table>
        </div>
      ` : ''}

      ${invoice.notes ? `<div class="note"><div class="label">Notes</div><div>${escapeHtml(invoice.notes)}</div></div>` : ''}
      <div class="footer">Facture generee depuis Saytu Yef. Pour obtenir un PDF, choisissez "Enregistrer en PDF" dans la fenetre d'impression.</div>
    </div>
  </body></html>`
}

function printHTMLDocument(title: string, html: string) {
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  iframe.title = title
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow?.document
  if (!doc) {
    document.body.removeChild(iframe)
    return
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
  }, 300)
}

export function printReceipt(receipt: ReceiptData) {
  printHTMLDocument(`Recu ${receipt.reference}`, buildReceiptHTML(receipt))
}

export function printSalesSummary(summary: SalesSummaryData) {
  printHTMLDocument(summary.title, buildSalesSummaryHTML(summary))
}

export function printInvoice(invoice: InvoiceData) {
  printHTMLDocument(`Facture ${invoice.invoiceNumber}`, buildInvoiceHTML(invoice))
}
