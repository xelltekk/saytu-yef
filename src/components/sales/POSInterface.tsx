'use client'
import { useState, useEffect } from 'react'
import { Search, Plus, Minus, Trash2, ShoppingCart, Tag, User } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { useSalesStore } from '@/store/salesStore'
import { getProducts } from '@/lib/supabase/queries'
import type { CartItem, Product } from '@/types'

interface POSInterfaceProps {
  onCheckout: () => void
}

export function POSInterface({ onCheckout }: POSInterfaceProps) {
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const { cart, addToCart, removeFromCart, updateCartQuantity, discount, setDiscount, getSubtotal, getTotal, customerName, setCustomer } = useSalesStore()

  useEffect(() => {
    getProducts()
      .then((data) => setProducts(data.filter((p) => p.status === 'active' && p.quantity > 0)))
      .catch(console.error)
      .finally(() => setLoadingProducts(false))
  }, [])

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  )

  const subtotal = getSubtotal()
  const total = getTotal()
  const discountAmount = subtotal * discount / 100

  const handleAddToCart = (product: Product) => {
    const item: CartItem = {
      product_id: product.id,
      product_name: product.name,
      unit_price: product.selling_price,
      quantity: 1,
      total: product.selling_price,
      max_quantity: product.quantity,
    }
    addToCart(item)
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-8rem)]">
      {/* Products panel */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8892aa]" />
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-[#f0f2f8] placeholder:text-[#4a5568] focus:border-[#4f6ef7] transition-all"
          />
        </div>

        {loadingProducts ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="p-3 rounded-2xl border border-white/[0.06] bg-[#0d1120] animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-white/[0.06] mb-2" />
                <div className="h-3 bg-white/[0.06] rounded w-3/4 mb-1" />
                <div className="h-4 bg-white/[0.06] rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto flex-1 pr-1">
            {filtered.map((product) => {
              const inCart = cart.find((c) => c.product_id === product.id)
              return (
                <button
                  key={product.id}
                  onClick={() => handleAddToCart(product)}
                  className="relative p-3 rounded-2xl border border-white/[0.06] bg-[#0d1120] hover:border-[#4f6ef7]/30 hover:bg-[#4f6ef7]/5 transition-all text-left group active:scale-[0.98]"
                >
                  {inCart && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#4f6ef7] flex items-center justify-center">
                      <span className="text-[10px] text-white font-bold">{inCart.quantity}</span>
                    </div>
                  )}
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center mb-2 text-lg">
                    📦
                  </div>
                  <p className="text-xs font-medium text-[#f0f2f8] leading-snug line-clamp-2">{product.name}</p>
                  <p className="text-sm font-bold text-[#4f6ef7] mt-1">{formatCurrency(product.selling_price)}</p>
                  <p className="text-[10px] text-[#8892aa]">Stock: {product.quantity}</p>
                </button>
              )
            })}
            {filtered.length === 0 && !loadingProducts && (
              <div className="col-span-3 text-center py-16 text-[#8892aa]">
                <ShoppingCart size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Aucun produit disponible</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cart panel */}
      <div className="lg:w-80 flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-[#0d1120] p-4">
        <div className="flex items-center gap-2">
          <ShoppingCart size={16} className="text-[#4f6ef7]" />
          <h3 className="text-sm font-semibold text-[#f0f2f8]">Panier</h3>
          <Badge variant="info">{cart.length} article(s)</Badge>
        </div>

        {/* Customer */}
        <Input
          placeholder="Nom du client (optionnel)"
          value={customerName}
          onChange={(e) => setCustomer(e.target.value, '')}
          leftAddon={<User size={14} />}
        />

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-[#8892aa]">
              <ShoppingCart size={28} className="mb-2 opacity-30" />
              <p className="text-xs">Sélectionnez des produits</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product_id} className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03]">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#f0f2f8] truncate">{item.product_name}</p>
                  <p className="text-xs text-[#8892aa]">{formatCurrency(item.unit_price)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => item.quantity > 1 ? updateCartQuantity(item.product_id, item.quantity - 1) : removeFromCart(item.product_id)}
                    className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center hover:bg-white/[0.1] transition-colors"
                  >
                    <Minus size={11} />
                  </button>
                  <span className="text-xs font-medium text-[#f0f2f8] w-5 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateCartQuantity(item.product_id, item.quantity + 1)}
                    className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center hover:bg-white/[0.1] transition-colors"
                    disabled={item.quantity >= item.max_quantity}
                  >
                    <Plus size={11} />
                  </button>
                  <button
                    onClick={() => removeFromCart(item.product_id)}
                    className="w-6 h-6 rounded-lg hover:bg-red-500/10 text-[#8892aa] hover:text-red-400 flex items-center justify-center ml-1 transition-colors"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Discount */}
        <div className="flex items-center gap-2">
          <Tag size={14} className="text-[#8892aa] flex-shrink-0" />
          <input
            type="number"
            min="0" max="100"
            placeholder="Remise %"
            value={discount || ''}
            onChange={(e) => setDiscount(Number(e.target.value))}
            className="flex-1 h-8 px-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-[#f0f2f8] placeholder:text-[#4a5568] focus:border-[#4f6ef7] transition-all"
          />
        </div>

        {/* Totals */}
        <div className="space-y-1.5 border-t border-white/[0.06] pt-3">
          <div className="flex justify-between text-xs text-[#8892aa]">
            <span>Sous-total</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-xs text-emerald-400">
              <span>Remise ({discount}%)</span>
              <span>-{formatCurrency(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold text-[#f0f2f8] pt-1">
            <span>Total</span>
            <span className="text-[#4f6ef7]">{formatCurrency(total)}</span>
          </div>
        </div>

        <Button
          variant="primary"
          fullWidth
          size="lg"
          disabled={cart.length === 0}
          onClick={onCheckout}
        >
          Encaisser
        </Button>
      </div>
    </div>
  )
}
