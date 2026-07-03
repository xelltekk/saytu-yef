'use client'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Minus, Phone, Plus, Search, ShoppingCart, Tag, Trash2, User } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils'
import { useSalesStore } from '@/store/salesStore'
import { getProducts } from '@/lib/supabase/queries'
import { useUser } from '@/hooks/useUser'
import type { CartItem, Product } from '@/types'

interface POSInterfaceProps {
  onCheckout: () => void
  refreshKey?: number
}

const PAYMENT_METHOD_CHIPS = [
  { id: 'cash', label: 'Especes' },
  { id: 'wave', label: 'Wave' },
  { id: 'orange_money', label: 'Orange Money' },
  { id: 'card', label: 'Carte' },
] as const

export function POSInterface({ onCheckout, refreshKey }: POSInterfaceProps) {
  const { user } = useUser()
  const restoredDraftNoticeShown = useRef(false)
  const [isDraftReady, setIsDraftReady] = useState(false)
  const [search, setSearch] = useState('')
  const [showMobileCart, setShowMobileCart] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [productsError, setProductsError] = useState('')
  const [stockNotice, setStockNotice] = useState('')
  const [currencyNotice, setCurrencyNotice] = useState('')
  const [showClearCartConfirm, setShowClearCartConfirm] = useState(false)
  const {
    draftOwnerId,
    cart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    syncCartStock,
    discount,
    setDiscount,
    taxRate,
    setTaxRate,
    getSubtotal,
    getTotal,
    customerName,
    customerPhone,
    setCustomer,
    paymentMethod,
    setPaymentMethod,
    setDraftOwner,
    clearCart,
  } = useSalesStore()

  useEffect(() => {
    setIsDraftReady(true)
  }, [])

  useEffect(() => {
    if (!user?.id) return
    if (draftOwnerId === user.id) return
    if (draftOwnerId) clearCart()
    setDraftOwner(user.id)
  }, [clearCart, draftOwnerId, setDraftOwner, user?.id])

  useEffect(() => {
    setTaxRate(user?.user_metadata?.tva_enabled ? 18 : 0)
  }, [setTaxRate, user])

  useEffect(() => {
    setLoadingProducts(true)
    setProductsError('')
    getProducts()
      .then((data) => {
        const activeProducts = data.filter((product) => product.status === 'active' && product.quantity > 0)
        const availableProducts = activeProducts.filter((product) => product.currency === 'XOF')
        const excludedCurrencyCount = activeProducts.length - availableProducts.length
        const currentCart = useSalesStore.getState().cart
        const productMap = new Map(availableProducts.map((product) => [product.id, product]))
        const removedCount = currentCart.filter((item) => !productMap.has(item.product_id)).length
        const reducedCount = currentCart.filter((item) => {
          const product = productMap.get(item.product_id)
          return product && item.quantity > product.quantity
        }).length

        setProducts(availableProducts)
        setCurrencyNotice(
          excludedCurrencyCount > 0
            ? `${excludedCurrencyCount} produit(s) hors FCFA masqué(s) pour éviter de mélanger les devises à la caisse.`
            : ''
        )
        syncCartStock(availableProducts)
        const notices: string[] = []
        if (currentCart.length > 0 && !restoredDraftNoticeShown.current) {
          notices.push('Votre panier en cours a été restauré.')
          restoredDraftNoticeShown.current = true
        }
        if (removedCount > 0) notices.push(`${removedCount} article(s) indisponible(s) retiré(s) du panier.`)
        else if (reducedCount > 0) notices.push(`${reducedCount} quantité(s) ajustée(s) au stock disponible.`)
        setStockNotice(notices.join(' '))
      })
      .catch((error: unknown) => {
        console.error(error)
        setProductsError(error instanceof Error ? error.message : 'Impossible de charger les produits')
      })
      .finally(() => setLoadingProducts(false))
  }, [refreshKey, syncCartStock])

  useEffect(() => {
    if (cart.length === 0) {
      setShowMobileCart(false)
    }
  }, [cart.length])

  const filtered = products.filter((product) =>
    product.name.toLowerCase().includes(search.toLowerCase()) ||
    (product.sku?.toLowerCase() ?? '').includes(search.toLowerCase())
  )

  const activeCart = isDraftReady ? cart : []
  const activeDiscount = isDraftReady ? discount : 0
  const activeCustomerName = isDraftReady ? customerName : ''
  const activeCustomerPhone = isDraftReady ? customerPhone : ''
  const activePaymentMethod = isDraftReady ? paymentMethod : 'cash'
  const subtotal = isDraftReady ? getSubtotal() : 0
  const total = isDraftReady ? getTotal() : 0
  const discountAmount = subtotal * activeDiscount / 100
  const taxAmount = (subtotal - discountAmount) * taxRate / 100
  const itemCount = activeCart.reduce((sum, item) => sum + item.quantity, 0)
  const selectedPaymentMethod = PAYMENT_METHOD_CHIPS.find((option) => option.id === activePaymentMethod) ?? PAYMENT_METHOD_CHIPS[0]
  const hasCartContext = itemCount > 0 || activeCustomerName.trim() || activeCustomerPhone.trim() || activeDiscount > 0
  const cartSummaryPills = [
    itemCount > 0 ? `${itemCount} article(s)` : '',
    activeCustomerName.trim() || activeCustomerPhone.trim() ? (activeCustomerName.trim() || activeCustomerPhone.trim()) : '',
    activeDiscount > 0 ? `Remise ${activeDiscount}%` : '',
    `Mode ${selectedPaymentMethod.label}`,
  ].filter(Boolean)

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

  const requestClearCart = () => {
    setShowMobileCart(false)
    setShowClearCartConfirm(true)
  }

  const renderCartContent = (mode: 'desktop' | 'mobile') => (
    <>
      {mode === 'desktop' && (
        <div className="flex items-center gap-2">
          <ShoppingCart size={16} className="text-[#6C5CE7]" />
          <h3 className="text-sm font-semibold text-[#1A3636]">Panier</h3>
          <Badge variant="purple">{activeCart.length} article(s)</Badge>
          {activeCart.length > 0 && (
            <button type="button" onClick={requestClearCart} className="ml-auto text-[11px] font-semibold text-red-600 hover:text-red-700">
              Vider
            </button>
          )}
        </div>
      )}

      <div className="grid gap-3">
        <Input
          placeholder="Nom du client (optionnel)"
          value={activeCustomerName}
          onChange={(event) => setCustomer(event.target.value, activeCustomerPhone)}
          leftAddon={<User size={14} />}
        />
        <Input
          placeholder="Telephone client"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={activeCustomerPhone}
          onChange={(event) => setCustomer(activeCustomerName, event.target.value)}
          leftAddon={<Phone size={14} />}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Mode prefere</p>
          <span className="text-[11px] font-medium text-[#6B7682]">{selectedPaymentMethod.label}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_METHOD_CHIPS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setPaymentMethod(option.id)}
              className={`min-h-10 rounded-2xl border px-3 text-xs font-semibold transition-all ${
                activePaymentMethod === option.id
                  ? 'border-[#6C5CE7] bg-[#6C5CE7]/10 text-[#6C5CE7]'
                  : 'border-[#2D7D7D]/[0.1] bg-[#F4F7FB] text-[#5C6B73] hover:border-[#6C5CE7]/30 hover:text-[#1A3636]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className={mode === 'mobile' ? 'max-h-[38dvh] space-y-2 overflow-y-auto pr-1' : 'flex-1 space-y-2 overflow-y-auto'}>
        {activeCart.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center text-[#6B7682]">
            <ShoppingCart size={28} className="mb-2 opacity-40" />
            <p className="text-xs">Selectionnez des produits</p>
          </div>
        ) : (
          activeCart.map((item) => mode === 'mobile' ? (
            <article key={item.product_id} className="rounded-xl bg-[#F4F7FB] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#2D7D7D]/[0.08] bg-white">
                  {item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image_url} alt={item.product_name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-base">📦</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#1A3636]">{item.product_name}</p>
                  <p className="text-xs text-[#6B7682]">{formatCurrency(item.unit_price)} / unité</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFromCart(item.product_id)}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-[#6B7682] transition-colors active:bg-red-500/10 active:text-red-500"
                  aria-label={`Retirer ${item.product_name}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#2D7D7D]/[0.07] pt-3">
                <p className="text-sm font-semibold text-[#1A3636]">{formatCurrency(item.total)}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => item.quantity > 1 ? updateCartQuantity(item.product_id, item.quantity - 1) : removeFromCart(item.product_id)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#1A3636] shadow-sm"
                    aria-label={`Diminuer ${item.product_name}`}
                  >
                    <Minus size={15} />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold text-[#1A3636]">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateCartQuantity(item.product_id, item.quantity + 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#1A3636] shadow-sm disabled:opacity-35"
                    disabled={item.quantity >= item.max_quantity}
                    aria-label={`Augmenter ${item.product_name}`}
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>
            </article>
          ) : (
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
                  type="button"
                  onClick={() => item.quantity > 1 ? updateCartQuantity(item.product_id, item.quantity - 1) : removeFromCart(item.product_id)}
                  className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#2D7D7D]/[0.08] text-[#1A3636] transition-colors hover:bg-[#2D7D7D]/[0.14]"
                  aria-label={`Diminuer ${item.product_name}`}
                >
                  <Minus size={11} />
                </button>
                <span className="w-5 text-center text-xs font-medium text-[#1A3636]">{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => updateCartQuantity(item.product_id, item.quantity + 1)}
                  className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#2D7D7D]/[0.08] text-[#1A3636] transition-colors hover:bg-[#2D7D7D]/[0.14]"
                  disabled={item.quantity >= item.max_quantity}
                  aria-label={`Augmenter ${item.product_name}`}
                >
                  <Plus size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => removeFromCart(item.product_id)}
                  className="ml-1 flex h-6 w-6 items-center justify-center rounded-lg text-[#6B7682] transition-colors hover:bg-red-500/10 hover:text-red-500"
                  aria-label={`Retirer ${item.product_name}`}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {mode === 'mobile' && activeCart.length > 0 && (
        <button type="button" onClick={requestClearCart} className="min-h-10 text-xs font-semibold text-red-600">
          Vider tout le panier
        </button>
      )}

      <div className="flex items-center gap-2">
        <Tag size={14} className="flex-shrink-0 text-[#6B7682]" />
        <input
          type="number"
          min="0"
          max="100"
          placeholder="Remise %"
          value={activeDiscount || ''}
          onChange={(event) => setDiscount(Number(event.target.value))}
          aria-label="Remise en pourcentage"
          className="h-9 flex-1 rounded-full border border-[#2D7D7D]/[0.14] bg-white px-3 text-xs text-[#1A3636] placeholder:text-[#6B7682] transition-all focus:border-[#6C5CE7]/60"
        />
      </div>

      <div className="space-y-1.5 border-t border-[#2D7D7D]/[0.07] pt-3">
        {cartSummaryPills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pb-1">
            {cartSummaryPills.map((pill) => (
              <span
                key={pill}
                className="rounded-full bg-[#F4F7FB] px-2.5 py-1 text-[10px] font-semibold text-[#5C6B73]"
              >
                {pill}
              </span>
            ))}
          </div>
        )}
        <div className="flex justify-between text-xs text-[#5C6B73]">
          <span>Sous-total</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        {activeDiscount > 0 && (
          <div className="flex justify-between text-xs text-emerald-600">
            <span>Remise ({activeDiscount}%)</span>
            <span>-{formatCurrency(discountAmount)}</span>
          </div>
        )}
        {taxRate > 0 && (
          <div className="flex justify-between text-xs text-[#5C6B73]">
            <span>TVA ({taxRate}%)</span>
            <span>+{formatCurrency(taxAmount)}</span>
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
        disabled={activeCart.length === 0}
        onClick={handleCheckout}
      >
        Encaisser
      </Button>
    </>
  )

  return (
    <>
      <div className="flex flex-col gap-4 lg:h-[calc(100dvh-8rem)] lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-4 pb-28 lg:min-h-0 lg:pb-0">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 z-10 -translate-y-1/2 text-[#6B7682]" />
            <input
              type="search"
              aria-label="Rechercher un produit"
              placeholder="Rechercher un produit..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-12 w-full rounded-full border border-[#2D7D7D]/[0.14] bg-white pl-10 pr-4 text-sm text-[#1A3636] placeholder:text-[#6B7682] transition-all focus:border-[#6C5CE7]/60 focus:shadow-[0_0_0_4px_rgba(108,92,231,0.10)]"
            />
          </div>

          {hasCartContext && (
            <>
              <div className="flex flex-wrap gap-2 sm:hidden">
                <span className="rounded-full border border-[#2D7D7D]/[0.08] bg-white px-3 py-1.5 text-xs font-semibold text-[#1A3636]">
                  {itemCount} article(s)
                </span>
                <span className="rounded-full border border-[#6C5CE7]/10 bg-[#6C5CE7]/[0.04] px-3 py-1.5 text-xs font-semibold text-[#6C5CE7]">
                  {formatCurrencyCompact(total)}
                </span>
                <span className="max-w-full truncate rounded-full border border-[#2D7D7D]/[0.08] bg-white px-3 py-1.5 text-xs font-semibold text-[#1A3636]">
                  {activeCustomerName.trim() || activeCustomerPhone.trim() || 'Client comptoir'}
                </span>
                <span className="rounded-full border border-[#2D7D7D]/[0.08] bg-white px-3 py-1.5 text-xs font-semibold text-[#5C6B73]">
                  {selectedPaymentMethod.label}
                </span>
                {activeDiscount > 0 && (
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                    Remise {activeDiscount}%
                  </span>
                )}
              </div>

              <div className="hidden grid-cols-2 gap-2 sm:grid sm:grid-cols-4">
                <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Panier</p>
                  <p className="mt-1 text-sm font-bold text-[#1A3636]">{itemCount} article(s)</p>
                </div>
                <div className="rounded-2xl border border-[#6C5CE7]/10 bg-[#6C5CE7]/[0.04] px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Total</p>
                  <p className="mt-1 text-sm font-bold text-[#6C5CE7]">{formatCurrency(total)}</p>
                </div>
                <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Client</p>
                  <p className="mt-1 truncate text-sm font-semibold text-[#1A3636]">
                    {activeCustomerName.trim() || activeCustomerPhone.trim() || 'Comptoir'}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Mode</p>
                  <p className="mt-1 truncate text-sm font-semibold text-[#1A3636]">{selectedPaymentMethod.label}</p>
                </div>
              </div>
            </>
          )}

          {productsError && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-600">
              {productsError}
            </div>
          )}
          {currencyNotice && (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-[#2D7D7D]/15 bg-[#2D7D7D]/5 px-3 py-2.5 text-xs text-[#2D7D7D]">
              <span>{currencyNotice}</span>
              <button type="button" onClick={() => setCurrencyNotice('')} className="font-semibold">Fermer</button>
            </div>
          )}
          {stockNotice && (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700">
              <span>{stockNotice}</span>
              <button type="button" onClick={() => setStockNotice('')} className="font-semibold">Fermer</button>
            </div>
          )}

          {loadingProducts ? (
            <div className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((index) => (
                <div key={index} className="rounded-xl border border-[#2D7D7D]/[0.07] bg-white p-2 animate-pulse">
                  <div className="mb-1.5 h-14 w-full rounded-lg bg-[#2D7D7D]/[0.08]" />
                  <div className="mb-1 h-2.5 w-3/4 rounded bg-[#2D7D7D]/[0.08]" />
                  <div className="h-3 w-1/2 rounded bg-[#2D7D7D]/[0.08]" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto pr-1 min-[420px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-5">
              {filtered.map((product) => {
                const inCart = activeCart.find((current) => current.product_id === product.id)
                const remaining = Math.max(0, product.quantity - (inCart?.quantity ?? 0))

                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleAddToCart(product)}
                    disabled={remaining === 0}
                    aria-label={remaining === 0 ? `${product.name}, stock épuisé` : `Ajouter ${product.name} au panier, ${remaining} disponible(s)`}
                    className="group relative rounded-xl border border-[#2D7D7D]/[0.07] bg-white p-2 text-left transition-all hover:border-[#6C5CE7]/30 hover:bg-[#6C5CE7]/[0.04] hover:shadow-[0_4px_12px_rgba(26,54,54,0.07)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-[#2D7D7D]/[0.07] disabled:hover:bg-white disabled:hover:shadow-none"
                  >
                    {inCart && (
                      <div className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#6C5CE7]">
                        <span className="text-[9px] font-bold text-white">{inCart.quantity}</span>
                      </div>
                    )}
                    <div className="mb-2 flex h-20 w-full items-center justify-center overflow-hidden rounded-xl bg-[#E8F4F2] min-[420px]:h-16">
                      {product.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-lg">📦</span>
                      )}
                    </div>
                    <p className="line-clamp-2 text-xs font-semibold leading-tight text-[#1A3636] min-[420px]:text-[11px]">{product.name}</p>
                    <p className="mt-1 text-sm font-bold text-[#6C5CE7] min-[420px]:text-xs">
                      <span className="sm:hidden">{formatCurrencyCompact(product.selling_price)}</span>
                      <span className="hidden sm:inline">{formatCurrency(product.selling_price)}</span>
                    </p>
                    <p className={`mt-0.5 text-[10px] ${remaining === 0 ? 'text-red-600' : 'text-[#6B7682]'}`}>
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

      {activeCart.length > 0 && (
        <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 -mt-2 lg:hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-[28px] border border-[#2D7D7D]/[0.08] bg-white/95 p-3 shadow-[0_12px_28px_rgba(26,54,54,0.12)] backdrop-blur">
            <button
              type="button"
              onClick={() => setShowMobileCart(true)}
              aria-label={`Ouvrir le panier, ${itemCount} article(s), total ${formatCurrency(total)}`}
              className="flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-[#F4F7FB] px-3 py-3 text-left"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[#6C5CE7]/10 text-[#6C5CE7]">
                  <ShoppingCart size={18} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#1A3636]">{itemCount} article(s)</p>
                  <p className="truncate text-xs text-[#6B7682]">
                    {activeCustomerName.trim() || activeCustomerPhone.trim() || 'Client comptoir'} · {selectedPaymentMethod.label}
                  </p>
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <span className="text-sm font-bold text-[#6C5CE7]">{formatCurrency(total)}</span>
                <ArrowRight size={16} className="text-[#6C5CE7]" />
              </div>
            </button>
            <Button
              variant="primary"
              size="md"
              className="min-w-[132px] px-5"
              onClick={handleCheckout}
            >
              Encaisser
            </Button>
          </div>
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

      <Modal
        isOpen={showClearCartConfirm}
        onClose={() => setShowClearCartConfirm(false)}
        title="Vider le panier"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowClearCartConfirm(false)}>Annuler</Button>
            <Button
              variant="danger"
              onClick={() => {
                clearCart()
                setShowClearCartConfirm(false)
              }}
            >
              Vider le panier
            </Button>
          </>
        }
      >
        <p className="text-sm text-[#5C6B73]">
          Les {itemCount} article(s) du panier seront retirés. Cette action est irréversible.
        </p>
      </Modal>
    </>
  )
}
