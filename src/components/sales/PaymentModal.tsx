'use client'
import { useEffect, useState } from 'react'
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
  items: { name: string; qty: number; unitPrice: number; total: number }[]
  subtotal: number
  discountAmount: number
  total: number
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

  return `<!doctype html><html><head><meta charset="utf-8"><title>Reçu</title>
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
    ${r.phone ? `<div class="center small">Tél: ${escapeHtml(r.phone)}</div>` : ''}
    <div class="line"></div>
    <table>${rows}</table>
    <div class="line"></div>
    <table>
      <tr><td class="l">Sous-total</td><td class="r">${money(r.subtotal)}</td></tr>
      ${r.discountAmount > 0 ? `<tr><td class="l">Remise</td><td class="r">-${money(r.discountAmount)}</td></tr>` : ''}
      <tr class="tot"><td class="l">TOTAL</td><td class="r">${money(r.total)}</td></tr>
      <tr><td class="l small">Paiement</td><td class="r small">${escapeHtml(r.methodLabel)}</td></tr>
    </table>
    <div class="line"></div>
    <div class="center small">Merci de votre achat !</div>
    <div class="center muted">Saytu Yëf</div>
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
  { id: 'wave', label: 'Wave', icon: '🌊', color: '#0ea5e9', description: 'Paiement mobile Wave' },
  { id: 'orange_money', label: 'Orange Money', icon: '🟠', color: '#f97316', description: 'Paiement Orange Money' },
  { id: 'cash', label: 'Espèces', icon: '💵', color: '#10b981', description: 'Paiement en espèces' },
  { id: 'card', label: 'Carte', icon: '💳', color: '#8b5cf6', description: 'Carte bancaire' },
]

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
  const { paymentMethod, setPaymentMethod, getTotal, getSubtotal, cart, discount, clearCart, customerPhone, setCustomer, customerName } = useSalesStore()
  const { businessName } = useUser()
  const [step, setStep] = useState<'method' | 'confirm' | 'success'>('method')
  const [phone, setPhone] = useState(customerPhone)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)

  const total = getTotal()
  const subtotal = getSubtotal()
  const method = PAYMENT_METHODS.find((m) => m.id === paymentMethod) || PAYMENT_METHODS[2]

  useEffect(() => {
    if (!isOpen) return
    setStep('method')
    setPhone(customerPhone)
    setError('')
    setReceipt(null)
  }, [isOpen, customerPhone])

  const handlePayment = async () => {
    if (cart.length === 0) {
      setError('Le panier est vide')
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
        customer_name: customerName || undefined,
        customer_phone: phone || undefined,
        items: cart.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.unit_price * item.quantity,
        })),
        subtotal,
        discount: subtotal * discount / 100,
        tax: 0,
        total,
        payment_method: paymentMethod as 'cash' | 'wave' | 'orange_money' | 'card',
      })
      // Snapshot du reçu avant que le panier ne soit vidé
      setReceipt({
        businessName: businessName || 'Saytu Yëf',
        date: new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }),
        customerName: customerName || undefined,
        phone: phone || undefined,
        methodLabel: method.label,
        items: cart.map((item) => ({
          name: item.product_name,
          qty: item.quantity,
          unitPrice: item.unit_price,
          total: item.unit_price * item.quantity,
        })),
        subtotal,
        discountAmount: subtotal * discount / 100,
        total,
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 'success' ? undefined : 'Encaissement'}
      size="md"
    >
      {step === 'method' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-[#F4F7FB] border border-[#2D7D7D]/[0.08] text-center">
            <p className="text-xs text-[#6B7682] mb-1">Total à payer</p>
            <p className="text-3xl font-bold text-[#1A3636]">{formatCurrency(total)}</p>
            <p className="text-xs text-[#6B7682] mt-1">{cart.length} article(s)</p>
          </div>

          <p className="text-xs font-medium text-[#6B7682] uppercase tracking-wider">Mode de paiement</p>
          <div className="grid grid-cols-2 gap-3">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.id}
                onClick={() => setPaymentMethod(m.id as 'wave' | 'orange_money' | 'cash' | 'card')}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${paymentMethod === m.id ? 'border-[#6C5CE7] bg-[#6C5CE7]/10' : 'border-[#2D7D7D]/[0.1] bg-[#F4F7FB] hover:border-[#2D7D7D]/[0.2]'}`}
              >
                <span className="text-2xl">{m.icon}</span>
                <span className="text-sm font-medium text-[#1A3636]">{m.label}</span>
                <span className="text-[10px] text-[#6B7682] text-center">{m.description}</span>
              </button>
            ))}
          </div>

          {(paymentMethod === 'wave' || paymentMethod === 'orange_money') && (
            <Input
              label="Numéro de téléphone"
              type="tel"
              placeholder="77 xxx xx xx"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setCustomer(customerName, e.target.value) }}
              leftAddon={<Smartphone size={14} />}
            />
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="ghost" fullWidth onClick={handleClose}>Annuler</Button>
            <Button variant="primary" fullWidth onClick={() => setStep('confirm')}>
              Confirmer
            </Button>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div className="p-4 rounded-xl bg-[#F4F7FB] border border-[#2D7D7D]/[0.08] space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#6B7682]">Mode de paiement</span>
              <span className="text-[#1A3636] font-medium flex items-center gap-1.5">
                {method.icon} {method.label}
              </span>
            </div>
            {phone && (
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7682]">Numéro</span>
                <span className="text-[#1A3636]">{phone}</span>
              </div>
            )}
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
            <div className="flex justify-between text-base font-bold border-t border-[#2D7D7D]/[0.08] pt-2">
              <span className="text-[#1A3636]">Total</span>
              <span className="text-[#6C5CE7]">{formatCurrency(total)}</span>
            </div>
          </div>

          {paymentMethod === 'wave' && (
            <div className="p-3 rounded-xl bg-[#0ea5e9]/5 border border-[#0ea5e9]/20 text-xs text-[#0ea5e9]">
              💡 Une notification Wave sera envoyée au client pour confirmer le paiement.
            </div>
          )}
          {paymentMethod === 'orange_money' && (
            <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/20 text-xs text-orange-400">
              💡 Le client recevra un code USSD Orange Money pour valider le paiement.
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="ghost" fullWidth onClick={() => setStep('method')}>Retour</Button>
            <Button variant="primary" fullWidth isLoading={isProcessing} onClick={handlePayment}>
              {isProcessing ? 'Enregistrement...' : 'Valider le paiement'}
            </Button>
          </div>
        </div>
      )}

      {step === 'success' && (
        <div className="text-center py-4 space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
            <CheckCircle size={32} className="text-emerald-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#1A3636]">Paiement réussi !</h3>
            <p className="text-sm text-[#6B7682] mt-1">{formatCurrency(total)} encaissé via {method.label}</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              fullWidth
              leftIcon={<Printer size={15} />}
              onClick={() => receipt && printReceipt(receipt)}
              disabled={!receipt}
            >
              Imprimer reçu
            </Button>
            <Button variant="primary" fullWidth onClick={handleClose}>
              Nouvelle vente
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
