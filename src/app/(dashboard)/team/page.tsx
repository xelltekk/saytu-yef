'use client'

import { useCallback, useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { UsageLimitNotice } from '@/components/subscriptions/UsageLimitNotice'
import { useSubscriptionOverview } from '@/hooks/useSubscriptionOverview'
import { useUser } from '@/hooks/useUser'
import { useAccountRole } from '@/hooks/useAccountRole'
import { refreshAccount } from '@/store/accountStore'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { getPlanDefinition, getUsageLimit } from '@/lib/subscriptions'
import { addTeamMember, getTeamContext, removeTeamMember } from '@/lib/supabase/queries'
import { updateTeamMember } from '@/lib/supabase/team'
import { ACCOUNT_ROLE_LABELS, TEAM_ROLE_OPTIONS } from '@/lib/accountRoles'
import { canEditTeamMember, filterTeamMembers, type TeamMemberDraft } from '@/lib/team'
import type { TeamMember } from '@/types'
import { Pencil, RefreshCw, Search, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react'

const roleOptions = TEAM_ROLE_OPTIONS.map((option) => ({ value: option.value, label: option.teamLabel }))
type Dialog = { kind: 'add' } | { kind: 'edit' | 'remove'; member: TeamMember } | null

export default function TeamPage() {
  const { user, accountOwnerId, loading } = useUser()
  const { role, loading: roleLoading } = useAccountRole()
  return <div className="min-h-screen">
    <Header title="Equipe et roles" subtitle="Membres de votre entreprise" />
    {loading || roleLoading ? <p role="status" className="p-4 text-sm">Chargement de l&apos;equipe...</p>
      : user && role ? <TeamContent key={`${user.id}:${accountOwnerId}:${role}`} actorId={user.id} ownerId={accountOwnerId ?? user.id} actorRole={role} />
        : <p role="alert" className="p-4 text-sm text-red-600">Connexion requise pour consulter l&apos;equipe.</p>}
  </div>
}

function TeamContent({ actorId, ownerId, actorRole }: { actorId: string; ownerId: string; actorRole: TeamMember['role'] }) {
  const { overview } = useSubscriptionOverview()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [current, setCurrent] = useState<TeamMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [email, setEmail] = useState('')
  const [draft, setDraft] = useState<TeamMemberDraft>({ full_name: '', role: 'cashier' })
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getTeamContext()
      if (data.current.id !== actorId || (data.current.account_owner_id ?? data.current.id) !== ownerId || data.current.role !== actorRole) {
        setMembers([])
        setCurrent(null)
        setDialog(null)
        void refreshAccount(true)
        throw new Error('Votre acces a change. Rechargez la page.')
      }
      setCurrent(data.current)
      setMembers(data.members.filter((member) => (member.account_owner_id ?? member.id) === ownerId))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger l'equipe.")
    } finally { setLoading(false) }
  }, [actorId, ownerId, actorRole])

  useEffect(() => { void load() }, [load])
  const isAdmin = current?.role === 'admin'
  const limit = overview ? getUsageLimit(overview.plan, 'teamMembers') : null
  const limitReached = limit !== null && members.length >= limit
  const visible = filterTeamMembers(members, search, roleFilter)
  const busy = saving || loading

  function openDialog(next: NonNullable<Dialog>) {
    setError('')
    setNotice('')
    setEmail('')
    setDraft(next.kind === 'edit' ? { full_name: next.member.full_name ?? '', role: next.member.role } : { full_name: '', role: 'cashier' })
    setDialog(next)
  }

  async function save() {
    if (!dialog || saving || !isAdmin) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      if (dialog.kind === 'add') {
        await addTeamMember(email.trim(), draft.role)
        setNotice('Membre ajoute a votre entreprise.')
      } else if (dialog.kind === 'edit') {
        await updateTeamMember(dialog.member, draft)
        setNotice('Modifications enregistrees.')
      } else {
        await removeTeamMember(dialog.member.id)
        setNotice('Membre retire de votre entreprise.')
      }
      setDialog(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation impossible.')
    } finally { setSaving(false) }
  }

  const close = () => { if (!saving) { setDialog(null); setError('') } }
  return <div className="space-y-4 p-3 sm:p-4 lg:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-[#5C6B73]"><Users size={17} /> {members.length} membre(s){limit !== null && ` / ${limit}`}</div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => void load()} disabled={busy} aria-label="Actualiser l'equipe" title="Actualiser l'equipe" className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#2D7D7D]/20 text-[#2D7D7D] disabled:opacity-40"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
        {isAdmin && <Button size="sm" leftIcon={<UserPlus size={15} />} onClick={() => openDialog({ kind: 'add' })} disabled={busy || limitReached}>Ajouter un membre</Button>}
      </div>
    </div>
    {limitReached && <UsageLimitNotice tone="danger" title="Limite equipe atteinte" detail={`Le plan ${overview ? getPlanDefinition(overview.plan).name : 'actuel'} autorise ${limit} utilisateur(s) au total.`} />}
    {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
    {error && !dialog && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
      <Input label="Rechercher un membre" placeholder="Nom ou email" value={search} onChange={(e) => setSearch(e.target.value)} leftAddon={<Search size={16} />} className="h-10" />
      <Select label="Role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} options={[{ value: '', label: 'Tous les roles' }, ...roleOptions]} className="h-10" />
    </div>
    <section aria-label="Liste des membres" aria-busy={loading} className="overflow-hidden border-y border-[#2D7D7D]/15 bg-white">
      <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1fr)_150px_140px_88px] gap-4 border-b border-[#2D7D7D]/10 bg-[#F4F7FA] px-3 py-2 text-xs uppercase text-[#5C6B73] lg:grid">
        <span>Membre</span><span>Role</span><span>Ajoute le</span><span className="text-right">Actions</span>
      </div>
      {loading && members.length === 0 && <p role="status" className="p-4 text-sm text-[#5C6B73]">Chargement...</p>}
      {!loading && !visible.length && <p className="p-4 text-sm text-[#5C6B73]">{members.length ? 'Aucun membre ne correspond aux filtres.' : 'Aucun membre a afficher.'}</p>}
      {visible.map((member) => {
        const owner = member.id === ownerId
        const editable = current && canEditTeamMember(current, member)
        const name = member.full_name || member.email
        return <article key={member.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_80px] items-center gap-x-3 gap-y-2 border-b border-[#2D7D7D]/10 px-3 py-3 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_150px_140px_88px] lg:gap-4">
          <div className="min-w-0">
            <p className="break-words text-sm font-semibold text-[#1A3636]">{member.full_name || 'Utilisateur'}{member.id === actorId && <span className="ml-2 text-xs font-normal text-[#5C6B73]">Vous</span>}</p>
            <p className="break-all text-xs text-[#5C6B73]">{member.email}</p>
          </div>
          <div className="col-start-1 row-start-2 flex min-w-0 items-center gap-2 lg:col-auto lg:row-auto">
            <span className={`rounded px-2 py-1 text-xs ${owner ? 'bg-amber-50 text-amber-800' : member.role === 'admin' ? 'bg-violet-50 text-violet-700' : member.role === 'cashier' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'}`}>{owner ? 'Proprietaire' : ACCOUNT_ROLE_LABELS[member.role]}</span>
          </div>
          <time className="hidden text-xs text-[#5C6B73] lg:block" dateTime={member.created_at}>{new Date(member.created_at).toLocaleDateString('fr-FR')}</time>
          <div className="col-start-2 row-span-2 row-start-1 flex justify-end gap-1 lg:col-auto lg:row-auto lg:row-span-1">
            {editable ? <>
              <button type="button" disabled={busy} aria-label={`Modifier ${name}`} title={`Modifier ${name}`} onClick={() => openDialog({ kind: 'edit', member })} className="grid size-9 shrink-0 place-items-center rounded-lg text-[#2D7D7D] hover:bg-[#EEF5F5] disabled:opacity-40"><Pencil size={16} /></button>
              <button type="button" disabled={busy} aria-label={`Retirer ${name}`} title={`Retirer ${name}`} onClick={() => openDialog({ kind: 'remove', member })} className="grid size-9 shrink-0 place-items-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-40"><Trash2 size={16} /></button>
            </> : owner ? <span title="Proprietaire du compte" className="p-2 text-[#2D7D7D]"><ShieldCheck size={17} aria-label="Proprietaire du compte" /></span> : null}
          </div>
        </article>
      })}
    </section>
    <Modal isOpen={dialog !== null} onClose={close} title={dialog?.kind === 'add' ? 'Ajouter un membre' : dialog?.kind === 'edit' ? 'Modifier le membre' : 'Retirer le membre'} footer={<div className="flex flex-wrap justify-end gap-2">
      <Button variant="ghost" onClick={close} disabled={saving}>Annuler</Button>
      <Button type="submit" form="team-member-form" variant={dialog?.kind === 'remove' ? 'danger' : 'primary'} isLoading={saving} disabled={loading}>{dialog?.kind === 'add' ? 'Ajouter' : dialog?.kind === 'edit' ? 'Enregistrer' : 'Retirer'}</Button>
    </div>}>
      <form id="team-member-form" onSubmit={(e) => { e.preventDefault(); void save() }} className="space-y-4">
        {dialog?.kind === 'remove' ? <p className="break-words text-sm text-[#1A3636]">Retirer <strong>{dialog.member.full_name || dialog.member.email}</strong> de votre entreprise ? Son compte ne sera pas supprime.</p> : <>
          {dialog?.kind === 'add' ? <>
            <p className="text-xs text-[#5C6B73]">Le membre doit deja posseder un compte avec cette adresse email.</p>
            <Input label="Email du compte" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} disabled={saving} />
          </> : <>
            <Input label="Nom complet" value={draft.full_name} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })} required maxLength={120} disabled={saving} autoComplete="off" />
            <Input label="Email de connexion" type="email" value={dialog?.kind === 'edit' ? dialog.member.email : ''} readOnly className="bg-[#F4F7FA]" />
          </>}
          <Select label="Role du membre" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as TeamMember['role'] })} options={roleOptions} disabled={saving} />
        </>}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </form>
    </Modal>
  </div>
}
