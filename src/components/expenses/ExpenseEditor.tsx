'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { ImagePlus, Save, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { EXPENSE_CATEGORIES, EXPENSE_METHODS, dateInputValue, prepareExpenseReceipt, validateExpense, type Expense, type ExpenseDraft } from '@/lib/expenses'
import { saveExpense, uploadExpenseReceipt } from '@/lib/supabase/expenses'

export function ExpenseEditor({ expense, initialDate, onClose, onSaved }: { expense: Expense | null; initialDate?: string; onClose: () => void; onSaved: () => void }) {
  const formId = useId()
  const [id] = useState(() => expense?.id ?? crypto.randomUUID())
  const [draft, setDraft] = useState<ExpenseDraft>(() => expense ? { label:expense.label,category:expense.category,amount:expense.amount,expense_date:expense.expense_date,payment_method:expense.payment_method,notes:expense.notes,receipt_path:expense.receipt_path }
    : { label:'',category:'other',amount:0,expense_date:initialDate ?? dateInputValue(new Date()),payment_method:'cash',notes:'',receipt_path:null })
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '')
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [preview, setPreview] = useState('')
  const [preparing, setPreparing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const uploadId = useRef(crypto.randomUUID())
  const uploadedPath = useRef<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const busy = preparing || saving
  useEffect(() => {
    if (!photo) { setPreview(''); return }
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])
  const changePhoto = async (file?: File) => {
    if (!file) return
    setPreparing(true)
    setError('')
    try {
      const blob = await prepareExpenseReceipt(file)
      uploadId.current = crypto.randomUUID()
      uploadedPath.current = null
      setPhoto(blob)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Photo illisible.') }
    finally { setPreparing(false); if (fileInput.current) fileInput.current.value = '' }
  }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    setError('')
    setSaving(true)
    try {
      const payload = { ...draft, amount:Number(amount) }
      validateExpense(payload)
      if (photo) {
        if (!uploadedPath.current) uploadedPath.current = await uploadExpenseReceipt(photo,uploadId.current)
        payload.receipt_path = uploadedPath.current
      }
      await saveExpense(id,payload,expense ?? undefined)
      onSaved()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.') }
    finally { setSaving(false) }
  }
  return (
    <Modal isOpen onClose={() => { if (!busy) onClose() }} title={expense ? 'Modifier la depense' : 'Nouvelle depense'} size="md" footer={
      <div className="flex w-full flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>Annuler</Button>
        <Button type="submit" form={formId} leftIcon={<Save size={16} />} isLoading={saving} disabled={busy}>Enregistrer</Button>
      </div>
    }>
      <form id={formId} onSubmit={submit}>
        <fieldset disabled={busy} className="space-y-4">
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <Input label="Libelle" value={draft.label} required maxLength={160} onChange={(e) => setDraft({ ...draft,label:e.target.value })} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Montant (FCFA)" type="number" inputMode="numeric" min={1} max={999999999999} step={1} required value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Input label="Date du paiement" type="date" min="2000-01-01" max="2099-12-31" required value={draft.expense_date} onChange={(e) => setDraft({ ...draft,expense_date:e.target.value })} />
            <Select label="Categorie" options={[...EXPENSE_CATEGORIES]} value={draft.category} onChange={(e) => setDraft({ ...draft,category:e.target.value as ExpenseDraft['category'] })} />
            <Select label="Mode de paiement" options={[...EXPENSE_METHODS]} value={draft.payment_method} onChange={(e) => setDraft({ ...draft,payment_method:e.target.value as ExpenseDraft['payment_method'] })} />
          </div>
          <Textarea label="Notes" maxLength={2000} value={draft.notes} onChange={(e) => setDraft({ ...draft,notes:e.target.value })} />
          <div className="space-y-2 border-t border-[#2D7D7D]/10 pt-4">
            <p className="text-xs font-medium text-[#5C6B73]">Justificatif photo</p>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Photo du justificatif" className="sr-only" onChange={(e) => void changePhoto(e.target.files?.[0])} />
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Justificatif selectionne" className="max-h-48 max-w-full rounded-lg object-contain" />
            )}
            {!preview && draft.receipt_path && <p className="text-xs text-[#2D7D7D]">Justificatif joint</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" leftIcon={<ImagePlus size={15} />} onClick={() => fileInput.current?.click()} disabled={busy}>{preparing ? 'Preparation...' : photo || draft.receipt_path ? 'Remplacer la photo' : 'Ajouter une photo'}</Button>
              {(photo || draft.receipt_path) && <Button type="button" variant="ghost" size="sm" leftIcon={<Trash2 size={15} />} onClick={() => { setPhoto(null);uploadedPath.current=null;setDraft({ ...draft,receipt_path:null }) }} disabled={busy}>Retirer</Button>}
            </div>
          </div>
        </fieldset>
      </form>
    </Modal>
  )
}
