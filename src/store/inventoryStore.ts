import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product, AbroadProduct, Category, Supplier } from '@/types'
import { saveAbroadProductsLocally } from '@/lib/utils'

interface InventoryState {
  products: Product[]
  abroadProducts: AbroadProduct[]
  categories: Category[]
  suppliers: Supplier[]
  searchQuery: string
  selectedCategory: string | null
  isLoading: boolean
  setProducts: (products: Product[]) => void
  addProduct: (product: Product) => void
  updateProduct: (id: string, updates: Partial<Product>) => void
  deleteProduct: (id: string) => void
  setAbroadProducts: (products: AbroadProduct[]) => void
  addAbroadProduct: (product: AbroadProduct) => void
  updateAbroadProduct: (id: string, updates: Partial<AbroadProduct>) => void
  deleteAbroadProduct: (id: string) => void
  setCategories: (categories: Category[]) => void
  setSuppliers: (suppliers: Supplier[]) => void
  setSearchQuery: (query: string) => void
  setSelectedCategory: (id: string | null) => void
  setLoading: (loading: boolean) => void
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set) => ({
      products: [],
      abroadProducts: [],
      categories: [],
      suppliers: [],
      searchQuery: '',
      selectedCategory: null,
      isLoading: false,
      setProducts: (products) => set({ products }),
      addProduct: (product) => set((state) => ({ products: [product, ...state.products] })),
      updateProduct: (id, updates) =>
        set((state) => ({
          products: state.products.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),
      deleteProduct: (id) =>
        set((state) => ({ products: state.products.filter((p) => p.id !== id) })),
      setAbroadProducts: (abroadProducts) => {
        saveAbroadProductsLocally(abroadProducts)
        set({ abroadProducts })
      },
      addAbroadProduct: (product) =>
        set((state) => {
          const updated = [product, ...state.abroadProducts]
          saveAbroadProductsLocally(updated)
          return { abroadProducts: updated }
        }),
      updateAbroadProduct: (id, updates) =>
        set((state) => {
          const updated = state.abroadProducts.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          )
          saveAbroadProductsLocally(updated)
          return { abroadProducts: updated }
        }),
      deleteAbroadProduct: (id) =>
        set((state) => {
          const updated = state.abroadProducts.filter((p) => p.id !== id)
          saveAbroadProductsLocally(updated)
          return { abroadProducts: updated }
        }),
      setCategories: (categories) => set({ categories }),
      setSuppliers: (suppliers) => set({ suppliers }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'saytu-inventory',
      partialize: (state) => ({ abroadProducts: state.abroadProducts }),
    }
  )
)
