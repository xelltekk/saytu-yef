'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  Minus,
  Package,
  Phone,
  Plus,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
  User,
} from 'lucide-react'
import { UsageLimitNotice } from '@/components/subscriptions/UsageLimitNotice'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import { useSubscriptionOverview } from '@/hooks/useSubscriptionOverview'
import { normalizeBarcodeValue } from '@/lib/barcodes'
import { getPlanDefinition, getUsageLimit, getUsageRatio } from '@/lib/subscriptions'
import { buildProductGroups, getProductGroupPriceLabel } from '@/lib/productGroups'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import {
  cn,
  formatCurrency,
  formatCurrencyCompact,
  formatProductLabel,
  getProductVariantSummary,
} from '@/lib/utils'
import { useSalesStore } from '@/store/salesStore'
import { getProducts } from '@/lib/supabase/queries'
import { useUser } from '@/hooks/useUser'
import type { CartItem, Product, ProductGroup } from '@/types'

interface POSInterfaceProps {
  onCheckout: () => void
  refreshKey?: number
  canCheckout?: boolean
  checkoutDisabledReason?: string
}

const PAYMENT_METHOD_CHIPS = [
  { id: 'cash', label: 'Especes' },
  { id: 'wave', label: 'Wave' },
  { id: 'orange_money', label: 'Orange Money' },
  { id: 'card', label: 'Carte' },
] as const

function summarizeValues(values: string[]) {
  if (values.length === 0) return ''
  if (values.length <= 3) return values.join(' · ')
  return `${values.slice(0, 2).join(' · ')} +${values.length - 2}`
}

function normalizeVariantOption(value?: string | null) {
  return value?.trim() ?? ''
}

