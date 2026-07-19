'use client'

import { useEffect, useMemo, useState } from 'react'
import { Printer, Tag } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { buildBarcodeLabelEntries, printBarcodeLabels } from '@/lib/barcodes'
import { formatCurrency, getProductVariantSummary } from '@/lib/utils'
import type { ProductGroup } from '@/types'

interface BarcodeLabelsModalProps {
  group: ProductGroup | null
  focusVariantId?: string | null
  isOpen: boolean
  onClose: () => void
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

function createRows(group: ProductGroup, focusVariantId?: string | null): LabelRowState[] {
  const variants = focusVariantId
    ? group.variants.filter((variant) => variant.id === focusVariantId)
    : group.variants

  return variants.map((variant) => ({
    id: variant.id,
    label: getProductVariantSummary(variant) || group.name,
    barcode: variant.barcode?.trim() || '',
    sku: variant.sku?.trim() || '',
    priceLabel: formatCurrency(variant.selling_price, variant.currency),
    copies: '1',
    selected: !!variant.barcode?.trim(),
    missingBarcode: !variant.barcode?.trim(),
  }))
}

export function BarcodeLabelsModal({
  group,
  focusVariantId,
  isOpen,
  onClose,
}: BarcodeLabelsModalProps) {
  const [rows, setRows] = useState<LabelRowState[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen || !group) return
    setError('')
    setRows(createRows(group, focusVariantId))
  }, [focusVariantId, group, isOpen])

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

  const handlePrint = () => {
    if (!group) return

    const products = group.variants.filter((variant) => {
      const row = rows.find((candidate) => candidate.id === variant.id)
      return !!row?.selected && !row.missingBarcode
    })

    const entries = buildBarcodeLabelEntries(products).map((entry) => {
      const row = rows.find((candidate) => candidate.id === entry.id)
      return {
        ...entry,
        copies: Math.max(1, Number(row?.copies) || 1),
      }
    })

    if (entries.length === 0) {
      setError("Selectionnez au moins une variante avec code-barres avant d'imprimer.")
      return
    }

    try {
      printBarcodeLabels(entries, `Etiquettes ${group.name}`)
      onClose()
    } catch (printError) {
      console.error(printError)
      setError(printError instanceof Error ? printError.message : "Impossible d'imprimer les etiquettes.")
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
      {!group ? null : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-[#F8FBFC] px-4 py-3 text-sm text-[#5C6B73]">
            {group.name} · {selectedCount} variante(s) selectionnee(s) · {totalCopies} etiquette(s) au total
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
