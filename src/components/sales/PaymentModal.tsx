'use client'
import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils'
import { useSalesStore } from '@/store/salesStore'
import { useUser } from '@/hooks/useUser'
import { createSale } from '@/lib/supabase/queries'
import { CheckCircle, Smartphone, Printer, AlertCircle } from 'lucide-react'

interface ReceiptData {
  businessName: string
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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}

function buildReceiptHTML(r: ReceiptData): string {
  const money = (n: number) =>
    `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n)} FCFA`
  const rows = r.items.map((it) => `
    <tr>
      <td class="l">${escapeHtml(it.name)}<br><span class="muted">${it.qty} x ${money(it.unitPrice)}</span></td>
      <td class="r">${money(it.total)}</td>
    </tr>`).join('')

  return `<!doctype html><html><head><meta charset="utf-8"><title>Recu</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; color: #000; margin: 0; padding: 10px; width: 280px; }
    h1 { font-size: 16px; text-align: center; margin: 0 0 2px; }
    .center { text-align: center; }
    .muted { color: #555; font-size: 11px; }
    .line { border-top: 1px dashed #000; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    td { padding: 3px 0; vertical-align: top; }
    td.l { text-align: left; } td.r { text-align: right; white-space: nowrap; padding-left: 8px; }
    .tot td { font-weight: bold; font-size: 13px; }
    .small { font-size: 11px; }
    @media print { body { width: auto; } }
  </style></head><body>
    <h1>${escapeHtml(r.businessName)}</h1>
    <div class="center muted">${escapeHtml(r.date)}</div>
    ${r.customerName ? `<div class="center small">Client: ${escapeHtml(r.customerName)}</div>` : ''}
    ${r.phone ? `<div class="center small">Tel: ${escapeHtml(r.phone)}</div>` : ''}
    <div class="line"></div>
    <table>${rows}</table>
    <div class="line"></div>
    <table>
      <tr><td class="l">Sous-total</td><td class="r">${money(r.subtotal)}</td></tr>
      ${r.discountAmount > 0 ? `<tr><td class="l">Remise</td><td class="r">-${money(r.discountAmount)}</td></tr>` : ''}
      ${r.taxAmount > 0 ? `<tr><td class="l">TVA</td><td class="r">${money(r.taxAmount)}</td></tr>` : ''}
      <tr class="tot"><td class="l">TOTAL</td><td class="r">${money(r.total)}</td></tr>
      <tr><td class="l small">Verse maintenant</td><td class="r small">${money(r.amountPaid)}</td></tr>
      ${r.amountDue > 0 ? `<tr><td class="l small">Reste du</td><td class="r small">${money(r.amountDue)}</td></tr>` : ''}
      <tr><td class="l small">Paiement</td><td class="r small">${escapeHtml(r.methodLabel)}</td></tr>
      <tr><td class="l small">Statut</td><td class="r small">${escapeHtml(r.statusLabel)}</td></tr>
    </table>
    <div class="line"></div>
    <div class="center small">Merci de votre achat !</div>
    <div class="center muted">Saytu Yef</div>
  </body></html>`
}

function printReceipt(r: ReceiptData) {
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow?.document
  if (!doc) { document.body.removeChild(iframe); return }
  doc.open(); doc.write(buildReceiptHTML(r)); doc.close()
  const win = iframe.contentWindow
  setTimeout(() => {
    win?.focus()
    win?.print()
    setTimeout(() => { try { document.body.removeChild(iframe) } catch {} }, 1500)
  }, 300)
}

const PAYMENT_METHODS = [
  { id: 'wave', label: 'Wave', icon: 'W', color: '#0ea5e9', description: 'Paiement mobile Wave' },
  { id: 'orange_money', label: 'Orange Money', icon: 'OM', color: '#f97316', description: 'Paiement Orange Money' },
  { id: 'cash', label: 'Especes', icon: 'F', color: '#10b981', description: 'Paiement en especes' },
  { id: 'card', label: 'Carte', icon: 'CB', color: '#8b5cf6', description: 'Carte bancaire' },
] as const

function getPaymentErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const value = err as { message?: string; details?: string; hint?: string }
    const parts = [value.message, value.details, value.hint].filter(Boolean)
    if (parts.length > 0) return parts.join(' ')
  }
  if (typeof err === 'string' && err.trim()) return err
  return 'Erreur lors du paiement'
}

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
}

export function PaymentModal({ isOpen, onClose }: PaymentModalProps) {
  const { paymentMethod, setPaymentMethod, getTotal, getSubtotal, cart, discount, taxRate, clearCart, customerPhone, setCustomer, customerName } = useSalesStore()
  const { businessName } = useUser()
  const [step, setStep] = useState<'method' | 'confirm' | 'success'>('method')
  const [localCustomerName, setLocalCustomerName] = useState(customerName)
  const [phone, setPhone] = useState(customerPhone)
  const [amountPaid, setAmountPaid] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)

  const total = getTotal()
  const subtotal = getSubtotal()
  const discountAmount = subtotal * discount / 100
  const taxAmount = (subtotal - discountAmount) * taxRate / 100
  const method = PAYMENT_METHODS.find((m) => m.id === paymentMethod) || PAYMENT_METHODS[2]
  const paidNow = useMemo(() => {
    const parsed = Number(amountPaid)
    if (Number.isNaN(parsed)) return 0
    return Math.max(0, Math.min(parsed, total))
  }, [amountPaid, total])
  const amountDue = Math.max(0, total - paidNow)
  const hasOutstandingDebt = amountDue > 0.001
  const requiresPhone = (paymentMethod === 'wave' || paymentMethod === 'orange_money') && paidNow > 0
  const quickAmounts = useMemo(() => {
    const presets = [
      { label: 'Total', value: Math.round(total) },
      { label: '50%', value: Math.round(total / 2) },
      { label: '0', value: 0 },
    ]

    return presets.filter((preset, index, list) => (
      total > 0 &&
      list.findIndex((candidate) => candidate.value === preset.value) === index
    ))
  }, [total])

  useEffect(() => {
    if (!isOpen) return
    setStep('method')
    setLocalCustomerName(customerName)
    setPhone(customerPhone)
    setAmountPaid(total > 0 ? String(Math.round(total)) : '')
    setError('')
    setReceipt(null)
  }, [isOpen, customerName, customerPhone, total])

  const handlePayment = async () => {
    if (cart.length === 0) {
      setError('Le panier est vide')
      return
    }

    if (!amountPaid.trim()) {
      setStep('method')
      setError('Le montant verse est requis')
      return
    }

    if (Number.isNaN(Number(amountPaid))) {
      setStep('method')
      setError('Le montant verse est invalide')
      return
    }

    if (requiresPhone && !phone.trim()) {
      setStep('method')
      setError('Le numero du client est requis pour ce mode de paiement')
      return
    }

    if (hasOutstandingDebt && !localCustomerName.trim() && !phone.trim()) {
      setStep('method')
      setError('Ajoutez au moins un nom ou un numero pour suivre cette dette client')
      return
    }

    const invalidItem = cart.find((item) => item.quantity > item.max_quantity)
    if (invalidItem) {
      setError(`Stock insuffisant pour ${invalidItem.product_name}`)
      return
    }

    setIsProcessing(true)
    setError('')

    try {
      await createSale({
        customer_name: localCustomerName.trim() || undefined,
        customer_phone: phone.trim() || undefined,
        items: cart.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.unit_price * item.quantity,
        })),
        subtotal,
        discount: discountAmount,
        tax: taxAmount,
        total,
        amount_paid: paidNow,
        payment_method: paymentMethod as 'cash' | 'wave' | 'orange_money' | 'card',
      })

      setCustomer(localCustomerName.trim(), phone.trim())

      setReceipt({
        businessName: businessName || 'Saytu Yef',
        date: new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }),
        customerName: localCustomerName.trim() || undefined,
        phone: phone.trim() || undefined,
        methodLabel: method.label,
        statusLabel: hasOutstandingDebt ? 'Partiel' : 'Paye',
        items: cart.map((item) => ({
          name: item.product_name,
          qty: item.quantity,
          unitPrice: item.unit_price,
          total: item.unit_price * item.quantity,
        })),
        subtotal,
        discountAmount,
        taxAmount,
        total,
        amountPaid: paidNow,
        amountDue,
      })
      setStep('success')
    } catch (err: unknown) {
      setError(getPaymentErrorMessage(err))
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClose = () => {
    if (step === 'success') {
      clearCart()
    }
    setStep('method')
    setError('')
    onClose()
  }

  const handleConfirmStep = () => {
    if (!amountPaid.trim()) {
      setError('Le montant verse est requis')
      return
    }

    if (Number.isNaN(Number(amountPaid))) {
      setError('Le montant verse est invalide')
      return
    }

    if (requiresPhone && !phone.trim()) {
      setError('Le numero du client est requis pour ce mode de paiement')
      return
    }

    if (hasOutstandingDebt && !localCustomerName.trim() && !phone.trim()) {
      setError('Ajoutez au moins un nom ou un numero pour suivre cette dette client')
      return
    }

    setError('')
    setStep('confirm')
  }

  const actionLabel = hasOutstandingDebt
    ? paidNow > 0
      ? "Enregistrer l'acompte"
      : 'Enregistrer la dette'
    : 'Valider le paiement'

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 'success' ? undefined : 'Encaissement'}
      size="md"
    >
      {step === 'method' && (
        <div className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-600">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-[#F4F7FB] p-4">
            <div className="text-center">
              <p className="text-xs text-[#6B7682] mb-1">Total de la vente</p>
              <p className="text-3xl font-bold text-[#1A3636]">{formatCurrency(total)}</p>
              <p className="text-xs text-[#6B7682] mt-1">{cart.length} article(s)</p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-2xl bg-white px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Verse</p>
                <p className="mt-1 text-sm font-semibold text-[#1A3636]">{formatCurrency(paidNow)}</p>
              </div>
              <div className={`rounded-2xl px-3 py-3 ${hasOutstandingDebt ? 'bg-amber-500/10 text-amber-700' : 'bg-emerald-500/10 text-emerald-700'}`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em]">Reste du</p>
                <p className="mt-1 text-sm font-semibold">{formatCurrency(amountDue)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Nom du client"
              placeholder="Client"
              value={localCustomerName}
              onChange={(event) => {
                const nextName = event.target.value
                setLocalCustomerName(nextName)
                setCustomer(nextName, phone)
                setError('')
              }}
            />
            <Input
              label="Telephone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="77 xxx xx xx"
              value={phone}
              onChange={(event) => {
                const nextPhone = event.target.value
                setPhone(nextPhone)
                setCustomer(localCustomerName, nextPhone)
                setError('')
              }}
              leftAddon={<Smartphone size={14} />}
              hint={hasOutstandingDebt ? 'Recommande pour relancer la dette client' : undefined}
            />
          </div>

          <Input
            label="Montant verse maintenant"
            type="number"
            min="0"
            max={Math.ceil(total)}
            step="1"
            inputMode="numeric"
            placeholder="0"
            value={amountPaid}
            onChange={(event) => {
              setAmountPaid(event.target.value)
              setError('')
            }}
            hint="Laissez le total pour un paiement complet."
          />

          <div className="flex flex-wrap gap-2">
            {quickAmounts.map((preset) => (
              <button
                key={`${preset.label}-${preset.value}`}
                type="button"
                onClick={() => {
                  setAmountPaid(String(preset.value))
                  setError('')
                }}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                  paidNow === preset.value
                    ? 'border-[#6C5CE7] bg-[#6C5CE7]/10 text-[#6C5CE7]'
                    : 'border-[#2D7D7D]/[0.14] bg-white text-[#5C6B73] hover:border-[#6C5CE7]/35 hover:text-[#1A3636]'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <p className="text-xs font-medium text-[#6B7682] uppercase tracking-wider">Mode de paiement</p>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setPaymentMethod(m.id as 'wave' | 'orange_money' | 'cash' | 'card')
                  setError('')
                }}
                className={`flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-all sm:p-4 ${paymentMethod === m.id ? 'border-[#6C5CE7] bg-[#6C5CE7]/10' : 'border-[#2D7D7D]/[0.1] bg-[#F4F7FB] hover:border-[#2D7D7D]/[0.2]'}`}
              >
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: m.color }}
                >
                  {m.icon}
                </span>
                <span className="text-sm font-medium text-[#1A3636]">{m.label}</span>
                <span className="hidden text-[10px] text-[#6B7682] sm:block">{m.description}</span>
              </button>
            ))}
          </div>

          {hasOutstandingDebt && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700">
              La vente sera enregistree avec un solde restant a encaisser plus tard.
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
            <Button variant="ghost" fullWidth onClick={handleClose}>Annuler</Button>
            <Button variant="primary" fullWidth onClick={handleConfirmStep}>
              Confirmer
            </Button>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-600">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div className="space-y-2 rounded-xl border border-[#2D7D7D]/[0.08] bg-[#F4F7FB] p-4">
            <div className="flex justify-between text-sm">
              <span className="text-[#6B7682]">Client</span>
              <span className="text-right text-[#1A3636]">{localCustomerName || 'Client comptoir'}</span>
            </div>
            {phone && (
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7682]">Telephone</span>
                <span className="text-[#1A3636]">{phone}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-[#6B7682]">Mode de paiement</span>
              <span className="text-[#1A3636] font-medium">{method.label}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#6B7682]">Articles</span>
              <span className="text-[#1A3636]">{cart.length}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Remise ({discount}%)</span>
                <span>-{formatCurrency(subtotal * discount / 100)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="flex justify-between text-sm text-[#5C6B73]">
                <span>TVA ({taxRate}%)</span>
                <span>+{formatCurrency(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-[#2D7D7D]/[0.08] pt-2 text-sm">
              <span className="text-[#6B7682]">Montant verse</span>
              <span className="font-medium text-[#1A3636]">{formatCurrency(paidNow)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#6B7682]">Reste du</span>
              <span className={`font-medium ${hasOutstandingDebt ? 'text-amber-700' : 'text-emerald-700'}`}>
                {formatCurrency(amountDue)}
              </span>
            </div>
            <div className="flex justify-between pt-1 text-base font-bold">
              <span className="text-[#1A3636]">Total</span>
              <span className="text-[#6C5CE7]">{formatCurrency(total)}</span>
            </div>
          </div>

          {requiresPhone && (
            <div className="rounded-xl border border-[#0ea5e9]/20 bg-[#0ea5e9]/5 p-3 text-xs text-[#0ea5e9]">
              Le numero client sera utilise pour confirmer ce versement mobile.
            </div>
          )}

          {hasOutstandingDebt && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-700">
              Cette vente restera visible dans l&apos;historique avec le solde a recouvrer.
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button variant="ghost" fullWidth onClick={() => setStep('method')}>Retour</Button>
            <Button variant="primary" fullWidth isLoading={isProcessing} onClick={handlePayment}>
              {isProcessing ? 'Enregistrement...' : actionLabel}
            </Button>
          </div>
        </div>
      )}

      {step === 'success' && (
        <div className="space-y-4 py-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10">
            <CheckCircle size={32} className="text-emerald-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#1A3636]">
              {hasOutstandingDebt ? 'Acompte enregistre' : 'Paiement reussi !'}
            </h3>
            <p className="mt-1 text-sm text-[#6B7682]">
              {hasOutstandingDebt
                ? `${formatCurrency(paidNow)} encaisses, ${formatCurrency(amountDue)} restent dus.`
                : `${formatCurrency(total)} encaisses via ${method.label}.`}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="outline"
              fullWidth
              leftIcon={<Printer size={15} />}
              onClick={() => receipt && printReceipt(receipt)}
              disabled={!receipt}
            >
              Imprimer recu
            </Button>
            <Button variant="primary" fullWidth onClick={handleClose}>
              {hasOutstandingDebt ? 'Terminer' : 'Nouvelle vente'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
