'use client'

import { useEffect, useState } from 'react'
import {
  ArrowRight,
  CheckCircle,
  Globe,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { useInventoryStore } from '@/store/inventoryStore'
import { formatCurrency, generateSKU } from '@/lib/utils'
import {
  activateAbroadProduct as activateAbroadProductRecord,
  deleteAbroadProduct as deleteAbroadProductRecord,
  getAbroadProducts,
  getCategories,
  saveAbroadProduct,
  updateAbroadProductRecord,
} from '@/lib/supabase/queries'
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
  { value: 'SN', label: 'Senegal' },
  { value: 'CN', label: 'Chine' },
  { value: 'AE', label: 'Emirats Arabes Unis' },
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

function mergeRemoteWithLocal(
  remoteProducts: AbroadProduct[],
  localProducts: AbroadProduct[]
) {
  const remoteLocalIds = new Set(
    remoteProducts.map((product) => product.local_id).filter(Boolean)
  )

  const localPending = localProducts.filter((product) => {
    if (product.synced) return false
    return !remoteLocalIds.has(product.local_id ?? product.id)
  })

  return [...localPending, ...remoteProducts].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

export function AbroadBatchEntry({ onTransferred }: AbroadBatchEntryProps) {
  const {
    abroadProducts,
    addAbroadProduct,
    deleteAbroadProduct,
    setAbroadProducts,
    updateAbroadProduct,
  } = useInventoryStore()

  const [categories, setCategories] = useState<Category[]>([])
  const [transferring, setTransferring] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [isOnline, setIsOnline] = useState(() =>
    typeof window !== 'undefined' ? window.navigator.onLine : true
  )
  const [showForm, setShowForm] = useState(false)
  const [activateModal, setActivateModal] = useState<ActivateModalState>({
    open: false,
    product: null,
    sellingPrice: '',
    buyingPrice: '',
    categoryId: '',
    sellingCurrency: 'XOF',
  })
  const [form, setForm] = useState({
    name: '',
    purchase_price: '',
    currency: 'XOF',
    quantity: '1',
    source_country: 'SN',
    notes: '',
  })
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    purchase_price: '',
    currency: 'CNY',
    quantity: '1',
    source_country: 'CN',
    notes: '',
  })

  const notActivated = abroadProducts.filter((product) => !product.activated)
  const pendingSync = abroadProducts.filter((product) => !product.synced)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    getCategories().then(setCategories).catch(console.error)
  }, [])

  useEffect(() => {
    if (!isOnline) return

    getAbroadProducts()
      .then((remoteProducts) => {
        setAbroadProducts(
          mergeRemoteWithLocal(remoteProducts, useInventoryStore.getState().abroadProducts)
        )
      })
      .catch(console.error)
  }, [isOnline, setAbroadProducts])

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

  const pushLocalProduct = async (product: AbroadProduct) => {
    const localId = product.local_id ?? product.id
    const savedProduct = await saveAbroadProduct({
      name: product.name,
      purchase_price: product.purchase_price,
      currency: product.currency,
      quantity: product.quantity,
      notes: product.notes,
      source_country: product.source_country,
      synced: true,
      activated: product.activated,
      local_id: localId,
    })

    deleteAbroadProduct(product.id)
    addAbroadProduct(savedProduct)
    return savedProduct
  }

  const handleSaveEdit = async () => {
    if (!editId || !editForm.name || !editForm.purchase_price) return

    const updates = {
      name: editForm.name,
      purchase_price: Number(editForm.purchase_price),
      currency: editForm.currency,
      quantity: Number(editForm.quantity),
      source_country: editForm.source_country,
      notes: editForm.notes,
    }

    updateAbroadProduct(editId, updates)

    const editedProduct = abroadProducts.find((product) => product.id === editId)
    if (isOnline && editedProduct?.synced) {
      updateAbroadProductRecord(editId, updates).catch((error) => {
        console.error(error)
        alert("La modification a ete gardee localement mais n'a pas pu etre synchronisee.")
      })
    }

    setEditId(null)
  }

  const handleSyncPending = async () => {
    if (!isOnline || pendingSync.length === 0) return

    setSyncing(true)
    try {
      for (const product of pendingSync) {
        await pushLocalProduct(product)
      }
    } catch (error) {
      console.error(error)
      alert("Erreur lors de la synchronisation des saisies etrangeres")
    } finally {
      setSyncing(false)
    }
  }

  const handleAdd = async () => {
    if (!form.name || !form.purchase_price) return

    const localId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Date.now().toString()

    const localProduct: AbroadProduct = {
      id: `local-${localId}`,
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
      local_id: localId,
    }

    try {
      if (isOnline) {
        const savedProduct = await saveAbroadProduct({
          name: localProduct.name,
          purchase_price: localProduct.purchase_price,
          currency: localProduct.currency,
          quantity: localProduct.quantity,
          notes: localProduct.notes,
          source_country: localProduct.source_country,
          synced: true,
          activated: false,
          local_id: localId,
        })
        addAbroadProduct(savedProduct)
      } else {
        addAbroadProduct(localProduct)
      }
    } catch (error) {
      console.error(error)
      addAbroadProduct(localProduct)
    }

    setForm({
      name: '',
      purchase_price: '',
      currency: 'XOF',
      quantity: '1',
      source_country: 'SN',
      notes: '',
    })
    setShowForm(false)
  }

  const handleActivate = async () => {
    const product = activateModal.product
    if (!product || !activateModal.sellingPrice) return

    if (!isOnline) {
      alert("La connexion est requise pour transferer cet article vers le stock principal.")
      return
    }

    setTransferring(true)
    try {
      const productToActivate = product.synced ? product : await pushLocalProduct(product)

      const createdProduct = await activateAbroadProductRecord(
        productToActivate.id,
        {
          name: product.name,
          sku: generateSKU(product.name),
          category_id: activateModal.categoryId || undefined,
          supplier_id: undefined,
          description: product.notes || undefined,
          buying_price: Number(activateModal.buyingPrice) || product.purchase_price,
          selling_price: Number(activateModal.sellingPrice) || 0,
          quantity: product.quantity,
          min_quantity: 5,
          currency: 'XOF',
          status: 'active',
        } as Parameters<typeof activateAbroadProductRecord>[1]
      )

      updateAbroadProduct(productToActivate.id, { activated: true, synced: true })
      setActivateModal({
        open: false,
        product: null,
        sellingPrice: '',
        buyingPrice: '',
        categoryId: '',
        sellingCurrency: 'XOF',
      })
      onTransferred?.(createdProduct)
    } catch (error) {
      console.error(error)
      alert('Erreur lors du transfert vers le stock principal')
    } finally {
      setTransferring(false)
    }
  }

  const handleDeleteItem = async (product: AbroadProduct) => {
    const previousProducts = abroadProducts
    deleteAbroadProduct(product.id)

    if (!isOnline || !product.synced) return

    try {
      await deleteAbroadProductRecord(product.id)
    } catch (error) {
      console.error(error)
      setAbroadProducts(previousProducts)
      alert("Suppression impossible pour le moment. L'article a ete restaure.")
    }
  }

  return (
    <div className="space-y-6">
      <div
        className={`flex items-center gap-3 rounded-2xl border p-4 ${
          isOnline
            ? 'border-emerald-500/20 bg-emerald-500/5'
            : 'border-amber-500/20 bg-amber-500/5'
        }`}
      >
        {isOnline ? (
          <>
            <Wifi size={18} className="flex-shrink-0 text-emerald-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-600">
                Connecte - synchronisation active
              </p>
              <p className="text-xs text-[#6B7682]">
                {pendingSync.length} article(s) en attente de sync
              </p>
            </div>
            {pendingSync.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Upload size={14} />}
                className="text-emerald-600"
                onClick={handleSyncPending}
                isLoading={syncing}
              >
                Synchroniser
              </Button>
            )}
          </>
        ) : (
          <>
            <WifiOff size={18} className="flex-shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-600">Mode hors ligne</p>
              <p className="text-xs text-[#6B7682]">
                Vos saisies sont gardees localement jusqu&apos;au retour du reseau.
              </p>
            </div>
          </>
        )}
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-[#6C5CE7]/10 p-2">
              <Globe size={16} className="text-[#6C5CE7]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#1A3636]">
                Saisie depuis l&apos;etranger
              </h3>
              <p className="text-xs text-[#6B7682]">
                Enregistrez vos achats en deplacement
              </p>
            </div>
          </div>
          <Button
            variant={showForm ? 'ghost' : 'primary'}
            size="sm"
            leftIcon={<Plus size={15} />}
            onClick={() => setShowForm((current) => !current)}
          >
            {showForm ? 'Annuler' : 'Ajouter'}
          </Button>
        </div>

        {showForm && (
          <div className="fade-in space-y-4 border-t border-[#2D7D7D]/[0.08] pt-4">
            <Input
              label="Nom du produit"
              placeholder="ex: Telephone Xiaomi 14 Pro"
              value={form.name}
              onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Select
                label="Pays source"
                options={COUNTRIES}
                value={form.source_country}
                onChange={(e) =>
                  setForm((current) => ({ ...current, source_country: e.target.value }))
                }
              />
              <Select
                label="Devise"
                options={CURRENCIES}
                value={form.currency}
                onChange={(e) => setForm((current) => ({ ...current, currency: e.target.value }))}
              />
              <Input
                label="Prix d'achat"
                type="number"
                placeholder="0"
                value={form.purchase_price}
                onChange={(e) =>
                  setForm((current) => ({ ...current, purchase_price: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Quantite"
                type="number"
                placeholder="1"
                value={form.quantity}
                onChange={(e) => setForm((current) => ({ ...current, quantity: e.target.value }))}
              />
              <Textarea
                label="Notes (marche, remarques...)"
                placeholder="ex: Guangzhou Electronics Market"
                value={form.notes}
                onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
                rows={1}
              />
            </div>
            <Button variant="primary" fullWidth onClick={handleAdd}>
              {isOnline ? 'Enregistrer et synchroniser' : 'Enregistrer localement'}
            </Button>
          </div>
        )}
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#1A3636]">
            Articles enregistres ({notActivated.length} a activer)
          </h3>
        </div>

        {notActivated.length === 0 ? (
          <Card>
            <div className="py-8 text-center">
              <Globe size={28} className="mx-auto mb-3 text-[#6B7682] opacity-50" />
              <p className="text-sm font-medium text-[#1A3636]">Aucun article a activer</p>
              <p className="mt-1 text-xs text-[#6B7682]">
                Les articles deja transferes restent enregistres mais ne s&apos;affichent plus ici.
              </p>
            </div>
          </Card>
        ) : (
          notActivated.map((product) => (
            <Card key={product.id} className="relative">
              <div className="flex items-start gap-3">
                <div
                  className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${
                    product.activated
                      ? 'bg-emerald-500'
                      : product.synced
                        ? 'bg-[#6C5CE7]'
                        : 'bg-amber-500'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium text-[#1A3636]">
                        {product.name}
                      </p>
                      <p className="mt-0.5 text-xs text-[#6B7682]">
                        {
                          COUNTRIES.find((country) => country.value === product.source_country)
                            ?.label
                        }{' '}
                        · {formatCurrency(product.purchase_price, product.currency)} · Qte:{' '}
                        {product.quantity}
                      </p>
                      {product.notes && (
                        <p className="mt-0.5 text-xs italic text-[#6B7682]">{product.notes}</p>
                      )}
                    </div>
                    <div className="flex flex-row items-center gap-2 sm:flex-col sm:items-end">
                      <div className="flex gap-1.5">
                        {product.activated ? (
                          <Badge variant="success">
                            <CheckCircle size={10} className="mr-1" />
                            Active
                          </Badge>
                        ) : product.synced ? (
                          <Badge variant="info">Synchronise</Badge>
                        ) : (
                          <Badge variant="warning">Local</Badge>
                        )}
                      </div>
                      {!product.activated && (
                        <Button
                          variant="primary"
                          size="sm"
                          rightIcon={<ArrowRight size={13} />}
                          onClick={() =>
                            setActivateModal({
                              open: true,
                              product,
                              sellingPrice: '',
                              buyingPrice: '',
                              categoryId: '',
                              sellingCurrency: 'XOF',
                            })
                          }
                        >
                          Transferer
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-shrink-0 flex-col gap-1">
                  {!product.activated && (
                    <button
                      onClick={() => openEdit(product)}
                      title="Modifier"
                      aria-label="Modifier l'article"
                      className="rounded-lg p-1.5 text-[#6B7682] transition-colors hover:bg-[#6C5CE7]/[0.1] hover:text-[#6C5CE7]"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteItem(product)}
                    title="Supprimer"
                    aria-label="Supprimer l'article"
                    className="rounded-lg p-1.5 text-[#6B7682] transition-colors hover:bg-red-500/5 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal
        isOpen={activateModal.open}
        onClose={() => setActivateModal((current) => ({ ...current, open: false }))}
        title="Transferer vers le stock principal"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setActivateModal((current) => ({ ...current, open: false }))}
            >
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={handleActivate}
              isLoading={transferring}
              disabled={!activateModal.sellingPrice}
            >
              Transferer
            </Button>
          </>
        }
      >
        {activateModal.product && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#2D7D7D]/[0.08] bg-[#F4F7FB] p-3">
              <p className="text-sm font-medium text-[#1A3636]">
                {activateModal.product.name}
              </p>
              <p className="mt-1 text-xs text-[#6B7682]">
                Prix achat:{' '}
                {formatCurrency(
                  activateModal.product.purchase_price,
                  activateModal.product.currency
                )}{' '}
                · Qte: {activateModal.product.quantity}
              </p>
            </div>
            <p className="text-xs text-[#6B7682]">
              Ce produit sera ajoute a votre inventaire principal avec la quantite saisie.
            </p>
            <Select
              label="Categorie (optionnel)"
              options={[
                { value: '', label: 'Sans categorie' },
                ...categories.map((category) => ({ value: category.id, label: category.name })),
              ]}
              value={activateModal.categoryId}
              onChange={(e) =>
                setActivateModal((current) => ({ ...current, categoryId: e.target.value }))
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Prix d'achat (FCFA)"
                type="number"
                placeholder={String(activateModal.product.purchase_price)}
                value={activateModal.buyingPrice}
                onChange={(e) =>
                  setActivateModal((current) => ({ ...current, buyingPrice: e.target.value }))
                }
              />
              <Input
                label="Prix de vente (FCFA)"
                type="number"
                placeholder="ex: 150000"
                value={activateModal.sellingPrice}
                onChange={(e) =>
                  setActivateModal((current) => ({ ...current, sellingPrice: e.target.value }))
                }
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={editId !== null}
        onClose={() => setEditId(null)}
        title="Modifier l'article"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditId(null)}>
              Annuler
            </Button>
            <Button variant="primary" onClick={handleSaveEdit}>
              Enregistrer
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nom du produit"
            placeholder="ex: Telephone Xiaomi 14 Pro"
            value={editForm.name}
            onChange={(e) => setEditForm((current) => ({ ...current, name: e.target.value }))}
          />
          <div className="grid grid-cols-3 gap-3">
            <Select
              label="Pays source"
              options={COUNTRIES}
              value={editForm.source_country}
              onChange={(e) =>
                setEditForm((current) => ({ ...current, source_country: e.target.value }))
              }
            />
            <Select
              label="Devise"
              options={CURRENCIES}
              value={editForm.currency}
              onChange={(e) => setEditForm((current) => ({ ...current, currency: e.target.value }))}
            />
            <Input
              label="Prix d'achat"
              type="number"
              placeholder="0"
              value={editForm.purchase_price}
              onChange={(e) =>
                setEditForm((current) => ({ ...current, purchase_price: e.target.value }))
              }
            />
          </div>
          <Input
            label="Quantite"
            type="number"
            placeholder="1"
            value={editForm.quantity}
            onChange={(e) => setEditForm((current) => ({ ...current, quantity: e.target.value }))}
          />
          <Textarea
            label="Notes (marche, remarques...)"
            placeholder="ex: Guangzhou Electronics Market"
            value={editForm.notes}
            onChange={(e) => setEditForm((current) => ({ ...current, notes: e.target.value }))}
            rows={2}
          />
        </div>
      </Modal>
    </div>
  )
}