export function POSInterface({
  onCheckout,
  refreshKey,
  canCheckout = true,
  checkoutDisabledReason = '',
}: POSInterfaceProps) {
  const { user } = useUser()
  const { overview } = useSubscriptionOverview()
  const restoredDraftNoticeShown = useRef(false)
  const [isDraftReady, setIsDraftReady] = useState(false)
  const [search, setSearch] = useState('')
  const [showMobileCart, setShowMobileCart] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [productsError, setProductsError] = useState('')
  const [stockNotice, setStockNotice] = useState('')
  const [currencyNotice, setCurrencyNotice] = useState('')
  const [scannerNotice, setScannerNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [showClearCartConfirm, setShowClearCartConfirm] = useState(false)
  const [variantPickerGroup, setVariantPickerGroup] = useState<ProductGroup | null>(null)
  const [selectedVariantSize, setSelectedVariantSize] = useState('')
  const [selectedVariantColor, setSelectedVariantColor] = useState('')
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
            ? `${excludedCurrencyCount} produit(s) hors FCFA masque(s) pour eviter de melanger les devises a la caisse.`
            : ''
        )
        syncCartStock(availableProducts)

        const notices: string[] = []
        if (currentCart.length > 0 && !restoredDraftNoticeShown.current) {
          notices.push('Votre panier en cours a ete restaure.')
          restoredDraftNoticeShown.current = true
        }
        if (removedCount > 0) notices.push(`${removedCount} article(s) indisponible(s) retire(s) du panier.`)
        else if (reducedCount > 0) notices.push(`${reducedCount} quantite(s) ajustee(s) au stock disponible.`)
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

  useEffect(() => {
    if (!scannerNotice) return
    const timeout = window.setTimeout(() => setScannerNotice(null), 3500)
    return () => window.clearTimeout(timeout)
  }, [scannerNotice])

  useEffect(() => {
    setSelectedVariantSize('')
    setSelectedVariantColor('')
  }, [variantPickerGroup?.id])

  const activeCart = useMemo(() => (isDraftReady ? cart : []), [cart, isDraftReady])
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
  const monthlySalesLimit = overview ? getUsageLimit(overview.plan, 'monthlySales') : null
  const monthlySalesCount = overview?.usage.monthlySales ?? 0
  const monthlySalesRatio = overview ? getUsageRatio(monthlySalesCount, monthlySalesLimit) : 0
  const isSalesLimitReached = !!monthlySalesLimit && monthlySalesCount >= monthlySalesLimit
  const isSalesLimitNear = !isSalesLimitReached && !!monthlySalesLimit && monthlySalesRatio >= 80
  const currentPlanName = overview ? getPlanDefinition(overview.plan).name : 'actuel'
  const checkoutBlockedBySession = !canCheckout && !isSalesLimitReached && checkoutDisabledReason.trim().length > 0
  const cartSummaryPills = [
    itemCount > 0 ? `${itemCount} article(s)` : '',
    activeCustomerName.trim() || activeCustomerPhone.trim() ? (activeCustomerName.trim() || activeCustomerPhone.trim()) : '',
    activeDiscount > 0 ? `Remise ${activeDiscount}%` : '',
    `Mode ${selectedPaymentMethod.label}`,
  ].filter(Boolean)

  const getRemainingQuantity = useCallback((product: Product) => {
    const inCart = activeCart.find((item) => item.product_id === product.id)?.quantity ?? 0
    return Math.max(0, product.quantity - inCart)
  }, [activeCart])

  const groupedProducts = useMemo(() => buildProductGroups(products), [products])

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr')

    return groupedProducts.filter((group) => {
      if (!query) return true

      return [
        group.name,
        group.category?.name,
        ...group.variants.flatMap((variant) => [variant.sku, variant.size, variant.color]),
      ]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase('fr').includes(query))
    })
  }, [groupedProducts, search])

  const variantPickerVariants = useMemo(() => {
    if (!variantPickerGroup) return []

    return variantPickerGroup.variants.filter((variant) => {
      const inCart = activeCart.find((item) => item.product_id === variant.id)?.quantity ?? 0
      return variant.quantity - inCart > 0
    })
  }, [activeCart, variantPickerGroup])

  const variantPickerSizes = useMemo(() => (
    Array.from(
      new Set(
        variantPickerVariants
          .map((variant) => normalizeVariantOption(variant.size))
          .filter(Boolean)
      )
    )
  ), [variantPickerVariants])

  const variantPickerColors = useMemo(() => (
    Array.from(
      new Set(
        variantPickerVariants
          .map((variant) => normalizeVariantOption(variant.color))
          .filter(Boolean)
      )
    )
  ), [variantPickerVariants])

  const enabledVariantSizes = useMemo(() => (
    new Set(
      variantPickerVariants
        .filter((variant) => !selectedVariantColor || normalizeVariantOption(variant.color) === selectedVariantColor)
        .map((variant) => normalizeVariantOption(variant.size))
        .filter(Boolean)
    )
  ), [selectedVariantColor, variantPickerVariants])

  const enabledVariantColors = useMemo(() => (
    new Set(
      variantPickerVariants
        .filter((variant) => !selectedVariantSize || normalizeVariantOption(variant.size) === selectedVariantSize)
        .map((variant) => normalizeVariantOption(variant.color))
        .filter(Boolean)
    )
  ), [selectedVariantSize, variantPickerVariants])

  const filteredVariantPickerVariants = useMemo(() => (
    variantPickerVariants.filter((variant) => {
      const variantSize = normalizeVariantOption(variant.size)
      const variantColor = normalizeVariantOption(variant.color)

      if (selectedVariantSize && variantSize !== selectedVariantSize) return false
      if (selectedVariantColor && variantColor !== selectedVariantColor) return false
      return true
    })
  ), [selectedVariantColor, selectedVariantSize, variantPickerVariants])

  const findProductByScanCode = useCallback((rawValue: string) => {
    const normalizedValue = normalizeBarcodeValue(rawValue).toLocaleLowerCase('fr')
    if (!normalizedValue) return null

    return products.find((product) => (
      product.status === 'active'
      && product.quantity > 0
      && product.currency === 'XOF'
      && (
        normalizeBarcodeValue(product.barcode || '').toLocaleLowerCase('fr') === normalizedValue
        || normalizeBarcodeValue(product.sku || '').toLocaleLowerCase('fr') === normalizedValue
      )
    )) ?? null
  }, [products])

  const handleAddToCart = useCallback((product: Product) => {
    const remaining = getRemainingQuantity(product)
    if (remaining <= 0) return

    const item: CartItem = {
      product_id: product.id,
      product_name: formatProductLabel(product),
      product_base_name: product.name,
      variant_label: getProductVariantSummary(product) || undefined,
      unit_price: product.selling_price,
      quantity: 1,
      total: product.selling_price,
      max_quantity: product.quantity,
      image_url: product.image_url,
      size: product.size,
      color: product.color,
      sku: product.sku,
      barcode: product.barcode,
    }
    addToCart(item)
  }, [addToCart, getRemainingQuantity])

  const handleBarcodeScan = useCallback((rawValue: string) => {
    const scannedValue = rawValue.trim()
    if (!scannedValue) return

    const matchedProduct = findProductByScanCode(scannedValue)
    if (!matchedProduct) {
      setSearch(scannedValue)
      setScannerNotice({
        type: 'error',
        message: `Code introuvable : ${scannedValue}. Verifiez le code-barres ou la reference du produit.`,
      })
      return
    }

    handleAddToCart(matchedProduct)
    setSearch('')
    setScannerNotice({
      type: 'success',
      message: `${formatProductLabel(matchedProduct)} ajoute au panier via scan.`,
    })
  }, [findProductByScanCode, handleAddToCart])

  useBarcodeScanner({
    enabled: !loadingProducts,
    onScan: handleBarcodeScan,
  })

  const handleSelectGroup = (group: ProductGroup) => {
    const availableVariants = group.variants.filter((variant) => getRemainingQuantity(variant) > 0)
    if (availableVariants.length === 0) return

    if (availableVariants.length === 1) {
      handleAddToCart(availableVariants[0])
      return
    }

    setVariantPickerGroup(group)
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
    <div className={cn('flex flex-col gap-3', mode === 'mobile' && 'min-h-[min(72dvh,34rem)]')}>
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

      {mode === 'mobile' && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#2D7D7D]/[0.08] bg-[#F4F7FB] px-3 py-2.5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Articles du panier</p>
            <p className="text-xs text-[#6B7682]">Ajustez les quantites avant encaissement.</p>
          </div>
          <Badge variant="purple">{itemCount} article(s)</Badge>
        </div>
      )}

      <div className={mode === 'mobile' ? 'min-h-0 flex-1 space-y-2 overflow-y-auto pr-1' : 'flex-1 space-y-2 overflow-y-auto'}>
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
                  <p className="truncate text-sm font-medium text-[#1A3636]">{item.product_base_name || item.product_name}</p>
                  {item.variant_label && (
                    <p className="truncate text-[11px] font-medium text-[#6C5CE7]">{item.variant_label}</p>
                  )}
                  <p className="text-xs text-[#6B7682]">{formatCurrency(item.unit_price)} / unite</p>
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
                <p className="truncate text-xs font-medium text-[#1A3636]">{item.product_base_name || item.product_name}</p>
                {item.variant_label && (
                  <p className="truncate text-[10px] font-medium text-[#6C5CE7]">{item.variant_label}</p>
                )}
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

      <div
        className={cn(
          'space-y-3 border-t border-[#2D7D7D]/[0.07] pt-3',
          mode === 'mobile' && 'mt-auto rounded-[24px] bg-white pb-[calc(env(safe-area-inset-bottom)+0.35rem)]'
        )}
      >
        {mode === 'mobile' && activeCart.length > 0 && (
          <button type="button" onClick={requestClearCart} className="min-h-10 text-xs font-semibold text-red-600">
            Vider tout le panier
          </button>
        )}

        {isSalesLimitReached && (
          <UsageLimitNotice
            tone="danger"
            compact
            title="Plafond de ventes atteint"
            detail={`Le plan ${currentPlanName} autorise ${monthlySalesLimit} vente(s) sur le mois. Passez a une formule superieure pour continuer a encaisser.`}
          />
        )}

        {isSalesLimitNear && monthlySalesLimit && (
          <UsageLimitNotice
            compact
            title="Plafond de ventes presque atteint"
            detail={`${monthlySalesCount} vente(s) enregistree(s) ce mois sur ${monthlySalesLimit}. Anticipez la suite depuis Abonnement.`}
          />
        )}

        {checkoutBlockedBySession && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-xs text-amber-700">
            {checkoutDisabledReason}
          </div>
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

        {cartSummaryPills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pb-1">
            {cartSummaryPills.map((pill) => (
              <span key={pill} className="rounded-full bg-[#F4F7FB] px-2.5 py-1 text-[10px] font-semibold text-[#5C6B73]">
                {pill}
              </span>
            ))}
          </div>
        )}

        <div className="space-y-1.5 rounded-2xl border border-[#2D7D7D]/[0.08] bg-[#F4F7FB] px-3 py-3">
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
          disabled={activeCart.length === 0 || isSalesLimitReached || !canCheckout}
          onClick={handleCheckout}
          title={
            isSalesLimitReached
              ? `Limite atteinte sur le plan ${currentPlanName}`
              : checkoutBlockedBySession
                ? checkoutDisabledReason
                : 'Encaisser'
          }
        >
          Encaisser
        </Button>
      </div>
    </div>
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
              placeholder="Rechercher ou scanner un code-barres..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return

                const matchedProduct = findProductByScanCode(search)
                if (!matchedProduct) return

                event.preventDefault()
                handleBarcodeScan(search)
              }}
              className="h-12 w-full rounded-full border border-[#2D7D7D]/[0.14] bg-white pl-10 pr-4 text-sm text-[#1A3636] placeholder:text-[#6B7682] transition-all focus:border-[#6C5CE7]/60 focus:shadow-[0_0_0_4px_rgba(108,92,231,0.10)]"
            />
          </div>

          <p className="-mt-2 text-[11px] text-[#6B7682]">
            Lecteur 2D compatible: scannez le code-barres ou la reference SKU d&apos;une variante pour l&apos;ajouter directement au panier.
          </p>

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

          {scannerNotice && (
            <div
              className={`flex items-start justify-between gap-3 rounded-xl px-3 py-2.5 text-xs ${
                scannerNotice.type === 'success'
                  ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-700'
                  : 'border border-red-500/20 bg-red-500/10 text-red-600'
              }`}
            >
              <span>{scannerNotice.message}</span>
              <button type="button" onClick={() => setScannerNotice(null)} className="font-semibold">Fermer</button>
            </div>
          )}

          {checkoutBlockedBySession && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700">
              {checkoutDisabledReason}
            </div>
          )}

          {loadingProducts ? (
            <div className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-5">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((index) => (
                <div key={index} className="rounded-xl border border-[#2D7D7D]/[0.07] bg-white p-2 animate-pulse">
                  <div className="mb-1.5 h-20 w-full rounded-lg bg-[#2D7D7D]/[0.08]" />
                  <div className="mb-1 h-2.5 w-3/4 rounded bg-[#2D7D7D]/[0.08]" />
                  <div className="h-3 w-1/2 rounded bg-[#2D7D7D]/[0.08]" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto pr-1 min-[420px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-5">
              {filteredGroups.map((group) => {
                const availableVariants = group.variants.filter((variant) => getRemainingQuantity(variant) > 0)
                const totalRemaining = availableVariants.reduce((sum, variant) => sum + getRemainingQuantity(variant), 0)
                const inCartCount = activeCart.reduce((sum, item) => (
                  sum + (group.variants.some((variant) => variant.id === item.product_id) ? item.quantity : 0)
                ), 0)
                const variantHint = [
                  group.sizes.length > 0 ? `Tailles: ${summarizeValues(group.sizes)}` : '',
                  group.colors.length > 0 ? `Couleurs: ${summarizeValues(group.colors)}` : '',
                ].filter(Boolean).join(' · ')
                const helperText = group.variant_count > 1
                  ? `${availableVariants.length}/${group.variant_count} variantes dispo · ${totalRemaining} unite(s)`
                  : totalRemaining === 0
                    ? 'Stock epuise'
                    : `Reste: ${totalRemaining}`

                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => handleSelectGroup(group)}
                    disabled={totalRemaining === 0}
                    aria-label={
                      totalRemaining === 0
                        ? `${group.name}, stock epuise`
                        : group.variant_count > 1
                          ? `Choisir une variante pour ${group.name}`
                          : `Ajouter ${group.name} au panier`
                    }
                    className="group relative rounded-xl border border-[#2D7D7D]/[0.07] bg-white p-2 text-left transition-all hover:border-[#6C5CE7]/30 hover:bg-[#6C5CE7]/[0.04] hover:shadow-[0_4px_12px_rgba(26,54,54,0.07)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-[#2D7D7D]/[0.07] disabled:hover:bg-white disabled:hover:shadow-none"
                  >
                    {inCartCount > 0 && (
                      <div className="absolute right-2 top-2 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#6C5CE7] px-1">
                        <span className="text-[9px] font-bold text-white">{inCartCount}</span>
                      </div>
                    )}

                    <div className="mb-2 flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-[#2D7D7D]/[0.08] bg-[#F8FAFD] p-2">
                      {group.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={group.image_url} alt={group.name} className="h-full w-full object-contain object-center" />
                      ) : (
                        <Package size={20} className="text-[#6B7682]" />
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="line-clamp-2 flex-1 text-xs font-semibold leading-tight text-[#1A3636] min-[420px]:text-[11px]">{group.name}</p>
                      {group.variant_count > 1 && (
                        <Badge variant="purple">{group.variant_count} variantes</Badge>
                      )}
                    </div>

                    {variantHint && (
                      <p className="mt-1 line-clamp-2 text-[10px] font-medium text-[#5A4BD4]">
                        {variantHint}
                      </p>
                    )}

                    <p className="mt-1 text-sm font-bold text-[#6C5CE7] min-[420px]:text-xs">
                      {getProductGroupPriceLabel(group)}
                    </p>
                    <p className={`mt-0.5 text-[10px] ${totalRemaining === 0 ? 'text-red-600' : 'text-[#6B7682]'}`}>
                      {helperText}
                    </p>
                  </button>
                )
              })}

              {filteredGroups.length === 0 && !loadingProducts && (
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
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-[28px] border border-[#2D7D7D]/[0.08] bg-white/95 p-2.5 shadow-[0_12px_28px_rgba(26,54,54,0.12)] backdrop-blur min-[400px]:gap-3 min-[400px]:p-3">
            <button
              type="button"
              onClick={() => setShowMobileCart(true)}
              aria-label={`Ouvrir le panier, ${itemCount} article(s), total ${formatCurrency(total)}`}
              className="flex min-w-0 items-center justify-between gap-2 rounded-2xl bg-[#F4F7FB] px-2.5 py-2.5 text-left min-[400px]:gap-3 min-[400px]:px-3 min-[400px]:py-3"
            >
              <div className="flex min-w-0 items-center gap-2 min-[400px]:gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-[#6C5CE7]/10 text-[#6C5CE7] min-[400px]:h-11 min-[400px]:w-11">
                  <ShoppingCart size={16} className="min-[400px]:h-[18px] min-[400px]:w-[18px]" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6B7682] min-[400px]:text-[11px]">A encaisser</p>
                  <p className="truncate text-[15px] font-bold leading-none text-[#6C5CE7] min-[400px]:text-base">
                    {formatCurrency(total)}
                  </p>
                </div>
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-0.5 text-right">
                <span className="text-[10px] font-semibold text-[#5C6B73] min-[400px]:text-[11px]">
                  {itemCount} article(s)
                </span>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-[#6C5CE7] min-[400px]:text-xs">
                  Details
                  <ArrowRight size={14} className="text-[#6C5CE7]" />
                </span>
              </div>
            </button>
            <Button
              variant="primary"
              size="md"
              className="min-w-[118px] px-4 text-[13px] min-[400px]:min-w-[132px] min-[400px]:px-5 min-[400px]:text-sm"
              onClick={handleCheckout}
              disabled={isSalesLimitReached || !canCheckout}
              title={
                isSalesLimitReached
                  ? `Limite atteinte sur le plan ${currentPlanName}`
                  : checkoutBlockedBySession
                    ? checkoutDisabledReason
                    : 'Encaisser'
              }
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
        footer={(
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
        )}
      >
        <p className="text-sm text-[#5C6B73]">
          Les {itemCount} article(s) du panier seront retires. Cette action est irreversible.
        </p>
      </Modal>

      <Modal
        isOpen={variantPickerGroup !== null}
        onClose={() => setVariantPickerGroup(null)}
        title={variantPickerGroup ? `Choisir une variante · ${variantPickerGroup.name}` : 'Choisir une variante'}
        size="md"
      >
        {variantPickerGroup && (
          <div className="space-y-3">
            <p className="text-sm text-[#6B7682]">
              Selectionnez la taille ou la couleur a encaisser pour utiliser le bon stock.
            </p>

            <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-[#F8FBFC] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">{filteredVariantPickerVariants.length} variante(s)</Badge>
                <Badge variant="purple">
                  {filteredVariantPickerVariants.reduce((sum, variant) => sum + getRemainingQuantity(variant), 0)} unite(s)
                </Badge>
                {(selectedVariantSize || selectedVariantColor) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVariantSize('')
                      setSelectedVariantColor('')
                    }}
                    className="text-xs font-semibold text-[#6C5CE7]"
                  >
                    Reinitialiser
                  </button>
                )}
              </div>

              {variantPickerSizes.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Taille</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedVariantSize('')}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                        selectedVariantSize === ''
                          ? 'border-[#6C5CE7] bg-[#6C5CE7]/10 text-[#6C5CE7]'
                          : 'border-[#2D7D7D]/[0.1] bg-white text-[#5C6B73]'
                      )}
                    >
                      Toutes
                    </button>
                    {variantPickerSizes.map((size) => {
                      const isEnabled = enabledVariantSizes.has(size)
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => {
                            setSelectedVariantSize(size)
                            if (
                              selectedVariantColor &&
                              !variantPickerVariants.some(
                                (variant) =>
                                  normalizeVariantOption(variant.size) === size &&
                                  normalizeVariantOption(variant.color) === selectedVariantColor
                              )
                            ) {
                              setSelectedVariantColor('')
                            }
                          }}
                          disabled={!isEnabled}
                          className={cn(
                            'rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                            selectedVariantSize === size
                              ? 'border-[#6C5CE7] bg-[#6C5CE7]/10 text-[#6C5CE7]'
                              : 'border-[#2D7D7D]/[0.1] bg-white text-[#5C6B73]',
                            !isEnabled && 'cursor-not-allowed opacity-35'
                          )}
                        >
                          {size}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {variantPickerColors.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Couleur</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedVariantColor('')}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                        selectedVariantColor === ''
                          ? 'border-[#6C5CE7] bg-[#6C5CE7]/10 text-[#6C5CE7]'
                          : 'border-[#2D7D7D]/[0.1] bg-white text-[#5C6B73]'
                      )}
                    >
                      Toutes
                    </button>
                    {variantPickerColors.map((color) => {
                      const isEnabled = enabledVariantColors.has(color)
                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() => {
                            setSelectedVariantColor(color)
                            if (
                              selectedVariantSize &&
                              !variantPickerVariants.some(
                                (variant) =>
                                  normalizeVariantOption(variant.color) === color &&
                                  normalizeVariantOption(variant.size) === selectedVariantSize
                              )
                            ) {
                              setSelectedVariantSize('')
                            }
                          }}
                          disabled={!isEnabled}
                          className={cn(
                            'rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                            selectedVariantColor === color
                              ? 'border-[#6C5CE7] bg-[#6C5CE7]/10 text-[#6C5CE7]'
                              : 'border-[#2D7D7D]/[0.1] bg-white text-[#5C6B73]',
                            !isEnabled && 'cursor-not-allowed opacity-35'
                          )}
                        >
                          {color}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {filteredVariantPickerVariants.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[#2D7D7D]/[0.14] bg-white px-4 py-6 text-center text-sm text-[#6B7682]">
                  Aucune variante ne correspond a cette combinaison taille / couleur.
                </div>
              )}

              {filteredVariantPickerVariants.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => {
                      handleAddToCart(variant)
                      setVariantPickerGroup(null)
                    }}
                    className="w-full rounded-2xl border border-[#2D7D7D]/[0.08] bg-[#F8FBFC] px-4 py-3 text-left transition-all hover:border-[#6C5CE7]/25 hover:bg-[#6C5CE7]/[0.04]"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1A3636]">
                          {getProductVariantSummary(variant) || 'Variante standard'}
                        </p>
                        <p className="mt-1 text-xs text-[#6B7682]">
                          SKU {variant.sku || 'Sans reference'} · Reste {getRemainingQuantity(variant)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[#6C5CE7]">{formatCurrency(variant.selling_price, variant.currency)}</p>
                        <p className="mt-1 text-[11px] text-[#5C6B73]">Ajouter au panier</p>
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
