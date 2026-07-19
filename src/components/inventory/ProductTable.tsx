'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Edit,
  History,
  Layers,
  MoreVertical,
  Package,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Tags,
  Trash2,
  Truck,
  XCircle,
} from 'lucide-react'
import { UsageLimitNotice } from '@/components/subscriptions/UsageLimitNotice'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import { useSubscriptionOverview } from '@/hooks/useSubscriptionOverview'
import { getPlanDefinition, getUsageLimit, getUsageRatio } from '@/lib/subscriptions'
import { buildProductGroups, getProductGroupPriceLabel } from '@/lib/productGroups'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { CategoryManager } from './CategoryManager'
import { BarcodeLabelsModal } from './BarcodeLabelsModal'
import { StockAdjustmentModal } from './StockAdjustmentModal'
import { StockMovementHistoryModal } from './StockMovementHistoryModal'
import {
  formatCurrency,
  formatCurrencyCompact,
  formatProductLabel,
  getProductVariantSummary,
  getStockStatus,
} from '@/lib/utils'
import { deleteProductGroup, getProducts } from '@/lib/supabase/queries'
import type { Product, ProductGroup } from '@/types'

interface ProductTableProps {
  onAddProduct: () => void
  onEditProduct: (productGroup: ProductGroup) => void
  refreshKey?: number
  activatedProduct?: Product | null
  onActivatedProductMerged?: () => void
  readOnly?: boolean
}

interface RestockCandidate {
  product: Product
  gap: number
  estimatedCost: number
}

interface RestockSupplierGroup {
  key: string
  supplierId: string | null
  supplierName: string
  supplierPhone: string
  products: RestockCandidate[]
  units: number
  budget: number
  missingSupplier: boolean
}

function getRestockGap(product: Product): number {
  if (product.quantity > product.min_quantity) return 0
  return Math.max(product.min_quantity - product.quantity + 1, 1)
}

function normalizePhone(phone?: string): string {
  if (!phone) return ''
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 9 && digits.startsWith('7')) digits = `221${digits}`
  return digits
}

function normalizeScannableValue(value?: string | null) {
  return value?.trim().replace(/\s+/g, '').toLocaleLowerCase('fr') || ''
}

function getGroupStockTone(group: ProductGroup) {
  const availableVariants = group.variants.filter((variant) => variant.quantity > variant.min_quantity).length
  const lowVariants = group.variants.filter((variant) => variant.quantity > 0 && variant.quantity <= variant.min_quantity).length
  const outVariants = group.variants.filter((variant) => variant.quantity === 0).length

  if (outVariants === group.variant_count) {
    return { label: 'Rupture', variant: 'danger' as const, helper: `${outVariants} variante(s) indisponible(s)` }
  }

  if (lowVariants > 0 || outVariants > 0) {
    return {
      label: 'Surveillance',
      variant: 'warning' as const,
      helper: `${lowVariants} faible(s) · ${outVariants} rupture(s)`,
    }
  }

  return {
    label: 'Disponible',
    variant: 'success' as const,
    helper: `${availableVariants} variante(s) prêtes`,
  }
}

function getGroupMargin(group: ProductGroup) {
  if (!group.variants.length) return 0

  const totalMargin = group.variants.reduce((sum, variant) => (
    sum + (variant.selling_price > 0 ? ((variant.selling_price - variant.buying_price) / variant.selling_price) * 100 : 0)
  ), 0)

  return totalMargin / group.variants.length
}

function summarizeValues(values: string[]) {
  if (values.length === 0) return ''
  if (values.length <= 3) return values.join(' · ')
  return `${values.slice(0, 2).join(' · ')} +${values.length - 2}`
}

async function copyText(value: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  if (typeof document === 'undefined') {
    throw new Error('copy_unavailable')
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'absolute'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)

  if (!copied) {
    throw new Error('copy_failed')
  }
}

