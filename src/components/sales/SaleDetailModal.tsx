'use client'
import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { recordSalePayment, updateSale } from '@/lib/supabase/queries'
import { getSaleAmountDue, getSaleAmountPaid, getSaleComputedStatus, SALE_METHOD_LABELS, SALE_METHOD_VARIANTS, SALE_STATUS_LABELS, SALE_STATUS_VARIANTS } from '@/lib/sales'
import type { Sale } from '@/types'

const METHOD_OPTIONS = [
  { value: 'cash', label: 'Especes' },
  { value: 'wave', label: 'Wave' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'card', label: 'Carte' },
]

interface SaleDetailModalProps {
  sale: Sale | null
  onClose: () => void
  onSaved?: () => void
}

export function SaleDetailModal({ sale, onClose, onSaved }: SaleDetailModalProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [recordingPayment, setRecordingPayment] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentError, setPaymentError] = useState('')
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
  }, [sale])

  const computedStatus = useMemo(() => (sale ? getSaleComputedStatus(sale) : 'pending'), [sale])
  const amountPaid = useMemo(() => (sale ? getSaleAmountPaid(sale) : 0), [sale])
  const amountDue = useMemo(() => (sale ? getSaleAmountDue(sale) : 0), [sale])
  const payments = useMemo(
    () => [...(sale?.payments ?? [])].sort((left, right) => right.created_at.localeCompare(left.created_at)),
    [sale]
  )

  const handleSave = async () => {
    if (!sale) return
    setSaving(true)
    try {
      await updateSale(sale.id, {
        customer_name: form.customer_name || undefined,
        customer_phone: form.customer_phone || undefined,
        payment_method: form.payment_method as Sale['payment_method'],
        notes: form.notes || undefined,
      })
      onSaved?.()
      onClose()
    } catch (err) {
      console.error(err)
      alert('Erreur lors de la modification de la vente')
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
      onSaved?.()
      onClose()
    } catch (err) {
      console.error(err)
      setPaymentError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement du versement")
    } finally {
      setRecordingPayment(false)
    }
  }

  return (
    <Modal
      isOpen={sale !== null}
      onClose={onClose}
      title={editing ? 'Modifier la vente' : 'Detail de la vente'}
      size="md"
      footer={
        editing ? (
          <>
            <Button variant="ghost" onClick={() => setEditing(false)}>Annuler</Button>
            <Button variant="primary" onClick={handleSave} isLoading={saving}>Enregistrer</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>Fermer</Button>
            <Button variant="primary" onClick={() => setEditing(true)}>Modifier</Button>
          </>
        )
      }
    >
      {sale && (
        <div className="space-y-4">
          {editing ? (
            <>
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

                <div className="mt-4 grid grid-cols-3 gap-2">
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
              </div>

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
                  {amountDue > 0 && computedStatus !== 'cancelled' && computedStatus !== 'refunded' && (
                    <Button
                      variant={showPaymentForm ? 'ghost' : 'teal'}
                      size="sm"
                      onClick={() => {
                        setShowPaymentForm((current) => !current)
                        setPaymentError('')
                      }}
                    >
                      {showPaymentForm ? 'Masquer' : 'Ajouter un versement'}
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
                    <Input
                      label="Note"
                      value={paymentForm.note}
                      onChange={(e) => setPaymentForm((current) => ({ ...current, note: e.target.value }))}
                      placeholder="Ex: acompte complementaire"
                    />
                    <div className="flex gap-3">
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
                      <div key={payment.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#F4F7FB] px-3 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#1A3636]">{formatCurrency(payment.amount)}</p>
                          <p className="text-xs text-[#6B7682]">
                            {SALE_METHOD_LABELS[payment.payment_method]} · {formatDate(payment.created_at)}
                          </p>
                          {payment.note && (
                            <p className="mt-0.5 truncate text-xs text-[#6B7682]">{payment.note}</p>
                          )}
                        </div>
                        <Badge variant={SALE_METHOD_VARIANTS[payment.payment_method]}>
                          {SALE_METHOD_LABELS[payment.payment_method]}
                        </Badge>
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
