import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { ACCOUNT_ROLE_LABELS } from './accountRoles'
import { getSafeLogoUrl, prepareBusinessLogo } from './businessLogo'
import type { ReportProduct, ReportSnapshot } from './reports'
import { expenseCategoryLabel } from './expenses'

export type ReportBusiness = {
  name: string
  address?: string
  phone?: string
  ninea?: string
  logoUrl?: string
}

type PdfInput = {
  snapshot: ReportSnapshot
  products: ReportProduct[]
  business: ReportBusiness
  generatedAt?: Date
  logoPng?: Uint8Array
}

const WIDTH = 595.28
const HEIGHT = 841.89
const MARGIN = 40
const CONTENT = WIDTH - MARGIN * 2
const BOTTOM = 53
const INK = rgb(0.1, 0.19, 0.2)
const MUTED = rgb(0.34, 0.4, 0.44)
const TEAL = rgb(0.1, 0.43, 0.43)
const GREEN = rgb(0.04, 0.49, 0.34)
const RED = rgb(0.72, 0.16, 0.18)
const RULE = rgb(0.85, 0.89, 0.9)
const SOFT = rgb(0.96, 0.98, 0.98)
const money = (value: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value).replace(/[\u00a0\u202f]/g, ' ')
const rate = (value: number) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value)} %`
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

export function getReportSellerLabel(snapshot: ReportSnapshot) {
  if (!snapshot.appliedSellerId) return "Toute l'équipe"
  return snapshot.sellerOptions.find((seller) => seller.id === snapshot.appliedSellerId)?.label
    || snapshot.sellerBreakdown.find((seller) => seller.sellerId === snapshot.appliedSellerId)?.sellerName
    || 'Vendeur sélectionné'
}

function dateLabel(value: Date, timeZone: string) {
  return value.toLocaleDateString('fr-FR', { timeZone, day: '2-digit', month: 'long', year: 'numeric' })
}

export function getReportPeriodLabel(snapshot: ReportSnapshot) {
  const { start, endExclusive, timeZone } = snapshot.request
  return `Du ${dateLabel(new Date(start), timeZone)} au ${dateLabel(new Date(new Date(endExclusive).getTime() - 1), timeZone)}`
}

export function getReportPdfFilename(snapshot: ReportSnapshot) {
  const day = (iso: string) => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: snapshot.request.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso))
    return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)?.value).join('-')
  }
  const seller = snapshot.appliedSellerId ? `-${getReportSellerLabel(snapshot).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'vendeur'}` : ''
  return `rapport-${day(snapshot.request.start)}-au-${day(new Date(new Date(snapshot.request.endExclusive).getTime() - 1).toISOString())}${seller}.pdf`
}

export async function buildReportPdf({ snapshot: data, products, business, generatedAt = new Date(), logoPng }: PdfInput) {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Rapport d'activité - ${business.name || 'Saytu Yef'}`)
  pdf.setAuthor(business.name || 'Saytu Yef')
  pdf.setCreator('Saytu Yef')
  pdf.setCreationDate(generatedAt)
  pdf.setModificationDate(generatedAt)
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const supported = new Set(regular.getCharacterSet())
  // Standard PDF fonts cover French; unsupported symbols must not break an export.
  const clean = (value: string) => [...String(value).replace(/[\u00a0\u202f\t]/g, ' ').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')]
    .map((char) => char === '\n' || supported.has(char.codePointAt(0)!) ? char : '?').join('')
  const wrap = (value: string, width: number, size = 9, font = regular) => {
    const lines: string[] = []
    for (const paragraph of clean(value).split('\n')) {
      let line = ''
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (line && font.widthOfTextAtSize(`${line} ${word}`, size) > width) { lines.push(line); line = '' }
        for (const char of word) {
          if (font.widthOfTextAtSize(line + char, size) > width) { lines.push(line); line = '' }
          line += char
        }
        line += ' '
      }
      lines.push(line.trimEnd())
    }
    return lines
  }
  let page: PDFPage
  let y = 0
  const text = (value: string, x: number, top: number, size = 9, font: PDFFont = regular, color = INK) => {
    page.drawText(clean(value), { x, y: HEIGHT - top - size, font, size, color })
  }
  const rule = (top: number, x = MARGIN, width = CONTENT) => page.drawLine({ start: { x, y: HEIGHT - top }, end: { x: x + width, y: HEIGHT - top }, color: RULE, thickness: 0.6 })
  const period = getReportPeriodLabel(data)
  const seller = getReportSellerLabel(data)
  const logo = logoPng ? await pdf.embedPng(logoPng) : null
  const newPage = (first = false) => {
    page = pdf.addPage([WIDTH, HEIGHT])
    page.drawRectangle({ x: 0, y: HEIGHT - 5, width: WIDTH, height: 5, color: TEAL })
    y = 34
    const brandWidth = CONTENT - (first && logo ? 68 : 0)
    const brandLines = wrap(business.name || 'Saytu Yef', brandWidth, first ? 16 : 10, bold)
    for (const line of brandLines.slice(0, first ? 4 : 1)) { text(line, MARGIN, y, first ? 16 : 10, bold); y += first ? 20 : 14 }
    if (first && logo) {
      const scale = Math.min(54 / logo.width, 54 / logo.height)
      page.drawImage(logo, { x: WIDTH - MARGIN - logo.width * scale, y: HEIGHT - 34 - logo.height * scale, width: logo.width * scale, height: logo.height * scale })
    }
    if (first) {
      const details = [business.address, business.phone ? `Tel. ${business.phone}` : '', business.ninea ? `NINEA : ${business.ninea}` : ''].filter(Boolean).join(' | ')
      for (const line of wrap(details, brandWidth, 8).slice(0, 4)) { text(line, MARGIN, y, 8, regular, MUTED); y += 11 }
      y = Math.max(y, logo ? 99 : 72)
      text("Rapport d'activité", MARGIN, y, 23, bold); y += 34
    }
    for (const line of wrap(period, CONTENT, 9)) { text(line, MARGIN, y, 9, regular, MUTED); y += 13 }
    const sellerLines = wrap(`Vendeur : ${seller}`, CONTENT, 9, bold)
    const visibleSellerLines = sellerLines.slice(0, 2)
    if (sellerLines.length > 2) {
      let lastLine = visibleSellerLines[1]
      while (bold.widthOfTextAtSize(`${lastLine}...`, 9) > CONTENT) lastLine = lastLine.slice(0, -1)
      visibleSellerLines[1] = `${lastLine}...`
    }
    for (const line of visibleSellerLines) { text(line, MARGIN, y, 9, bold); y += 13 }
    y += 7
    rule(y); y += 18
  }
  const ensure = (height: number) => { if (y + height > HEIGHT - BOTTOM) newPage() }
  const paragraph = (value: string, size = 9, color = MUTED) => {
    for (const line of wrap(value, CONTENT, size)) { ensure(size + 5); text(line, MARGIN, y, size, regular, color); y += size + 4 }
    y += 5
  }
  const heading = (value: string) => { ensure(64); text(value, MARGIN, y, 13, bold); y += 24 }

  newPage(true)
  const revenue = sum(data.monthlyData.map((bucket) => bucket.revenue))
  const profit = sum(data.monthlyData.map((bucket) => bucket.profit))
  const metrics: Array<[string, number, ReturnType<typeof rgb>]> = [
    ['Montant facturé TTC', data.totalInvoiced, INK], ['Versements rattachés', data.totalCollected, GREEN], ['Solde clients', data.totalDue, RED],
    ['Revenus HT', revenue, INK], ['Bénéfice brut', profit, profit < 0 ? RED : GREEN], ['Encaissements de période', data.cashCollected, TEAL],
  ]
  const metricWidth = (CONTENT - 20) / 3
  ensure(150)
  metrics.forEach(([label, value, color], index) => {
    const x = MARGIN + (index % 3) * (metricWidth + 10)
    const top = y + Math.floor(index / 3) * 75
    page.drawRectangle({ x, y: HEIGHT - top - 64, width: metricWidth, height: 64, color: SOFT })
    text(label, x + 10, top + 9, 8, regular, MUTED)
    const amount = money(value)
    let size = 19
    while (bold.widthOfTextAtSize(amount, size) > metricWidth - 20 && size > 8) size -= 0.5
    text(amount, x + 10, top + 26, size, bold, color)
    text('FCFA', x + 10, top + 49, 7, regular, MUTED)
  })
  y += 153
  paragraph(`${money(data.salesCount)} ventes | ${money(data.totalSold)} articles | Ticket moyen : ${money(data.averageTicket)} FCFA | Recouvrement : ${rate(data.collectionRate)}`, 9, INK)
  paragraph(`Ventes réglées : ${money(data.completedCount)} | Partielles : ${money(data.partialCount)} | En attente : ${money(data.pendingCount)}`, 8)

  ensure(210)
  heading('Évolution des revenus et du bénéfice brut')
  const buckets = data.monthlyData.slice(-12)
  const chartTop = y + 5
  const chartHeight = 120
  const left = MARGIN + 86
  const chartWidth = CONTENT - 90
  const high = Math.max(0, ...buckets.flatMap((bucket) => [bucket.revenue, bucket.profit]))
  const low = Math.min(0, ...buckets.flatMap((bucket) => [bucket.revenue, bucket.profit]))
  const span = high - low || 1
  const chartY = (value: number) => chartTop + (high - value) / span * chartHeight
  for (const value of high === low ? [0] : [high, (high + low) / 2, low]) {
    const top = chartY(value)
    rule(top, left, chartWidth)
    const label = money(value)
    let size = 7
    while (regular.widthOfTextAtSize(label, size) > 77 && size > 4) size -= 0.5
    text(label, MARGIN, top - 4, size, regular, MUTED)
  }
  if (!buckets.length || (high === 0 && low === 0)) text('Aucune activité sur cette période.', left + 20, chartTop + 52, 9, regular, MUTED)
  else buckets.forEach((bucket, index) => {
    const slot = chartWidth / buckets.length
    const width = Math.min(15, slot * 0.27)
    const x = left + index * slot + (slot - width * 2 - 2) / 2
    for (const [offset, value, color] of [[0, bucket.revenue, TEAL], [width + 2, bucket.profit, GREEN]] as const) {
      page.drawRectangle({ x: x + offset, y: HEIGHT - Math.max(chartY(value), chartY(0)), width, height: Math.abs(chartY(value) - chartY(0)), color: value < 0 ? RED : color })
    }
    const lines = wrap(bucket.month, slot - 4, 7).slice(0, 2)
    lines.forEach((line, row) => text(line, left + index * slot + Math.max(0, (slot - regular.widthOfTextAtSize(clean(line), 7)) / 2), chartTop + chartHeight + 8 + row * 9, 7, regular, MUTED))
  })
  y = chartTop + chartHeight + 38
  text('Revenus HT', MARGIN, y, 8, bold, TEAL)
  text('Bénéfice brut', MARGIN + 105, y, 8, bold, GREEN)
  if (low < 0) text('Perte brute', MARGIN + 210, y, 8, bold, RED)
  text('Montants en FCFA', WIDTH - MARGIN - 95, y, 8, regular, MUTED)
  y += 21
  if (data.monthlyData.length > 12) paragraph('Graphique limité aux 12 dernières périodes. La série complète figure dans le tableau détaillé.', 8)
  paragraph('Versements rattachés : paiements des ventes sélectionnées, quelle que soit leur date. Encaissements de période : argent reçu entre les dates indiquées, y compris pour des ventes antérieures.', 8)
  paragraph(`Soldes au moment de l'export. Bénéfice brut hors charges d'exploitation.${data.estimatedProfitCount ? ` Attention : ${money(data.estimatedProfitCount)} ligne(s) de vente avec un coût historique estimé.` : ''}`, 8, data.estimatedProfitCount ? RED : MUTED)

  type Column = { label: string; width: number; right?: boolean }
  const table = (title: string, columns: Column[], rows: string[][], empty: string) => {
    ensure(90)
    const headerLines = columns.map((column) => wrap(column.label, column.width - 16, 8, bold))
    const headerHeight = Math.max(...headerLines.map((lines) => lines.length)) * 11 + 14
    const startTable = (continuation = false) => {
      heading(`${title}${continuation ? ' (suite)' : ''}`)
      page.drawRectangle({ x: MARGIN, y: HEIGHT - y - headerHeight, width: CONTENT, height: headerHeight, color: TEAL })
      let x = MARGIN
      columns.forEach((column, index) => {
        headerLines[index].forEach((line, row) => text(line, column.right ? x + column.width - 8 - bold.widthOfTextAtSize(line, 8) : x + 8, y + 7 + row * 11, 8, bold, rgb(1, 1, 1)))
        x += column.width
      })
      y += headerHeight
    }
    startTable()
    if (!rows.length) { y += 12; paragraph(empty); y += 10; return }
    for (const [rowIndex, row] of rows.entries()) {
      const cells = columns.map((column, index) => wrap(row[index] ?? '', column.width - 16, 8.5))
      const lineCount = Math.max(...cells.map((cell) => cell.length))
      let offset = 0
      while (offset < lineCount) {
        let available = Math.floor((HEIGHT - BOTTOM - y - 12) / 12)
        if (available < Math.min(lineCount - offset, 3)) { newPage(); startTable(true); available = Math.floor((HEIGHT - BOTTOM - y - 12) / 12) }
        const count = Math.min(available, lineCount - offset)
        const height = count * 12 + 12
        if (rowIndex % 2 === 0) page.drawRectangle({ x: MARGIN, y: HEIGHT - y - height, width: CONTENT, height, color: SOFT })
        let x = MARGIN
        columns.forEach((column, index) => {
          cells[index].slice(offset, offset + count).forEach((line, rowNumber) => text(line,
            column.right ? x + column.width - 8 - regular.widthOfTextAtSize(line, 8.5) : x + 8,
            y + 6 + rowNumber * 12, 8.5))
          x += column.width
        })
        y += height
        rule(y)
        offset += count
      }
    }
    y += 24
  }
  const amountColumns: Column[] = [{ label: 'Revenus HT (FCFA)', width: 115, right: true }, { label: 'Bénéfice brut (FCFA)', width: 115, right: true }]
  if (data.expenses && !data.appliedSellerId) {
    newPage()
    heading('Depenses et resultat estime')
    paragraph(`Benefice brut des ventes : ${money(profit)} FCFA.`, 10, INK)
    paragraph(`Frais d'exploitation payes : ${money(data.expenses.total)} FCFA (${data.expenses.count} depense(s)).`, 10, INK)
    const estimatedResult = profit-data.expenses.total
    paragraph(`Resultat estime apres depenses saisies : ${money(estimatedResult)} FCFA.`, 11, estimatedResult < 0 ? RED : GREEN)
    paragraph('Estimation de gestion : marge brute moins frais enregistres. Ne constitue pas un resultat comptable et ne comprend pas les charges non saisies. Les achats de stock sont deja pris en compte dans le cout des ventes.', 8)
    table('Depenses par categorie', [{ label:'Categorie',width:CONTENT-160 },{ label:'Montant (FCFA)',width:160,right:true }],
      data.expenses.byCategory.map((item) => [expenseCategoryLabel(item.category),money(item.total)]),'Aucune depense enregistree sur cette periode.')
    table('Depenses par mois', [{ label:'Mois',width:CONTENT-160 },{ label:'Montant (FCFA)',width:160,right:true }],
      data.expenses.byMonth.map((item) => [item.month,money(item.total)]),'Aucune depense enregistree sur cette periode.')
  }
  newPage()
  table('Activité par période', [{ label: 'Période', width: CONTENT - 230 }, ...amountColumns],
    data.monthlyData.map((bucket) => [bucket.month, money(bucket.revenue), money(bucket.profit)]), 'Aucune vente sur cette période.')
  const methods = { cash: 'Espèces', wave: 'Wave', orange_money: 'Orange Money', card: 'Carte' }
  table('Paiements des ventes sélectionnées', [
    { label: 'Mode', width: CONTENT - 350 }, { label: 'Ventes', width: 50, right: true },
    { label: 'Facturé (FCFA)', width: 100, right: true }, { label: 'Versé (FCFA)', width: 100, right: true }, { label: 'Reste (FCFA)', width: 100, right: true },
  ], data.paymentMethodData.map((method) => [methods[method.method], money(method.count), money(method.invoiced), money(method.collected), money(method.due)]), 'Aucun mode de paiement enregistré.')
  table('Performance des vendeurs', [
    { label: 'Vendeur / rôle', width: CONTENT - 380 }, { label: 'Ventes', width: 50, right: true },
    { label: 'Facturé (FCFA)', width: 95, right: true }, { label: 'Versé (FCFA)', width: 95, right: true },
    { label: 'Reste (FCFA)', width: 95, right: true }, { label: 'Taux', width: 45, right: true },
  ], data.sellerBreakdown.map((entry) => [`${entry.sellerName}\n${ACCOUNT_ROLE_LABELS[entry.sellerRole]}`, money(entry.salesCount), money(entry.totalInvoiced), money(entry.totalCollected), money(entry.totalDue), rate(entry.collectionRate)]), 'Aucune vente attribuée.')
  table('Principaux clients', [
    { label: 'Client / téléphone', width: CONTENT - 350 }, { label: 'Ventes', width: 50, right: true },
    { label: 'Facturé (FCFA)', width: 100, right: true }, { label: 'Versé (FCFA)', width: 100, right: true }, { label: 'Reste (FCFA)', width: 100, right: true },
  ], data.topClients.map((client) => [`${client.name}${client.phone ? `\n${client.phone}` : ''}`, money(client.salesCount), money(client.invoiced), money(client.collected), money(client.due)]), 'Aucun client sur cette période.')
  if (data.topClients.length) paragraph(`Classement : ${data.topClients.length === 1 ? '1 client principal' : `${data.topClients.length} clients principaux`}. Soldes des ventes sélectionnées uniquement.`, 8)
  newPage()
  table(`Produits vendus - ${money(products.length)} référence(s)`, [
    { label: 'Produit', width: CONTENT - 320 }, { label: 'Articles', width: 55, right: true },
    { label: 'Revenus HT (FCFA)', width: 105, right: true }, { label: 'Bénéfice brut (FCFA)', width: 105, right: true },
    { label: 'Marge', width: 55, right: true },
  ], products.map((product) => [product.name, money(product.sold), money(product.revenue), money(product.profit), rate(product.margin)]), 'Aucun produit vendu sur cette période.')
  paragraph(`Total produits : ${money(sum(products.map((product) => product.sold)))} articles | Revenus HT : ${money(sum(products.map((product) => product.revenue)))} FCFA | Bénéfice brut : ${money(sum(products.map((product) => product.profit)))} FCFA.`, 9, INK)

  const pages = pdf.getPages()
  const generatedLabel = generatedAt.toLocaleString('fr-FR', { timeZone: data.request.timeZone, dateStyle: 'short', timeStyle: 'short' })
  for (const [index, current] of pages.entries()) {
    page = current
    rule(HEIGHT - 40)
    text(`Saytu Yef | Généré le ${generatedLabel} (${data.request.timeZone})`, MARGIN, HEIGHT - 33, 7, regular, MUTED)
    const pagination = `${index + 1} / ${pages.length}`
    text(pagination, WIDTH - MARGIN - regular.widthOfTextAtSize(pagination, 8), HEIGHT - 33, 8, regular, MUTED)
    text('Document de gestion - Ne remplace pas un bilan comptable.', MARGIN, HEIGHT - 22, 7, regular, MUTED)
  }
  return pdf.save()
}

