'use client'
import { useState, useEffect } from 'react'
import { Globe, Plus, Wifi, WifiOff, Trash2, CheckCircle, ArrowRight, Upload } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { useInventoryStore } from '@/store/inventoryStore'
import { formatCurrency } from '@/lib/utils'
import type { AbroadProduct } from '@/types'

const CURRENCIES = [
  { value: 'CNY', label: 'Yuan (CNY)' },
  { value: 'AED', label: 'Dirham (AED)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'USD', label: 'Dollar (USD)' },
  { value: 'TRY', label: 'Lire (TRY)' },
  { value: 'SAR', label: 'Riyal (SAR)' },
]

const COUNTRIES = [
  { value: 'CN', label: 'Chine' },
  { value: 'AE', label: 'Émirats Arabes Unis' },
  { value: 'TR', label: 'Turquie' },
  { value: 'FR', label: 'France' },
  { value: 'SA', label: 'Arabie Saoudite' },
  { value: 'MA', label: 'Maroc' },
  { value: 'Other', label: 'Autre' },
]

const SAMPLE_ABROAD: AbroadProduct[] = [
  {
    id: 'a1', user_id: 'u1', name: 'Téléphone Xiaomi 14 Pro', purchase_price: 2800, currency: 'CNY',
    quantity: 10, notes: 'Guangzhou Electronics Market', source_country: 'CN', synced: false, activated: false,
    created_at: '2024-01-10T10:00:00'
  },
  {
    id: 'a2', user_id: 'u1', name: 'Montre Casio G-Shock', purchase_price: 180, currency: 'AED',
    quantity: 15, notes: 'Deira Gold Souk', source_country: 'AE', synced: false, activated: false,
    created_at: '2024-01-11T14:00:00'
  },
  {
    id: 'a3', user_id: 'u1', name: 'Tissu soie premium 50m', purchase_price: 450, currency: 'CNY',
    quantity: 5, notes: 'Yiwu Market', source_country: 'CN', synced: true, activated: false,
    created_at: '2024-01-12T09:00:00'
  },
]

interface ActivateModalState {
  open: boolean
  product: AbroadProduct | null
  sellingPrice: string
  sellingCurrency: string
}

export function AbroadBatchEntry() {
  const { abroadProducts, addAbroadProduct, deleteAbroadProduct, updateAbroadProduct } = useInventoryStore()
  const [isOnline, setIsOnline] = useState(() =>
    typeof window !== 'undefined' ? window.navigator.onLine : true
  )
  const [showForm, setShowForm] = useState(false)
  const [activateModal, setActivateModal] = useState<ActivateModalState>({
    open: false, product: null, sellingPrice: '', sellingCurrency: 'XOF'
  })
  const [form, setForm] = useState({
    name: '', purchase_price: '', currency: 'CNY', quantity: '1',
    source_country: 'CN', notes: ''
  })

  const allProducts = abroadProducts.length > 0 ? abroadProducts : SAMPLE_ABROAD

  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    // initialise once after mount (outside effect to avoid cascading render lint rule)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const handleAdd = () => {
    if (!form.name || !form.purchase_price) return
    const product: AbroadProduct = {
      id: Date.now().toString(),
      user_id: 'u1',
      name: form.name,
      purchase_price: Number(form.purchase_price),
      currency: form.currency,
      quantity: Number(form.quantity),
      source_country: form.source_country,
      notes: form.notes,
      synced: false,
      activated: false,
      created_at: new Date().toISOString(),
    }
    addAbroadProduct(product)
    setForm({ name: '', purchase_price: '', currency: 'CNY', quantity: '1', source_country: 'CN', notes: '' })
    setShowForm(false)
  }

  const handleActivate = () => {
    if (!activateModal.product || !activateModal.sellingPrice) return
    updateAbroadProduct(activateModal.product.id, { activated: true })
    setActivateModal({ open: false, product: null, sellingPrice: '', sellingCurrency: 'XOF' })
  }

  const notActivated = allProducts.filter((p) => !p.activated)
  const pendingSync = allProducts.filter((p) => !p.synced)

  return (
    <div className="space-y-6">
      {/* Status banner */}
      <div className={`flex items-center gap-3 p-4 rounded-2xl border ${isOnline ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
        {isOnline ? (
          <><Wifi size={18} className="text-emerald-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-400">Connecté — Synchronisation active</p>
              <p className="text-xs text-[#8892aa]">{pendingSync.length} article(s) en attente de sync</p>
            </div>
            {pendingSync.length > 0 && (
              <Button variant="ghost" size="sm" leftIcon={<Upload size={14} />} className="text-emerald-400">
                Synchroniser
              </Button>
            )}
          </>
        ) : (
          <><WifiOff size={18} className="text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-400">Mode hors ligne</p>
              <p className="text-xs text-[#8892aa]">Vos saisies sont sauvegardées localement</p>
            </div>
          </>
        )}
      </div>

      {/* Add form toggle */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#4f6ef7]/10">
              <Globe size={16} className="text-[#4f6ef7]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#f0f2f8]">Saisie depuis l&apos;étranger</h3>
              <p className="text-xs text-[#8892aa]">Enregistrez vos achats en déplacement</p>
            </div>
          </div>
          <Button
            variant={showForm ? 'ghost' : 'primary'}
            size="sm"
            leftIcon={<Plus size={15} />}
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Annuler' : 'Ajouter'}
          </Button>
        </div>

        {showForm && (
          <div className="border-t border-white/[0.06] pt-4 space-y-4 fade-in">
            <Input
              label="Nom du produit"
              placeholder="ex: Téléphone Xiaomi 14 Pro"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <div className="grid grid-cols-3 gap-3">
              <Select
                label="Pays source"
                options={COUNTRIES}
                value={form.source_country}
                onChange={(e) => setForm((f) => ({ ...f, source_country: e.target.value }))}
              />
              <Select
                label="Devise"
                options={CURRENCIES}
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              />
              <Input
                label="Prix d'achat"
                type="number"
                placeholder="0"
                value={form.purchase_price}
                onChange={(e) => setForm((f) => ({ ...f, purchase_price: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Quantité"
                type="number"
                placeholder="1"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              />
              <Textarea
                label="Notes (marché, remarques...)"
                placeholder="ex: Guangzhou Electronics Market"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={1}
              />
            </div>
            <Button variant="primary" fullWidth onClick={handleAdd}>
              Enregistrer localement
            </Button>
          </div>
        )}
      </Card>

      {/* Products list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#f0f2f8]">
            Articles enregistrés ({notActivated.length} à activer)
          </h3>
        </div>

        {allProducts.map((product) => (
          <Card key={product.id} className="relative">
            <div className="flex items-start gap-3">
              <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${product.activated ? 'bg-emerald-400' : product.synced ? 'bg-[#4f6ef7]' : 'bg-amber-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-[#f0f2f8]">{product.name}</p>
                    <p className="text-xs text-[#8892aa] mt-0.5">
                      {COUNTRIES.find((c) => c.value === product.source_country)?.label} ·{' '}
                      {formatCurrency(product.purchase_price, product.currency)} · Qté: {product.quantity}
                    </p>
                    {product.notes && (
                      <p className="text-xs text-[#8892aa] mt-0.5 italic">{product.notes}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-1.5">
                      {product.activated ? (
                        <Badge variant="success"><CheckCircle size={10} className="mr-1" />Activé</Badge>
                      ) : product.synced ? (
                        <Badge variant="info">Synchronisé</Badge>
                      ) : (
                        <Badge variant="warning">Local</Badge>
                      )}
                    </div>
                    {!product.activated && (
                      <Button
                        variant="primary"
                        size="sm"
                        rightIcon={<ArrowRight size={13} />}
                        onClick={() => setActivateModal({ open: true, product, sellingPrice: '', sellingCurrency: 'XOF' })}
                      >
                        Activer
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => deleteAbroadProduct(product.id)}
                className="p-1.5 rounded-lg text-[#8892aa] hover:text-red-400 hover:bg-red-500/5 transition-colors flex-shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </Card>
        ))}
      </div>

      {/* Activate modal */}
      <Modal
        isOpen={activateModal.open}
        onClose={() => setActivateModal((s) => ({ ...s, open: false }))}
        title="Activer le produit"
        footer={
          <>
            <Button variant="ghost" onClick={() => setActivateModal((s) => ({ ...s, open: false }))}>Annuler</Button>
            <Button variant="primary" onClick={handleActivate}>Ajouter à l&apos;inventaire</Button>
          </>
        }
      >
        {activateModal.product && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <p className="text-sm font-medium text-[#f0f2f8]">{activateModal.product.name}</p>
              <p className="text-xs text-[#8892aa] mt-1">
                Prix achat: {formatCurrency(activateModal.product.purchase_price, activateModal.product.currency)} · Qté: {activateModal.product.quantity}
              </p>
            </div>
            <p className="text-xs text-[#8892aa]">
              Définissez le prix de vente en FCFA pour ajouter ce produit à votre inventaire principal.
            </p>
            <Input
              label="Prix de vente (FCFA)"
              type="number"
              placeholder="ex: 150000"
              value={activateModal.sellingPrice}
              onChange={(e) => setActivateModal((s) => ({ ...s, sellingPrice: e.target.value }))}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
