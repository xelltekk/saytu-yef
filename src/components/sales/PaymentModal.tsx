'use client'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils'
import { useSalesStore } from '@/store/salesStore'
import { createSale } from '@/lib/supabase/queries'
import { CheckCircle, Smartphone, Banknote, AlertCircle } from 'lucide-react'

const PAYMENT_METHODS = [
  { id: 'wave', label: 'Wave', icon: '🌊', color: '#0ea5e9', description: 'Paiement mobile Wave' },
  { id: 'orange_money', label: 'Orange Money', icon: '🟠', color: '#f97316', description: 'Paiement Orange Money' },
  { id: 'cash', label: 'Espèces', icon: '💵', color: '#10b981', description: 'Paiement en espèces' },
  { id: 'card', label: 'Carte', icon: '💳', color: '#8b5cf6', description: 'Carte bancaire' },
]

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
}

export function PaymentModal({ isOpen, onClose }: PaymentModalProps) {
  const { paymentMethod, setPaymentMethod, getTotal, getSubtotal, cart, discount, clearCart, customerPhone, setCustomer, customerName } = useSalesStore()
  const [step, setStep] = useState<'method' | 'confirm' | 'success'>('method')
  const [phone, setPhone] = useState(customerPhone)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')

  const total = getTotal()
  const subtotal = getSubtotal()
  const method = PAYMENT_METHODS.find((m) => m.id === paymentMethod) || PAYMENT_METHODS[2]

  const handlePayment = async () => {
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
      setStep('success')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors du paiement')
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
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
            <p className="text-xs text-[#8892aa] mb-1">Total à payer</p>
            <p className="text-3xl font-bold text-[#f0f2f8]">{formatCurrency(total)}</p>
            <p className="text-xs text-[#8892aa] mt-1">{cart.length} article(s)</p>
          </div>

          <p className="text-xs font-medium text-[#8892aa] uppercase tracking-wider">Mode de paiement</p>
          <div className="grid grid-cols-2 gap-3">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.id}
                onClick={() => setPaymentMethod(m.id as 'wave' | 'orange_money' | 'cash' | 'card')}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${paymentMethod === m.id ? 'border-[#4f6ef7] bg-[#4f6ef7]/10' : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.16]'}`}
              >
                <span className="text-2xl">{m.icon}</span>
                <span className="text-sm font-medium text-[#f0f2f8]">{m.label}</span>
                <span className="text-[10px] text-[#8892aa] text-center">{m.description}</span>
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
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#8892aa]">Mode de paiement</span>
              <span className="text-[#f0f2f8] font-medium flex items-center gap-1.5">
                {method.icon} {method.label}
              </span>
            </div>
            {phone && (
              <div className="flex justify-between text-sm">
                <span className="text-[#8892aa]">Numéro</span>
                <span className="text-[#f0f2f8]">{phone}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-[#8892aa]">Articles</span>
              <span className="text-[#f0f2f8]">{cart.length}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-emerald-400">
                <span>Remise ({discount}%)</span>
                <span>-{formatCurrency(subtotal * discount / 100)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold border-t border-white/[0.06] pt-2">
              <span className="text-[#f0f2f8]">Total</span>
              <span className="text-[#4f6ef7]">{formatCurrency(total)}</span>
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
            <CheckCircle size={32} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#f0f2f8]">Paiement réussi !</h3>
            <p className="text-sm text-[#8892aa] mt-1">{formatCurrency(total)} encaissé via {method.label}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" fullWidth leftIcon={<Banknote size={15} />}>
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
