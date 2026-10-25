import { expect, it } from 'vitest'
import { buildDebtReminder } from './debtReminders'
import { formatCurrency } from './utils'

const options = { customerName: 'Fatou', businessName: 'Boutique test', amountDue: 25000, businessPhone: '+221 77 123 45 67' }
it('includes the exact outstanding balance, customer, company and company mobile payment number', () => {
  const message = buildDebtReminder(options)
  expect(message).toContain('Bonjour Fatou')
  expect(message).toContain(formatCurrency(25000))
  expect(message).toContain('sur votre compte chez Boutique test')
  expect(message).toContain('Vous pouvez payer par Wave ou Orange Money au +221 77 123 45 67.')
})
it('keeps the sale receipt reference when reminding about one sale', () => {
  const message = buildDebtReminder({ ...options, reference: 'ABCD1234' })
  expect(message).toContain('sur votre achat chez Boutique test (re\u00e7u ABCD1234)')
  expect(message).toContain('Wave ou Orange Money')
})
it.each([undefined, null, '', '  ', 'pas de telephone', '123', '+221 77 123 45 67 / 78 765 43 21'])('omits mobile instructions without a usable company phone: %s', (phone) => {
  const message = buildDebtReminder({ ...options, businessPhone: phone })
  expect(message).toContain(formatCurrency(25000))
  expect(message).not.toContain('Wave')
  expect(message).not.toContain('Orange Money')
})
it('accepts local phone formatting and converts international 00 prefixes', () => {
  expect(buildDebtReminder({ ...options, businessPhone: ' 77 123 45 67 ' })).toContain('au 77 123 45 67.')
  expect(buildDebtReminder({ ...options, businessPhone: '00221 77 123 45 67' })).toContain('au +221 77 123 45 67.')
})
it('updates the text when the configured company number changes and URL-encodes without losing details', () => {
  const message = buildDebtReminder({ ...options, businessPhone: '781234567' })
  expect(message).not.toContain(options.businessPhone)
  expect(message).toContain('au 781234567.')
  const link = new URL(`https://wa.me/221770000000?text=${encodeURIComponent(message)}`)
  expect(link.searchParams.get('text')).toBe(message)
})
it.each([0, -1, NaN, Infinity])('does not generate a reminder for an invalid or settled balance: %s', (amountDue) => {
  expect(buildDebtReminder({ ...options, amountDue })).toBe('')
})
it('provides neutral names when the customer or company name is absent', () => {
  expect(buildDebtReminder({ amountDue: 1500 })).toContain('Bonjour cher client')
  expect(buildDebtReminder({ amountDue: 1500 })).toContain('Saytu Yef')
})
