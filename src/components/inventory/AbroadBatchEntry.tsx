'use client'
import { useState, useEffect } from 'react'
import { Globe, Plus, Wifi, WifiOff, Trash2, CheckCircle, ArrowRight, Upload, Pencil } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { useInventoryStore } from '@/store/inventoryStore'
import { formatCurrency, generateSKU } from '@/lib/utils'
import { addProduct, getCategories } from '@/lib/supabase/queries'
import type { AbroadProduct, Category, Product } from '@/types'

const CURRENCIES = [
  { value: 'XOF', label: 'FCFA (XOF)' },
  { value: 'CNY', label: 'Yuan (CNY)' },
  { value: 'AED', label: 'Dirham (AED)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'USD', label: 'Dollar (USD)' },
  { value: 'TRY', label: 'Lire (TRY)' },
  { value: 'SAR', label: 'Riyal (SAR)' },
]

const COUNTRIES = [
  { value: 'SN', label: 'Sénégal' },
  { value: 'CN', label: 'Chine' },
  { value: 'AE', label: 'Émirats Arabes Unis' },
  { value: 'TR', label: 'Turquie' },
  { value: 'FR', label: 'France' },
  { value: 'SA', label: 'Arabie Saoudite' },
  { value: 'MA', label: 'Maroc' },
  { value: 'Other', label: 'Autre' },
]

interface ActivateModalState {
  open: boolean
  product: AbroadProduct | null
  sellingPrice: string
  buyingPrice: string
  categoryId: string
  sellingCurrency: string
}

interface AbroadBatchEntryProps {
  onTransferred?: (product: Product) => void
}

export function AbroadBatchEntry({ onTransferred }: AbroadBatchEntryProps) {
  const { abroadProducts, addAbroadProduct, deleteAbroadProduct, updateAbroadProduct } = useInventoryStore()
  const [categories, setCategories] = useState<Category[]>([])
  const [transferring, setTransferring] = useState(false)
  const [isOnline, setIsOnline] = useState(() =>
    typeof window !== 'undefined' ? window.navigator.onLine : true
  )
  const [showForm, setShowForm] = useState(false)
  const [activateModal, setActivateModal] = useState<ActivateModalState>({
    open: false, product: null, sellingPrice: '', buyingPrice: '', categoryId: '', sellingCurrency: 'XOF'
  })
  const [form, setForm] = useState({
    name: '', purchase_price: '', currency: 'XOF', quantity: '1',
    source_country: 'SN', notes: ''
  })
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    name: '', purchase_price: '', currency: 'CNY', quantity: '1',
    source_country: 'CN', notes: ''
  })

  const openEdit = (product: AbroadProduct) => {
    setEditId(product.id)
    setEditForm({
      name: product.name,
      purchase_price: String(product.purchase_price),
      currency: product.currency,
      quantity: String(product.quantity),
      source_country: product.source_country,
      notes: product.notes ?? '',
    })
  }

  const handleSaveEdit = () => {
    if (!editId || !editForm.name || !editForm.purchase_price) return
    updateAbroadProduct(editId, {
      name: editForm.name,
      purchase_price: Number(editForm.purchase_price),
      currency: editForm.currency,
      quantity: Number(editForm.quantity),
      source_country: editForm.source_country,
      notes: editForm.notes,
    })
    setEditId(null)
  }

  const allProducts = abroadProducts

  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    // initialise once after mount (outside effect to avoid cascading render lint rule)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  useEffect(() => {
    getCategories().then(setCategories).catch(console.error)
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
    setForm({ name: '', purchase_price: '', currency: 'XOF', quantity: '1', source_country: 'SN', notes: '' })
    setShowForm(false)
  }

  const handleActivate = async () => {
    const p = activateModal.product
    if (!p || !activateModal.sellingPrice) return
    setTransferring(true)
    try {
      // Crée réellement le produit dans le stock principal (Supabase)
      const createdProduct = await addProduct({
        name: p.name,
        sku: generateSKU(p.name),
        category_id: activateModal.categoryId || undefined,
        supplier_id: undefined,
        description: p.notes || undefined,
        buying_price: Number(activateModal.buyingPrice) || p.purchase_price,
        selling_price: Number(activateModal.sellingPrice) || 0,
        quantity: p.quantity,
        min_quantity: 5,
        currency: 'XOF',
        status: 'active',
      } as Parameters<typeof addProduct>[0])

      // Marque l'article étranger comme transféré
      updateAbroadProduct(p.id, { activated: true, synced: true })
      setActivateModal({ open: false, product: null, sellingPrice: '', buyingPrice: '', categoryId: '', sellingCurrency: 'XOF' })
      onTransferred?.(createdProduct)
    } catch (err) {
      console.error(err)
      alert('Erreur lors du transfert vers le stock principal')
    } finally {
      setTransferring(false)
    }
  }

  const notActivated = allProducts.filter((p) => !p.activated)
  const pendingSync = allProducts.filter((p) => !p.synced)

  return (
    <div className="space-y-6">
      {/* Status banner */}
      <div className={`flex items-center gap-3 p-4 rounded-2xl border ${isOnline ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
        {isOnline ? (
          <><Wifi size={18} className="text-emerald-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-600">Connecté — Synchronisation active</p>
              <p className="text-xs text-[#6B7682]">{pendingSync.length} article(s) en attente de sync</p>
            </div>
            {pendingSync.length > 0 && (
              <Button variant="ghost" size="sm" leftIcon={<Upload size={14} />} className="text-emerald-600">
                Synchroniser
              </Button>
            )}
          </>
        ) : (
          <><WifiOff size={18} className="text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-600">Mode hors ligne</p>
              <p className="text-xs text-[#6B7682]">Vos saisies sont sauvegardées localement</p>
            </div>
          </>
        )}
      </div>

      {/* Add form toggle */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#6C5CE7]/10">
              <Globe size={16} className="text-[#6C5CE7]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#1A3636]">Saisie depuis l&apos;étranger</h3>
              <p className="text-xs text-[#6B7682]">Enregistrez vos achats en déplacement</p>
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
          <div className="border-t border-[#2D7D7D]/[0.08] pt-4 space-y-4 fade-in">
            <Input
              label="Nom du produit"
              placeholder="ex: Téléphone Xiaomi 14 Pro"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <h3 className="text-sm font-semibold text-[#1A3636]">
            Articles enregistrés ({notActivated.length} à activer)
          </h3>
        </div>

        {allProducts.length === 0 ? (
          <Card>
            <div className="py-8 text-center">
              <Globe size={28} className="mx-auto mb-3 text-[#6B7682] opacity-50" />
              <p className="text-sm font-medium text-[#1A3636]">Aucune saisie étrangère</p>
              <p className="mt-1 text-xs text-[#6B7682]">Ajoutez vos achats, puis transférez-les vers le stock principal.</p>
            </div>
          </Card>
        ) : allProducts.map((product) => (
          <Card key={product.id} className="relative">
            <div className="flex items-start gap-3">
              <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${product.activated ? 'bg-emerald-500' : product.synced ? 'bg-[#6C5CE7]' : 'bg-amber-500'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1A3636] break-words">{product.name}</p>
                    <p className="text-xs text-[#6B7682] mt-0.5">
                      {COUNTRIES.find((c) => c.value === product.source_country)?.label} ·{' '}
                      {formatCurrency(product.purchase_price, product.currency)} · Qté: {product.quantity}
                    </p>
                    {product.notes && (
                      <p className="text-xs text-[#6B7682] mt-0.5 italic">{product.notes}</p>
                    )}
                  </div>
                  <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 flex-shrink-0">
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
                        onClick={() => setActivateModal({ open: true, product, sellingPrice: '', buyingPrice: '', categoryId: '', sellingCurrency: 'XOF' })}
                      >
                        Transférer
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1 flex-shrink-0">
                {!product.activated && (
                  <button
                    onClick={() => openEdit(product)}
                    title="Modifier"
                    aria-label="Modifier l'article"
                    className="p-1.5 rounded-lg text-[#6B7682] hover:text-[#6C5CE7] hover:bg-[#6C5CE7]/[0.1] transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                )}
                <button
                  onClick={() => deleteAbroadProduct(product.id)}
                  title="Supprimer"
                  aria-label="Supprimer l'article"
                  className="p-1.5 rounded-lg text-[#6B7682] hover:text-red-600 hover:bg-red-500/5 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Activate / Transfer modal */}
      <Modal
        isOpen={activateModal.open}
        onClose={() => setActivateModal((s) => ({ ...s, open: false }))}
        title="Transférer vers le stock principal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setActivateModal((s) => ({ ...s, open: false }))}>Annuler</Button>
            <Button variant="primary" onClick={handleActivate} isLoading={transferring} disabled={!activateModal.sellingPrice}>
              Transférer
            </Button>
          </>
        }
      >
        {activateModal.product && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-[#F4F7FB] border border-[#2D7D7D]/[0.08]">
              <p className="text-sm font-medium text-[#1A3636]">{activateModal.product.name}</p>
              <p className="text-xs text-[#6B7682] mt-1">
                Prix achat: {formatCurrency(activateModal.product.purchase_price, activateModal.product.currency)} · Qté: {activateModal.product.quantity}
              </p>
            </div>
            <p className="text-xs text-[#6B7682]">
              Ce produit sera ajouté à votre inventaire principal avec la quantité saisie.
            </p>
            <Select
              label="Catégorie (optionnel)"
              options={[
                { value: '', label: 'Sans catégorie' },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
              value={activateModal.categoryId}
              onChange={(e) => setActivateModal((s) => ({ ...s, categoryId: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Prix d'achat (FCFA)"
                type="number"
                placeholder={String(activateModal.product.purchase_price)}
                value={activateModal.buyingPrice}
                onChange={(e) => setActivateModal((s) => ({ ...s, buyingPrice: e.target.value }))}
              />
              <Input
                label="Prix de vente (FCFA)"
                type="number"
                placeholder="ex: 150000"
                value={activateModal.sellingPrice}
                onChange={(e) => setActivateModal((s) => ({ ...s, sellingPrice: e.target.value }))}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Edit modal */}
      <Modal
        isOpen={editId !== null}
        onClose={() => setEditId(null)}
        title="Modifier l'article"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditId(null)}>Annuler</Button>
            <Button variant="primary" onClick={handleSaveEdit}>Enregistrer</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nom du produit"
            placeholder="ex: Téléphone Xiaomi 14 Pro"
            value={editForm.name}
            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
          />
          <div className="grid grid-cols-3 gap-3">
            <Select
              label="Pays source"
              options={COUNTRIES}
              value={editForm.source_country}
              onChange={(e) => setEditForm((f) => ({ ...f, source_country: e.target.value }))}
            />
            <Select
              label="Devise"
              options={CURRENCIES}
              value={editForm.currency}
              onChange={(e) => setEditForm((f) => ({ ...f, currency: e.target.value }))}
            />
            <Input
              label="Prix d'achat"
              type="number"
              placeholder="0"
              value={editForm.purchase_price}
              onChange={(e) => setEditForm((f) => ({ ...f, purchase_price: e.target.value }))}
            />
          </div>
          <Input
            label="Quantité"
            type="number"
            placeholder="1"
            value={editForm.quantity}
            onChange={(e) => setEditForm((f) => ({ ...f, quantity: e.target.value }))}
          />
          <Textarea
            label="Notes (marché, remarques...)"
            placeholder="ex: Guangzhou Electronics Market"
            value={editForm.notes}
            onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
          />
        </div>
      </Modal>
    </div>
  )
}
