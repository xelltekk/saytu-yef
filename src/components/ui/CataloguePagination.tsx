import { ChevronLeft, ChevronRight } from 'lucide-react'

export function CataloguePagination({ offset, total, loading, onChange }: {
  offset: number; total: number; loading: boolean; onChange: (offset: number) => void
}) {
  return <nav aria-label="Pages du catalogue" className="flex flex-wrap items-center justify-end gap-3 py-3 text-sm">
    <span>{total ? offset + 1 : 0} - {Math.min(offset + 24, total)} / {total} produit(s)</span>
    <button type="button" title="Page precedente" aria-label="Page precedente" disabled={loading || offset === 0}
      onClick={() => onChange(offset - 24)} className="flex h-11 w-11 items-center justify-center rounded-lg border disabled:opacity-40"><ChevronLeft size={18} /></button>
    <button type="button" title="Page suivante" aria-label="Page suivante" disabled={loading || offset + 24 >= total}
      onClick={() => onChange(offset + 24)} className="flex h-11 w-11 items-center justify-center rounded-lg border disabled:opacity-40"><ChevronRight size={18} /></button>
  </nav>
}
