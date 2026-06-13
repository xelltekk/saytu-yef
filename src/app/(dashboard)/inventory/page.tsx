'use client'
import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { ProductTable } from '@/components/inventory/ProductTable'
import { AddProductModal } from '@/components/inventory/AddProductModal'
import { AbroadBatchEntry } from '@/components/inventory/AbroadBatchEntry'
import { Package, Globe } from 'lucide-react'
import type { Product } from '@/types'

type Tab = 'stock' | 'abroad'

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>('stock')
  const [showAdd, setShowAdd] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="min-h-screen">
      <Header title="Inventaire" subtitle="Gérez votre stock de produits" />
      <div className="p-4 lg:p-6 space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-white/[0.03] rounded-xl border border-white/[0.06] w-fit">
          <button
            onClick={() => setTab('stock')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${tab === 'stock' ? 'bg-[#4f6ef7] text-white shadow-lg shadow-[rgba(79,110,247,0.3)]' : 'text-[#8892aa] hover:text-[#f0f2f8]'}`}
          >
            <Package size={15} /> Stock principal
          </button>
          <button
            onClick={() => setTab('abroad')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${tab === 'abroad' ? 'bg-[#4f6ef7] text-white shadow-lg shadow-[rgba(79,110,247,0.3)]' : 'text-[#8892aa] hover:text-[#f0f2f8]'}`}
          >
            <Globe size={15} /> Saisie Étranger
            <span className="bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded-md font-medium">3</span>
          </button>
        </div>

        {tab === 'stock' ? (
          <ProductTable
            onAddProduct={() => setShowAdd(true)}
            onEditProduct={(p) => setEditProduct(p)}
            refreshKey={refreshKey}
          />
        ) : (
          <AbroadBatchEntry />
        )}
      </div>

      <AddProductModal
        isOpen={showAdd || !!editProduct}
        onClose={() => { setShowAdd(false); setEditProduct(null) }}
        product={editProduct}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  )
}
