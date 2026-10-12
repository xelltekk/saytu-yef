'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckoutRejectedError, validatePaymentParts, type PaymentPart } from '@/lib/checkout'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils'
import { useSalesStore } from '@/store/salesStore'
import { useUser } from '@/hooks/useUser'
import { createSale } from '@/lib/supabase/queries'
import { printReceipt, type ReceiptData } from '@/lib/receipt'
import { CheckCircle, Smartphone, Printer, AlertCircle, Plus, Trash2 } from 'lucide-react'

const PAYMENT_METHODS = [
  { id: 'wave', label: 'Wave', icon: 'W', color: '#0ea5e9', description: 'Paiement mobile Wave' },
  { id: 'orange_money', label: 'Orange Money', icon: 'OM', color: '#f97316', description: 'Paiement Orange Money' },
  { id: 'cash', label: 'Especes', icon: 'F', color: '#10b981', description: 'Paiement en especes' },
  { id: 'card', label: 'Carte', icon: 'CB', color: '#8b5cf6', description: 'Carte bancaire' },
] as const

function roundUpToStep(amount: number, step: number): number {
  if (step <= 0) return Math.round(amount)
  return Math.ceil(amount / step) * step
}

function formatQuickAmountLabel(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount)
}

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
  const { businessName, businessAddress, businessPhone, businessNinea, businessLogoUrl } = useUser()
  const [step, setStep] = useState<'method' | 'confirm' | 'success'>('method')
  const [localCustomerName, setLocalCustomerName] = useState(customerName)
  const [phone, setPhone] = useState(customerPhone)
  const [amountPaid, setAmountPaid] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const [extraPayments, setExtraPayments] = useState<PaymentPart[]>([])
  const [dueDate, setDueDate] = useState('')
  const opened = useRef(false)
  const submitting = useRef(false)

  const total = getTotal()
  const subtotal = getSubtotal()
  const discountAmount = subtotal * discount / 100
  const taxAmount = (subtotal - discountAmount) * taxRate / 100
  const method = PAYMENT_METHODS.find((m) => m.id === paymentMethod) || PAYMENT_METHODS[2]
  const enteredAmount = useMemo(() => {
    const parsed = Number(amountPaid)
    if (Number.isNaN(parsed)) return 0
    return Math.max(0, parsed)
  }, [amountPaid])
  const extraTotal = extraPayments.reduce((sum, part) => sum + part.amount, 0)
  const primaryPaid = Math.max(0, Math.min(enteredAmount, Math.max(0, total - extraTotal)))
  const paidNow = primaryPaid + extraTotal
  const payments: PaymentPart[] = [
    ...(primaryPaid > 0 ? [{ payment_method: paymentMethod, amount: primaryPaid }] : []),
    ...extraPayments,
  ]
  const paymentError = validatePaymentParts(payments, total)
  const methodLabel = extraPayments.length
    ? payments.map((part) => `${PAYMENT_METHODS.find((option) => option.id === part.payment_method)?.label}: ${formatCurrency(part.amount)}`).join(' + ')
    : method.label
  const changeDue = useMemo(
    () => paymentMethod === 'cash' ? Math.max(0, enteredAmount + extraTotal - total) : 0,
    [enteredAmount, extraTotal, paymentMethod, total]
  )
  const hasCashChange = changeDue > 0.001
  const amountDue = Math.max(0, total - paidNow)
  const hasOutstandingDebt = amountDue > 0.001
  const requiresPhone = payments.some((part) => part.payment_method === 'wave' || part.payment_method === 'orange_money')
  const quickAmounts = useMemo(() => {
    const presets = paymentMethod === 'cash'
      ? [
          { label: 'Exact', value: Math.round(total) },
          { label: formatQuickAmountLabel(roundUpToStep(total, 500)), value: roundUpToStep(total, 500) },
          { label: formatQuickAmountLabel(roundUpToStep(total, 1000)), value: roundUpToStep(total, 1000) },
          { label: formatQuickAmountLabel(roundUpToStep(total, 5000)), value: roundUpToStep(total, 5000) },
        ]
      : [
          { label: 'Total', value: Math.round(total) },
          { label: '50%', value: Math.round(total / 2) },
          { label: '25%', value: Math.round(total / 4) },
          { label: '0 maintenant', value: 0 },
        ]

    return presets.filter((preset, index, list) => (
      total > 0 &&
      list.findIndex((candidate) => candidate.value === preset.value) === index
    ))
  }, [paymentMethod, total])
  const salePreviewItems = useMemo(() => cart.slice(0, 2), [cart])

  useEffect(() => {
    if (!isOpen) { opened.current = false; return }
    if (opened.current) return
    opened.current = true
    setStep('method')
    setLocalCustomerName(customerName)
    setPhone(customerPhone)
    setAmountPaid(total > 0 ? String(Math.round(total)) : '')
    setError('')
    setReceipt(null)
    setExtraPayments([])
    setDueDate('')
    const pending = useSalesStore.getState().checkoutRequest
    if (pending) {
      try {
        const payload = JSON.parse(pending.fingerprint)
        setLocalCustomerName(payload.customer_name || '')
        setPhone(payload.customer_phone || '')
        setPaymentMethod(payload.payment_method)
        const priorPayments: PaymentPart[] = payload.payments ?? []
        setAmountPaid(String(priorPayments.find((part) => part.payment_method === payload.payment_method)?.amount ?? 0))
        setExtraPayments(priorPayments.filter((part) => part.payment_method !== payload.payment_method))
        setDueDate(payload.due_date || '')
      } catch { setError('Tentative precedente a verifier dans l historique.') }
    }
  }, [isOpen, customerName, customerPhone, total, setPaymentMethod])

  const handlePayment = async () => {
    if (submitting.current) return
    if (paymentError) { setError(paymentError); return }
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

    if (paymentMethod !== 'cash' && enteredAmount + extraTotal > total) {
      setStep('method')
      setError('Le montant verse ne peut pas depasser le total avec ce mode de paiement')
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
    submitting.current = true
    setError('')

    try {
      const payload = {
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
        payments,
        due_date: hasOutstandingDebt ? dueDate || undefined : undefined,
      }
      const requestId = useSalesStore.getState().getCheckoutRequestId(JSON.stringify(payload))
      const createdSale = await createSale({ ...payload, request_id: requestId })

      setCustomer(localCustomerName.trim(), phone.trim())

      setReceipt({
        businessName: businessName || 'Saytu Yef',
        businessAddress: businessAddress || undefined,
        businessPhone: businessPhone || undefined,
        businessNinea: businessNinea || undefined,
        businessLogoUrl: businessLogoUrl || undefined,
        reference: createdSale.id.slice(0, 8).toUpperCase(),
        date: new Date(createdSale.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }),
        customerName: localCustomerName.trim() || undefined,
        phone: phone.trim() || undefined,
        methodLabel,
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
        amountTendered: hasCashChange ? enteredAmount : undefined,
        changeDue: hasCashChange ? changeDue : undefined,
      })
      setStep('success')
    } catch (err: unknown) {
      if (err instanceof CheckoutRejectedError) useSalesStore.setState({ checkoutRequest: null })
      setError(getPaymentErrorMessage(err))
    } finally {
      setIsProcessing(false)
      submitting.current = false
    }
  }

  const handleClose = () => {
    if (submitting.current) return
    if (step === 'success') {
      clearCart()
    }
    setStep('method')
    setError('')
    onClose()
  }

  const handleConfirmStep = () => {
    if (paymentError) { setError(paymentError); return }
    if (!amountPaid.trim()) {
      setError('Le montant verse est requis')
      return
    }

    if (Number.isNaN(Number(amountPaid))) {
      setError('Le montant verse est invalide')
      return
    }

    if (paymentMethod !== 'cash' && enteredAmount + extraTotal > total) {
      setError('Le montant verse ne peut pas depasser le total avec ce mode de paiement')
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

  const footer = step === 'method'
    ? (
        <>
          <Button variant="ghost" className="w-full sm:w-auto" onClick={handleClose}>Annuler</Button>
          <Button variant="primary" className="w-full sm:w-auto" onClick={handleConfirmStep}>
            Confirmer
          </Button>
        </>
      )
    : step === 'confirm'
      ? (
          <>
            <Button variant="ghost" disabled={isProcessing} className="w-full sm:w-auto" onClick={() => setStep('method')}>Retour</Button>
            <Button variant="primary" className="w-full sm:w-auto" isLoading={isProcessing} onClick={handlePayment}>
              {isProcessing ? 'Enregistrement...' : actionLabel}
            </Button>
          </>
        )
      : step === 'success'
        ? (
            <>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                leftIcon={<Printer size={15} />}
                onClick={() => receipt && printReceipt(receipt)}
                disabled={!receipt}
              >
                Imprimer recu
              </Button>
              <Button variant="primary" className="w-full sm:w-auto" onClick={handleClose}>
                {hasOutstandingDebt ? 'Terminer' : 'Nouvelle vente'}
              </Button>
            </>
          )
        : undefined

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 'success' ? undefined : 'Encaissement'}
      size="md"
      footer={footer}
    >
      {step === 'method' && (
        <div className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-600">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-[#F4F7FB] p-3 sm:p-4">
            <div className="text-center">
              <p className="text-xs text-[#6B7682] mb-1">Total de la vente</p>
              <p className="text-2xl font-bold text-[#1A3636] sm:text-3xl">{formatCurrency(total)}</p>
              <p className="text-xs text-[#6B7682] mt-1">{cart.length} article(s)</p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:mt-4 sm:gap-3">
              <div className="rounded-2xl bg-white px-3 py-2.5 sm:py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">
                  {hasCashChange ? 'Recu' : 'Verse'}
                </p>
                <p className="mt-1 text-sm font-semibold text-[#1A3636]">
                  {formatCurrency(hasCashChange ? enteredAmount : paidNow)}
                </p>
              </div>
              <div className={`rounded-2xl px-3 py-2.5 sm:py-3 ${
                hasCashChange
                  ? 'bg-[#6C5CE7]/10 text-[#6C5CE7]'
                  : hasOutstandingDebt
                    ? 'bg-amber-500/10 text-amber-700'
                    : 'bg-emerald-500/10 text-emerald-700'
              }`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em]">
                  {hasCashChange ? 'Monnaie' : 'Reste du'}
                </p>
                <p className="mt-1 text-sm font-semibold">{formatCurrency(hasCashChange ? changeDue : amountDue)}</p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-4 sm:gap-2">
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[#5C6B73]">
                Mode {method.label}
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[#5C6B73]">
                {localCustomerName.trim() || phone.trim() || 'Client comptoir'}
              </span>
              {hasOutstandingDebt ? (
                <span className="rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-700">
                  Solde a suivre
                </span>
              ) : (
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                  Paiement complet
                </span>
              )}
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

          {requiresPhone && (
            <div className="rounded-xl border border-[#0ea5e9]/20 bg-[#0ea5e9]/5 px-3 py-2.5 text-xs text-[#0ea5e9]">
              Ajoutez ou verifiez le numero client avant de confirmer ce versement mobile.
            </div>
          )}

          {hasOutstandingDebt && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700">
              La vente sera enregistree avec un solde restant a encaisser plus tard.
            </div>
          )}

          <Input
            label="Montant verse maintenant"
            type="number"
            min="0"
            max={paymentMethod === 'cash' ? undefined : Math.ceil(total)}
            step="1"
            inputMode="numeric"
            placeholder="0"
            value={amountPaid}
            onChange={(event) => {
              setAmountPaid(event.target.value)
              setError('')
            }}
            hint={
              paymentMethod === 'cash'
                ? hasCashChange
                  ? `Monnaie a rendre: ${formatCurrency(changeDue)}`
                  : 'Vous pouvez saisir le montant remis par le client.'
                : 'Laissez le total pour un paiement complet.'
            }
          />

          <div className="space-y-2">
            {extraPayments.map((part, index) => (
              <div key={index} className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem] items-center gap-2">
                <select aria-label="Mode du versement complementaire" value={part.payment_method}
                  className="min-w-0 rounded-lg border bg-white p-2 text-sm"
                  onChange={(event) => setExtraPayments((current) => current.map((entry, i) => i === index
                    ? { ...entry, payment_method: event.target.value as PaymentPart['payment_method'] } : entry))}>
                  {PAYMENT_METHODS.filter((option) => option.id !== paymentMethod).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
                <Input aria-label="Montant complementaire" type="number" min="1" step="1" inputMode="numeric"
                  value={part.amount || ''} onChange={(event) => setExtraPayments((current) => current.map((entry, i) => i === index
                    ? { ...entry, amount: Number(event.target.value) } : entry))} />
                <button type="button" title="Retirer ce versement" aria-label="Retirer ce versement"
                  onClick={() => setExtraPayments((current) => current.filter((_, i) => i !== index))}><Trash2 size={16} /></button>
              </div>
            ))}
            <Button size="sm" variant="outline" disabled={extraPayments.length >= 3} leftIcon={<Plus size={14} />}
              onClick={() => {
                const next = PAYMENT_METHODS.find((option) => option.id !== paymentMethod && !extraPayments.some((part) => part.payment_method === option.id))
                if (next) setExtraPayments((current) => [...current, { payment_method: next.id, amount: 0 }])
              }}>Ajouter un versement</Button>
          </div>
          {hasOutstandingDebt && <Input label="Echeance" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {quickAmounts.map((preset) => (
              <button
                key={`${preset.label}-${preset.value}`}
                type="button"
                onClick={() => {
                  setAmountPaid(String(preset.value))
                  setError('')
                }}
                className={`min-h-10 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                  paidNow === preset.value
                    ? 'border-[#6C5CE7] bg-[#6C5CE7]/10 text-[#6C5CE7]'
                    : 'border-[#2D7D7D]/[0.14] bg-white text-[#5C6B73] hover:border-[#6C5CE7]/35 hover:text-[#1A3636]'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {hasCashChange && (
            <div className="rounded-xl border border-[#6C5CE7]/20 bg-[#6C5CE7]/5 px-3 py-2.5 text-xs text-[#6C5CE7]">
              Le client remet {formatCurrency(enteredAmount)}. Vous rendez {formatCurrency(changeDue)}.
            </div>
          )}

          <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Resume panier</p>
              <span className="text-[11px] font-medium text-[#6B7682]">{cart.length} article(s)</span>
            </div>
            <div className="mt-3 space-y-2">
              {salePreviewItems.map((item) => (
                <div key={item.product_id} className="flex items-center justify-between gap-3 rounded-xl bg-[#F4F7FB] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#1A3636]">{item.product_name}</p>
                    <p className="text-xs text-[#6B7682]">{item.quantity} x {formatCurrency(item.unit_price)}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-[#1A3636]">{formatCurrency(item.total)}</p>
                </div>
              ))}
              {cart.length > salePreviewItems.length && (
                <p className="text-xs text-[#6B7682]">+ {cart.length - salePreviewItems.length} autre(s) article(s)</p>
              )}
            </div>
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
              <span className="max-w-[65%] break-words text-right text-[#1A3636] font-medium">{methodLabel}</span>
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
                <span className="text-[#6B7682]">{hasCashChange ? 'Montant recu' : 'Montant verse'}</span>
                <span className="font-medium text-[#1A3636]">{formatCurrency(hasCashChange ? enteredAmount : paidNow)}</span>
              </div>
              {hasCashChange && (
                <>
                  <div className="flex justify-between text-sm text-[#5C6B73]">
                    <span>Affecte a la vente</span>
                    <span className="font-medium text-[#1A3636]">{formatCurrency(paidNow)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-[#6C5CE7]">
                    <span>Monnaie a rendre</span>
                    <span className="font-medium">{formatCurrency(changeDue)}</span>
                  </div>
                </>
              )}
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

          <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Controle rapide</p>
              <span className="text-[11px] font-medium text-[#6B7682]">{cart.length} article(s)</span>
            </div>
            <div className="mt-3 space-y-2">
              {salePreviewItems.map((item) => (
                <div key={item.product_id} className="flex items-center justify-between gap-3 rounded-xl bg-[#F4F7FB] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#1A3636]">{item.product_name}</p>
                    <p className="text-xs text-[#6B7682]">x{item.quantity}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-[#1A3636]">{formatCurrency(item.total)}</p>
                </div>
              ))}
              {cart.length > salePreviewItems.length && (
                <p className="text-xs text-[#6B7682]">+ {cart.length - salePreviewItems.length} autre(s) article(s)</p>
              )}
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
                : hasCashChange
                  ? `${formatCurrency(enteredAmount)} recus, ${formatCurrency(changeDue)} rendus, vente comptee pour ${formatCurrency(total)}.`
                  : `${formatCurrency(total)} encaisses via ${method.label}.`}
            </p>
          </div>
        </div>
      )}
    </Modal>
  )
}