async function fetchLogoPng(url: string, signal: AbortSignal) {
  const safeUrl = getSafeLogoUrl(url)
  if (!safeUrl) throw new Error('Logo non valide')
  const controller = new AbortController()
  const cancel = () => controller.abort()
  signal.addEventListener('abort', cancel, { once: true })
  if (signal.aborted) controller.abort()
  const timeout = setTimeout(cancel, 8000)
  try {
    const response = await fetch(safeUrl, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' })
    if (!response.ok) throw new Error('Logo indisponible')
    const blob = await response.blob()
    const prepared = await prepareBusinessLogo(new File([blob], 'logo', { type: blob.type }))
    return new Uint8Array(await prepared.arrayBuffer())
  } finally { clearTimeout(timeout); signal.removeEventListener('abort', cancel) }
}

export async function downloadReportPdf(snapshot: ReportSnapshot, products: ReportProduct[], business: ReportBusiness, signal: AbortSignal) {
  let logoPng: Uint8Array | undefined
  let logoOmitted = false
  if (business.logoUrl) {
    try { logoPng = await fetchLogoPng(business.logoUrl, signal) }
    catch { if (signal.aborted) return { logoOmitted: false }; logoOmitted = true }
  }
  if (signal.aborted) return { logoOmitted: false }
  const bytes = await buildReportPdf({ snapshot, products, business, logoPng })
  if (signal.aborted) return { logoOmitted: false }
  const blob = new Blob([Uint8Array.from(bytes).buffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = getReportPdfFilename(snapshot)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  return { logoOmitted }
}
