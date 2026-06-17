'use client'
import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { formatCurrency, formatDate } from '@/lib/utils'
import { updateSale } from '@/lib/supabase/queries'
import type { Sale } from '@/types'

const METHOD_OPTIONS = [
  { value: 'cash', label: 'Espèces' },
  { value: 'wave', label: 'Wave' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'card', label: 'Carte' },
]

const STATUS_OPTIONS = [
  { value: 'completed', label: 'Payé' },
  { value: 'pending', label: 'En attente' },
  { value: 'cancelled', label: 'Annulé' },
  { value: 'refunded', label: 'Remboursé' },
]

interface SaleDetailModalProps {
  sale: Sale | null
  onClose: () => void
  onSaved?: () => void
}

export function SaleDetailModal({ sale, onClose, onSaved }: SaleDetailModalProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    customer_name: '', customer_phone: '', payment_method: 'cash', payment_status: 'completed', notes: '',
  })

  useEffect(() => {
    if (sale) {
      setForm({
        customer_name: sale.customer_name ?? '',
        customer_phone: sale.customer_phone ?? '',
        payment_method: sale.payment_method,
        payment_status: sale.payment_status,
        notes: sale.notes ?? '',
      })
      setEditing(false)
    }
  }, [sale])

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

  return (
    <Modal
      isOpen={sale !== null}
      onClose={onClose}
      title={editing ? 'Modifier la vente' : 'Détail de la vente'}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Nom du client"
                  value={form.customer_name}
                  onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
                  placeholder="Client"
                />
                <Input
                  label="Téléphone"
                  value={form.customer_phone}
                  onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))}
                  placeholder="+221 ..."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  label="Paiement"
                  options={METHOD_OPTIONS}
                  value={form.payment_method}
                  onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
                />
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">
                    Statut
                  </p>
                  <div className="flex h-11 items-center rounded-full border border-[#2D7D7D]/[0.14] bg-[#F4F7FB] px-4 text-sm text-[#1A3636]">
                    {STATUS_OPTIONS.find((status) => status.value === sale.payment_status)?.label}
                  </div>
                </div>
              </div>
              <Input
                label="Notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Remarques sur la vente"
              />
            </>
          ) : (
            <>
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#F4F7FB] border border-[#2D7D7D]/[0.08]">
                <div>
                  <p className="text-sm font-semibold text-[#1A3636]">{sale.customer_name || 'Client'}</p>
                  {sale.customer_phone && <p className="text-xs text-[#6B7682]">{sale.customer_phone}</p>}
                  <p className="text-xs text-[#6B7682] mt-0.5">{formatDate(sale.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-[#1A3636]">{formatCurrency(sale.total)}</p>
                  <p className="text-xs text-[#6B7682]">
                    {STATUS_OPTIONS.find((s) => s.value === sale.payment_status)?.label} ·{' '}
                    {METHOD_OPTIONS.find((m) => m.value === sale.payment_method)?.label}
                  </p>
                </div>
              </div>

              {/* Articles */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73] mb-2">
                  Articles ({sale.items?.length ?? 0})
                </p>
                <div className="space-y-1.5">
                  {(sale.items ?? []).map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[#F4F7FB]">
                      <div className="min-w-0">
                        <p className="text-sm text-[#1A3636] truncate">{item.product_name}</p>
                        <p className="text-xs text-[#6B7682]">{item.quantity} × {formatCurrency(item.unit_price)}</p>
                      </div>
                      <p className="text-sm font-semibold text-[#1A3636] flex-shrink-0">{formatCurrency(item.total)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totaux */}
              <div className="space-y-1 border-t border-[#2D7D7D]/[0.08] pt-3 text-sm">
                <div className="flex justify-between text-[#6B7682]"><span>Sous-total</span><span>{formatCurrency(sale.subtotal)}</span></div>
                {sale.discount > 0 && <div className="flex justify-between text-emerald-600"><span>Remise</span><span>-{formatCurrency(sale.discount)}</span></div>}
                {sale.tax > 0 && <div className="flex justify-between text-[#6B7682]"><span>TVA</span><span>{formatCurrency(sale.tax)}</span></div>}
                <div className="flex justify-between font-bold text-[#1A3636] pt-1"><span>Total</span><span>{formatCurrency(sale.total)}</span></div>
              </div>

              {sale.notes && (
                <p className="text-xs text-[#6B7682] italic p-2.5 rounded-lg bg-[#F4F7FB]">{sale.notes}</p>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
