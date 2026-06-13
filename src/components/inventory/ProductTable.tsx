'use client'
import { useState, useEffect, useCallback } from 'react'
import { Package, Edit, Trash2, MoreVertical, Search, Plus, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatCurrency, getStockStatus } from '@/lib/utils'
import { getProducts, deleteProduct } from '@/lib/supabase/queries'
import type { Product } from '@/types'

interface ProductTableProps {
  onAddProduct: () => void
  onEditProduct: (product: Product) => void
  refreshKey?: number
}

export function ProductTable({ onAddProduct, onEditProduct, refreshKey }: ProductTableProps) {
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getProducts()
      .then(setProducts)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [refreshKey])

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

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8892aa]" />
          <input
            type="text"
            placeholder="Rechercher un produit, SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-[#f0f2f8] placeholder:text-[#4a5568] focus:border-[#4f6ef7] focus:bg-white/[0.06] transition-all"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="md" leftIcon={<RefreshCw size={15} />} onClick={load}>
            Actualiser
          </Button>
          <Button variant="primary" size="md" leftIcon={<Plus size={15} />} onClick={onAddProduct}>
            Ajouter
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
        {loading ? (
          <div className="divide-y divide-white/[0.04]">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 animate-pulse">
                <div className="w-9 h-9 rounded-xl bg-white/[0.06]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-white/[0.06] rounded w-40" />
                  <div className="h-2 bg-white/[0.04] rounded w-24" />
                </div>
                <div className="h-4 bg-white/[0.06] rounded w-16" />
                <div className="h-4 bg-white/[0.06] rounded w-20" />
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="text-left px-4 py-3 text-xs font-medium text-[#8892aa] uppercase tracking-wider">Produit</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[#8892aa] uppercase tracking-wider hidden sm:table-cell">SKU</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[#8892aa] uppercase tracking-wider hidden md:table-cell">Catégorie</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[#8892aa] uppercase tracking-wider">Qté</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[#8892aa] uppercase tracking-wider hidden lg:table-cell">Prix achat</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[#8892aa] uppercase tracking-wider">Prix vente</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[#8892aa] uppercase tracking-wider hidden sm:table-cell">Statut</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map((product) => {
                  const stock = getStockStatus(product.quantity, product.min_quantity)
                  const margin = product.selling_price > 0
                    ? ((product.selling_price - product.buying_price) / product.selling_price * 100).toFixed(0)
                    : '0'
                  return (
                    <tr key={product.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                            <Package size={16} className="text-[#8892aa]" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[#f0f2f8]">{product.name}</p>
                            <p className="text-xs text-[#8892aa] sm:hidden">{product.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-xs font-mono text-[#8892aa]">{product.sku}</span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {product.category ? (
                          <span
                            className="text-xs px-2 py-0.5 rounded-md font-medium"
                            style={{ background: `${product.category.color}15`, color: product.category.color }}
                          >
                            {product.category.name}
                          </span>
                        ) : <span className="text-xs text-[#8892aa]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-medium ${stock.color}`}>{product.quantity}</span>
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell">
                        <span className="text-sm text-[#8892aa]">{formatCurrency(product.buying_price)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div>
                          <p className="text-sm font-medium text-[#f0f2f8]">{formatCurrency(product.selling_price)}</p>
                          <p className="text-[10px] text-emerald-400">+{margin}%</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <Badge
                          variant={
                            product.quantity === 0 ? 'danger' :
                            product.quantity <= product.min_quantity ? 'warning' :
                            'success'
                          }
                        >
                          {stock.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 relative">
                        <button
                          onClick={() => setActiveMenu(activeMenu === product.id ? null : product.id)}
                          className="p-1.5 rounded-lg text-[#8892aa] hover:text-[#f0f2f8] hover:bg-white/[0.06] opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <MoreVertical size={15} />
                        </button>
                        {activeMenu === product.id && (
                          <div className="absolute right-4 top-full z-10 mt-1 w-36 rounded-xl border border-white/[0.08] bg-[#111827] shadow-xl py-1">
                            <button
                              onClick={() => { onEditProduct(product); setActiveMenu(null) }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[#f0f2f8] hover:bg-white/[0.05] transition-colors"
                            >
                              <Edit size={13} /> Modifier
                            </button>
                            <button
                              onClick={() => handleDelete(product)}
                              disabled={deleting === product.id}
                              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-400 hover:bg-red-500/5 transition-colors disabled:opacity-50"
                            >
                              <Trash2 size={13} /> {deleting === product.id ? '…' : 'Supprimer'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-12">
            <Package size={32} className="text-[#8892aa] mx-auto mb-3" />
            <p className="text-sm text-[#8892aa]">
              {products.length === 0 ? 'Aucun produit dans l\'inventaire' : 'Aucun produit trouvé'}
            </p>
            {products.length === 0 && (
              <Button variant="primary" size="sm" className="mt-4" onClick={onAddProduct}>
                Ajouter le premier produit
              </Button>
            )}
          </div>
        )}
      </div>

      {!loading && <p className="text-xs text-[#8892aa]">{filtered.length} produit(s) affiché(s)</p>}
    </div>
  )
}
