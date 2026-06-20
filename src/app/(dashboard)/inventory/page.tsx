'use client'

import { useCallback, useState } from 'react'
import { Globe, Package } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { ProductTable } from '@/components/inventory/ProductTable'
import { AddProductModal } from '@/components/inventory/AddProductModal'
import { AbroadBatchEntry } from '@/components/inventory/AbroadBatchEntry'
import { useInventoryStore } from '@/store/inventoryStore'
import type { Product } from '@/types'

type Tab = 'stock' | 'abroad'

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>('stock')
  const [showAdd, setShowAdd] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [activatedProduct, setActivatedProduct] = useState<Product | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const abroadPendingCount = useInventoryStore(
    (state) => state.abroadProducts.filter((product) => !product.activated).length
  )
  const clearActivatedProduct = useCallback(() => setActivatedProduct(null), [])

  return (
    <div className="min-h-screen">
      <Header title="Inventaire" subtitle="Gerez votre stock de produits" />

      <div className="space-y-4 p-3 sm:p-4 lg:space-y-6 lg:p-6">
        <div className="grid w-full grid-cols-2 gap-1 rounded-xl border border-[#2D7D7D]/[0.08] bg-[#E9EEF6] p-1 sm:w-fit">
          <button
            onClick={() => setTab('stock')}
            className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-semibold transition-all duration-200 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm ${
              tab === 'stock'
                ? 'bg-gradient-to-r from-[#6C5CE7] to-[#8B7DF0] text-white shadow-[0_4px_14px_rgba(108,92,231,0.35)]'
                : 'text-[#5C6B73] hover:text-[#1A3636]'
            }`}
          >
            <Package size={15} />
            <span className="truncate">Stock principal</span>
          </button>

          <button
            onClick={() => setTab('abroad')}
            className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-semibold transition-all duration-200 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm ${
              tab === 'abroad'
                ? 'bg-gradient-to-r from-[#6C5CE7] to-[#8B7DF0] text-white shadow-[0_4px_14px_rgba(108,92,231,0.35)]'
                : 'text-[#5C6B73] hover:text-[#1A3636]'
            }`}
          >
            <Globe size={15} />
            <span className="truncate">Saisie étranger</span>
            {abroadPendingCount > 0 && (
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                  tab === 'abroad'
                    ? 'bg-white/25 text-white'
                    : 'bg-amber-500/15 text-amber-700'
                }`}
              >
                {abroadPendingCount}
              </span>
            )}
          </button>
        </div>

        {tab === 'stock' ? (
          <ProductTable
            onAddProduct={() => setShowAdd(true)}
            onEditProduct={(product) => setEditProduct(product)}
            refreshKey={refreshKey}
            activatedProduct={activatedProduct}
            onActivatedProductMerged={clearActivatedProduct}
          />
        ) : (
          <AbroadBatchEntry
            onTransferred={(product) => {
              setActivatedProduct(product)
              setRefreshKey((current) => current + 1)
              setTab('stock')
            }}
          />
        )}
      </div>

      <AddProductModal
        isOpen={showAdd || !!editProduct}
        onClose={() => {
          setShowAdd(false)
          setEditProduct(null)
        }}
        product={editProduct}
        onSaved={() => setRefreshKey((current) => current + 1)}
      />
    </div>
  )
}
