'use client'
import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { generateSKU, getProfitMargin } from '@/lib/utils'
import { addProduct, updateProduct, getCategories } from '@/lib/supabase/queries'
import type { Product, Category } from '@/types'

interface AddProductModalProps {
  isOpen: boolean
  onClose: () => void
  product?: Product | null
  onSaved?: () => void
}

const CURRENCIES = [
  { value: 'XOF', label: 'FCFA (XOF)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'USD', label: 'Dollar (USD)' },
  { value: 'CNY', label: 'Yuan (CNY)' },
  { value: 'AED', label: 'Dirham (AED)' },
]

export function AddProductModal({ isOpen, onClose, product, onSaved }: AddProductModalProps) {
  const [form, setForm] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    category_id: product?.category_id || '',
    description: product?.description || '',
    buying_price: product?.buying_price?.toString() || '',
    selling_price: product?.selling_price?.toString() || '',
    quantity: product?.quantity?.toString() || '',
    min_quantity: product?.min_quantity?.toString() || '5',
    currency: product?.currency || 'XOF',
  })
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    getCategories().then(setCategories).catch(console.error)
    setError('')
  }, [isOpen])

  // Sync form when product changes (edit vs new)
  useEffect(() => {
    if (!isOpen) return
    if (!product) {
      setForm({ name: '', sku: '', category_id: '', description: '', buying_price: '', selling_price: '', quantity: '', min_quantity: '5', currency: 'XOF' })
    } else {
      setForm({
        name: product.name,
        sku: product.sku,
        category_id: product.category_id,
        description: product.description || '',
        buying_price: product.buying_price.toString(),
        selling_price: product.selling_price.toString(),
        quantity: product.quantity.toString(),
        min_quantity: product.min_quantity.toString(),
        currency: product.currency,
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const margin = form.buying_price && form.selling_price
    ? getProfitMargin(Number(form.buying_price), Number(form.selling_price))
    : 0

  const categoryOptions = [
    { value: '', label: 'Sélectionner une catégorie' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Le nom est requis'); return }

    setIsLoading(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku || generateSKU(form.name),
        category_id: form.category_id || undefined,
        supplier_id: undefined,
        description: form.description || undefined,
        buying_price: Number(form.buying_price) || 0,
        selling_price: Number(form.selling_price) || 0,
        quantity: Number(form.quantity) || 0,
        min_quantity: Number(form.min_quantity) || 5,
        currency: form.currency,
        status: 'active' as const,
      }

      if (product) {
        await updateProduct(product.id, payload)
      } else {
        await addProduct(payload as Parameters<typeof addProduct>[0])
      }

      onSaved?.()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement')
    } finally {
      setIsLoading(false)
    }
  }

  const autoSKU = () => {
    setForm((f) => ({ ...f, sku: generateSKU(f.name || 'PRD') }))
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product ? 'Modifier le produit' : 'Nouveau produit'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" isLoading={isLoading} onClick={handleSubmit}>
            {product ? 'Enregistrer' : 'Ajouter au stock'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
            {error}
          </div>
        )}

        <Input
          label="Nom du produit"
          placeholder="ex: iPhone 15 Pro 256GB"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Input
              label="SKU / Référence"
              placeholder="ex: IPH-A8F2"
              value={form.sku}
              onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
            />
            <button
              type="button"
              onClick={autoSKU}
              className="text-xs text-[#4f6ef7] hover:text-[#3d5ce5] transition-colors"
            >
              Générer automatiquement
            </button>
          </div>
          <Select
            label="Catégorie"
            options={categoryOptions}
            value={form.category_id}
            onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
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
            value={form.buying_price}
            onChange={(e) => setForm((f) => ({ ...f, buying_price: e.target.value }))}
          />
          <div>
            <Input
              label="Prix de vente"
              type="number"
              placeholder="0"
              value={form.selling_price}
              onChange={(e) => setForm((f) => ({ ...f, selling_price: e.target.value }))}
            />
            {margin > 0 && (
              <p className={`text-xs mt-1 font-medium ${margin > 20 ? 'text-emerald-400' : margin > 10 ? 'text-amber-400' : 'text-red-400'}`}>
                Marge: {margin.toFixed(1)}%
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Quantité initiale"
            type="number"
            placeholder="0"
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
          />
          <Input
            label="Stock minimum"
            type="number"
            placeholder="5"
            value={form.min_quantity}
            onChange={(e) => setForm((f) => ({ ...f, min_quantity: e.target.value }))}
            hint="Alerte stock faible"
          />
        </div>

        <Textarea
          label="Description (optionnel)"
          placeholder="Détails sur le produit..."
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={3}
        />
      </form>
    </Modal>
  )
}
