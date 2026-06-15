'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle,
  Download,
  Edit,
  Filter,
  Layers,
  MoreVertical,
  Package,
  Plus,
  RefreshCw,
  Search,
  Tags,
  Trash2,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CategoryManager } from './CategoryManager'
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
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showCategories, setShowCategories] = useState(false)

  const mergeActivatedProduct = useCallback((list: Product[]) => {
    if (!activatedProduct || list.some((product) => product.id === activatedProduct.id)) {
      return list
    }
    return [activatedProduct, ...list]
  }, [activatedProduct])

  const load = useCallback(() => {
    setLoading(true)
    getProducts()
      .then((data) => {
        setProducts(mergeActivatedProduct(data))
        if (activatedProduct) onActivatedProductMerged?.()
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [activatedProduct, mergeActivatedProduct, onActivatedProductMerged])

  useEffect(() => { load() }, [load, refreshKey])

  useEffect(() => {
    if (!activatedProduct) return
    setProducts((prev) => mergeActivatedProduct(prev))
    onActivatedProductMerged?.()
  }, [activatedProduct, mergeActivatedProduct, onActivatedProductMerged])

  const handleDelete = async (product: Product) => {
    if (!confirm(`Supprimer "${product.name}" ?`)) return
    setDeleting(product.id)
    try {
      await deleteProduct(product.id)
      setProducts((prev) => prev.filter((p) => p.id !== product.id))
    } catch (err) {
      console.error(err)
      alert('Erreur lors de la suppression')
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

  const resetFilters = () => {
    setSearch('')
    setCategoryFilter('all')
    setStockFilter('all')
    setSortBy('recent')
  }

  const exportCsv = () => {
    const rows = filtered.map((product) => ({
      Nom: product.name,
      SKU: product.sku ?? '',
      Categorie: product.category?.name ?? '',
      Quantite: product.quantity,
      Stock_minimum: product.min_quantity,
      Prix_achat: product.buying_price,
      Prix_vente: product.selling_price,
      Devise: product.currency,
      Statut: getStockStatus(product.quantity, product.min_quantity).label,
    }))
    const header = Object.keys(rows[0] ?? {
      Nom: '',
      SKU: '',
      Categorie: '',
      Quantite: '',
      Stock_minimum: '',
      Prix_achat: '',
      Prix_vente: '',
      Devise: '',
      Statut: '',
    })
    const csv = [
      header.join(','),
      ...rows.map((row) =>
        header
          .map((key) => `"${String(row[key as keyof typeof row] ?? '').replace(/"/g, '""')}"`)
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
        <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white p-3">
          <div className="flex items-center gap-2 text-[#5C6B73]">
            <Package size={15} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em]">Produits</span>
          </div>
          <p className="mt-2 text-xl font-bold text-[#1A3636]">{summary.total}</p>
          <p className="text-xs text-[#5C6B73]">{summary.units} unité(s)</p>
        </div>
        <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white p-3">
          <div className="flex items-center gap-2 text-[#5C6B73]">
            <Layers size={15} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em]">Valeur achat</span>
          </div>
          <p className="mt-2 text-xl font-bold text-[#1A3636]">{formatCurrency(summary.buyingValue)}</p>
          <p className="text-xs text-[#5C6B73]">capital immobilisé</p>
        </div>
        <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white p-3">
          <div className="flex items-center gap-2 text-[#5C6B73]">
            <Layers size={15} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em]">Valeur vente</span>
          </div>
          <p className="mt-2 text-xl font-bold text-[#1A3636]">{formatCurrency(summary.sellingValue)}</p>
          <p className="text-xs text-[#5C6B73]">potentiel brut</p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2 text-amber-700">
            <AlertTriangle size={15} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em]">Alertes</span>
          </div>
          <p className="mt-2 text-xl font-bold text-[#1A3636]">{summary.low + summary.out}</p>
          <p className="text-xs text-[#5C6B73]">{summary.low} faible · {summary.out} rupture</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
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
        <div className="flex gap-2">
          <Button variant="outline" size="md" leftIcon={<Download size={15} />} onClick={exportCsv} disabled={filtered.length === 0}>
            <span className="hidden sm:inline">Exporter</span>
          </Button>
          <Button variant="outline" size="md" leftIcon={<Tags size={15} />} onClick={() => setShowCategories(true)}>
            <span className="hidden sm:inline">Catégories</span>
          </Button>
          <Button variant="outline" size="md" leftIcon={<RefreshCw size={15} />} onClick={load}>
            <span className="hidden sm:inline">Actualiser</span>
          </Button>
          <Button variant="primary" size="md" leftIcon={<Plus size={15} />} onClick={onAddProduct}>
            Ajouter
          </Button>
        </div>
      </div>

      {/* Filtres */}
      <div className="grid grid-cols-1 gap-2 rounded-2xl border border-[#2D7D7D]/[0.08] bg-white p-3 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
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

      <CategoryManager isOpen={showCategories} onClose={() => setShowCategories(false)} onChanged={load} />

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
              <div
                key={product.id}
                className="group relative flex items-center gap-3 w-full px-3 sm:px-4 h-14 rounded-xl bg-white border border-[#2D7D7D]/[0.08] hover:border-[#6C5CE7]/30 hover:shadow-[0_4px_14px_rgba(26,54,54,0.06)] transition-all"
              >
                {/* Photo / icône + nom */}
                <div className="w-9 h-9 rounded-lg bg-[#F4F7FB] border border-[#2D7D7D]/[0.08] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {product.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package size={15} className="text-[#6B7682]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#1A3636] truncate leading-tight">{product.name}</p>
                  <p className="text-[11px] font-mono text-[#6B7682] truncate leading-tight">{product.sku || 'Sans SKU'}</p>
                  <div className="mt-1 flex items-center gap-1.5 sm:hidden">
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${stock.bg} ${stock.color}`}>
                      {product.quantity} · {stock.label}
                    </span>
                    {product.category && (
                      <span
                        className="max-w-[96px] truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{ background: `${product.category.color}15`, color: product.category.color }}
                      >
                        {product.category.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Catégorie */}
                <div className="hidden md:block w-28 flex-shrink-0">
                  {product.category ? (
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-md font-medium inline-block truncate max-w-full"
                      style={{ background: `${product.category.color}15`, color: product.category.color }}
                    >
                      {product.category.name}
                    </span>
                  ) : <span className="text-xs text-[#6B7682]">—</span>}
                </div>

                {/* Quantité */}
                <div className="hidden sm:block w-16 text-center flex-shrink-0">
                  <p className={`text-sm font-semibold ${stock.color} leading-tight`}>{product.quantity}</p>
                  <p className="text-[10px] text-[#6B7682] leading-tight">en stock</p>
                </div>

                {/* Prix vente */}
                <div className="w-24 text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-[#1A3636] leading-tight">{formatCurrency(product.selling_price)}</p>
                  <p className="text-[10px] text-emerald-600 leading-tight">+{margin}%</p>
                </div>

                {/* Statut */}
                <div className="hidden lg:flex w-24 justify-center flex-shrink-0">
                  <Badge
                    variant={
                      product.quantity === 0 ? 'danger' :
                      product.quantity <= product.min_quantity ? 'warning' :
                      'success'
                    }
                  >
                    {stock.label}
                  </Badge>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => onEditProduct(product)}
                    title="Modifier"
                    aria-label="Modifier le produit"
                    className="p-1.5 rounded-lg text-[#6B7682] hover:text-[#6C5CE7] hover:bg-[#6C5CE7]/[0.1] transition-all"
                  >
                    <Edit size={15} />
                  </button>
                  <div className="relative">
                  <button
                    onClick={() => setActiveMenu(activeMenu === product.id ? null : product.id)}
                    className="p-1.5 rounded-lg text-[#6B7682] hover:text-[#1A3636] hover:bg-[#2D7D7D]/[0.08] transition-all"
                  >
                    <MoreVertical size={15} />
                  </button>
                  {activeMenu === product.id && (
                    <div className="absolute right-0 top-full z-10 mt-1 w-36 rounded-xl border border-[#2D7D7D]/[0.1] bg-white shadow-[0_8px_24px_rgba(26,54,54,0.12)] py-1">
                      <button
                        onClick={() => { onEditProduct(product); setActiveMenu(null) }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[#1A3636] hover:bg-[#F4F7FB] transition-colors"
                      >
                        <Edit size={13} /> Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(product)}
                        disabled={deleting === product.id}
                        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-600 hover:bg-red-500/5 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={13} /> {deleting === product.id ? '…' : 'Supprimer'}
                      </button>
                    </div>
                  )}
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
