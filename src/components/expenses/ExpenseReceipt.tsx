'use client'
import { useEffect, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { downloadExpenseReceipt } from '@/lib/supabase/expenses'
import type { Expense } from '@/lib/expenses'

export function ExpenseReceipt({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    let objectUrl = ''
    void downloadExpenseReceipt(expense.receipt_path!).then((blob) => {
      if (!active) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Justificatif indisponible.') })
    return () => { active=false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [expense.receipt_path])
  return <Modal isOpen onClose={onClose} title="Justificatif" size="lg" footer={url ? <a href={url} download={`justificatif-${expense.expense_date}.${expense.receipt_path?.split('.').pop()}`} className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#2D7D7D]"><Download size={16} />Telecharger</a> : undefined}>
    <p className="mb-3 break-words text-sm font-medium">{expense.label}</p>
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={`Justificatif : ${expense.label}`} className="mx-auto max-h-[65dvh] max-w-full object-contain" />
    ) : <p role="status" className="flex items-center gap-2 text-sm"><Loader2 size={16} className="animate-spin" />Chargement...</p>}
  </Modal>
}
