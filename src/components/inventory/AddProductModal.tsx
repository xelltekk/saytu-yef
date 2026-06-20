'use client'
import { useState, useEffect, useRef } from 'react'
import { Upload, Camera, X, ImageIcon } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { generateSKU, getProfitMargin, compressImage } from '@/lib/utils'
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
  const [image, setImage] = useState<string>(product?.image_url || '')
  const [imgLoading, setImgLoading] = useState(false)
  const uploadRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permet de re-sélectionner le même fichier
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Fichier image invalide'); return }
    setImgLoading(true)
    try {
      const dataUrl = await compressImage(file)
      setImage(dataUrl)
    } catch (err) {
      console.error(err)
      setError('Impossible de charger l\'image')
    } finally {
      setImgLoading(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    getCategories().then(setCategories).catch(console.error)
    setError('')
    setImage(product?.image_url || '')
  }, [isOpen, product])

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

    const buyingPrice = form.buying_price === '' ? 0 : Number(form.buying_price)
    const sellingPrice = form.selling_price === '' ? 0 : Number(form.selling_price)
    const initialQuantity = form.quantity === '' ? 0 : Number(form.quantity)
    const minQuantity = form.min_quantity === '' ? 5 : Number(form.min_quantity)

    if (!Number.isFinite(buyingPrice) || buyingPrice < 0) {
      setError("Le prix d'achat doit être positif ou nul")
      return
    }
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      setError('Le prix de vente doit être positif ou nul')
      return
    }
    if (!product && (!Number.isInteger(initialQuantity) || initialQuantity < 0)) {
      setError('La quantité initiale doit être un nombre entier positif ou nul')
      return
    }
    if (!Number.isInteger(minQuantity) || minQuantity < 0) {
      setError('Le stock minimum doit être un nombre entier positif ou nul')
      return
    }

    setIsLoading(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim() || generateSKU(form.name),
        category_id: form.category_id || undefined,
        supplier_id: undefined,
        description: form.description.trim() || undefined,
        buying_price: buyingPrice,
        selling_price: sellingPrice,
        quantity: product?.quantity ?? initialQuantity,
        min_quantity: minQuantity,
        currency: form.currency,
        image_url: image || undefined,
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
          <div className="px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600">
            {error}
          </div>
        )}

        {/* Photo du produit */}
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20 rounded-2xl bg-[#F4F7FB] border border-[#2D7D7D]/[0.1] flex items-center justify-center overflow-hidden flex-shrink-0">
            {imgLoading ? (
              <div className="w-5 h-5 border-2 border-[#6C5CE7] border-t-transparent rounded-full animate-spin" />
            ) : image ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="Aperçu produit" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImage('')}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/55 text-white flex items-center justify-center hover:bg-black/75 transition-colors"
                  aria-label="Retirer la photo"
                >
                  <X size={11} />
                </button>
              </>
            ) : (
              <ImageIcon size={22} className="text-[#9AA7AE]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73] mb-2">Photo du produit</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" leftIcon={<Upload size={14} />} onClick={() => uploadRef.current?.click()}>
                Charger
              </Button>
              <Button type="button" variant="outline" size="sm" leftIcon={<Camera size={14} />} onClick={() => cameraRef.current?.click()}>
                Photo
              </Button>
            </div>
            <input ref={uploadRef} type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleImageFile} className="hidden" />
          </div>
        </div>

        <Input
          label="Nom du produit"
          placeholder="ex: iPhone 15 Pro 256GB"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              className="text-xs text-[#6C5CE7] hover:text-[#5A4BD4] transition-colors"
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

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Select
            label="Devise"
            options={CURRENCIES}
            value={form.currency}
            onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
          />
          <Input
            label="Prix d'achat"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            placeholder="0"
            value={form.buying_price}
            onChange={(e) => setForm((f) => ({ ...f, buying_price: e.target.value }))}
          />
          <div>
            <Input
              label="Prix de vente"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              placeholder="0"
              value={form.selling_price}
              onChange={(e) => setForm((f) => ({ ...f, selling_price: e.target.value }))}
            />
            {margin > 0 && (
              <p className={`text-xs mt-1 font-medium ${margin > 20 ? 'text-emerald-600' : margin > 10 ? 'text-amber-600' : 'text-red-600'}`}>
                Marge: {margin.toFixed(1)}%
              </p>
            )}
          </div>
        </div>

        {product && (
          <div className="rounded-xl bg-[#6C5CE7]/[0.08] px-3 py-2.5 text-xs text-[#5446C8]">
            Pour conserver un historique fiable, modifiez la quantité avec l&apos;action <strong>Ajuster</strong> depuis la liste des produits.
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={product ? 'Quantité actuelle' : 'Quantité initiale'}
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            placeholder="0"
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            disabled={!!product}
            className="disabled:cursor-not-allowed disabled:bg-[#F4F7FB] disabled:text-[#6B7682]"
          />
          <Input
            label="Stock minimum"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
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
