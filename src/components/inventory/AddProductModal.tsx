'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, ImageIcon, Plus, Trash2, Upload, Wand2, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { compressImage, generateSKU, getProfitMargin, getProductVariantSummary } from '@/lib/utils'
import { createProductGroup, getCategories, getProducts, getSuppliers, updateProductGroup } from '@/lib/supabase/queries'
import type { Category, Product, ProductGroup, ProductVariantDraft, Supplier } from '@/types'

interface AddProductModalProps {
  isOpen: boolean
  onClose: () => void
  productGroup?: ProductGroup | null
  onSaved?: (message?: string) => void
}

type VariantRow = {
  key: string
  id?: string
  sku: string
  size: string
  color: string
  buying_price: string
  selling_price: string
  quantity: string
  min_quantity: string
}

const CURRENCIES = [
  { value: 'XOF', label: 'FCFA (XOF)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'USD', label: 'Dollar (USD)' },
  { value: 'CNY', label: 'Yuan (CNY)' },
  { value: 'AED', label: 'Dirham (AED)' },
]

function createVariantKey() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return `variant-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

function createEmptyVariant(overrides: Partial<VariantRow> = {}): VariantRow {
  return {
    key: createVariantKey(),
    sku: '',
    size: '',
    color: '',
    buying_price: '',
    selling_price: '',
    quantity: '0',
    min_quantity: '5',
    ...overrides,
  }
}

function mapGroupVariants(productGroup?: ProductGroup | null): VariantRow[] {
  if (!productGroup) {
    return [createEmptyVariant()]
  }

  return productGroup.variants.map((variant) => createEmptyVariant({
    id: variant.id,
    sku: variant.sku || '',
    size: variant.size || '',
    color: variant.color || '',
    buying_price: variant.buying_price.toString(),
    selling_price: variant.selling_price.toString(),
    quantity: variant.quantity.toString(),
    min_quantity: variant.min_quantity.toString(),
  }))
}

function buildVariantSku(productName: string, variant: VariantRow, index: number) {
  const seed = [
    productName.trim(),
    variant.size.trim(),
    variant.color.trim(),
    `V${index + 1}`,
  ].filter(Boolean).join(' ')

  return generateSKU(seed || productName || `PRD-${index + 1}`)
}

function buildVariantTitle(variant: VariantRow, index: number) {
  const summary = getProductVariantSummary(variant)
  return summary ? `Variante ${index + 1} · ${summary}` : `Variante ${index + 1}`
}

export function AddProductModal({ isOpen, onClose, productGroup, onSaved }: AddProductModalProps) {
  const [form, setForm] = useState({
    name: productGroup?.name || '',
    category_id: productGroup?.category_id || '',
    supplier_id: productGroup?.supplier_id || '',
    description: productGroup?.description || '',
    currency: productGroup?.currency || 'XOF',
  })
  const [variants, setVariants] = useState<VariantRow[]>(() => mapGroupVariants(productGroup))
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [existingProducts, setExistingProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [image, setImage] = useState<string>(productGroup?.image_url || '')
  const [imgLoading, setImgLoading] = useState(false)
  const uploadRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return

    setError('')
    setImage(productGroup?.image_url || '')
    setForm({
      name: productGroup?.name || '',
      category_id: productGroup?.category_id || '',
      supplier_id: productGroup?.supplier_id || '',
      description: productGroup?.description || '',
      currency: productGroup?.currency || 'XOF',
    })
    setVariants(mapGroupVariants(productGroup))

    getCategories()
      .then(setCategories)
      .catch((loadError: unknown) => {
        console.error(loadError)
        setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les categories.')
      })

    getSuppliers()
      .then(setSuppliers)
      .catch((loadError: unknown) => {
        console.error(loadError)
        setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les fournisseurs.')
      })

    getProducts()
      .then(setExistingProducts)
      .catch((loadError: unknown) => {
        console.error(loadError)
        setError(loadError instanceof Error ? loadError.message : 'Impossible de verifier les references existantes.')
      })
  }, [isOpen, productGroup])

  const currentVariantIds = useMemo(
    () => new Set(productGroup?.variants.map((variant) => variant.id) ?? []),
    [productGroup]
  )

  const categoryOptions = [
    { value: '', label: 'Selectionner une categorie' },
    ...categories.map((category) => ({ value: category.id, label: category.name })),
  ]

  const supplierOptions = [
    { value: '', label: 'Sans fournisseur' },
    ...suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })),
  ]

  const handleImageFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Fichier image invalide.')
      return
    }

    setImgLoading(true)
    try {
      const dataUrl = await compressImage(file)
      setImage(dataUrl)
    } catch (loadError) {
      console.error(loadError)
      setError("Impossible de charger l'image.")
    } finally {
      setImgLoading(false)
    }
  }

  const updateVariant = (key: string, updates: Partial<VariantRow>) => {
    setVariants((current) => current.map((variant) => (
      variant.key === key ? { ...variant, ...updates } : variant
    )))
  }

  const addVariantRow = () => {
    setVariants((current) => [
      ...current,
      createEmptyVariant({
        min_quantity: current[0]?.min_quantity || '5',
      }),
    ])
  }

  const removeVariantRow = (key: string) => {
    setVariants((current) => (
      current.length > 1 ? current.filter((variant) => variant.key !== key) : current
    ))
  }

  const handleGenerateVariantSku = (key: string) => {
    const targetIndex = variants.findIndex((variant) => variant.key === key)
    if (targetIndex === -1) return

    updateVariant(key, { sku: buildVariantSku(form.name, variants[targetIndex], targetIndex) })
  }

  const handleGenerateAllSkus = () => {
    setVariants((current) => current.map((variant, index) => ({
      ...variant,
      sku: variant.sku.trim() || buildVariantSku(form.name, variant, index),
    })))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (!form.name.trim()) {
      setError('Le nom du produit est requis.')
      return
    }

    if (!variants.length) {
      setError('Ajoutez au moins une variante.')
      return
    }

    const nextVariants: ProductVariantDraft[] = []
    const usedSkus = new Set<string>()

    for (const [index, variant] of variants.entries()) {
      const buyingPrice = variant.buying_price === '' ? 0 : Number(variant.buying_price)
      const sellingPrice = variant.selling_price === '' ? 0 : Number(variant.selling_price)
      const quantity = variant.quantity === '' ? 0 : Number(variant.quantity)
      const minQuantity = variant.min_quantity === '' ? 5 : Number(variant.min_quantity)
      const sku = (variant.sku.trim() || buildVariantSku(form.name, variant, index)).trim()

      if (!Number.isFinite(buyingPrice) || buyingPrice < 0) {
        setError(`${buildVariantTitle(variant, index)} : prix d'achat invalide.`)
        return
      }

      if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
        setError(`${buildVariantTitle(variant, index)} : le prix de vente doit etre superieur a zero.`)
        return
      }

      if (!Number.isInteger(quantity) || quantity < 0) {
        setError(`${buildVariantTitle(variant, index)} : quantite invalide.`)
        return
      }

      if (!Number.isInteger(minQuantity) || minQuantity < 0) {
        setError(`${buildVariantTitle(variant, index)} : stock minimum invalide.`)
        return
      }

      const normalizedSku = sku.toLocaleLowerCase('fr')
      if (usedSkus.has(normalizedSku)) {
        setError(`La reference « ${sku} » est dupliquee dans les variantes.`)
        return
      }
      usedSkus.add(normalizedSku)

      const duplicateSku = existingProducts.some((existingProduct) => (
        existingProduct.sku?.trim().toLocaleLowerCase('fr') === normalizedSku
        && !currentVariantIds.has(existingProduct.id)
      ))
      if (duplicateSku) {
        setError(`La reference « ${sku} » est deja utilisee par un autre produit.`)
        return
      }

      nextVariants.push({
        id: variant.id,
        sku,
        size: variant.size.trim() || undefined,
        color: variant.color.trim() || undefined,
        buying_price: buyingPrice,
        selling_price: sellingPrice,
        quantity,
        min_quantity: minQuantity,
      })
    }

    setIsLoading(true)
    try {
      const payload = {
        name: form.name.trim(),
        category_id: form.category_id || undefined,
        supplier_id: form.supplier_id || undefined,
        description: form.description.trim() || undefined,
        image_url: image || undefined,
        currency: form.currency,
        status: 'active' as const,
        variants: nextVariants,
      }

      if (productGroup) {
        await updateProductGroup(productGroup, payload)
      } else {
        await createProductGroup(payload)
      }

      const count = nextVariants.length
      onSaved?.(
        productGroup
          ? `Le produit « ${payload.name} » et ses ${count} variante(s) ont ete mis a jour.`
          : `Le produit « ${payload.name} » a ete cree avec ${count} variante(s).`
      )
      onClose()
    } catch (submitError: unknown) {
      console.error(submitError)
      const fallbackMessage = "Erreur lors de l'enregistrement."
      const message = submitError instanceof Error ? submitError.message : fallbackMessage
      setError(
        message.includes("nâ€™a pas encore les colonnes de variantes produit")
          || message.includes("Could not find the 'color' column of 'products' in the schema cache")
          || message.includes("Could not find the 'size' column of 'products' in the schema cache")
          || message.includes("Could not find the 'product_group_id' column of 'products' in the schema cache")
          ? "La base locale Supabase n'a pas encore les colonnes de variantes produit. Appliquez d'abord les migrations SQL taille/couleur et product_group_id, puis rechargez la page."
          : message
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={productGroup ? 'Modifier le produit et ses variantes' : 'Nouveau produit avec variantes'}
      size="lg"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" isLoading={isLoading} onClick={handleSubmit}>
            {productGroup ? 'Enregistrer' : 'Ajouter au stock'}
          </Button>
        </>
      )}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-600">
            {error}
          </div>
        )}

        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl border border-[#2D7D7D]/[0.1] bg-[#F4F7FB]">
            {imgLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#6C5CE7] border-t-transparent" />
              </div>
            ) : image ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="Apercu produit" className="h-full w-full object-contain object-center p-1.5" />
                <button
                  type="button"
                  onClick={() => setImage('')}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
                  aria-label="Retirer la photo"
                >
                  <X size={11} />
                </button>
              </>
            ) : (
              <div className="flex h-full items-center justify-center">
                <ImageIcon size={22} className="text-[#9AA7AE]" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Photo du produit</p>
            <div className="flex flex-wrap gap-2">
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
          placeholder="ex: Tee-shirt coton premium"
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          required
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Categorie"
            options={categoryOptions}
            value={form.category_id}
            onChange={(event) => setForm((current) => ({ ...current, category_id: event.target.value }))}
          />
          <Select
            label="Fournisseur (optionnel)"
            options={supplierOptions}
            value={form.supplier_id}
            onChange={(event) => setForm((current) => ({ ...current, supplier_id: event.target.value }))}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
          <Textarea
            label="Description (optionnel)"
            placeholder="Description commune a toutes les variantes..."
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            rows={3}
          />
          <Select
            label="Devise"
            options={CURRENCIES}
            value={form.currency}
            onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}
          />
        </div>

        <div className="rounded-[28px] border border-[#2D7D7D]/[0.08] bg-[#F8FBFC] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#1A3636]">Variantes du produit</p>
              <p className="mt-1 text-xs text-[#6B7682]">
                Un seul produit parent, puis un stock distinct par taille et couleur. Vous pouvez scanner directement dans le champ code-barres / SKU.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leftIcon={<Wand2 size={14} />}
                onClick={handleGenerateAllSkus}
              >
                Generer les references
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={addVariantRow}
              >
                Ajouter une variante
              </Button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {variants.map((variant, index) => {
              const buyingPrice = Number(variant.buying_price)
              const sellingPrice = Number(variant.selling_price)
              const margin = Number.isFinite(buyingPrice) && Number.isFinite(sellingPrice) && sellingPrice > 0
                ? getProfitMargin(buyingPrice, sellingPrice)
                : null

              return (
                <div key={variant.key} className="rounded-[24px] border border-[#2D7D7D]/[0.08] bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#1A3636]">{buildVariantTitle(variant, index)}</p>
                      <p className="mt-1 text-xs text-[#6B7682]">
                        {variant.id
                          ? "Stock actuel conserve. Utilisez 'Ajuster' depuis l'inventaire pour tracer les mouvements."
                          : 'Definissez la couleur, la taille, le prix et le stock de depart.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeVariantRow(variant.key)}
                      disabled={variants.length === 1}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-30"
                      aria-label={`Supprimer ${buildVariantTitle(variant, index)}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                      label="Taille (optionnel)"
                      placeholder="ex: S, M, L, 42"
                      value={variant.size}
                      onChange={(event) => updateVariant(variant.key, { size: event.target.value })}
                    />
                    <Input
                      label="Couleur (optionnel)"
                      placeholder="ex: Noir, Bleu, Blanc"
                      value={variant.color}
                      onChange={(event) => updateVariant(variant.key, { color: event.target.value })}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <Input
                      label="Code-barres / SKU"
                      placeholder="ex: 1234567890123 ou TSH-M-NOIR"
                      value={variant.sku}
                      onChange={(event) => updateVariant(variant.key, { sku: event.target.value })}
                      hint="Unique par variante. Compatible avec un lecteur code-barres 1D / 2D."
                    />
                    <div className="self-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        leftIcon={<Wand2 size={14} />}
                        onClick={() => handleGenerateVariantSku(variant.key)}
                      >
                        Generer
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <Input
                      label="Prix d'achat"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      placeholder="0"
                      value={variant.buying_price}
                      onChange={(event) => updateVariant(variant.key, { buying_price: event.target.value })}
                    />
                    <Input
                      label="Prix de vente"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      placeholder="0"
                      value={variant.selling_price}
                      onChange={(event) => updateVariant(variant.key, { selling_price: event.target.value })}
                    />
                    <Input
                      label={variant.id ? 'Stock actuel' : 'Stock initial'}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={variant.quantity}
                      onChange={(event) => updateVariant(variant.key, { quantity: event.target.value })}
                      disabled={!!variant.id}
                      className="disabled:cursor-not-allowed disabled:bg-[#F4F7FB] disabled:text-[#6B7682]"
                    />
                    <Input
                      label="Stock minimum"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      placeholder="5"
                      value={variant.min_quantity}
                      onChange={(event) => updateVariant(variant.key, { min_quantity: event.target.value })}
                    />
                  </div>

                  {margin !== null && (
                    <div className="mt-3 rounded-xl bg-[#F4F7FB] px-3 py-2 text-xs text-[#5C6B73]">
                      Marge estimee :{' '}
                      <span className={margin < 0 ? 'font-semibold text-red-600' : 'font-semibold text-emerald-600'}>
                        {margin.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </form>
    </Modal>
  )
}
