import { formatCurrency } from '@/lib/utils'

interface DebtReminderOptions {
  customerName?: string | null
  amountDue: number
  businessName?: string | null
  businessPhone?: string | null
  reference?: string
}

export function buildDebtReminder({ customerName, amountDue, businessName, businessPhone, reference }: DebtReminderOptions): string {
  if (!Number.isFinite(amountDue) || amountDue <= 0) return ''
  const company = businessName?.trim() || 'Saytu Yef'
  const customer = customerName?.trim() || 'cher client'
  const purchase = reference ? `sur votre achat chez ${company} (re\u00e7u ${reference})` : `sur votre compte chez ${company}`
  const lines = [`Bonjour ${customer}, nous vous rappelons qu'il reste ${formatCurrency(amountDue)} \u00e0 r\u00e9gler ${purchase}.`]
  const phone = businessPhone?.trim().replace(/^00/, '+').replace(/\s+/g, ' ') || ''
  const digits = phone.replace(/\D/g, '')
  if (/^\+?[\d ().-]+$/.test(phone) && digits.length >= 8 && digits.length <= 15) {
    lines.push(`Vous pouvez payer par Wave ou Orange Money au ${phone}.`)
  }
  lines.push('Merci.')
  return lines.join('\n\n')
}
