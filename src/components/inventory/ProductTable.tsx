'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Edit,
  Filter,
  History,
  Layers,
  MoreVertical,
  Package,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Tags,
  Trash2,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { CategoryManager } from './CategoryManager'
import { StockAdjustmentModal } from './StockAdjustmentModal'
import { StockMovementHistoryModal } from './StockMovementHistoryModal'
import { formatCurrency, getStockStatus } from '@/lib/utils'
import { getProducts, deleteProduct } from '@/lib/supabase/queries'
import type { Product } from '@/types'

interface ProductTableProps {
  onAddProduct: () => void
  onEditProduct: (product: Product) => void
  refreshKey?: number
  activatedProduct?: Product | null
  onActivatedProductMerged?: () => void
}

export function ProductTable({
  onAddProduct,
  onEditProduct,
  refreshKey,
  activatedProduct,
  onActivatedProductMerged,
}: ProductTableProps) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [stockFilter, setStockFilter] = useState<'all' | 'available' | 'low' | 'out'>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'stock-low' | 'stock-high' | 'margin'>('recent')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<Product | null>(null)
  const [showCategories, setShowCategories] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [adjustmentProduct, setAdjustmentProduct] = useState<Product | null>(null)
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null)

  const mergeActivatedProduct = useCallback((list: Product[]) => {
    if (!activatedProduct || list.some((product) => product.id === activatedProduct.id)) {
      return list
    }
    return [activatedProduct, ...list]
  }, [activatedProduct])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')

    try {
      const data = await getProducts()
      setProducts(mergeActivatedProduct(data))
      if (activatedProduct) onActivatedProductMerged?.()
    } catch (error: unknown) {
      console.error(error)
      setLoadError(error instanceof Error ? error.message : "Impossible de charger l'inventaire.")
    } finally {
      setLoading(false)
    }
  }, [activatedProduct, mergeActivatedProduct, onActivatedProductMerged])

  useEffect(() => { void load() }, [load, refreshKey])

  useEffect(() => {
    if (!activatedProduct) return
    setProducts((prev) => mergeActivatedProduct(prev))
    onActivatedProductMerged?.()
  }, [activatedProduct, mergeActivatedProduct, onActivatedProductMerged])

  const handleDelete = async () => {
    if (!deleteCandidate) return
    const product = deleteCandidate
    setDeleting(product.id)
    setFeedback(null)
    try {
      await deleteProduct(product.id)
      setProducts((prev) => prev.filter((p) => p.id !== product.id))
      setDeleteCandidate(null)
      setFeedback({ type: 'success', message: `Le produit « ${product.name} » a été supprimé.` })
    } catch (err: unknown) {
      console.error(err)
      setDeleteCandidate(null)
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erreur lors de la suppression du produit.',
      })
    } finally {
      setDeleting(null)
      setActiveMenu(null)
    }
  }

  const categoryOptions = Array.from(
    new Map(
      products
        .filter((product) => product.category)
        .map((product) => [product.category!.id, product.category!])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name))

  const summary = products.reduce(
    (acc, product) => {
      acc.total += 1
      acc.units += product.quantity
      acc.buyingValue += product.buying_price * product.quantity
      acc.sellingValue += product.selling_price * product.quantity
      if (product.quantity === 0) acc.out += 1
      if (product.quantity > 0 && product.quantity <= product.min_quantity) acc.low += 1
      return acc
    },
    { total: 0, units: 0, buyingValue: 0, sellingValue: 0, low: 0, out: 0 }
  )

  const filtered = products
    .filter((p) => {
      const query = search.trim().toLowerCase()
      const sku = p.sku?.toLowerCase() ?? ''
      const categoryName = p.category?.name.toLowerCase() ?? ''
      const matchesSearch =
        !query ||
        p.name.toLowerCase().includes(query) ||
        sku.includes(query) ||
        categoryName.includes(query)

      const matchesCategory = categoryFilter === 'all' || p.category_id === categoryFilter
      const matchesStock =
        stockFilter === 'all' ||
        (stockFilter === 'available' && p.quantity > p.min_quantity) ||
        (stockFilter === 'low' && p.quantity > 0 && p.quantity <= p.min_quantity) ||
        (stockFilter === 'out' && p.quantity === 0)

      return matchesSearch && matchesCategory && matchesStock
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'stock-low') return a.quantity - b.quantity
      if (sortBy === 'stock-high') return b.quantity - a.quantity
      if (sortBy === 'margin') {
        const marginA = a.selling_price > 0 ? (a.selling_price - a.buying_price) / a.selling_price : 0
        const marginB = b.selling_price > 0 ? (b.selling_price - b.buying_price) / b.selling_price : 0
        return marginB - marginA
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const hasFilters = search || categoryFilter !== 'all' || stockFilter !== 'all' || sortBy !== 'recent'
  const activeFilterCount = [categoryFilter !== 'all', stockFilter !== 'all', sortBy !== 'recent']
    .filter(Boolean).length

  const resetFilters = () => {
    setSearch('')
    setCategoryFilter('all')
    setStockFilter('all')
    setSortBy('recent')
  }

  const openStockAdjustment = (product: Product) => {
    setAdjustmentProduct(product)
    setActiveMenu(null)
  }

  const openStockHistory = (product: Product) => {
    setHistoryProduct(product)
    setActiveMenu(null)
  }

  const handleStockAdjusted = (productId: string, quantity: number) => {
    const adjustedProduct = products.find((product) => product.id === productId)
    setProducts((current) => current.map((product) => (
      product.id === productId ? { ...product, quantity } : product
    )))
    setFeedback({
      type: 'success',
      message: `Stock de « ${adjustedProduct?.name ?? 'Produit'} » mis à jour : ${quantity} unité(s).`,
    })
  }

  const exportCsv = () => {
    const protectSpreadsheetCell = (value: string | number) => {
      const text = String(value)
      const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text
      return `"${safeText.replace(/"/g, '""')}"`
    }
    const rows = filtered.map((product) => ({
      Nom: product.name,
      SKU: product.sku ?? '',
      Categorie: product.category?.name ?? '',
      Quantite: product.quantity,
      Stock_minimum: product.min_quantity,
      Prix_achat: product.buying_price,
      Prix_vente: product.selling_price,
      Marge_pct: product.selling_price > 0
        ? (((product.selling_price - product.buying_price) / product.selling_price) * 100).toFixed(2)
        : '0.00',
      Valeur_achat_stock: product.buying_price * product.quantity,
      Valeur_vente_stock: product.selling_price * product.quantity,
      Devise: product.currency,
      Statut: getStockStatus(product.quantity, product.min_quantity).label,
      Date_ajout: new Date(product.created_at).toLocaleString('fr-SN'),
    }))
    const header = Object.keys(rows[0] ?? {
      Nom: '',
      SKU: '',
      Categorie: '',
      Quantite: '',
      Stock_minimum: '',
      Prix_achat: '',
      Prix_vente: '',
      Marge_pct: '',
      Valeur_achat_stock: '',
      Valeur_vente_stock: '',
      Devise: '',
      Statut: '',
      Date_ajout: '',
    })
    const csv = [
      header.map(protectSpreadsheetCell).join(','),
      ...rows.map((row) =>
        header
          .map((key) => protectSpreadsheetCell(row[key as keyof typeof row] ?? ''))
          .join(',')
      ),
    ].join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `inventaire-saytu-yef-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* Résumé stock */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="min-w-0 rounded-2xl border border-[#2D7D7D]/[0.08] bg-white p-3">
          <div className="flex items-center gap-2 text-[#5C6B73]">
            <Package size={15} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em]">Produits</span>
          </div>
          <p className="mt-2 truncate text-lg font-bold text-[#1A3636] sm:text-xl">{summary.total}</p>
          <p className="truncate text-[11px] text-[#5C6B73] sm:text-xs">{summary.units} unité(s)</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-[#2D7D7D]/[0.08] bg-white p-3">
          <div className="flex items-center gap-2 text-[#5C6B73]">
            <Layers size={15} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em]">Valeur achat</span>
          </div>
          <p className="mt-2 truncate text-base font-bold text-[#1A3636] sm:text-xl" title={formatCurrency(summary.buyingValue)}>{formatCurrency(summary.buyingValue)}</p>
          <p className="truncate text-[11px] text-[#5C6B73] sm:text-xs">capital immobilisé</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-[#2D7D7D]/[0.08] bg-white p-3">
          <div className="flex items-center gap-2 text-[#5C6B73]">
            <Layers size={15} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em]">Valeur vente</span>
          </div>
          <p className="mt-2 truncate text-base font-bold text-[#1A3636] sm:text-xl" title={formatCurrency(summary.sellingValue)}>{formatCurrency(summary.sellingValue)}</p>
          <p className="truncate text-[11px] text-[#5C6B73] sm:text-xs">potentiel brut</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2 text-amber-700">
            <AlertTriangle size={15} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em]">Alertes</span>
          </div>
          <p className="mt-2 truncate text-lg font-bold text-[#1A3636] sm:text-xl">{summary.low + summary.out}</p>
          <p className="truncate text-[11px] text-[#5C6B73] sm:text-xs">{summary.low} faible · {summary.out} rupture</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7682]" />
          <input
            type="text"
            placeholder="Rechercher un produit, SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-[#F4F7FB] border border-[#2D7D7D]/[0.1] text-sm text-[#1A3636] placeholder:text-[#6B7682] focus:border-[#6C5CE7] focus:bg-[#2D7D7D]/[0.08] transition-all"
          />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-2 sm:flex">
          <Button variant="outline" size="md" leftIcon={<Download size={15} />} onClick={exportCsv} disabled={filtered.length === 0} aria-label="Exporter l'inventaire" title="Exporter" className="w-11 gap-0 px-0 sm:w-auto sm:gap-2 sm:px-6">
            <span className="hidden sm:inline">Exporter</span>
          </Button>
          <Button variant="outline" size="md" leftIcon={<Tags size={15} />} onClick={() => setShowCategories(true)} aria-label="Gérer les catégories" title="Catégories" className="w-11 gap-0 px-0 sm:w-auto sm:gap-2 sm:px-6">
            <span className="hidden sm:inline">Catégories</span>
          </Button>
          <Button variant="outline" size="md" leftIcon={<RefreshCw size={15} className={loading ? 'animate-spin' : ''} />} onClick={() => void load()} disabled={loading} aria-label="Actualiser la liste" title="Actualiser" className="w-11 gap-0 px-0 sm:w-auto sm:gap-2 sm:px-6">
            <span className="hidden sm:inline">Actualiser</span>
          </Button>
          <Button variant="primary" size="md" leftIcon={<Plus size={15} />} onClick={onAddProduct} className="order-first w-full sm:order-last sm:w-auto">
            Ajouter
          </Button>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{loadError}</span>
          <button type="button" onClick={() => void load()} className="min-h-10 rounded-xl border border-red-500/25 bg-white px-4 text-xs font-semibold text-red-700">
            Réessayer
          </button>
        </div>
      )}

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-medium ${
            feedback.type === 'success'
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700'
              : 'border-red-500/20 bg-red-500/10 text-red-700'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={18} className="shrink-0" /> : <AlertTriangle size={18} className="shrink-0" />}
          <span className="flex-1">{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} className="rounded-lg px-2 py-1 text-xs font-semibold" aria-label="Masquer le message">
            Fermer
          </button>
        </div>
      )}

      {/* Filtres */}
      <button
        type="button"
        onClick={() => setShowMobileFilters((current) => !current)}
        className="flex min-h-11 w-full items-center justify-between rounded-xl border border-[#2D7D7D]/[0.1] bg-white px-4 text-sm font-semibold text-[#2D7D7D] sm:hidden"
        aria-expanded={showMobileFilters}
      >
        <span className="flex items-center gap-2"><SlidersHorizontal size={16} /> Filtres et tri</span>
        <span className="text-xs text-[#6B7682]">{activeFilterCount > 0 ? `${activeFilterCount} actif(s)` : showMobileFilters ? 'Masquer' : 'Afficher'}</span>
      </button>
      <div className={`${showMobileFilters ? 'grid' : 'hidden'} grid-cols-1 gap-2 rounded-2xl border border-[#2D7D7D]/[0.08] bg-white p-3 sm:grid sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_auto]`}>
        <label className="space-y-1">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">
            <Filter size={12} /> Catégorie
          </span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-10 w-full rounded-xl border border-[#2D7D7D]/[0.1] bg-[#F4F7FB] px-3 text-sm text-[#1A3636] transition-all focus:border-[#6C5CE7]"
          >
            <option value="all">Toutes les catégories</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Stock</span>
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as typeof stockFilter)}
            className="h-10 w-full rounded-xl border border-[#2D7D7D]/[0.1] bg-[#F4F7FB] px-3 text-sm text-[#1A3636] transition-all focus:border-[#6C5CE7]"
          >
            <option value="all">Tous les statuts</option>
            <option value="available">Disponible</option>
            <option value="low">Stock faible</option>
            <option value="out">Rupture</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Tri</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="h-10 w-full rounded-xl border border-[#2D7D7D]/[0.1] bg-[#F4F7FB] px-3 text-sm text-[#1A3636] transition-all focus:border-[#6C5CE7]"
          >
            <option value="recent">Plus récents</option>
            <option value="name">Nom A-Z</option>
            <option value="stock-low">Stock le plus bas</option>
            <option value="stock-high">Stock le plus haut</option>
            <option value="margin">Meilleure marge</option>
          </select>
        </label>
        {hasFilters && (
          <Button variant="ghost" size="md" leftIcon={<XCircle size={15} />} onClick={resetFilters} className="self-end">
            Réinitialiser
          </Button>
        )}
      </div>

      <CategoryManager isOpen={showCategories} onClose={() => setShowCategories(false)} onChanged={() => void load()} />
      <StockAdjustmentModal
        product={adjustmentProduct}
        onClose={() => setAdjustmentProduct(null)}
        onAdjusted={handleStockAdjusted}
      />
      <StockMovementHistoryModal
        product={historyProduct}
        onClose={() => setHistoryProduct(null)}
      />
      <Modal
        isOpen={deleteCandidate !== null}
        onClose={() => { if (!deleting) setDeleteCandidate(null) }}
        title="Supprimer le produit"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteCandidate(null)} disabled={!!deleting}>Annuler</Button>
            <Button variant="danger" onClick={() => void handleDelete()} isLoading={!!deleting}>Supprimer</Button>
          </>
        }
      >
        <p className="text-sm text-[#5C6B73]">
          Voulez-vous vraiment supprimer <strong className="text-[#1A3636]">{deleteCandidate?.name}</strong> ? Cette action est irréversible.
        </p>
      </Modal>

      {/* Liste */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 h-14 rounded-xl bg-white border border-[#2D7D7D]/[0.08] animate-pulse">
              <div className="w-8 h-8 rounded-lg bg-[#2D7D7D]/[0.08]" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-[#2D7D7D]/[0.08] rounded w-40" />
                <div className="h-2 bg-[#F4F7FB] rounded w-24" />
              </div>
              <div className="h-4 bg-[#2D7D7D]/[0.08] rounded w-16" />
              <div className="h-4 bg-[#2D7D7D]/[0.08] rounded w-20" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-[#2D7D7D]/[0.08] bg-white">
          <Package size={32} className="text-[#6B7682] mx-auto mb-3" />
          <p className="text-sm text-[#6B7682]">
            {products.length === 0 ? 'Aucun produit dans l\'inventaire' : 'Aucun produit ne correspond aux filtres'}
          </p>
          {products.length === 0 ? (
            <Button variant="primary" size="sm" className="mt-4" onClick={onAddProduct}>
              Ajouter le premier produit
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="mt-4" onClick={resetFilters}>
              Réinitialiser les filtres
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((product) => {
            const stock = getStockStatus(product.quantity, product.min_quantity)
            const margin = product.selling_price > 0
              ? ((product.selling_price - product.buying_price) / product.selling_price * 100).toFixed(0)
              : '0'
            return (
              <div key={product.id}>
                {/* Carte tactile mobile */}
                <article className="relative rounded-2xl border border-[#2D7D7D]/[0.08] bg-white p-3 shadow-[0_3px_12px_rgba(26,54,54,0.04)] sm:hidden">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#2D7D7D]/[0.08] bg-[#F4F7FB]">
                      {product.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package size={18} className="text-[#6B7682]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="truncate text-sm font-semibold leading-tight text-[#1A3636]">{product.name}</p>
                      <p className="mt-1 truncate font-mono text-[11px] leading-tight text-[#6B7682]">{product.sku || 'Sans SKU'}</p>
                    </div>
                    <div className="relative -mr-1 -mt-1">
                      <button
                        type="button"
                        onClick={() => setActiveMenu(activeMenu === product.id ? null : product.id)}
                        className="flex h-11 w-11 items-center justify-center rounded-xl text-[#6B7682] transition-all active:bg-[#2D7D7D]/[0.08]"
                        aria-label={`Actions pour ${product.name}`}
                      >
                        <MoreVertical size={18} />
                      </button>
                      {activeMenu === product.id && (
                        <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-[#2D7D7D]/[0.1] bg-white py-1 shadow-[0_12px_30px_rgba(26,54,54,0.16)]">
                          <button
                            type="button"
                            onClick={() => openStockAdjustment(product)}
                            className="flex min-h-11 w-full items-center gap-2 px-3 text-sm text-[#1A3636] transition-colors hover:bg-[#F4F7FB]"
                          >
                            <SlidersHorizontal size={15} /> Ajuster le stock
                          </button>
                          <button
                            type="button"
                            onClick={() => openStockHistory(product)}
                            className="flex min-h-11 w-full items-center gap-2 px-3 text-sm text-[#1A3636] transition-colors hover:bg-[#F4F7FB]"
                          >
                            <History size={15} /> Historique
                          </button>
                          <button
                            type="button"
                            onClick={() => { onEditProduct(product); setActiveMenu(null) }}
                            className="flex min-h-11 w-full items-center gap-2 px-3 text-sm text-[#1A3636] transition-colors hover:bg-[#F4F7FB]"
                          >
                            <Edit size={15} /> Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() => { setDeleteCandidate(product); setActiveMenu(null) }}
                            disabled={deleting === product.id}
                            className="flex min-h-11 w-full items-center gap-2 px-3 text-sm text-red-600 transition-colors hover:bg-red-500/5 disabled:opacity-50"
                          >
                            <Trash2 size={15} /> {deleting === product.id ? '…' : 'Supprimer'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex min-w-0 items-center gap-1.5 overflow-hidden">
                    <span className={`flex-shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold ${stock.bg} ${stock.color}`}>
                      {product.quantity} · {stock.label}
                    </span>
                    {product.category && (
                      <span
                        className="truncate rounded-md px-2 py-1 text-[10px] font-semibold"
                        style={{ background: `${product.category.color}15`, color: product.category.color }}
                      >
                        {product.category.name}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#2D7D7D]/[0.07] pt-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#1A3636]">{formatCurrency(product.selling_price)}</p>
                      <p className="text-[10px] font-medium text-emerald-600">Marge +{margin}%</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openStockAdjustment(product)}
                      className="flex min-h-10 flex-shrink-0 items-center gap-2 rounded-xl bg-[#6C5CE7]/[0.1] px-3 text-xs font-semibold text-[#5A4BD4] transition-colors active:bg-[#6C5CE7]/[0.18]"
                    >
                      <SlidersHorizontal size={14} /> Ajuster
                    </button>
                  </div>
                </article>

                {/* Ligne compacte tablette et bureau */}
                <div className="group relative hidden h-14 w-full items-center gap-3 rounded-xl border border-[#2D7D7D]/[0.08] bg-white px-4 transition-all hover:border-[#6C5CE7]/30 hover:shadow-[0_4px_14px_rgba(26,54,54,0.06)] sm:flex">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#2D7D7D]/[0.08] bg-[#F4F7FB]">
                    {product.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <Package size={15} className="text-[#6B7682]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight text-[#1A3636]">{product.name}</p>
                    <p className="truncate font-mono text-[11px] leading-tight text-[#6B7682]">{product.sku || 'Sans SKU'}</p>
                  </div>

                  <div className="hidden w-28 flex-shrink-0 md:block">
                    {product.category ? (
                      <span
                        className="inline-block max-w-full truncate rounded-md px-2 py-0.5 text-[11px] font-medium"
                        style={{ background: `${product.category.color}15`, color: product.category.color }}
                      >
                        {product.category.name}
                      </span>
                    ) : <span className="text-xs text-[#6B7682]">—</span>}
                  </div>

                  <div className="w-16 flex-shrink-0 text-center">
                    <p className={`text-sm font-semibold leading-tight ${stock.color}`}>{product.quantity}</p>
                    <p className="text-[10px] leading-tight text-[#6B7682]">en stock</p>
                  </div>

                  <div className="w-24 flex-shrink-0 text-right">
                    <p className="text-sm font-semibold leading-tight text-[#1A3636]">{formatCurrency(product.selling_price)}</p>
                    <p className="text-[10px] leading-tight text-emerald-600">+{margin}%</p>
                  </div>

                  <div className="hidden w-24 flex-shrink-0 justify-center lg:flex">
                    <Badge variant={product.quantity === 0 ? 'danger' : product.quantity <= product.min_quantity ? 'warning' : 'success'}>
                      {stock.label}
                    </Badge>
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => onEditProduct(product)}
                      title="Modifier"
                      aria-label="Modifier le produit"
                      className="rounded-lg p-1.5 text-[#6B7682] transition-all hover:bg-[#6C5CE7]/[0.1] hover:text-[#6C5CE7]"
                    >
                      <Edit size={15} />
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setActiveMenu(activeMenu === product.id ? null : product.id)}
                        className="rounded-lg p-1.5 text-[#6B7682] transition-all hover:bg-[#2D7D7D]/[0.08] hover:text-[#1A3636]"
                        aria-label={`Actions pour ${product.name}`}
                      >
                        <MoreVertical size={15} />
                      </button>
                      {activeMenu === product.id && (
                        <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-xl border border-[#2D7D7D]/[0.1] bg-white py-1 shadow-[0_8px_24px_rgba(26,54,54,0.12)]">
                          <button
                            type="button"
                            onClick={() => openStockAdjustment(product)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[#1A3636] transition-colors hover:bg-[#F4F7FB]"
                          >
                            <SlidersHorizontal size={13} /> Ajuster le stock
                          </button>
                          <button
                            type="button"
                            onClick={() => openStockHistory(product)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[#1A3636] transition-colors hover:bg-[#F4F7FB]"
                          >
                            <History size={13} /> Historique
                          </button>
                          <button
                            type="button"
                            onClick={() => { onEditProduct(product); setActiveMenu(null) }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[#1A3636] transition-colors hover:bg-[#F4F7FB]"
                          >
                            <Edit size={13} /> Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() => { setDeleteCandidate(product); setActiveMenu(null) }}
                            disabled={deleting === product.id}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 transition-colors hover:bg-red-500/5 disabled:opacity-50"
                          >
                            <Trash2 size={13} /> {deleting === product.id ? '…' : 'Supprimer'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && <p className="text-xs text-[#6B7682]">{filtered.length} produit(s) affiché(s)</p>}
    </div>
  )
}
