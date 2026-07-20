'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, Printer, Tag } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { buildBarcodeLabelEntries, exportBarcodeLabelsPdf, printBarcodeLabels } from '@/lib/barcodes'
import { formatCurrency, formatProductLabel, getProductVariantSummary } from '@/lib/utils'
import type { Product, ProductGroup } from '@/types'

interface BarcodeLabelsModalProps {
  group: ProductGroup | null
  products?: Product[] | null
  focusVariantId?: string | null
  isOpen: boolean
  onClose: () => void
  title?: string
}

type LabelRowState = {
  id: string
  label: string
  barcode: string
  sku?: string
  priceLabel: string
  copies: string
  selected: boolean
  missingBarcode: boolean
}

function createRows(products: Product[], groupName?: string): LabelRowState[] {
  return products.map((variant) => ({
    id: variant.id,
    label: groupName ? (getProductVariantSummary(variant) || groupName) : formatProductLabel(variant),
    barcode: variant.barcode?.trim() || '',
    sku: variant.sku?.trim() || '',
    priceLabel: formatCurrency(variant.selling_price, variant.currency),
    copies: '1',
    selected: !!variant.barcode?.trim(),
    missingBarcode: !variant.barcode?.trim(),
  }))
}

function resolveSourceProducts(group: ProductGroup | null, products?: Product[] | null, focusVariantId?: string | null) {
  if (products?.length) {
    return products
  }

  if (!group) return []

  return focusVariantId
    ? group.variants.filter((variant) => variant.id === focusVariantId)
    : group.variants
}

export function BarcodeLabelsModal({
  group,
  products,
  focusVariantId,
  isOpen,
  onClose,
  title,
}: BarcodeLabelsModalProps) {
  const [rows, setRows] = useState<LabelRowState[]>([])
  const [error, setError] = useState('')
  const [isExportingPdf, setIsExportingPdf] = useState(false)

  const sourceProducts = useMemo(
    () => resolveSourceProducts(group, products, focusVariantId),
    [focusVariantId, group, products]
  )
  const sourceLabel = group?.name || title || "Etiquettes de l'inventaire"

  useEffect(() => {
    if (!isOpen || sourceProducts.length === 0) return
    setError('')
    setRows(createRows(sourceProducts, group?.name || undefined))
  }, [group?.name, isOpen, sourceProducts])

  const selectedCount = useMemo(() => rows.filter((row) => row.selected && !row.missingBarcode).length, [rows])
  const totalCopies = useMemo(() => rows.reduce((sum, row) => (
    row.selected && !row.missingBarcode ? sum + Math.max(1, Number(row.copies) || 1) : sum
  ), 0), [rows])

  const handleToggle = (id: string) => {
    setRows((current) => current.map((row) => (
      row.id === id && !row.missingBarcode ? { ...row, selected: !row.selected } : row
    )))
  }

  const handleCopiesChange = (id: string, copies: string) => {
    setRows((current) => current.map((row) => (
      row.id === id ? { ...row, copies } : row
    )))
  }

  const getSelectedEntries = () => {
    const selectedProducts = sourceProducts.filter((variant) => {
      const row = rows.find((candidate) => candidate.id === variant.id)
      return !!row?.selected && !row.missingBarcode
    })

    return buildBarcodeLabelEntries(selectedProducts).map((entry) => {
      const row = rows.find((candidate) => candidate.id === entry.id)
      return {
        ...entry,
        copies: Math.max(1, Number(row?.copies) || 1),
      }
    })
  }

  const handlePrint = () => {
    const entries = getSelectedEntries()

    if (entries.length === 0) {
      setError("Selectionnez au moins une variante avec code-barres avant d'imprimer.")
      return
    }

    try {
      printBarcodeLabels(entries, sourceLabel)
      onClose()
    } catch (printError) {
      console.error(printError)
      setError(printError instanceof Error ? printError.message : "Impossible d'imprimer les etiquettes.")
    }
  }

  const handleExportPdf = async () => {
    const entries = getSelectedEntries()

    if (entries.length === 0) {
      setError("Selectionnez au moins une variante avec code-barres avant d'exporter.")
      return
    }

    setIsExportingPdf(true)
    try {
      await exportBarcodeLabelsPdf(entries, sourceLabel)
    } catch (exportError) {
      console.error(exportError)
      setError(exportError instanceof Error ? exportError.message : "Impossible d'exporter les etiquettes en PDF.")
    } finally {
      setIsExportingPdf(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={focusVariantId ? 'Imprimer une etiquette variante' : 'Imprimer des etiquettes code-barres'}
      size="lg"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Fermer</Button>
          <Button
            variant="outline"
            leftIcon={<Download size={15} />}
            onClick={() => void handleExportPdf()}
            disabled={selectedCount === 0 || isExportingPdf}
          >
            {isExportingPdf ? 'Export PDF...' : `Exporter PDF (${totalCopies})`}
          </Button>
          <Button
            variant="primary"
            leftIcon={<Printer size={15} />}
            onClick={handlePrint}
            disabled={selectedCount === 0}
          >
            Imprimer {totalCopies} etiquette(s)
          </Button>
        </>
      )}
    >
      {sourceProducts.length === 0 ? null : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-[#F8FBFC] px-4 py-3 text-sm text-[#5C6B73]">
            {sourceLabel} · {selectedCount} variante(s) selectionnee(s) · {totalCopies} etiquette(s) au total
          </div>

          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-3">
            {rows.map((row) => (
              <div
                key={row.id}
                className={`rounded-2xl border px-4 py-3 ${
                  row.missingBarcode
                    ? 'border-amber-500/20 bg-amber-500/5'
                    : row.selected
                      ? 'border-[#6C5CE7]/20 bg-[#6C5CE7]/[0.04]'
                      : 'border-[#2D7D7D]/[0.08] bg-white'
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggle(row.id)}
                        disabled={row.missingBarcode}
                        className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-2 text-[11px] font-semibold ${
                          row.missingBarcode
                            ? 'cursor-not-allowed border-amber-500/20 bg-amber-500/10 text-amber-700'
                            : row.selected
                              ? 'border-[#6C5CE7]/25 bg-[#6C5CE7]/10 text-[#6C5CE7]'
                              : 'border-[#2D7D7D]/15 bg-white text-[#5C6B73]'
                        }`}
                      >
                        {row.missingBarcode ? 'A creer' : row.selected ? 'Inclus' : 'Exclu'}
                      </button>
                      <p className="truncate text-sm font-semibold text-[#1A3636]">{row.label}</p>
                      <span className="rounded-full bg-[#F4F7FB] px-2.5 py-1 text-[11px] font-semibold text-[#5C6B73]">
                        {row.priceLabel}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#5C6B73]">
                      <span className="rounded-full bg-white px-2.5 py-1">
                        Code: {row.barcode || 'Absent'}
                      </span>
                      {row.sku && (
                        <span className="rounded-full bg-white px-2.5 py-1">
                          Ref: {row.sku}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 rounded-full border border-[#2D7D7D]/[0.12] bg-white px-3 py-2">
                      <Tag size={14} className="text-[#6B7682]" />
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={row.copies}
                        onChange={(event) => handleCopiesChange(row.id, event.target.value)}
                        disabled={row.missingBarcode || !row.selected}
                        className="w-16 border-0 bg-transparent text-sm font-semibold text-[#1A3636] outline-none disabled:text-[#9AA7AE]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