export function ProductTable({
  onAddProduct,
  onEditProduct,
  refreshKey,
  activatedProduct,
  onActivatedProductMerged,
  readOnly = false,
}: ProductTableProps) {
  const { overview } = useSubscriptionOverview()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [stockFilter, setStockFilter] = useState<'all' | 'available' | 'low' | 'out' | 'restock'>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'stock-low' | 'stock-high' | 'variants' | 'restock-cost'>('recent')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<ProductGroup | null>(null)
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null)
  const [showCategories, setShowCategories] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [inventoryView, setInventoryView] = useState<'products' | 'restock'>('products')
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([])
  const [adjustmentProduct, setAdjustmentProduct] = useState<Product | null>(null)
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null)
  const [activeGroupMenu, setActiveGroupMenu] = useState<string | null>(null)
  const [barcodeLabelTarget, setBarcodeLabelTarget] = useState<{ groupId: string; variantId?: string | null } | null>(null)

  const mergeActivatedProduct = useCallback((list: Product[]) => {
    if (!activatedProduct || list.some((product) => product.id === activatedProduct.id)) {
      return list
    }
    return [activatedProduct, ...list]
  }, [activatedProduct])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')

    try {
      const data = await getProducts()
      setProducts(mergeActivatedProduct(data))
      if (activatedProduct) onActivatedProductMerged?.()
    } catch (error: unknown) {
      console.error(error)
      setLoadError(error instanceof Error ? error.message : "Impossible de charger l'inventaire.")
    } finally {
      setLoading(false)
    }
  }, [activatedProduct, mergeActivatedProduct, onActivatedProductMerged])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  useEffect(() => {
    if (!feedback) return
    const timeout = window.setTimeout(() => setFeedback(null), 5000)
    return () => window.clearTimeout(timeout)
  }, [feedback])

  useEffect(() => {
    if (readOnly && inventoryView === 'restock') {
      setInventoryView('products')
    }
  }, [inventoryView, readOnly])

  const productGroups = useMemo(() => buildProductGroups(products), [products])
  const barcodeLabelGroup = useMemo(() => (
    barcodeLabelTarget ? productGroups.find((group) => group.id === barcodeLabelTarget.groupId) ?? null : null
  ), [barcodeLabelTarget, productGroups])

  const handleInventoryScan = useCallback((rawValue: string) => {
    const scannedValue = rawValue.trim()
    if (!scannedValue) return

    const normalizedValue = normalizeScannableValue(scannedValue)
    const matchedGroup = productGroups.find((group) => (
      group.variants.some((variant) => (
        normalizeScannableValue(variant.barcode) === normalizedValue
        || normalizeScannableValue(variant.sku) === normalizedValue
      ))
    ))

    setSearch(scannedValue)
    setInventoryView('products')
    setShowMobileFilters(false)

    if (!matchedGroup) {
      setFeedback({
        type: 'error',
        message: `Code introuvable : ${scannedValue}. Verifiez le code-barres ou la reference de la variante.`,
      })
      return
    }

    setExpandedGroupIds((current) => current.includes(matchedGroup.id) ? current : [matchedGroup.id, ...current])
    setFeedback({
      type: 'success',
      message: `${matchedGroup.name} retrouve via scan. La liste a ete filtree sur la reference ${scannedValue}.`,
    })
  }, [productGroups])

  useBarcodeScanner({
    enabled: !loading,
    onScan: handleInventoryScan,
  })

  const categoryOptions = useMemo(() => (
    Array.from(
      new Map(
        productGroups
          .filter((group) => group.category)
          .map((group) => [group.category!.id, group.category!])
      ).values()
    ).sort((left, right) => left.name.localeCompare(right.name))
  ), [productGroups])

  const supplierOptions = useMemo(() => (
    Array.from(
      new Map(
        productGroups
          .filter((group) => group.supplier)
          .map((group) => [group.supplier!.id, group.supplier!])
      ).values()
    ).sort((left, right) => left.name.localeCompare(right.name))
  ), [productGroups])

  const summary = useMemo(() => productGroups.reduce((acc, group) => {
    const groupRestockUnits = group.variants.reduce((sum, variant) => sum + getRestockGap(variant), 0)
    const groupBuyingValue = group.variants.reduce((sum, variant) => sum + (variant.buying_price * variant.quantity), 0)
    const groupSellingValue = group.variants.reduce((sum, variant) => sum + (variant.selling_price * variant.quantity), 0)

    acc.products += 1
    acc.variants += group.variant_count
    acc.units += group.quantity
    acc.buyingValue += groupBuyingValue
    acc.sellingValue += groupSellingValue
    acc.lowVariants += group.low_variant_count
    acc.outVariants += group.out_variant_count
    if (groupRestockUnits > 0) {
      acc.restockProducts += 1
      acc.restockUnits += groupRestockUnits
      acc.restockCost += group.variants.reduce((sum, variant) => sum + (getRestockGap(variant) * variant.buying_price), 0)
    }
    return acc
  }, {
    products: 0,
    variants: 0,
    units: 0,
    buyingValue: 0,
    sellingValue: 0,
    lowVariants: 0,
    outVariants: 0,
    restockProducts: 0,
    restockUnits: 0,
    restockCost: 0,
  }), [productGroups])

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr')

    return productGroups
      .filter((group) => {
        const matchesSearch = !query || [
          group.name,
          group.description,
          group.category?.name,
          group.supplier?.name,
          ...group.variants.flatMap((variant) => [variant.barcode, variant.sku, variant.size, variant.color]),
        ]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase('fr').includes(query))

        const matchesCategory = categoryFilter === 'all' || group.category_id === categoryFilter
        const matchesSupplier = supplierFilter === 'all'
          || (supplierFilter === 'none' ? !group.supplier_id : group.supplier_id === supplierFilter)

        const groupAllOut = group.variants.every((variant) => variant.quantity === 0)
        const groupHasLow = group.variants.some((variant) => variant.quantity > 0 && variant.quantity <= variant.min_quantity)
        const groupHasAvailable = group.variants.some((variant) => variant.quantity > variant.min_quantity)
        const groupNeedsRestock = group.variants.some((variant) => getRestockGap(variant) > 0)

        const matchesStock = stockFilter === 'all'
          || (stockFilter === 'available' && groupHasAvailable)
          || (stockFilter === 'low' && !groupAllOut && groupHasLow)
          || (stockFilter === 'out' && groupAllOut)
          || (stockFilter === 'restock' && groupNeedsRestock)

        return matchesSearch && matchesCategory && matchesSupplier && matchesStock
      })
      .sort((left, right) => {
        if (sortBy === 'name') return left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' })
        if (sortBy === 'stock-low') return left.quantity - right.quantity
        if (sortBy === 'stock-high') return right.quantity - left.quantity
        if (sortBy === 'variants') return right.variant_count - left.variant_count
        if (sortBy === 'restock-cost') {
          const leftCost = left.variants.reduce((sum, variant) => sum + (getRestockGap(variant) * variant.buying_price), 0)
          const rightCost = right.variants.reduce((sum, variant) => sum + (getRestockGap(variant) * variant.buying_price), 0)
          return rightCost - leftCost
        }

        return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
      })
  }, [categoryFilter, productGroups, search, sortBy, stockFilter, supplierFilter])

  const visibleVariants = useMemo(() => filteredGroups.flatMap((group) => group.variants), [filteredGroups])

  const restockCandidates = useMemo<RestockCandidate[]>(() => (
    visibleVariants
      .filter((variant) => getRestockGap(variant) > 0)
      .map((variant) => ({
        product: variant,
        gap: getRestockGap(variant),
        estimatedCost: getRestockGap(variant) * variant.buying_price,
      }))
      .sort((left, right) => (
        Number(right.product.quantity === 0) - Number(left.product.quantity === 0)
        || right.estimatedCost - left.estimatedCost
        || left.product.quantity - right.product.quantity
      ))
  ), [visibleVariants])

  const restockSummary = useMemo(() => restockCandidates.reduce((acc, item) => ({
    products: acc.products + 1,
    units: acc.units + item.gap,
    budget: acc.budget + item.estimatedCost,
    withoutSupplier: acc.withoutSupplier + (item.product.supplier ? 0 : 1),
  }), {
    products: 0,
    units: 0,
    budget: 0,
    withoutSupplier: 0,
  }), [restockCandidates])

  const restockSupplierGroups = useMemo<RestockSupplierGroup[]>(() => {
    const groups = new Map<string, RestockSupplierGroup>()

    restockCandidates.forEach((candidate) => {
      const supplier = candidate.product.supplier ?? null
      const key = supplier?.id ?? 'missing-supplier'
      const current = groups.get(key)

      if (current) {
        current.products.push(candidate)
        current.units += candidate.gap
        current.budget += candidate.estimatedCost
        return
      }

      groups.set(key, {
        key,
        supplierId: supplier?.id ?? null,
        supplierName: supplier?.name ?? 'Sans fournisseur',
        supplierPhone: normalizePhone(supplier?.phone),
        products: [candidate],
        units: candidate.gap,
        budget: candidate.estimatedCost,
        missingSupplier: !supplier,
      })
    })

    return Array.from(groups.values()).sort((left, right) => (
      Number(left.missingSupplier) - Number(right.missingSupplier)
      || right.budget - left.budget
      || left.supplierName.localeCompare(right.supplierName, 'fr', { sensitivity: 'base' })
    ))
  }, [restockCandidates])

  const hasFilters = search || categoryFilter !== 'all' || supplierFilter !== 'all' || stockFilter !== 'all' || sortBy !== 'recent'
  const isRestockView = inventoryView === 'restock'
  const productLimit = overview ? getUsageLimit(overview.plan, 'products') : null
  const productUsage = overview?.usage.products ?? summary.variants
  const productRatio = overview ? getUsageRatio(productUsage, productLimit) : 0
  const isProductLimitReached = !!productLimit && productUsage >= productLimit
  const isProductLimitNear = !isProductLimitReached && !!productLimit && productRatio >= 80
  const currentPlanName = overview ? getPlanDefinition(overview.plan).name : 'actuel'

  const resetFilters = () => {
    setSearch('')
    setCategoryFilter('all')
    setSupplierFilter('all')
    setStockFilter('all')
    setSortBy('recent')
  }

  const toggleExpandedGroup = (groupId: string) => {
    setExpandedGroupIds((current) => (
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId]
    ))
  }

  const handleDelete = async () => {
    if (!deleteCandidate) return
    const group = deleteCandidate
    setDeletingGroupId(group.id)
    setFeedback(null)

    try {
      await deleteProductGroup(group)
      const idsToRemove = new Set(group.variants.map((variant) => variant.id))
      setProducts((current) => current.filter((product) => !idsToRemove.has(product.id)))
      setDeleteCandidate(null)
      setFeedback({
        type: 'success',
        message: `Le produit « ${group.name} » et ses ${group.variant_count} variante(s) ont ete supprimes.`,
      })
    } catch (deleteError: unknown) {
      console.error(deleteError)
      setFeedback({
        type: 'error',
        message: deleteError instanceof Error ? deleteError.message : 'Erreur lors de la suppression du produit.',
      })
    } finally {
      setDeletingGroupId(null)
      setActiveGroupMenu(null)
    }
  }

  const handleStockAdjusted = (productId: string, quantity: number) => {
    setProducts((current) => current.map((product) => (
      product.id === productId ? { ...product, quantity } : product
    )))

    const adjustedProduct = products.find((product) => product.id === productId)
    setFeedback({
      type: 'success',
      message: `Stock de « ${adjustedProduct ? formatProductLabel(adjustedProduct) : 'Produit'} » mis a jour : ${quantity} unite(s).`,
    })
  }

  const exportCsv = () => {
    const rows = visibleVariants.map((variant) => ({
      Produit: variant.name,
      Variante: getProductVariantSummary(variant) || 'Standard',
      Code_barres: variant.barcode ?? '',
      SKU: variant.sku ?? '',
      Categorie: variant.category?.name ?? '',
      Fournisseur: variant.supplier?.name ?? '',
      Quantite: variant.quantity,
      Stock_minimum: variant.min_quantity,
      Reappro_unites: getRestockGap(variant),
      Cout_reappro: getRestockGap(variant) * variant.buying_price,
      Prix_achat: variant.buying_price,
      Prix_vente: variant.selling_price,
      Valeur_achat_stock: variant.buying_price * variant.quantity,
      Valeur_vente_stock: variant.selling_price * variant.quantity,
      Devise: variant.currency,
      Statut: getStockStatus(variant.quantity, variant.min_quantity).label,
      Date_ajout: new Date(variant.created_at).toLocaleString('fr-SN'),
    }))

    const headers = Object.keys(rows[0] ?? {
      Produit: '',
      Variante: '',
      Code_barres: '',
      SKU: '',
      Categorie: '',
      Fournisseur: '',
      Quantite: '',
      Stock_minimum: '',
      Reappro_unites: '',
      Cout_reappro: '',
      Prix_achat: '',
      Prix_vente: '',
      Valeur_achat_stock: '',
      Valeur_vente_stock: '',
      Devise: '',
      Statut: '',
      Date_ajout: '',
    })

    const protectCell = (value: string | number) => {
      const text = String(value)
      const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text
      return `"${safeText.replace(/"/g, '""')}"`
    }

    const csv = [
      headers.map(protectCell).join(','),
      ...rows.map((row) => headers.map((header) => protectCell(row[header as keyof typeof row] ?? '')).join(',')),
    ].join('\n')

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `inventaire-variantes-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleCopyRestockBatch = async (group: RestockSupplierGroup) => {
    if (group.missingSupplier) {
      setFeedback({ type: 'error', message: 'Ajoutez un fournisseur avant de copier une demande groupee.' })
      return
    }

    const items = group.products
      .map(({ product, gap }) => `- ${gap} unite(s) de ${formatProductLabel(product)}${product.sku ? ` (SKU ${product.sku})` : ''}`)
      .join('\n')

    const message = [
      `Bonjour ${group.supplierName},`,
      'Merci de preparer pour Saytu Yef :',
      items,
      `Total a commander : ${group.units} unite(s).`,
      `Budget achat estime : ${formatCurrency(group.budget)}.`,
      'Merci de nous confirmer la disponibilite et le delai.',
    ].join('\n')

    try {
      await copyText(message)
      setFeedback({ type: 'success', message: `Demande groupee copiee pour ${group.supplierName}.` })
    } catch {
      setFeedback({ type: 'error', message: 'Impossible de copier la demande groupee.' })
    }
  }

  const renderVariantRow = (group: ProductGroup, variant: Product) => {
    const stock = getStockStatus(variant.quantity, variant.min_quantity)
    const stockBadgeVariant = variant.quantity === 0 ? 'danger' : variant.quantity <= variant.min_quantity ? 'warning' : 'success'
    const supplierPhone = normalizePhone(group.supplier?.phone)
    const variantSummary = getProductVariantSummary(variant) || 'Variante standard'

    return (
      <div
        key={variant.id}
        className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-[#F8FBFC] px-3 py-3"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-[#1A3636]">{variantSummary}</p>
              <Badge variant={stockBadgeVariant}>{stock.label}</Badge>
              {variant.barcode && (
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#5C6B73]">
                  Code {variant.barcode}
                </span>
              )}
              {variant.sku && (
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#5C6B73]">
                  Ref {variant.sku}
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              {variant.size && (
                <span className="rounded-full bg-[#6C5CE7]/10 px-2.5 py-1 font-semibold text-[#5A4BD4]">
                  Taille {variant.size}
                </span>
              )}
              {variant.color && (
                <span className="rounded-full bg-[#2D7D7D]/10 px-2.5 py-1 font-semibold text-[#2D7D7D]">
                  Couleur {variant.color}
                </span>
              )}
              <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-[#5C6B73]">
                Stock {variant.quantity} · Min {variant.min_quantity}
              </span>
              {getRestockGap(variant) > 0 && (
                <span className="rounded-full bg-amber-500/10 px-2.5 py-1 font-semibold text-amber-700">
                  Reappro +{getRestockGap(variant)}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 lg:w-[320px] lg:grid-cols-2">
            <div className="rounded-xl bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Achat</p>
              <p className="mt-1 text-sm font-semibold text-[#1A3636]">{formatCurrency(variant.buying_price, variant.currency)}</p>
            </div>
            <div className="rounded-xl bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Vente</p>
              <p className="mt-1 text-sm font-semibold text-[#6C5CE7]">{formatCurrency(variant.selling_price, variant.currency)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!readOnly && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<SlidersHorizontal size={14} />}
                onClick={() => {
                  setAdjustmentProduct(variant)
                  setActiveGroupMenu(null)
                }}
              >
                Ajuster
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Printer size={14} />}
              onClick={() => {
                setBarcodeLabelTarget({ groupId: group.id, variantId: variant.id })
                setActiveGroupMenu(null)
              }}
            >
              Etiquette
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<History size={14} />}
              onClick={() => {
                setHistoryProduct(variant)
                setActiveGroupMenu(null)
              }}
            >
              Historique
            </Button>
            {supplierPhone && getRestockGap(variant) > 0 && (
              <a
                href={`tel:+${supplierPhone}`}
                className="inline-flex h-8 items-center justify-center gap-2 rounded-full border border-[#2D7D7D]/[0.18] px-4 text-xs font-semibold text-[#2D7D7D]"
              >
                <Phone size={13} />
                Appeler
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white p-3">
          <div className="flex items-center gap-2 text-[#5C6B73]">
            <Package size={15} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em]">Produits</span>
          </div>
          <p className="mt-2 text-lg font-bold text-[#1A3636] sm:text-xl">{summary.products}</p>
          <p className="text-[11px] text-[#5C6B73] sm:text-xs">{summary.variants} variante(s)</p>
        </div>

        <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white p-3">
          <div className="flex items-center gap-2 text-[#5C6B73]">
            <Layers size={15} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em]">Stock total</span>
          </div>
          <p className="mt-2 text-lg font-bold text-[#1A3636] sm:text-xl">{summary.units}</p>
          <p className="text-[11px] text-[#5C6B73] sm:text-xs">unite(s) cumulees</p>
        </div>

        <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white p-3">
          <div className="flex items-center gap-2 text-[#5C6B73]">
            <Layers size={15} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em]">Valeur achat</span>
          </div>
          <p className="mt-2 text-base font-bold text-[#1A3636] sm:text-xl" title={formatCurrency(summary.buyingValue)}>
            {formatCurrencyCompact(summary.buyingValue)}
          </p>
          <p className="text-[11px] text-[#5C6B73] sm:text-xs">capital immobilise</p>
        </div>

        <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white p-3">
          <div className="flex items-center gap-2 text-[#5C6B73]">
            <Tags size={15} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em]">Valeur vente</span>
          </div>
          <p className="mt-2 text-base font-bold text-[#1A3636] sm:text-xl" title={formatCurrency(summary.sellingValue)}>
            {formatCurrencyCompact(summary.sellingValue)}
          </p>
          <p className="text-[11px] text-[#5C6B73] sm:text-xs">potentiel brut</p>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2 text-amber-700">
            <AlertTriangle size={15} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em]">Alertes</span>
          </div>
          <p className="mt-2 text-lg font-bold text-[#1A3636] sm:text-xl">{summary.lowVariants + summary.outVariants}</p>
          <p className="text-[11px] text-[#5C6B73] sm:text-xs">
            {summary.lowVariants} faible(s) · {summary.outVariants} rupture(s)
          </p>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={`flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium ${
            feedback.type === 'success'
              ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-700'
              : 'border border-red-500/20 bg-red-500/10 text-red-600'
          }`}
        >
          <CheckCircle2 size={18} className="shrink-0" />
          <span className="flex-1">{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} className="rounded-lg px-2 py-1 text-xs font-semibold">
            Fermer
          </button>
        </div>
      )}

      {loadError && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {loadError}
        </div>
      )}

      {isProductLimitReached && (
        <UsageLimitNotice
          tone="danger"
          title="Limite de variantes atteinte"
          detail={`Le plan ${currentPlanName} autorise ${productLimit} variante(s) produit. Passez a une formule superieure pour continuer a enrichir le catalogue.`}
        />
      )}

      {isProductLimitNear && productLimit && (
        <UsageLimitNotice
          title="Limite de variantes bientot atteinte"
          detail={`${productUsage} variante(s) utilisee(s) sur ${productLimit}. Anticipez une mise a niveau avant de multiplier tailles et couleurs.`}
        />
      )}

      <div className="rounded-[28px] border border-[#2D7D7D]/[0.08] bg-white p-4 shadow-[0_6px_20px_rgba(26,54,54,0.05)]">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#6B7682]" />
              <input
                type="search"
                aria-label="Rechercher un produit"
                placeholder="Rechercher ou scanner un produit, un code-barres, une taille, une couleur ou une reference..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  if (!search.trim()) return

                  const normalizedSearch = normalizeScannableValue(search)
                  const hasExactSkuMatch = productGroups.some((group) => (
                    group.variants.some((variant) => (
                      normalizeScannableValue(variant.barcode) === normalizedSearch
                      || normalizeScannableValue(variant.sku) === normalizedSearch
                    ))
                  ))

                  if (!hasExactSkuMatch) return

                  event.preventDefault()
                  handleInventoryScan(search)
                }}
                className="h-12 w-full rounded-full border border-[#2D7D7D]/[0.14] bg-[#F8FAFD] pl-11 pr-4 text-sm text-[#1A3636] placeholder:text-[#6B7682] transition-all focus:border-[#6C5CE7]/60 focus:shadow-[0_0_0_4px_rgba(108,92,231,0.10)]"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {!readOnly && (
                <Button
                  variant={isRestockView ? 'teal' : 'outline'}
                  size="sm"
                  leftIcon={<Truck size={14} />}
                  onClick={() => setInventoryView((current) => current === 'products' ? 'restock' : 'products')}
                >
                  {isRestockView ? 'Retour aux produits' : 'Plan de reapprovisionnement'}
                </Button>
              )}
              <Button variant="outline" size="sm" leftIcon={<Download size={14} />} onClick={exportCsv}>
                Exporter
              </Button>
              {!readOnly && (
                <Button variant="outline" size="sm" leftIcon={<Tags size={14} />} onClick={() => setShowCategories(true)}>
                  Categories
                </Button>
              )}
              <Button variant="outline" size="sm" leftIcon={<RefreshCw size={14} />} onClick={() => void load()}>
                Actualiser
              </Button>
              {!readOnly && (
                <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={onAddProduct}>
                  Ajouter
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 lg:hidden">
            <p className="text-xs text-[#6B7682]">
              {filteredGroups.length} produit(s) · {visibleVariants.length} variante(s)
            </p>
            <Button variant="ghost" size="sm" onClick={() => setShowMobileFilters((current) => !current)}>
              {showMobileFilters ? 'Masquer les filtres' : 'Filtres'}
            </Button>
          </div>

          <p className="text-[11px] text-[#6B7682]">
            Lecteur 2D compatible: scannez une reference SKU / code-barres pour retrouver instantanement la variante dans l&apos;inventaire.
          </p>

          <div className={`${showMobileFilters ? 'grid' : 'hidden'} grid-cols-1 gap-3 md:grid md:grid-cols-4`}>
            <label className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Categorie</span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="h-10 w-full rounded-xl border border-[#2D7D7D]/[0.1] bg-[#F4F7FB] px-3 text-sm text-[#1A3636]"
              >
                <option value="all">Toutes les categories</option>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Fournisseur</span>
              <select
                value={supplierFilter}
                onChange={(event) => setSupplierFilter(event.target.value)}
                className="h-10 w-full rounded-xl border border-[#2D7D7D]/[0.1] bg-[#F4F7FB] px-3 text-sm text-[#1A3636]"
              >
                <option value="all">Tous</option>
                <option value="none">Sans fournisseur</option>
                {supplierOptions.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Stock</span>
              <select
                value={stockFilter}
                onChange={(event) => setStockFilter(event.target.value as typeof stockFilter)}
                className="h-10 w-full rounded-xl border border-[#2D7D7D]/[0.1] bg-[#F4F7FB] px-3 text-sm text-[#1A3636]"
              >
                <option value="all">Tous les statuts</option>
                <option value="available">Disponible</option>
                <option value="low">Stock faible</option>
                <option value="out">Rupture</option>
                <option value="restock">A reapprovisionner</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Tri</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
                className="h-10 w-full rounded-xl border border-[#2D7D7D]/[0.1] bg-[#F4F7FB] px-3 text-sm text-[#1A3636]"
              >
                <option value="recent">Plus recents</option>
                <option value="name">Nom A-Z</option>
                <option value="stock-low">Stock le plus bas</option>
                <option value="stock-high">Stock le plus haut</option>
                <option value="variants">Plus de variantes</option>
                <option value="restock-cost">Cout de reappro</option>
              </select>
            </label>

            {hasFilters && (
              <div className="md:col-span-4">
                <Button variant="ghost" size="sm" leftIcon={<XCircle size={14} />} onClick={resetFilters}>
                  Reinitialiser les filtres
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {isRestockView ? (
        <div className="rounded-[28px] border border-[#2D7D7D]/[0.08] bg-white shadow-[0_6px_20px_rgba(26,54,54,0.05)]">
          <div className="border-b border-[#2D7D7D]/[0.08] px-4 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[#1A3636]">Plan de reapprovisionnement</h3>
                <p className="mt-1 text-sm text-[#6B7682]">
                  Variantes a traiter en priorite pour eviter les ruptures.
                </p>
              </div>
              {restockCandidates.length > 0 && (
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded-full bg-[#F4F7FB] px-3 py-1 font-semibold text-[#5C6B73]">
                    {restockSummary.products} variante(s)
                  </span>
                  <span className="rounded-full bg-[#F4F7FB] px-3 py-1 font-semibold text-[#5C6B73]">
                    {restockSummary.units} unite(s) a commander
                  </span>
                  <span className="rounded-full bg-amber-500/10 px-3 py-1 font-semibold text-amber-700">
                    Budget estime {formatCurrencyCompact(restockSummary.budget)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {restockCandidates.length === 0 ? (
            <div className="px-4 py-12 text-center text-[#6B7682]">
              <Truck size={28} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">Aucune variante n&apos;a besoin de reapprovisionnement pour le moment.</p>
            </div>
          ) : (
            <div className="space-y-4 px-4 py-4">
              {restockSupplierGroups.length > 0 && (
                <div className="grid gap-3 lg:grid-cols-2">
                  {restockSupplierGroups.map((group) => (
                    <div
                      key={`restock-supplier-${group.key}`}
                      className={`rounded-2xl border p-4 ${
                        group.missingSupplier
                          ? 'border-red-500/20 bg-red-500/5'
                          : 'border-[#2D7D7D]/[0.08] bg-[#F8FBFC]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#1A3636]">{group.supplierName}</p>
                          <p className="mt-1 text-xs text-[#6B7682]">
                            {group.products.length} variante(s) · {group.units} unite(s)
                          </p>
                        </div>
                        <Badge variant={group.missingSupplier ? 'danger' : 'success'}>
                          {group.missingSupplier ? 'A completer' : 'Pret'}
                        </Badge>
                      </div>

                      <div className="mt-3 space-y-2 rounded-2xl bg-white/80 p-3">
                        {group.products.slice(0, 4).map(({ product, gap, estimatedCost }) => (
                          <div key={`supplier-item-${group.key}-${product.id}`} className="flex items-start justify-between gap-3 text-xs">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-[#1A3636]">{formatProductLabel(product)}</p>
                              <p className="mt-0.5 text-[#6B7682]">
                                {gap} unite(s){product.sku ? ` · ${product.sku}` : ''}
                              </p>
                            </div>
                            <span className="shrink-0 font-semibold text-[#2D7D7D]">{formatCurrencyCompact(estimatedCost)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={<Copy size={14} />}
                          onClick={() => void handleCopyRestockBatch(group)}
                        >
                          Copier la demande
                        </Button>
                        {group.supplierPhone && (
                          <a
                            href={`tel:+${group.supplierPhone}`}
                            className="inline-flex h-8 items-center justify-center gap-2 rounded-full border border-[#2D7D7D]/[0.18] px-4 text-xs font-semibold text-[#2D7D7D]"
                          >
                            <Phone size={13} />
                            Appeler
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid gap-3 lg:grid-cols-2">
                {restockCandidates.map(({ product, gap, estimatedCost }) => (
                  <div key={`restock-${product.id}`} className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-[#F8FBFC] p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#1A3636]">{formatProductLabel(product)}</p>
                        <p className="mt-1 text-xs text-[#6B7682]">
                          SKU {product.sku || 'Sans reference'} · Stock {product.quantity} / Min {product.min_quantity}
                        </p>
                        {product.supplier?.name && (
                          <p className="mt-1 text-xs text-[#2D7D7D]">{product.supplier.name}</p>
                        )}
                      </div>
                      <Badge variant={product.quantity === 0 ? 'danger' : 'warning'}>
                        +{gap} a commander
                      </Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                      <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-[#5C6B73]">
                        Cout estime {formatCurrencyCompact(estimatedCost)}
                      </span>
                      {!product.supplier && (
                        <span className="rounded-full bg-red-500/10 px-2.5 py-1 font-semibold text-red-600">
                          Sans fournisseur
                        </span>
                      )}
                    </div>

                    {!readOnly && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" leftIcon={<SlidersHorizontal size={14} />} onClick={() => setAdjustmentProduct(product)}>
                          Ajuster
                        </Button>
                        <Button variant="ghost" size="sm" leftIcon={<Edit size={14} />} onClick={() => onEditProduct(buildProductGroups([product])[0])}>
                          Modifier le parent
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((index) => (
                <div key={index} className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white p-4 animate-pulse">
                  <div className="h-5 w-48 rounded bg-[#2D7D7D]/[0.08]" />
                  <div className="mt-3 h-16 rounded-2xl bg-[#F4F7FB]" />
                </div>
              ))}
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white py-12 text-center">
              <Package size={30} className="mx-auto mb-3 text-[#6B7682]" />
              <p className="text-sm text-[#6B7682]">
                {productGroups.length === 0 ? "Aucun produit dans l'inventaire." : 'Aucun produit ne correspond aux filtres.'}
              </p>
              <div className="mt-4 flex justify-center">
                {productGroups.length === 0 && !readOnly ? (
                  <Button variant="primary" size="sm" onClick={onAddProduct}>Ajouter le premier produit</Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={resetFilters}>Reinitialiser les filtres</Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredGroups.map((group) => {
                const stockTone = getGroupStockTone(group)
                const isExpanded = expandedGroupIds.includes(group.id)
                const groupMargin = getGroupMargin(group)
                const supplierPhone = normalizePhone(group.supplier?.phone)
                const deleteInProgress = deletingGroupId === group.id
                const totalRestock = group.variants.reduce((sum, variant) => sum + getRestockGap(variant), 0)

                return (
                  <article
                    key={group.id}
                    className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white p-3 shadow-[0_4px_14px_rgba(26,54,54,0.04)]"
                  >
                    <div className="sm:hidden">
                      <div className="flex items-start gap-3">
                        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#2D7D7D]/[0.08] bg-[#F8FAFD] p-1.5">
                          {group.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={group.image_url} alt={group.name} className="h-full w-full object-contain object-center" />
                          ) : (
                            <Package size={18} className="text-[#6B7682]" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-sm font-semibold text-[#1A3636]">{group.name}</h3>
                            <Badge variant={stockTone.variant}>{stockTone.label}</Badge>
                            <span className="rounded-full bg-[#F4F7FB] px-2 py-0.5 text-[10px] font-semibold text-[#5C6B73]">
                              {group.variant_count} variante(s)
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                            {group.category && (
                              <span
                                className="rounded-full px-2 py-0.5 font-semibold"
                                style={{ background: `${group.category.color}15`, color: group.category.color }}
                              >
                                {group.category.name}
                              </span>
                            )}
                            {group.supplier && (
                              <span className="rounded-full bg-[#2D7D7D]/10 px-2 py-0.5 font-semibold text-[#2D7D7D]">
                                {group.supplier.name}
                              </span>
                            )}
                            {group.sizes.length > 0 && (
                              <span className="rounded-full bg-[#6C5CE7]/10 px-2 py-0.5 font-semibold text-[#5A4BD4]">
                                T. {summarizeValues(group.sizes)}
                              </span>
                            )}
                            {group.colors.length > 0 && (
                              <span className="rounded-full bg-[#2D7D7D]/10 px-2 py-0.5 font-semibold text-[#2D7D7D]">
                                C. {summarizeValues(group.colors)}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveGroupMenu(activeGroupMenu === group.id ? null : group.id)}
                          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-[#6B7682] transition-colors hover:bg-[#F4F7FB]"
                          aria-label={`Actions pour ${group.name}`}
                        >
                          <MoreVertical size={16} />
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#2D7D7D]/[0.08] pt-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#6C5CE7]">{getProductGroupPriceLabel(group)}</p>
                          <p className="mt-1 text-[11px] text-[#6B7682]">{group.quantity} unite(s) · {stockTone.helper}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!readOnly && (
                            <Button variant="ghost" size="sm" onClick={() => onEditProduct(group)}>
                              Modifier
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            onClick={() => toggleExpandedGroup(group.id)}
                          >
                            {isExpanded ? 'Masquer' : 'Variantes'}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="hidden sm:block xl:hidden">
                      <div className="flex items-start gap-3">
                        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#2D7D7D]/[0.08] bg-[#F8FAFD] p-1.5">
                          {group.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={group.image_url} alt={group.name} className="h-full w-full object-contain object-center" />
                          ) : (
                            <Package size={20} className="text-[#6B7682]" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="min-w-0 max-w-full truncate text-base font-semibold text-[#1A3636]">{group.name}</h3>
                            <Badge variant={stockTone.variant}>{stockTone.label}</Badge>
                            <span className="rounded-full bg-[#F4F7FB] px-2 py-0.5 text-[10px] font-semibold text-[#5C6B73]">
                              {group.variant_count} variante(s)
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                            {group.category && (
                              <span
                                className="rounded-full px-2 py-0.5 font-semibold"
                                style={{ background: `${group.category.color}15`, color: group.category.color }}
                              >
                                {group.category.name}
                              </span>
                            )}
                            {group.supplier && (
                              <span className="rounded-full bg-[#2D7D7D]/10 px-2 py-0.5 font-semibold text-[#2D7D7D]">
                                {group.supplier.name}
                              </span>
                            )}
                            {group.sizes.length > 0 && (
                              <span className="rounded-full bg-[#6C5CE7]/10 px-2 py-0.5 font-semibold text-[#5A4BD4]">
                                T. {summarizeValues(group.sizes)}
                              </span>
                            )}
                            {group.colors.length > 0 && (
                              <span className="rounded-full bg-[#2D7D7D]/10 px-2 py-0.5 font-semibold text-[#2D7D7D]">
                                C. {summarizeValues(group.colors)}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setActiveGroupMenu(activeGroupMenu === group.id ? null : group.id)}
                          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-[#6B7682] transition-colors hover:bg-[#F4F7FB]"
                          aria-label={`Actions pour ${group.name}`}
                        >
                          <MoreVertical size={16} />
                        </button>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#2D7D7D]/[0.08] pt-3">
                        <div className="rounded-2xl bg-[#F8FAFD] p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Prix</p>
                          <p className="mt-1 text-sm font-semibold leading-snug text-[#6C5CE7] break-words">
                            {getProductGroupPriceLabel(group)}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-[#F8FAFD] p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Stock</p>
                          <p className="mt-1 text-sm font-semibold text-[#1A3636]">{group.quantity} unite(s)</p>
                          <p className="mt-1 text-[11px] text-[#6B7682]">{stockTone.helper}</p>
                        </div>
                        <div className="rounded-2xl bg-[#F8FAFD] p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Marge</p>
                          <p className="mt-1 text-sm font-semibold text-emerald-600">{groupMargin.toFixed(0)}%</p>
                        </div>
                        <div className="rounded-2xl bg-[#F8FAFD] p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Variantes</p>
                          <p className="mt-1 text-sm font-semibold text-[#1A3636]">{group.variant_count}</p>
                          {totalRestock > 0 ? (
                            <p className="mt-1 text-[11px] text-amber-600">Reappro +{totalRestock}</p>
                          ) : (
                            <p className="mt-1 text-[11px] text-[#6B7682]">Aucune alerte</p>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                        {!readOnly && (
                          <Button variant="ghost" size="sm" onClick={() => onEditProduct(group)}>
                            Modifier
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          onClick={() => toggleExpandedGroup(group.id)}
                        >
                          {isExpanded ? 'Masquer' : 'Variantes'}
                        </Button>
                      </div>
                    </div>

                    <div className="hidden xl:flex xl:items-center xl:gap-3">
                      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#2D7D7D]/[0.08] bg-[#F8FAFD] p-1.5">
                        {group.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={group.image_url} alt={group.name} className="h-full w-full object-contain object-center" />
                        ) : (
                          <Package size={18} className="text-[#6B7682]" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="min-w-0 max-w-full truncate text-sm font-semibold text-[#1A3636]">{group.name}</h3>
                          <Badge variant={stockTone.variant}>{stockTone.label}</Badge>
                          <span className="rounded-full bg-[#F4F7FB] px-2 py-0.5 text-[10px] font-semibold text-[#5C6B73]">
                            {group.variant_count} variante(s)
                          </span>
                        </div>
                        <p className="mt-1 truncate text-[11px] text-[#6B7682]">
                          {[
                            group.supplier?.name,
                            group.category?.name,
                            group.sizes.length > 0 ? `Tailles: ${summarizeValues(group.sizes)}` : '',
                            group.colors.length > 0 ? `Couleurs: ${summarizeValues(group.colors)}` : '',
                            totalRestock > 0 ? `Reappro +${totalRestock}` : '',
                          ].filter(Boolean).join(' · ')}
                        </p>
                      </div>

                      <div className="w-28 flex-shrink-0 text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Prix</p>
                        <p className="mt-1 text-sm font-semibold leading-snug text-[#6C5CE7] break-words">{getProductGroupPriceLabel(group)}</p>
                      </div>

                      <div className="w-20 flex-shrink-0 text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Stock</p>
                        <p className="mt-1 text-sm font-semibold text-[#1A3636]">{group.quantity}</p>
                      </div>

                      <div className="hidden w-24 flex-shrink-0 text-right xl:block">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Marge</p>
                        <p className="mt-1 text-sm font-semibold text-emerald-600">{groupMargin.toFixed(0)}%</p>
                      </div>

                      <div className="flex flex-shrink-0 items-center gap-1">
                        {!readOnly && (
                          <Button variant="ghost" size="sm" onClick={() => onEditProduct(group)}>
                            Modifier
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          onClick={() => toggleExpandedGroup(group.id)}
                        >
                          {isExpanded ? 'Masquer' : 'Variantes'}
                        </Button>
                        <button
                          type="button"
                          onClick={() => setActiveGroupMenu(activeGroupMenu === group.id ? null : group.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-[#6B7682] transition-colors hover:bg-[#F4F7FB]"
                          aria-label={`Actions pour ${group.name}`}
                        >
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </div>

                    {activeGroupMenu === group.id && (
                      <div className="relative mt-2">
                        <div className="absolute right-0 top-0 z-20 w-48 rounded-2xl border border-[#2D7D7D]/[0.1] bg-white py-1 shadow-[0_12px_30px_rgba(26,54,54,0.12)]">
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => {
                                onEditProduct(group)
                                setActiveGroupMenu(null)
                              }}
                              className="flex min-h-11 w-full items-center gap-2 px-3 text-sm text-[#1A3636] hover:bg-[#F4F7FB]"
                            >
                              <Edit size={14} />
                              Modifier le parent
                            </button>
                          )}
                          {supplierPhone && (
                            <a
                              href={`tel:+${supplierPhone}`}
                              className="flex min-h-11 w-full items-center gap-2 px-3 text-sm text-[#1A3636] hover:bg-[#F4F7FB]"
                            >
                              <Phone size={14} />
                              Appeler fournisseur
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setBarcodeLabelTarget({ groupId: group.id })
                              setActiveGroupMenu(null)
                            }}
                            className="flex min-h-11 w-full items-center gap-2 px-3 text-sm text-[#1A3636] hover:bg-[#F4F7FB]"
                          >
                            <Printer size={14} />
                            Imprimer etiquettes
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              toggleExpandedGroup(group.id)
                              setActiveGroupMenu(null)
                            }}
                            className="flex min-h-11 w-full items-center gap-2 px-3 text-sm text-[#1A3636] hover:bg-[#F4F7FB]"
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {isExpanded ? 'Replier' : 'Afficher'}
                          </button>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteCandidate(group)
                                setActiveGroupMenu(null)
                              }}
                              disabled={deleteInProgress}
                              className="flex min-h-11 w-full items-center gap-2 px-3 text-sm text-red-600 hover:bg-red-500/5 disabled:opacity-50"
                            >
                              <Trash2 size={14} />
                              {deleteInProgress ? 'Suppression...' : 'Supprimer'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {isExpanded && (
                      <div className="mt-4 space-y-3 border-t border-[#2D7D7D]/[0.08] pt-4">
                        {group.variants.map((variant) => renderVariantRow(group, variant))}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}

          {!loading && (
            <p className="text-xs text-[#6B7682]">
              {filteredGroups.length} produit(s) affiches · {visibleVariants.length} variante(s)
            </p>
          )}
        </>
      )}

      <CategoryManager isOpen={showCategories} onClose={() => setShowCategories(false)} onChanged={() => void load()} />

      <StockAdjustmentModal
        product={adjustmentProduct}
        onClose={() => setAdjustmentProduct(null)}
        onAdjusted={handleStockAdjusted}
      />

      <StockMovementHistoryModal
        product={historyProduct}
        onClose={() => setHistoryProduct(null)}
      />

      <BarcodeLabelsModal
        group={barcodeLabelGroup}
        focusVariantId={barcodeLabelTarget?.variantId ?? null}
        isOpen={barcodeLabelTarget !== null}
        onClose={() => setBarcodeLabelTarget(null)}
      />

      <Modal
        isOpen={deleteCandidate !== null}
        onClose={() => {
          if (!deletingGroupId) setDeleteCandidate(null)
        }}
        title="Supprimer le produit"
        size="sm"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setDeleteCandidate(null)} disabled={!!deletingGroupId}>
              Annuler
            </Button>
            <Button variant="danger" onClick={() => void handleDelete()} isLoading={!!deletingGroupId}>
              Supprimer
            </Button>
          </>
        )}
      >
        <p className="text-sm text-[#5C6B73]">
          Voulez-vous vraiment supprimer <strong className="text-[#1A3636]">{deleteCandidate?.name}</strong> ?
          {' '}Les {deleteCandidate?.variant_count ?? 0} variante(s) et leur stock seront retires.
        </p>
      </Modal>
    </div>
  )
}
