'use client'
import { useEffect, useState } from 'react'
import { ArrowRight, Minus, Plus, Search, ShoppingCart, Tag, Trash2, User } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
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
  const [showMobileCart, setShowMobileCart] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const {
    cart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    discount,
    setDiscount,
    getSubtotal,
    getTotal,
    customerName,
    customerPhone,
    setCustomer,
  } = useSalesStore()

  useEffect(() => {
    setLoadingProducts(true)
    getProducts()
      .then((data) => setProducts(data.filter((product) => product.status === 'active' && product.quantity > 0)))
      .catch(console.error)
      .finally(() => setLoadingProducts(false))
  }, [refreshKey])

  useEffect(() => {
    if (cart.length === 0) {
      setShowMobileCart(false)
    }
  }, [cart.length])

  const filtered = products.filter((product) =>
    product.name.toLowerCase().includes(search.toLowerCase()) ||
    (product.sku?.toLowerCase() ?? '').includes(search.toLowerCase())
  )

  const subtotal = getSubtotal()
  const total = getTotal()
  const discountAmount = subtotal * discount / 100
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)

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

  const handleCheckout = () => {
    setShowMobileCart(false)
    onCheckout()
  }

  const renderCartContent = (mode: 'desktop' | 'mobile') => (
    <>
      <div className="flex items-center gap-2">
        <ShoppingCart size={16} className="text-[#6C5CE7]" />
        <h3 className="text-sm font-semibold text-[#1A3636]">Panier</h3>
        <Badge variant="purple">{cart.length} article(s)</Badge>
      </div>

      <Input
        placeholder="Nom du client (optionnel)"
        value={customerName}
        onChange={(event) => setCustomer(event.target.value, customerPhone)}
        leftAddon={<User size={14} />}
      />

      <div className={mode === 'mobile' ? 'max-h-[38dvh] space-y-2 overflow-y-auto pr-1' : 'flex-1 space-y-2 overflow-y-auto'}>
        {cart.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center text-[#6B7682]">
            <ShoppingCart size={28} className="mb-2 opacity-40" />
            <p className="text-xs">Selectionnez des produits</p>
          </div>
        ) : (
          cart.map((item) => (
            <div key={item.product_id} className="flex items-center gap-2 rounded-xl bg-[#F4F7FB] p-2">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#2D7D7D]/[0.08] bg-white">
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image_url} alt={item.product_name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm">📦</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-[#1A3636]">{item.product_name}</p>
                <p className="text-xs text-[#6B7682]">{formatCurrency(item.unit_price)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => item.quantity > 1 ? updateCartQuantity(item.product_id, item.quantity - 1) : removeFromCart(item.product_id)}
                  className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#2D7D7D]/[0.08] text-[#1A3636] transition-colors hover:bg-[#2D7D7D]/[0.14]"
                >
                  <Minus size={11} />
                </button>
                <span className="w-5 text-center text-xs font-medium text-[#1A3636]">{item.quantity}</span>
                <button
                  onClick={() => updateCartQuantity(item.product_id, item.quantity + 1)}
                  className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#2D7D7D]/[0.08] text-[#1A3636] transition-colors hover:bg-[#2D7D7D]/[0.14]"
                  disabled={item.quantity >= item.max_quantity}
                >
                  <Plus size={11} />
                </button>
                <button
                  onClick={() => removeFromCart(item.product_id)}
                  className="ml-1 flex h-6 w-6 items-center justify-center rounded-lg text-[#6B7682] transition-colors hover:bg-red-500/10 hover:text-red-500"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-2">
        <Tag size={14} className="flex-shrink-0 text-[#6B7682]" />
        <input
          type="number"
          min="0"
          max="100"
          placeholder="Remise %"
          value={discount || ''}
          onChange={(event) => setDiscount(Number(event.target.value))}
          className="h-9 flex-1 rounded-full border border-[#2D7D7D]/[0.14] bg-white px-3 text-xs text-[#1A3636] placeholder:text-[#6B7682] transition-all focus:border-[#6C5CE7]/60"
        />
      </div>

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
        <div className="flex justify-between pt-1 text-sm font-bold text-[#1A3636]">
          <span>Total</span>
          <span className="text-[#6C5CE7]">{formatCurrency(total)}</span>
        </div>
      </div>

      <Button
        variant="primary"
        fullWidth
        size="lg"
        disabled={cart.length === 0}
        onClick={handleCheckout}
      >
        Encaisser
      </Button>
    </>
  )

  return (
    <>
      <div className="flex flex-col gap-4 lg:h-[calc(100dvh-8rem)] lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-4 pb-24 lg:min-h-0 lg:pb-0">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 z-10 -translate-y-1/2 text-[#6B7682]" />
            <input
              type="text"
              placeholder="Rechercher un produit..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-12 w-full rounded-full border border-[#2D7D7D]/[0.14] bg-white pl-10 pr-4 text-sm text-[#1A3636] placeholder:text-[#6B7682] transition-all focus:border-[#6C5CE7]/60 focus:shadow-[0_0_0_4px_rgba(108,92,231,0.10)]"
            />
          </div>

          {loadingProducts ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((index) => (
                <div key={index} className="rounded-xl border border-[#2D7D7D]/[0.07] bg-white p-2 animate-pulse">
                  <div className="mb-1.5 h-14 w-full rounded-lg bg-[#2D7D7D]/[0.08]" />
                  <div className="mb-1 h-2.5 w-3/4 rounded bg-[#2D7D7D]/[0.08]" />
                  <div className="h-3 w-1/2 rounded bg-[#2D7D7D]/[0.08]" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid flex-1 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4 lg:grid-cols-5">
              {filtered.map((product) => {
                const inCart = cart.find((current) => current.product_id === product.id)
                const remaining = Math.max(0, product.quantity - (inCart?.quantity ?? 0))

                return (
                  <button
                    key={product.id}
                    onClick={() => handleAddToCart(product)}
                    disabled={remaining === 0}
                    className="group relative rounded-xl border border-[#2D7D7D]/[0.07] bg-white p-2 text-left transition-all hover:border-[#6C5CE7]/30 hover:bg-[#6C5CE7]/[0.04] hover:shadow-[0_4px_12px_rgba(26,54,54,0.07)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-[#2D7D7D]/[0.07] disabled:hover:bg-white disabled:hover:shadow-none"
                  >
                    {inCart && (
                      <div className="absolute right-1.5 top-1.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-[#6C5CE7]">
                        <span className="text-[9px] font-bold text-white">{inCart.quantity}</span>
                      </div>
                    )}
                    <div className="mb-1.5 flex h-14 w-full items-center justify-center overflow-hidden rounded-lg bg-[#E8F4F2]">
                      {product.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-lg">📦</span>
                      )}
                    </div>
                    <p className="line-clamp-2 text-[11px] font-medium leading-tight text-[#1A3636]">{product.name}</p>
                    <p className="mt-0.5 text-xs font-bold text-[#6C5CE7]">{formatCurrency(product.selling_price)}</p>
                    <p className={`text-[9px] ${remaining === 0 ? 'text-red-600' : 'text-[#6B7682]'}`}>
                      {remaining === 0 ? 'Stock epuise' : `Reste: ${remaining}`}
                    </p>
                  </button>
                )
              })}

              {filtered.length === 0 && !loadingProducts && (
                <div className="col-span-full py-16 text-center text-[#6B7682]">
                  <ShoppingCart size={32} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Aucun produit disponible</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="hidden lg:flex lg:w-80 lg:flex-col lg:gap-3 lg:rounded-2xl lg:border lg:border-[#2D7D7D]/[0.07] lg:bg-white lg:p-4 lg:shadow-[0_6px_20px_rgba(26,54,54,0.06)]">
          {renderCartContent('desktop')}
        </div>
      </div>

      {cart.length > 0 && (
        <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 -mt-2 lg:hidden">
          <button
            type="button"
            onClick={() => setShowMobileCart(true)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[#2D7D7D]/[0.08] bg-white px-4 py-3 shadow-[0_12px_28px_rgba(26,54,54,0.12)]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[#6C5CE7]/10 text-[#6C5CE7]">
                <ShoppingCart size={18} />
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-semibold text-[#1A3636]">{itemCount} article(s) dans le panier</p>
                <p className="text-xs text-[#6B7682]">Touchez pour modifier puis encaisser</p>
              </div>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <span className="text-sm font-bold text-[#6C5CE7]">{formatCurrency(total)}</span>
              <ArrowRight size={16} className="text-[#6C5CE7]" />
            </div>
          </button>
        </div>
      )}

      <Modal
        isOpen={showMobileCart}
        onClose={() => setShowMobileCart(false)}
        title="Panier"
        size="md"
      >
        <div className="flex flex-col gap-3">
          {renderCartContent('mobile')}
        </div>
      </Modal>
    </>
  )
}
