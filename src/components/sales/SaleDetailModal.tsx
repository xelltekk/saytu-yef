'use client'
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, MessageCircle, Phone, Printer, RotateCcw } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { recordSalePayment, reverseSale, updateSale } from '@/lib/supabase/queries'
import { printReceipt, type ReceiptData } from '@/lib/receipt'
import { getSaleAmountDue, getSaleAmountPaid, getSaleComputedStatus, SALE_METHOD_LABELS, SALE_METHOD_VARIANTS, SALE_STATUS_LABELS, SALE_STATUS_VARIANTS } from '@/lib/sales'
import { useUser } from '@/hooks/useUser'
import { useAccountRole } from '@/hooks/useAccountRole'
import type { Sale } from '@/types'

const METHOD_OPTIONS = [
  { value: 'cash', label: 'Especes' },
  { value: 'wave', label: 'Wave' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'card', label: 'Carte' },
]

function normalizeContactPhone(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 9 && digits.startsWith('7')) digits = `221${digits}`
  return digits
}

interface SaleDetailModalProps {
  sale: Sale | null
  onClose: () => void
  onSaved?: (message?: string) => void
}

export function SaleDetailModal({ sale, onClose, onSaved }: SaleDetailModalProps) {
  const { businessName, businessAddress, businessPhone, businessNinea } = useUser()
  const { isAdmin } = useAccountRole()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [recordingPayment, setRecordingPayment] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [showReversal, setShowReversal] = useState(false)
  const [reversalReason, setReversalReason] = useState('')
  const [reversalError, setReversalError] = useState('')
  const [reversing, setReversing] = useState(false)
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    payment_method: 'cash',
    notes: '',
  })
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_method: 'cash',
    note: '',
  })

  useEffect(() => {
    if (!sale) return

    setForm({
      customer_name: sale.customer_name ?? '',
      customer_phone: sale.customer_phone ?? '',
      payment_method: sale.payment_method,
      notes: sale.notes ?? '',
    })
    setPaymentForm({
      amount: sale.amount_due ? String(Math.round(sale.amount_due)) : '',
      payment_method: sale.payment_method,
      note: '',
    })
    setEditing(false)
    setShowPaymentForm(false)
    setPaymentError('')
    setSaveError('')
    setShowReversal(false)
    setReversalReason('')
    setReversalError('')
  }, [sale])

  const computedStatus = useMemo(() => (sale ? getSaleComputedStatus(sale) : 'pending'), [sale])
  const amountPaid = useMemo(() => (sale ? getSaleAmountPaid(sale) : 0), [sale])
  const amountDue = useMemo(() => (sale ? getSaleAmountDue(sale) : 0), [sale])
  const payments = useMemo(
    () => [...(sale?.payments ?? [])].sort((left, right) => right.created_at.localeCompare(left.created_at)),
    [sale]
  )
  const receipt = useMemo<ReceiptData | null>(() => {
    if (!sale) return null

    return {
      businessName: businessName || 'Saytu Yef',
      businessAddress: businessAddress || undefined,
      businessPhone: businessPhone || undefined,
      businessNinea: businessNinea || undefined,
      reference: sale.id.slice(0, 8).toUpperCase(),
      date: new Date(sale.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }),
      customerName: sale.customer_name || undefined,
      phone: sale.customer_phone || undefined,
      methodLabel: SALE_METHOD_LABELS[sale.payment_method],
      statusLabel: SALE_STATUS_LABELS[computedStatus],
      items: (sale.items ?? []).map((item) => ({
        name: item.product_name,
        qty: item.quantity,
        unitPrice: item.unit_price,
        total: item.total,
      })),
      subtotal: sale.subtotal,
      discountAmount: sale.discount,
      taxAmount: sale.tax,
      total: sale.total,
      amountPaid,
      amountDue,
    }
  }, [amountDue, amountPaid, businessAddress, businessName, businessNinea, businessPhone, computedStatus, sale])
  const contactPhone = useMemo(
    () => normalizeContactPhone(sale?.customer_phone ?? ''),
    [sale?.customer_phone]
  )
  const debtReminder = useMemo(() => {
    if (!sale || amountDue <= 0) return ''
    const customer = sale.customer_name ? ` ${sale.customer_name}` : ''
    return `Bonjour${customer}, nous vous rappelons qu’il reste ${formatCurrency(amountDue)} à régler sur votre achat chez ${businessName || 'Saytu Yef'} (reçu ${sale.id.slice(0, 8).toUpperCase()}). Merci.`
  }, [amountDue, businessName, sale])
  const reversalTarget = amountPaid > 0 ? 'refunded' : 'cancelled'
  const paymentQuickAmounts = useMemo(() => {
    const presets = [
      { label: 'Reste', value: Math.round(amountDue) },
      { label: '50%', value: Math.round(amountDue / 2) },
      { label: '25%', value: Math.round(amountDue / 4) },
    ]

    return presets.filter((preset, index, list) => (
      amountDue > 0 &&
      preset.value > 0 &&
      list.findIndex((candidate) => candidate.value === preset.value) === index
    ))
  }, [amountDue])
  const paymentProgress = useMemo(() => {
    if (!sale || sale.total <= 0) return 0
    return Math.max(0, Math.min(100, Math.round((amountPaid / sale.total) * 100)))
  }, [amountPaid, sale])

  const handleSave = async () => {
    if (!sale) return
    setSaving(true)
    setSaveError('')
    try {
      await updateSale(sale.id, {
        customer_name: form.customer_name.trim() || undefined,
        customer_phone: form.customer_phone.trim() || undefined,
        payment_method: form.payment_method as Sale['payment_method'],
        notes: form.notes.trim() || undefined,
      })
      onSaved?.('Les informations de la vente ont été enregistrées.')
      onClose()
    } catch (err: unknown) {
      console.error(err)
      setSaveError(err instanceof Error ? err.message : 'Erreur lors de la modification de la vente.')
    } finally {
      setSaving(false)
    }
  }

  const handleRecordPayment = async () => {
    if (!sale) return

    const amount = Number(paymentForm.amount)
    if (!paymentForm.amount || Number.isNaN(amount) || amount <= 0) {
      setPaymentError('Le montant du versement est invalide')
      return
    }

    if (amount > amountDue) {
      setPaymentError("Le versement ne peut pas depasser le reste du")
      return
    }

    setRecordingPayment(true)
    setPaymentError('')

    try {
      await recordSalePayment(sale.id, {
        amount,
        payment_method: paymentForm.payment_method as Sale['payment_method'],
        note: paymentForm.note || undefined,
      })
      onSaved?.(`Versement de ${formatCurrency(amount)} enregistré.`)
      onClose()
    } catch (err) {
      console.error(err)
      setPaymentError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement du versement")
    } finally {
      setRecordingPayment(false)
    }
  }

  const handleReverseSale = async () => {
    if (!sale) return
    if (reversalReason.trim().length < 3) {
      setReversalError('Indiquez un motif d’au moins 3 caractères.')
      return
    }

    setReversing(true)
    setReversalError('')
    try {
      await reverseSale(sale.id, reversalTarget, reversalReason)
      onSaved?.(
        reversalTarget === 'refunded'
          ? 'La vente a été remboursée et le stock restauré.'
          : 'La vente a été annulée et le stock restauré.'
      )
      onClose()
    } catch (error: unknown) {
      console.error(error)
      setReversalError(error instanceof Error ? error.message : 'Impossible de traiter cette vente.')
    } finally {
      setReversing(false)
    }
  }

  return (
    <Modal
      isOpen={sale !== null}
      onClose={onClose}
      title={showReversal ? (reversalTarget === 'refunded' ? 'Rembourser la vente' : 'Annuler la vente') : editing ? 'Modifier la vente' : 'Detail de la vente'}
      size="md"
      footer={
        showReversal ? (
          <>
            <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setShowReversal(false)} disabled={reversing}>Retour</Button>
            <Button variant="danger" className="w-full sm:w-auto" onClick={() => void handleReverseSale()} isLoading={reversing}>
              {reversalTarget === 'refunded' ? 'Confirmer le remboursement' : 'Confirmer l’annulation'}
            </Button>
          </>
        ) : editing ? (
          <>
            <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setEditing(false)}>Annuler</Button>
            <Button variant="primary" className="w-full sm:w-auto" onClick={handleSave} isLoading={saving}>Enregistrer</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" className="w-full sm:w-auto" onClick={onClose}>Fermer</Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              leftIcon={<Printer size={15} />}
              onClick={() => receipt && printReceipt(receipt)}
              disabled={!receipt}
            >
              Imprimer le reçu
            </Button>
            {isAdmin && computedStatus !== 'cancelled' && computedStatus !== 'refunded' && (
              <Button
                variant="danger"
                className="w-full sm:w-auto"
                leftIcon={<RotateCcw size={15} />}
                onClick={() => setShowReversal(true)}
              >
                {amountPaid > 0 ? 'Rembourser' : 'Annuler'}
              </Button>
            )}
            <Button variant="primary" className="w-full sm:w-auto" onClick={() => setEditing(true)}>Modifier</Button>
          </>
        )
      }
    >
      {sale && (
        <div className="space-y-4">
          {showReversal ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#1A3636]">
                      {reversalTarget === 'refunded' ? 'Remboursement avec remise en stock' : 'Annulation avec remise en stock'}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[#5C6B73]">
                      Les quantités des {sale.items?.length ?? 0} article(s) seront automatiquement restaurées et tracées dans l’historique du stock.
                    </p>
                  </div>
                </div>
              </div>

              {reversalTarget === 'refunded' && (
                <div className="flex items-center justify-between rounded-xl bg-amber-500/10 px-3 py-3 text-sm text-amber-800">
                  <span>Montant encaissé à restituer</span>
                  <strong>{formatCurrency(amountPaid)}</strong>
                </div>
              )}

              {reversalError && (
                <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-600">
                  {reversalError}
                </div>
              )}

              <Textarea
                label="Motif obligatoire"
                value={reversalReason}
                onChange={(event) => {
                  setReversalReason(event.target.value)
                  setReversalError('')
                }}
                placeholder="Ex : retour client, erreur de saisie…"
                rows={3}
                disabled={reversing}
              />

              <p className="text-xs text-[#6B7682]">
                Cette action est irréversible. Le remboursement financier doit être effectué avec le moyen convenu avec le client.
              </p>
            </div>
          ) : editing ? (
            <>
              {saveError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-600"
                >
                  {saveError}
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="Nom du client"
                  value={form.customer_name}
                  onChange={(e) => setForm((current) => ({ ...current, customer_name: e.target.value }))}
                  placeholder="Client"
                />
                <Input
                  label="Telephone"
                  value={form.customer_phone}
                  onChange={(e) => setForm((current) => ({ ...current, customer_phone: e.target.value }))}
                  placeholder="+221 ..."
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Select
                  label="Paiement principal"
                  options={METHOD_OPTIONS}
                  value={form.payment_method}
                  onChange={(e) => setForm((current) => ({ ...current, payment_method: e.target.value }))}
                />
                <div className="space-y-1.5">
                  <p className="ml-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">
                    Statut
                  </p>
                  <div className="flex h-11 items-center rounded-full border border-[#2D7D7D]/[0.14] bg-[#F4F7FB] px-4 text-sm text-[#1A3636]">
                    {SALE_STATUS_LABELS[computedStatus]}
                  </div>
                </div>
              </div>
              <Input
                label="Notes"
                value={form.notes}
                onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
                placeholder="Remarques sur la vente"
              />
            </>
          ) : (
            <>
              <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-[#F4F7FB] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[#1A3636]">{sale.customer_name || 'Client'}</p>
                    {sale.customer_phone && <p className="text-xs text-[#6B7682]">{sale.customer_phone}</p>}
                    <p className="mt-0.5 text-xs text-[#6B7682]">{formatDate(sale.created_at)}</p>
                    {(sale.seller_name || sale.seller_email) && (
                      <p className="mt-1 text-xs font-medium text-[#6C5CE7]">
                        Vendeur: {sale.seller_name || sale.seller_email}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-[#1A3636]">{formatCurrency(sale.total)}</p>
                    <div className="mt-1 flex flex-wrap justify-end gap-1.5">
                      <Badge variant={SALE_STATUS_VARIANTS[computedStatus]}>
                        {SALE_STATUS_LABELS[computedStatus]}
                      </Badge>
                      <Badge variant={SALE_METHOD_VARIANTS[sale.payment_method]}>
                        {SALE_METHOD_LABELS[sale.payment_method]}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="rounded-xl bg-white px-3 py-3 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Total</p>
                    <p className="mt-1 text-xs font-semibold text-[#1A3636]">{formatCurrency(sale.total)}</p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-3 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Paye</p>
                    <p className="mt-1 text-xs font-semibold text-emerald-600">{formatCurrency(amountPaid)}</p>
                  </div>
                  <div className={`rounded-xl px-3 py-3 text-center ${amountDue > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Reste</p>
                    <p className={`mt-1 text-xs font-semibold ${amountDue > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {formatCurrency(amountDue)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-white px-3 py-3">
                  <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-[#5C6B73]">
                    <span>Progression d&apos;encaissement</span>
                    <span>{paymentProgress}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#F4F7FB]">
                    <div
                      className={`h-full rounded-full ${amountDue > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${paymentProgress}%` }}
                    />
                  </div>
                </div>
              </div>

              {amountDue > 0 && computedStatus !== 'cancelled' && computedStatus !== 'refunded' && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#1A3636]">Solde a recouvrer</p>
                      <p className="text-xs text-amber-700">Suivi client et versement rapide depuis mobile.</p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-amber-700">{formatCurrency(amountDue)}</p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <Button
                      variant={showPaymentForm ? 'ghost' : 'teal'}
                      className="col-span-2 w-full sm:col-span-1"
                      onClick={() => {
                        setShowPaymentForm((current) => !current)
                        setPaymentError('')
                      }}
                    >
                      {showPaymentForm ? 'Masquer le versement' : 'Ajouter un versement'}
                    </Button>
                    {contactPhone ? (
                      <>
                        <a
                          href={`https://wa.me/${contactPhone}?text=${encodeURIComponent(debtReminder)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                        >
                          <MessageCircle size={15} /> Relancer
                        </a>
                        <a
                          href={`tel:+${contactPhone}`}
                          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#2D7D7D]/15 bg-white px-3 text-xs font-semibold text-[#2D7D7D]"
                        >
                          <Phone size={15} /> Appeler
                        </a>
                      </>
                    ) : (
                      <div className="col-span-2 rounded-xl border border-amber-500/20 bg-white px-3 py-3 text-xs text-amber-700 sm:col-span-2">
                        Ajoutez le numero du client pour pouvoir le relancer rapidement.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">
                  Articles ({sale.items?.length ?? 0})
                </p>
                <div className="space-y-1.5">
                  {(sale.items ?? []).map((item, index) => (
                    <div key={index} className="flex items-center justify-between gap-2 rounded-lg bg-[#F4F7FB] p-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-[#1A3636]">{item.product_name}</p>
                        <p className="text-xs text-[#6B7682]">{item.quantity} x {formatCurrency(item.unit_price)}</p>
                      </div>
                      <p className="flex-shrink-0 text-sm font-semibold text-[#1A3636]">{formatCurrency(item.total)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">
                    Versements ({payments.length})
                  </p>
                  {amountDue > 0 && computedStatus !== 'cancelled' && computedStatus !== 'refunded' && showPaymentForm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowPaymentForm(false)
                        setPaymentError('')
                      }}
                    >
                      Masquer
                    </Button>
                  )}
                </div>

                {showPaymentForm && (
                  <div className="mb-3 space-y-3 rounded-2xl border border-[#2D7D7D]/[0.08] bg-[#F4F7FB] p-3">
                    {paymentError && (
                      <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-600">
                        {paymentError}
                      </div>
                    )}
                    <div className="rounded-2xl bg-white px-3 py-3">
                      <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">
                        <span>Encaissement client</span>
                        <span>{paymentProgress}% deja regle</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-[#F4F7FB] px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Paye</p>
                          <p className="mt-1 text-sm font-semibold text-emerald-600">{formatCurrency(amountPaid)}</p>
                        </div>
                        <div className="rounded-xl bg-[#F4F7FB] px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Reste du</p>
                          <p className="mt-1 text-sm font-semibold text-amber-700">{formatCurrency(amountDue)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Input
                        label="Montant du versement"
                        type="number"
                        min="0"
                        max={Math.ceil(amountDue)}
                        step="1"
                        inputMode="numeric"
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm((current) => ({ ...current, amount: e.target.value }))}
                        placeholder="0"
                      />
                      <Select
                        label="Mode de paiement"
                        options={METHOD_OPTIONS}
                        value={paymentForm.payment_method}
                        onChange={(e) => setPaymentForm((current) => ({ ...current, payment_method: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {paymentQuickAmounts.map((preset) => (
                        <button
                          key={`${preset.label}-${preset.value}`}
                          type="button"
                          onClick={() => setPaymentForm((current) => ({ ...current, amount: String(preset.value) }))}
                          className={`rounded-full border px-3 py-2 text-xs font-semibold transition-all ${
                            Number(paymentForm.amount) === preset.value
                              ? 'border-[#6C5CE7] bg-[#6C5CE7]/10 text-[#6C5CE7]'
                              : 'border-[#2D7D7D]/[0.14] bg-white text-[#5C6B73] hover:border-[#6C5CE7]/35 hover:text-[#1A3636]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <Input
                      label="Note"
                      value={paymentForm.note}
                      onChange={(e) => setPaymentForm((current) => ({ ...current, note: e.target.value }))}
                      placeholder="Ex: acompte complementaire"
                    />
                    <div className="flex flex-col-reverse gap-3 sm:flex-row">
                      <Button variant="ghost" fullWidth onClick={() => setShowPaymentForm(false)}>
                        Annuler
                      </Button>
                      <Button variant="primary" fullWidth onClick={handleRecordPayment} isLoading={recordingPayment}>
                        Enregistrer
                      </Button>
                    </div>
                  </div>
                )}

                {payments.length === 0 ? (
                  <div className="rounded-xl bg-[#F4F7FB] px-3 py-4 text-center text-xs text-[#6B7682]">
                    Aucun versement enregistre pour cette vente.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {payments.map((payment) => (
                      <div key={payment.id} className="flex flex-col gap-3 rounded-xl bg-[#F4F7FB] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#1A3636]">{formatCurrency(payment.amount)}</p>
                          <p className="text-xs text-[#6B7682]">
                            {SALE_METHOD_LABELS[payment.payment_method]} · {formatDate(payment.created_at)}
                          </p>
                          {payment.note && (
                            <p className="mt-0.5 truncate text-xs text-[#6B7682]">{payment.note}</p>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-3 sm:block">
                          <span className="text-[11px] font-medium text-[#6B7682] sm:hidden">{formatDate(payment.created_at)}</span>
                          <Badge variant={SALE_METHOD_VARIANTS[payment.payment_method]}>
                            {SALE_METHOD_LABELS[payment.payment_method]}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1 border-t border-[#2D7D7D]/[0.08] pt-3 text-sm">
                <div className="flex justify-between text-[#6B7682]"><span>Sous-total</span><span>{formatCurrency(sale.subtotal)}</span></div>
                {sale.discount > 0 && <div className="flex justify-between text-emerald-600"><span>Remise</span><span>-{formatCurrency(sale.discount)}</span></div>}
                {sale.tax > 0 && <div className="flex justify-between text-[#6B7682]"><span>TVA</span><span>{formatCurrency(sale.tax)}</span></div>}
                <div className="flex justify-between pt-1 font-bold text-[#1A3636]"><span>Total</span><span>{formatCurrency(sale.total)}</span></div>
              </div>

              {sale.notes && (
                <p className="rounded-lg bg-[#F4F7FB] p-2.5 text-xs italic text-[#6B7682]">{sale.notes}</p>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
