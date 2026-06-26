'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Mail, MapPin, Pencil, Phone, Plus, RefreshCw, Search, Trash2, Truck } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { addSupplier, deleteSupplier, getSuppliers, updateSupplier } from '@/lib/supabase/queries'
import type { Supplier } from '@/types'

const EMPTY_FORM = {
  name: '',
  contact_name: '',
  phone: '',
  email: '',
  address: '',
  country: 'SN',
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<Supplier | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const loadSuppliers = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      setSuppliers(await getSuppliers())
    } catch (loadError: unknown) {
      console.error(loadError)
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les fournisseurs.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadSuppliers()
  }, [loadSuppliers])

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('fr')
    if (!normalizedQuery) return suppliers
    return suppliers.filter((supplier) => (
      `${supplier.name} ${supplier.contact_name ?? ''} ${supplier.phone ?? ''} ${supplier.email ?? ''} ${supplier.country}`
        .toLocaleLowerCase('fr')
        .includes(normalizedQuery)
    ))
  }, [query, suppliers])

  const openCreate = () => {
    setEditingSupplier(null)
    setForm(EMPTY_FORM)
    setError('')
    setFormOpen(true)
  }

  const openEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setForm({
      name: supplier.name,
      contact_name: supplier.contact_name ?? '',
      phone: supplier.phone ?? '',
      email: supplier.email ?? '',
      address: supplier.address ?? '',
      country: supplier.country || 'SN',
    })
    setError('')
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Le nom du fournisseur est requis.')
      return
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('L’adresse email est invalide.')
      return
    }

    const payload = {
      name: form.name.trim(),
      contact_name: form.contact_name.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim().toLowerCase() || undefined,
      address: form.address.trim() || undefined,
      country: form.country.trim().toUpperCase() || 'SN',
    }

    setSaving(true)
    setError('')
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, payload)
        setNotice(`Le fournisseur « ${payload.name} » a été modifié.`)
      } else {
        await addSupplier(payload)
        setNotice(`Le fournisseur « ${payload.name} » a été ajouté.`)
      }
      setFormOpen(false)
      await loadSuppliers(true)
    } catch (saveError: unknown) {
      console.error(saveError)
      setError(saveError instanceof Error ? saveError.message : 'Impossible d’enregistrer ce fournisseur.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteCandidate) return
    setDeleting(true)
    setError('')
    try {
      await deleteSupplier(deleteCandidate.id)
      setSuppliers((current) => current.filter((supplier) => supplier.id !== deleteCandidate.id))
      setNotice(`Le fournisseur « ${deleteCandidate.name} » a été supprimé.`)
      setDeleteCandidate(null)
    } catch (deleteError: unknown) {
      console.error(deleteError)
      setError(deleteError instanceof Error ? deleteError.message : 'Impossible de supprimer ce fournisseur.')
      setDeleteCandidate(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen">
      <Header title="Fournisseurs" subtitle="Contacts et sources d’approvisionnement" />
      <div className="space-y-4 p-3 sm:p-4 lg:space-y-6 lg:p-6">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative flex-1"><span className="sr-only">Rechercher un fournisseur</span><Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7682]" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nom, contact, pays…" className="h-11 w-full rounded-xl border border-[#2D7D7D]/[0.12] bg-white pl-10 pr-4 text-sm text-[#1A3636]" /></label>
          <Button variant="outline" leftIcon={<RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />} onClick={() => void loadSuppliers(true)} disabled={refreshing}>Actualiser</Button>
          <Button variant="primary" leftIcon={<Plus size={15} />} onClick={openCreate}>Ajouter</Button>
        </div>

        {notice && <div role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-700">{notice}</div>}
        {error && !formOpen && <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-600">{error}</div>}

        {loading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="skeleton h-44 rounded-2xl" />)}</div>
        ) : filtered.length === 0 ? (
          <Card><div className="py-12 text-center text-[#6B7682]"><Truck size={32} className="mx-auto mb-3 opacity-40" /><p className="text-sm">Aucun fournisseur enregistré.</p><Button variant="primary" size="sm" className="mt-4" onClick={openCreate}>Ajouter le premier fournisseur</Button></div></Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((supplier) => (
              <Card key={supplier.id} className="p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#1A3636]">{supplier.name}</p><p className="mt-0.5 text-xs text-[#6B7682]">{supplier.contact_name || 'Aucun contact principal'}</p></div><span className="rounded-lg bg-[#2D7D7D]/10 px-2 py-1 text-[10px] font-semibold text-[#2D7D7D]">{supplier.country}</span></div>
                <div className="mt-4 space-y-2 text-xs text-[#5C6B73]">
                  {supplier.phone && <a href={`tel:${supplier.phone}`} className="flex items-center gap-2 hover:text-[#2D7D7D]"><Phone size={14} /> {supplier.phone}</a>}
                  {supplier.email && <a href={`mailto:${supplier.email}`} className="flex items-center gap-2 truncate hover:text-[#2D7D7D]"><Mail size={14} /> {supplier.email}</a>}
                  {supplier.address && <p className="flex items-start gap-2"><MapPin size={14} className="mt-0.5 shrink-0" /> {supplier.address}</p>}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#2D7D7D]/[0.07] pt-3"><button type="button" onClick={() => openEdit(supplier)} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#2D7D7D]/15 text-xs font-semibold text-[#2D7D7D]"><Pencil size={14} /> Modifier</button><button type="button" onClick={() => setDeleteCandidate(supplier)} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-500/20 text-xs font-semibold text-red-600"><Trash2 size={14} /> Supprimer</button></div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={formOpen} onClose={() => { if (!saving) setFormOpen(false) }} title={editingSupplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'} footer={<><Button variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>Annuler</Button><Button variant="primary" onClick={() => void handleSave()} isLoading={saving}>Enregistrer</Button></>}>
        <div className="space-y-4">
          {error && <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-600">{error}</div>}
          <Input label="Nom du fournisseur" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex : Guangzhou Mobile Trading" required />
          <div className="grid gap-3 sm:grid-cols-2"><Input label="Contact principal" value={form.contact_name} onChange={(event) => setForm((current) => ({ ...current, contact_name: event.target.value }))} /><Input label="Pays (code)" value={form.country} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))} placeholder="CN" maxLength={2} /></div>
          <div className="grid gap-3 sm:grid-cols-2"><Input label="Téléphone" type="tel" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /><Input label="Email" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></div>
          <Textarea label="Adresse" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} rows={2} />
        </div>
      </Modal>

      <Modal isOpen={deleteCandidate !== null} onClose={() => { if (!deleting) setDeleteCandidate(null) }} title="Supprimer le fournisseur" size="sm" footer={<><Button variant="ghost" onClick={() => setDeleteCandidate(null)} disabled={deleting}>Annuler</Button><Button variant="danger" onClick={() => void handleDelete()} isLoading={deleting}>Supprimer</Button></>}>
        <p className="text-sm text-[#5C6B73]">Supprimer <strong className="text-[#1A3636]">{deleteCandidate?.name}</strong> ? Les produits associés resteront dans l’inventaire sans fournisseur.</p>
      </Modal>
    </div>
  )
}
