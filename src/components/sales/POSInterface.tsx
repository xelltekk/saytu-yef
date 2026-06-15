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
  refreshKey?: number
}

export function POSInterface({ onCheckout, refreshKey }: POSInterfaceProps) {
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const { cart, addToCart, removeFromCart, updateCartQuantity, discount, setDiscount, getSubtotal, getTotal, customerName, setCustomer } = useSalesStore()

  useEffect(() => {
    setLoadingProducts(true)
    getProducts()
      .then((data) => setProducts(data.filter((p) => p.status === 'active' && p.quantity > 0)))
      .catch(console.error)
      .finally(() => setLoadingProducts(false))
  }, [refreshKey])

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku?.toLowerCase() ?? '').includes(search.toLowerCase())
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
      image_url: product.image_url,
    }
    addToCart(item)
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100dvh-8rem)]">
      {/* Products panel */}
      <div className="flex-1 flex flex-col gap-4 min-w-0 lg:min-h-0">
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B7682] z-10" />
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-12 pl-10 pr-4 rounded-full bg-white border border-[#2D7D7D]/[0.14] text-sm text-[#1A3636] placeholder:text-[#6B7682] focus:border-[#6C5CE7]/60 focus:shadow-[0_0_0_4px_rgba(108,92,231,0.10)] transition-all"
          />
        </div>

        {loadingProducts ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <div key={i} className="p-2 rounded-xl border border-[#2D7D7D]/[0.07] bg-white animate-pulse">
                <div className="w-full h-14 rounded-lg bg-[#2D7D7D]/[0.08] mb-1.5" />
                <div className="h-2.5 bg-[#2D7D7D]/[0.08] rounded w-3/4 mb-1" />
                <div className="h-3 bg-[#2D7D7D]/[0.08] rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 overflow-y-auto flex-1 pr-1">
            {filtered.map((product) => {
              const inCart = cart.find((c) => c.product_id === product.id)
              const remaining = Math.max(0, product.quantity - (inCart?.quantity ?? 0))
              return (
                <button
                  key={product.id}
                  onClick={() => handleAddToCart(product)}
                  disabled={remaining === 0}
                  className="relative p-2 rounded-xl border border-[#2D7D7D]/[0.07] bg-white hover:border-[#6C5CE7]/30 hover:bg-[#6C5CE7]/[0.04] hover:shadow-[0_4px_12px_rgba(26,54,54,0.07)] transition-all text-left group active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-[#2D7D7D]/[0.07] disabled:hover:bg-white disabled:hover:shadow-none"
                >
                  {inCart && (
                    <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#6C5CE7] flex items-center justify-center z-10">
                      <span className="text-[9px] text-white font-bold">{inCart.quantity}</span>
                    </div>
                  )}
                  <div className="w-full h-14 rounded-lg bg-[#E8F4F2] flex items-center justify-center mb-1.5 overflow-hidden">
                    {product.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg">📦</span>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-[#1A3636] leading-tight line-clamp-2">{product.name}</p>
                  <p className="text-xs font-bold text-[#6C5CE7] mt-0.5">{formatCurrency(product.selling_price)}</p>
                  <p className={`text-[9px] ${remaining === 0 ? 'text-red-600' : 'text-[#6B7682]'}`}>
                    {remaining === 0 ? 'Stock épuisé' : `Reste: ${remaining}`}
                  </p>
                </button>
              )
            })}
            {filtered.length === 0 && !loadingProducts && (
              <div className="col-span-full text-center py-16 text-[#6B7682]">
                <ShoppingCart size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">Aucun produit disponible</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cart panel */}
      <div className="lg:w-80 flex flex-col gap-3 rounded-2xl border border-[#2D7D7D]/[0.07] bg-white p-4 shadow-[0_6px_20px_rgba(26,54,54,0.06)]">
        <div className="flex items-center gap-2">
          <ShoppingCart size={16} className="text-[#6C5CE7]" />
          <h3 className="text-sm font-semibold text-[#1A3636]">Panier</h3>
          <Badge variant="purple">{cart.length} article(s)</Badge>
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
            <div className="flex flex-col items-center justify-center h-32 text-[#6B7682]">
              <ShoppingCart size={28} className="mb-2 opacity-40" />
              <p className="text-xs">Sélectionnez des produits</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product_id} className="flex items-center gap-2 p-2 rounded-xl bg-[#F4F7FB]">
                <div className="w-8 h-8 rounded-lg bg-white border border-[#2D7D7D]/[0.08] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm">📦</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#1A3636] truncate">{item.product_name}</p>
                  <p className="text-xs text-[#6B7682]">{formatCurrency(item.unit_price)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => item.quantity > 1 ? updateCartQuantity(item.product_id, item.quantity - 1) : removeFromCart(item.product_id)}
                    className="w-6 h-6 rounded-lg bg-[#2D7D7D]/[0.08] text-[#1A3636] flex items-center justify-center hover:bg-[#2D7D7D]/[0.14] transition-colors"
                  >
                    <Minus size={11} />
                  </button>
                  <span className="text-xs font-medium text-[#1A3636] w-5 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateCartQuantity(item.product_id, item.quantity + 1)}
                    className="w-6 h-6 rounded-lg bg-[#2D7D7D]/[0.08] text-[#1A3636] flex items-center justify-center hover:bg-[#2D7D7D]/[0.14] transition-colors"
                    disabled={item.quantity >= item.max_quantity}
                  >
                    <Plus size={11} />
                  </button>
                  <button
                    onClick={() => removeFromCart(item.product_id)}
                    className="w-6 h-6 rounded-lg hover:bg-red-500/10 text-[#6B7682] hover:text-red-500 flex items-center justify-center ml-1 transition-colors"
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
          <Tag size={14} className="text-[#6B7682] flex-shrink-0" />
          <input
            type="number"
            min="0" max="100"
            placeholder="Remise %"
            value={discount || ''}
            onChange={(e) => setDiscount(Number(e.target.value))}
            className="flex-1 h-9 px-3 rounded-full bg-white border border-[#2D7D7D]/[0.14] text-xs text-[#1A3636] placeholder:text-[#6B7682] focus:border-[#6C5CE7]/60 transition-all"
          />
        </div>

        {/* Totals */}
        <div className="space-y-1.5 border-t border-[#2D7D7D]/[0.07] pt-3">
          <div className="flex justify-between text-xs text-[#5C6B73]">
            <span>Sous-total</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-xs text-emerald-600">
              <span>Remise ({discount}%)</span>
              <span>-{formatCurrency(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold text-[#1A3636] pt-1">
            <span>Total</span>
            <span className="text-[#6C5CE7]">{formatCurrency(total)}</span>
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
