'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Globe,
  History,
  Pencil,
  Plus,
  RefreshCw,
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
import { ProductPhotoPicker } from './ProductPhotoPicker'
import { useInventoryStore } from '@/store/inventoryStore'
import { formatCurrency, generateSKU } from '@/lib/utils'
import { getRemainingQuantity, getTransferredQuantity, validateTransferQuantity } from '@/lib/abroadTransfers'
import {
  activateAbroadProduct as activateAbroadProductRecord,
  deleteAbroadProduct as deleteAbroadProductRecord,
  getAbroadProducts,
  getAbroadTransfers,
  getCategories,
  saveAbroadProduct,
  updateAbroadProductRecord,
} from '@/lib/supabase/queries'
import type { AbroadProduct, AbroadTransfer, Category, Product } from '@/types'

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
  exchangeRate: number | null
  rateUpdatedAt: string | null
  rateSource: string | null
  quantity: string
  requestId: string
  sku: string
}

type Feedback = { type: 'success' | 'warning' | 'error'; message: string }

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
  const [loadingRate, setLoadingRate] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [savingAdd, setSavingAdd] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [editPhotoBusy, setEditPhotoBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [formError, setFormError] = useState('')
  const [editError, setEditError] = useState('')
  const [transferError, setTransferError] = useState('')
  const [deleteCandidate, setDeleteCandidate] = useState<AbroadProduct | null>(null)
  const [isOnline, setIsOnline] = useState(() =>
    typeof window !== 'undefined' ? window.navigator.onLine : true
  )
  const [showForm, setShowForm] = useState(false)
  const [listFilter, setListFilter] = useState('pending')
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [history, setHistory] = useState<{ product: AbroadProduct; rows: AbroadTransfer[]; loading: boolean; error: string } | null>(null)
  const [activateModal, setActivateModal] = useState<ActivateModalState>({
    open: false,
    product: null,
    sellingPrice: '',
    buyingPrice: '',
    categoryId: '',
    exchangeRate: null,
    rateUpdatedAt: null,
    rateSource: null,
    quantity: '', requestId: '', sku: '',
  })
  const [form, setForm] = useState({
    name: '',
    purchase_price: '',
    currency: 'XOF',
    quantity: '1',
    source_country: 'SN',
    notes: '',
    image_url: '',
  })
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    purchase_price: '',
    currency: 'CNY',
    quantity: '1',
    source_country: 'CN',
    notes: '',
    image_url: '',
  })

  const notActivated = abroadProducts.filter((product) => getRemainingQuantity(product) > 0)
  const visibleProducts = abroadProducts.filter((product) =>
    (listFilter === 'all' || (listFilter === 'pending' ? getRemainingQuantity(product) > 0 : getRemainingQuantity(product) === 0))
    && product.name.toLocaleLowerCase('fr').includes(search.trim().toLocaleLowerCase('fr')))
  const pendingSync = abroadProducts.filter((product) => !product.synced)

  const refreshProducts = async () => {
    setRefreshing(true)
    try {
      const remote = await getAbroadProducts()
      setAbroadProducts(mergeRemoteWithLocal(remote, useInventoryStore.getState().abroadProducts))
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Actualisation impossible.' })
    } finally { setRefreshing(false) }
  }

  const openHistory = async (product: AbroadProduct) => {
    setHistory({ product, rows: [], loading: true, error: '' })
    try {
      const rows = await getAbroadTransfers(product.id)
      setHistory((current) => current?.product.id === product.id ? { ...current, rows, loading: false } : current)
    } catch (error) {
      setHistory((current) => current?.product.id === product.id ? { ...current, loading: false,
        error: error instanceof Error ? error.message : 'Historique indisponible.' } : current)
    }
  }

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
    getCategories()
      .then(setCategories)
      .catch((error: unknown) => {
        console.error(error)
        setFeedback({
          type: 'error',
          message: error instanceof Error ? error.message : 'Impossible de charger les catégories.',
        })
      })
  }, [])

  useEffect(() => {
    if (!isOnline) return

    getAbroadProducts()
      .then((remoteProducts) => {
        setAbroadProducts(
          mergeRemoteWithLocal(remoteProducts, useInventoryStore.getState().abroadProducts)
        )
      })
      .catch((error: unknown) => {
        console.error(error)
        setFeedback({
          type: 'error',
          message: error instanceof Error ? error.message : 'Impossible de charger les saisies étrangères.',
        })
      })
  }, [isOnline, setAbroadProducts])

  useEffect(() => {
    if (!feedback || feedback.type === 'error') return
    const timeout = window.setTimeout(() => setFeedback(null), 5000)
    return () => window.clearTimeout(timeout)
  }, [feedback])

  const openEdit = (product: AbroadProduct) => {
    setEditError('')
    setEditId(product.id)
    setEditForm({
      name: product.name,
      purchase_price: String(product.purchase_price),
      currency: product.currency,
      quantity: String(product.quantity),
      source_country: product.source_country,
      notes: product.notes ?? '',
      image_url: product.image_url ?? '',
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
      ...(product.image_url ? { image_url: product.image_url } : {}),
      source_country: product.source_country,
      synced: true,
      activated: product.activated,
      local_id: localId,
    })

    setAbroadProducts(useInventoryStore.getState().abroadProducts.map((current) =>
      current.id === product.id ? savedProduct : current
    ))
    return savedProduct
  }

  const openActivate = (product: AbroadProduct) => {
    setTransferError('')
    setActivateModal({
      open: true,
      product,
      sellingPrice: '',
      buyingPrice: product.currency === 'XOF' ? String(product.purchase_price) : '',
      categoryId: '',
      exchangeRate: product.currency === 'XOF' ? 1 : null,
      rateUpdatedAt: product.currency === 'XOF' ? new Date().toISOString() : null,
      rateSource: product.currency === 'XOF' ? 'Taux fixe XOF' : null,
      quantity: String(getRemainingQuantity(product)),
      requestId: crypto.randomUUID(),
      sku: generateSKU(product.name),
    })
  }

  const loadExchangeRate = async () => {
    const product = activateModal.product
    if (!product) return

    setLoadingRate(true)
    setTransferError('')
    try {
      const response = await fetch(`/api/exchange-rates?base=${encodeURIComponent(product.currency)}`)
      const payload = (await response.json()) as {
        rate?: number
        updatedAt?: string
        source?: string
        stale?: boolean
        error?: string
      }
      if (!response.ok || !payload.rate) throw new Error(payload.error ?? 'Taux indisponible.')

      setActivateModal((current) => ({
        ...current,
        buyingPrice: String(Math.round(product.purchase_price * payload.rate!)),
        exchangeRate: payload.rate!,
        rateUpdatedAt: payload.updatedAt ?? new Date().toISOString(),
        rateSource: `${payload.source ?? 'ExchangeRate-API'}${payload.stale ? ' (cache)' : ''}`,
      }))
    } catch (error) {
      setTransferError(
        `${error instanceof Error ? error.message : 'Conversion indisponible.'} Vous pouvez saisir le prix FCFA manuellement.`
      )
    } finally {
      setLoadingRate(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!editId || savingEdit || editPhotoBusy) return

    const purchasePrice = Number(editForm.purchase_price)
    const quantity = Number(editForm.quantity)
    if (!editForm.name.trim()) {
      setEditError('Le nom du produit est requis.')
      return
    }
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
      setEditError("Le prix d'achat doit être positif ou nul.")
      return
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setEditError('La quantité doit être un nombre entier supérieur à zéro.')
      return
    }

    const editedProduct = abroadProducts.find((product) => product.id === editId)
    if (!editedProduct) return
    if (quantity < getTransferredQuantity(editedProduct)) {
      setEditError('La quantite totale ne peut pas etre inferieure au nombre deja transfere.')
      return
    }
    if (!isOnline && editedProduct.synced) {
      setEditError('Une connexion est requise pour modifier un article déjà synchronisé.')
      return
    }

    const updates = {
      name: editForm.name.trim(),
      purchase_price: purchasePrice,
      currency: editForm.currency,
      quantity,
      source_country: editForm.source_country,
      notes: editForm.notes.trim(),
      image_url: editForm.image_url || null,
    }

    setSavingEdit(true)
    setEditError('')
    try {
      const saved = editedProduct.synced ? await updateAbroadProductRecord(editId, updates) : updates
      updateAbroadProduct(editId, saved)
      setEditId(null)
      setFeedback({ type: 'success', message: `L’article « ${updates.name} » a été modifié.` })
    } catch (error: unknown) {
      console.error(error)
      setEditError(error instanceof Error ? error.message : 'Impossible de modifier cet article.')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleSyncPending = async () => {
    if (!isOnline || pendingSync.length === 0 || syncing || savingAdd || savingEdit || transferring) return

    setSyncing(true)
    setFeedback(null)
    let syncedCount = 0
    try {
      for (const product of pendingSync) {
        await pushLocalProduct(product)
        syncedCount += 1
      }
      setFeedback({
        type: 'success',
        message: `${syncedCount} article(s) synchronisé(s) avec succès.`,
      })
    } catch (error: unknown) {
      console.error(error)
      setFeedback({
        type: 'error',
        message: syncedCount > 0
          ? `${syncedCount} article(s) synchronisé(s), puis la synchronisation s’est interrompue.`
          : error instanceof Error ? error.message : 'La synchronisation a échoué.',
      })
    } finally {
      setSyncing(false)
    }
  }

  const handleAdd = async () => {
    if (savingAdd || photoBusy) return
    const purchasePrice = Number(form.purchase_price)
    const quantity = Number(form.quantity)
    if (!form.name.trim()) {
      setFormError('Le nom du produit est requis.')
      return
    }
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
      setFormError("Le prix d'achat doit être positif ou nul.")
      return
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setFormError('La quantité doit être un nombre entier supérieur à zéro.')
      return
    }
    setFormError('')

    const localId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Date.now().toString()

    const localProduct: AbroadProduct = {
      id: `local-${localId}`,
      user_id: 'u1',
      name: form.name.trim(),
      purchase_price: purchasePrice,
      currency: form.currency,
      quantity,
      source_country: form.source_country,
      notes: form.notes.trim(),
      image_url: form.image_url || null,
      synced: false,
      activated: false,
      created_at: new Date().toISOString(),
      local_id: localId,
    }

    setSavingAdd(true)
    try {
      addAbroadProduct(localProduct)
    } catch {
      setFormError("Stockage local plein ou indisponible. La saisie n'a pas été enregistrée. Retirez la photo ou libérez de l'espace avant de réessayer.")
      setSavingAdd(false)
      return
    }

    try {
      if (isOnline) {
        await pushLocalProduct(localProduct)
        setFeedback({ type: 'success', message: `L’article « ${localProduct.name} » a été enregistré et synchronisé.` })
      } else {
        setFeedback({ type: 'warning', message: `L’article « ${localProduct.name} » est conservé localement jusqu’au retour du réseau.` })
      }
    } catch (error: unknown) {
      console.error(error)
      setFeedback({
        type: 'warning',
        message: `La synchronisation a échoué, mais « ${localProduct.name} » est conservé localement.`,
      })
    }
    setSavingAdd(false)

    setForm({
      name: '',
      purchase_price: '',
      currency: 'XOF',
      quantity: '1',
      source_country: 'SN',
      notes: '',
      image_url: '',
    })
    setShowForm(false)
  }

  const handleActivate = async () => {
    const product = activateModal.product
    if (!product || transferring || syncing) return

    const buyingPrice = Number(activateModal.buyingPrice)
    const sellingPrice = Number(activateModal.sellingPrice)
    const quantityError = validateTransferQuantity(activateModal.quantity, product)
    if (quantityError) { setTransferError(quantityError); return }
    const restocking = getTransferredQuantity(product) > 0
    if (!restocking && (!activateModal.buyingPrice.trim() || !Number.isFinite(buyingPrice) || buyingPrice < 0)) {
      setTransferError("Saisissez le prix d'achat converti en FCFA.")
      return
    }
    if (!restocking && (!Number.isFinite(sellingPrice) || sellingPrice <= 0)) {
      setTransferError('Le prix de vente doit être supérieur à zéro.')
      return
    }

    if (!isOnline) {
      setTransferError('Une connexion est requise pour transférer cet article vers le stock principal.')
      return
    }

    setTransferring(true)
    setTransferError('')
    try {
      const productToActivate = product.synced ? product : await pushLocalProduct(product)

      // Keep the remote id after syncing, even if the transfer subsequently fails.
      setActivateModal((current) => ({ ...current, product: productToActivate }))
      const result = await activateAbroadProductRecord(
        activateModal.requestId,
        productToActivate.id,
        Number(activateModal.quantity),
        {
          expected_transferred: getTransferredQuantity(product),
          sku: activateModal.sku,
          category_id: activateModal.categoryId || undefined,
          buying_price: restocking ? undefined : buyingPrice,
          selling_price: restocking ? undefined : sellingPrice,
          exchange_rate: restocking ? undefined : activateModal.exchangeRate ?? undefined,
          rate_source: restocking ? undefined : activateModal.rateSource ?? 'Saisie manuelle',
          rate_updated_at: restocking ? undefined : activateModal.rateUpdatedAt ?? undefined,
        }
      )

      updateAbroadProduct(productToActivate.id, result.abroad)
      setFeedback({ type: 'success', message: `${result.transfer.quantity} unite(s) transferee(s). Reste : ${getRemainingQuantity(result.abroad)}.` })
      setActivateModal({
        open: false,
        product: null,
        sellingPrice: '',
        buyingPrice: '',
        categoryId: '',
        exchangeRate: null,
        rateUpdatedAt: null,
        rateSource: null,
        quantity: '', requestId: '', sku: '',
      })
      if (result.product) onTransferred?.(result.product)
    } catch (error: unknown) {
      console.error(error)
      setTransferError(error instanceof Error ? error.message : 'Erreur lors du transfert vers le stock principal.')
    } finally {
      setTransferring(false)
    }
  }

  const handleDeleteItem = async () => {
    if (!deleteCandidate) return
    const product = deleteCandidate
    if (!isOnline && product.synced) {
      setDeleteCandidate(null)
      setFeedback({ type: 'warning', message: 'Une connexion est requise pour supprimer un article déjà synchronisé.' })
      return
    }

    setDeleting(true)
    setFeedback(null)
    try {
      if (product.synced) await deleteAbroadProductRecord(product.id)
      deleteAbroadProduct(product.id)
      setDeleteCandidate(null)
      setFeedback({ type: 'success', message: `L’article « ${product.name} » a été supprimé.` })
    } catch (error: unknown) {
      console.error(error)
      setDeleteCandidate(null)
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Suppression impossible pour le moment.',
      })
    } finally {
      setDeleting(false)
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
                onClick={() => void handleSyncPending()}
                isLoading={syncing}
                disabled={savingAdd || savingEdit || transferring}
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

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700'
              : feedback.type === 'warning'
                ? 'border-amber-500/20 bg-amber-500/10 text-amber-700'
                : 'border-red-500/20 bg-red-500/10 text-red-700'
          }`}
        >
          {feedback.type === 'success'
            ? <CheckCircle size={18} className="shrink-0" />
            : <AlertTriangle size={18} className="shrink-0" />}
          <span className="flex-1">{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} className="rounded-lg px-2 py-1 text-xs font-semibold">Fermer</button>
        </div>
      )}

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="shrink-0 rounded-xl bg-[#6C5CE7]/10 p-2">
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
            disabled={savingAdd || photoBusy}
            className="shrink-0 whitespace-nowrap"
            leftIcon={<Plus size={15} />}
            onClick={() => {
              setFormError('')
              setShowForm((current) => !current)
            }}
          >
            {showForm ? 'Annuler' : 'Ajouter'}
          </Button>
        </div>

        {showForm && (
          <fieldset disabled={savingAdd} className="fade-in min-w-0 space-y-4 border-t border-[#2D7D7D]/[0.08] pt-4">
            {formError && (
              <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-600">
                {formError}
              </div>
            )}
            <ProductPhotoPicker value={form.image_url}
              onChange={(image_url) => setForm((current) => ({ ...current, image_url }))}
              onBusyChange={setPhotoBusy} disabled={savingAdd} />
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
                min="0"
                step="any"
                inputMode="decimal"
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
                min="1"
                step="1"
                inputMode="numeric"
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
            <Button variant="primary" fullWidth onClick={() => void handleAdd()} isLoading={savingAdd} disabled={photoBusy}>
              {isOnline ? 'Enregistrer et synchroniser' : 'Enregistrer localement'}
            </Button>
          </fieldset>
        )}
      </Card>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#1A3636]">
            Articles enregistres ({notActivated.length} a transferer)
          </h3>
          <Button size="sm" variant="ghost" leftIcon={<RefreshCw size={14} />} onClick={() => void refreshProducts()}
            isLoading={refreshing} disabled={!isOnline || transferring || syncing || savingAdd || savingEdit}>Actualiser</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input aria-label="Rechercher une saisie" placeholder="Rechercher un produit..." value={search} onChange={(event) => setSearch(event.target.value)} />
          <Select aria-label="Etat du transfert" value={listFilter} onChange={(event) => setListFilter(event.target.value)}
            options={[{ value: 'pending', label: 'A transferer' }, { value: 'completed', label: 'Transferes' }, { value: 'all', label: 'Tous les articles' }]} />
        </div>

        {visibleProducts.length === 0 ? (
          <Card>
            <div className="py-8 text-center">
              <Globe size={28} className="mx-auto mb-3 text-[#6B7682] opacity-50" />
              <p className="text-sm font-medium text-[#1A3636]">Aucun article pour cette selection</p>
            </div>
          </Card>
        ) : (
          visibleProducts.map((product) => (
            <Card key={product.id} className="relative">
              <div className="flex items-start gap-3">
                {product.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.image_url} alt={product.name} loading="lazy"
                    className="h-12 w-12 shrink-0 rounded-lg border border-[#2D7D7D]/10 bg-[#F4F7FB] object-contain p-1" />
                )}
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
                      <p className="mt-1 text-xs font-medium text-[#2D7D7D]">
                        Transfere : {getTransferredQuantity(product)} · Reste : {getRemainingQuantity(product)}
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
                    <div className="flex flex-row flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                      <div className="flex gap-1.5">
                        {product.activated ? (
                          <Badge variant="success">
                            <CheckCircle size={10} className="mr-1" />
                            Transfere
                          </Badge>
                        ) : getTransferredQuantity(product) > 0 ? (
                          <Badge variant="warning">Partiel</Badge>
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
                          className="shrink-0 whitespace-nowrap"
                          rightIcon={<ArrowRight size={13} />}
                          onClick={() => openActivate(product)}
                          disabled={syncing || savingAdd || transferring || refreshing}
                        >
                          {getTransferredQuantity(product) > 0 ? 'Transferer le reste' : 'Transferer'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-shrink-0 flex-col gap-1">
                  {getTransferredQuantity(product) > 0 && (
                    <button type="button" onClick={() => void openHistory(product)} disabled={!isOnline}
                      title="Historique des transferts" aria-label={`Historique de ${product.name}`}
                      className="rounded-lg p-1.5 text-[#2D7D7D] hover:bg-[#2D7D7D]/10"><History size={16} /></button>
                  )}
                  {!product.activated && (
                    <button
                      onClick={() => openEdit(product)}
                      disabled={syncing || savingAdd || transferring}
                      title="Modifier"
                      aria-label="Modifier l'article"
                      className="rounded-lg p-1.5 text-[#6B7682] transition-colors hover:bg-[#6C5CE7]/[0.1] hover:text-[#6C5CE7]"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                  {getTransferredQuantity(product) === 0 && <button
                    onClick={() => { setDeleteCandidate(product); setFeedback(null) }}
                    disabled={syncing || savingAdd || transferring}
                    title="Supprimer"
                    aria-label="Supprimer l'article"
                    className="rounded-lg p-1.5 text-[#6B7682] transition-colors hover:bg-red-500/5 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal
        isOpen={activateModal.open}
        onClose={() => {
          if (transferring) return
          setActivateModal((current) => ({ ...current, open: false }))
          setTransferError('')
        }}
        title="Transferer vers le stock principal"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setActivateModal((current) => ({ ...current, open: false }))
                setTransferError('')
              }}
              disabled={transferring}
            >
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleActivate()}
              isLoading={transferring}
              disabled={!isOnline || loadingRate || !activateModal.product || !!validateTransferQuantity(activateModal.quantity, activateModal.product)
                || (getTransferredQuantity(activateModal.product) === 0 && (!activateModal.sellingPrice || !activateModal.buyingPrice))}
            >
              Transferer
            </Button>
          </div>
        }
      >
        {activateModal.product && (
          <fieldset disabled={transferring} className="min-w-0 space-y-4">
            {transferError && (
              <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-600">
                {transferError}
              </div>
            )}
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
            <Input label="Quantite a transferer" type="number" min="1" max={getRemainingQuantity(activateModal.product)} step="1" inputMode="numeric"
              value={activateModal.quantity} onChange={(event) => setActivateModal((current) => ({ ...current, quantity: event.target.value }))}
              error={validateTransferQuantity(activateModal.quantity, activateModal.product) ?? undefined} />
            <dl className="grid grid-cols-2 gap-3 border-y border-[#2D7D7D]/10 py-3 text-sm">
              <div><dt className="text-xs text-[#6B7682]">Disponible</dt><dd className="font-semibold text-[#1A3636]">{getRemainingQuantity(activateModal.product)} unite(s)</dd></div>
              <div><dt className="text-xs text-[#6B7682]">Reste apres transfert</dt><dd className="font-semibold text-[#2D7D7D]">{validateTransferQuantity(activateModal.quantity, activateModal.product) ? '-' : getRemainingQuantity(activateModal.product) - Number(activateModal.quantity)} unite(s)</dd></div>
            </dl>
            {getTransferredQuantity(activateModal.product) > 0 ? (
              <p className="text-sm text-[#2D7D7D]">Destination : fiche produit existante. Prix d&apos;achat et de vente conserves.</p>
            ) : <>
            {activateModal.product.currency !== 'XOF' && (
              <div className="rounded-xl border border-[#2D7D7D]/15 bg-[#2D7D7D]/5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-[#1A3636]">Conversion vers le FCFA</p>
                    <p className="mt-1 text-[11px] text-[#6B7682]">
                      {activateModal.exchangeRate
                        ? `1 ${activateModal.product.currency} = ${activateModal.exchangeRate.toLocaleString('fr-FR')} FCFA`
                        : 'Récupérez le dernier taux disponible avant le transfert.'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void loadExchangeRate()}
                    isLoading={loadingRate}
                    disabled={!isOnline || transferring}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Obtenir le taux
                  </Button>
                </div>
                {activateModal.rateUpdatedAt && (
                  <p className="mt-2 text-[10px] text-[#7B8794]">
                    Taux du {new Date(activateModal.rateUpdatedAt).toLocaleString('fr-FR')} · {activateModal.rateSource}
                  </p>
                )}
              </div>
            )}
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Prix d'achat (FCFA)"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                placeholder={activateModal.product.currency === 'XOF' ? String(activateModal.product.purchase_price) : 'Coût converti en FCFA'}
                value={activateModal.buyingPrice}
                onChange={(e) => {
                  const value = e.target.value
                  setActivateModal((current) => ({
                    ...current,
                    buyingPrice: value,
                    exchangeRate: null,
                    rateSource: 'Saisie manuelle',
                    rateUpdatedAt: new Date().toISOString(),
                  }))
                }}
              />
              <Input
                label="Prix de vente (FCFA)"
                type="number"
                min="1"
                step="any"
                inputMode="decimal"
                placeholder="ex: 150000"
                value={activateModal.sellingPrice}
                onChange={(e) =>
                  setActivateModal((current) => ({ ...current, sellingPrice: e.target.value }))
                }
              />
            </div>
            </>}
          </fieldset>
        )}
      </Modal>

      <Modal
        isOpen={editId !== null}
        onClose={() => { if (!savingEdit && !editPhotoBusy) setEditId(null) }}
        title="Modifier l'article"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditId(null)} disabled={savingEdit || editPhotoBusy}>
              Annuler
            </Button>
            <Button variant="primary" onClick={() => void handleSaveEdit()} isLoading={savingEdit} disabled={editPhotoBusy}>
              Enregistrer
            </Button>
          </div>
        }
      >
        <fieldset disabled={savingEdit} className="min-w-0 space-y-4">
          {editError && (
            <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-600">
              {editError}
            </div>
          )}
          <ProductPhotoPicker value={editForm.image_url}
            onChange={(image_url) => setEditForm((current) => ({ ...current, image_url }))}
            onBusyChange={setEditPhotoBusy} disabled={savingEdit} />
          <Input
            label="Nom du produit"
            placeholder="ex: Telephone Xiaomi 14 Pro"
            value={editForm.name}
            onChange={(e) => setEditForm((current) => ({ ...current, name: e.target.value }))}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
              min="0"
              step="any"
              inputMode="decimal"
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
            min="1"
            step="1"
            inputMode="numeric"
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
        </fieldset>
      </Modal>

      <Modal
        isOpen={deleteCandidate !== null}
        onClose={() => { if (!deleting) setDeleteCandidate(null) }}
        title="Supprimer la saisie"
        size="sm"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteCandidate(null)} disabled={deleting}>Annuler</Button>
            <Button variant="danger" onClick={() => void handleDeleteItem()} isLoading={deleting}>Supprimer</Button>
          </div>
        }
      >
        <p className="text-sm text-[#5C6B73]">
          Voulez-vous vraiment supprimer <strong className="text-[#1A3636]">{deleteCandidate?.name}</strong> ?
        </p>
      </Modal>
      <Modal isOpen={history !== null} onClose={() => setHistory(null)} title="Historique des transferts">
        {history && <div className="space-y-3">
          <p className="break-words text-sm font-semibold text-[#1A3636]">{history.product.name}</p>
          <p className="text-sm text-[#2D7D7D]">{getTransferredQuantity(history.product)} transfere(s) sur {history.product.quantity}</p>
          {history.loading ? <p role="status" className="text-sm text-[#6B7682]">Chargement...</p>
            : history.error ? <div role="alert" className="text-sm text-red-600">{history.error}
              <Button size="sm" variant="ghost" onClick={() => void openHistory(history.product)}>Reessayer</Button></div>
            : history.rows.length === 0 ? <p className="text-sm text-[#6B7682]">Transfert anterieur au suivi detaille.</p>
            : <ul className="divide-y divide-[#2D7D7D]/10">{history.rows.map((row) => <li key={row.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
              <time className="text-[#6B7682]" dateTime={row.created_at}>{new Date(row.created_at).toLocaleString('fr-FR')}</time>
              <span className="font-semibold text-[#2D7D7D]">+{row.quantity} unite(s)</span>
            </li>)}</ul>}
          {history.rows.length === 50 && <p className="text-xs text-[#6B7682]">50 derniers transferts</p>}
        </div>}
      </Modal>
    </div>
  )
}
