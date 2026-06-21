'use client'
import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, CheckCircle2, Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { getCategories, addCategory, updateCategory, deleteCategory } from '@/lib/supabase/queries'
import type { Category } from '@/types'

const COLORS = ['#6C5CE7', '#2D7D7D', '#F59E0B', '#EF4444', '#16A34A', '#06B6D4', '#EC4899', '#F97316']

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`w-6 h-6 rounded-full transition-transform ${value === c ? 'ring-2 ring-offset-2 ring-offset-white scale-110' : 'hover:scale-105'}`}
          style={{ background: c, boxShadow: value === c ? `0 0 0 2px ${c}` : undefined }}
          aria-label={`Couleur ${c}`}
        />
      ))}
    </div>
  )
}

interface CategoryManagerProps {
  isOpen: boolean
  onClose: () => void
  onChanged?: () => void
}

export function CategoryManager({ isOpen, onClose, onChanged }: CategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<Category | null>(null)

  // Edit state
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState(COLORS[0])

  // New category
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(COLORS[0])

  const load = useCallback(async () => {
    setLoading(true)
    setFeedback(null)

    try {
      setCategories(await getCategories())
    } catch (error: unknown) {
      console.error(error)
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Impossible de charger les catégories.',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) void load()
  }, [isOpen, load])

  const handleAdd = async () => {
    if (!newName.trim()) return
    setBusy(true)
    setFeedback(null)
    try {
      const created = await addCategory(newName.trim(), newColor)
      setCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
      setNewColor(COLORS[0])
      onChanged?.()
      setFeedback({ type: 'success', message: `La catégorie « ${created.name} » a été créée.` })
    } catch (err: unknown) {
      console.error(err)
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erreur lors de la création de la catégorie.',
      })
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (cat: Category) => {
    setEditId(cat.id)
    setEditName(cat.name)
    setEditColor(cat.color)
  }

  const handleSaveEdit = async () => {
    if (!editId || !editName.trim()) return
    setBusy(true)
    setFeedback(null)
    try {
      const savedName = editName.trim()
      await updateCategory(editId, { name: editName.trim(), color: editColor })
      setCategories((prev) =>
        prev.map((c) => (c.id === editId ? { ...c, name: editName.trim(), color: editColor } : c))
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      setEditId(null)
      onChanged?.()
      setFeedback({ type: 'success', message: `La catégorie « ${savedName} » a été modifiée.` })
    } catch (err: unknown) {
      console.error(err)
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erreur lors de la modification de la catégorie.',
      })
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteCandidate) return
    const category = deleteCandidate
    setBusy(true)
    setFeedback(null)
    try {
      await deleteCategory(category.id)
      setCategories((prev) => prev.filter((c) => c.id !== category.id))
      setDeleteCandidate(null)
      onChanged?.()
      setFeedback({ type: 'success', message: `La catégorie « ${category.name} » a été supprimée.` })
    } catch (err: unknown) {
      console.error(err)
      setDeleteCandidate(null)
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erreur lors de la suppression de la catégorie.',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gérer les catégories" size="md">
      <div className="space-y-4">
        {feedback && (
          <div
            role={feedback.type === 'error' ? 'alert' : 'status'}
            className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-xs ${
              feedback.type === 'success'
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700'
                : 'border-red-500/20 bg-red-500/10 text-red-700'
            }`}
          >
            {feedback.type === 'success' ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertTriangle size={16} className="shrink-0" />}
            <span className="flex-1">{feedback.message}</span>
            <button type="button" onClick={() => setFeedback(null)} className="font-semibold">Fermer</button>
          </div>
        )}

        {deleteCandidate && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
            <p className="text-sm font-semibold text-[#1A3636]">Supprimer « {deleteCandidate.name} » ?</p>
            <p className="mt-1 text-xs text-[#6B7682]">Les produits associés resteront dans l’inventaire sans catégorie.</p>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDeleteCandidate(null)} disabled={busy}>Annuler</Button>
              <Button variant="danger" size="sm" onClick={() => void handleDelete()} isLoading={busy}>Supprimer</Button>
            </div>
          </div>
        )}

        {/* Liste */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-[#F4F7FB] animate-pulse" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <p className="text-sm text-[#6B7682] text-center py-4">Aucune catégorie. Créez-en une ci-dessous.</p>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => (
              <div key={cat.id} className="rounded-xl border border-[#2D7D7D]/[0.08] bg-white p-3">
                {editId === cat.id ? (
                  <div className="space-y-3">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg bg-white border border-[#2D7D7D]/[0.14] text-sm text-[#1A3636] focus:border-[#6C5CE7] transition-all"
                      placeholder="Nom de la catégorie"
                    />
                    <ColorPicker value={editColor} onChange={setEditColor} />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditId(null)} leftIcon={<X size={13} />}>Annuler</Button>
                      <Button variant="primary" size="sm" onClick={handleSaveEdit} isLoading={busy} leftIcon={<Check size={13} />}>Enregistrer</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                    <span className="flex-1 text-sm font-medium text-[#1A3636] truncate">{cat.name}</span>
                    <button
                      onClick={() => startEdit(cat)}
                      title="Modifier"
                      className="p-1.5 rounded-lg text-[#6B7682] hover:text-[#6C5CE7] hover:bg-[#6C5CE7]/[0.1] transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => { setDeleteCandidate(cat); setFeedback(null) }}
                      disabled={busy}
                      title="Supprimer"
                      className="p-1.5 rounded-lg text-[#6B7682] hover:text-red-600 hover:bg-red-500/5 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Ajouter */}
        <div className="border-t border-[#2D7D7D]/[0.08] pt-4 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Nouvelle catégorie</p>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full h-10 px-3 rounded-lg bg-white border border-[#2D7D7D]/[0.14] text-sm text-[#1A3636] placeholder:text-[#6B7682] focus:border-[#6C5CE7] transition-all"
            placeholder="ex: Électronique"
          />
          <ColorPicker value={newColor} onChange={setNewColor} />
          <Button variant="primary" fullWidth onClick={handleAdd} isLoading={busy} leftIcon={<Plus size={15} />} disabled={!newName.trim()}>
            Ajouter la catégorie
          </Button>
        </div>
      </div>
    </Modal>
  )
}
