'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { UsageLimitNotice } from '@/components/subscriptions/UsageLimitNotice'
import { useSubscriptionOverview } from '@/hooks/useSubscriptionOverview'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { getPlanDefinition, getUsageLimit, getUsageRatio } from '@/lib/subscriptions'
import { addTeamMember, getTeamContext, removeTeamMember, updateTeamMemberRole } from '@/lib/supabase/queries'
import type { TeamMember } from '@/types'
import { ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react'

export default function TeamPage() {
  const { overview } = useSubscriptionOverview()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [current, setCurrent] = useState<TeamMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TeamMember['role']>('employee')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await getTeamContext()
      setCurrent(data.current)
      setMembers(data.members)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger l'équipe.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  const isAdmin = current?.role === 'admin'
  const ownerId = current?.account_owner_id ?? current?.id
  const teamLimit = overview ? getUsageLimit(overview.plan, 'teamMembers') : null
  const teamRatio = overview ? getUsageRatio(members.length, teamLimit) : 0
  const isTeamLimitReached = !!teamLimit && members.length >= teamLimit
  const isTeamLimitNear = !isTeamLimitReached && !!teamLimit && teamRatio >= 80
  const currentPlanName = overview ? getPlanDefinition(overview.plan).name : 'actuel'

  const add = async () => {
    if (!email.trim()) return
    setSaving(true); setError(''); setNotice('')
    try {
      await addTeamMember(email.trim(), role)
      setEmail(''); setRole('employee'); setOpen(false)
      setNotice('Le membre a été rattaché à votre entreprise.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'ajouter ce membre.")
    } finally { setSaving(false) }
  }

  const changeRole = async (member: TeamMember, nextRole: TeamMember['role']) => {
    setError('')
    try { await updateTeamMemberRole(member.id, nextRole); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Modification impossible.') }
  }

  const remove = async (member: TeamMember) => {
    if (!window.confirm(`Retirer ${member.full_name || member.email} de l'entreprise ?`)) return
    setError('')
    try { await removeTeamMember(member.id); setNotice('Membre retiré.'); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Suppression impossible.') }
  }

  return (
    <div className="min-h-screen">
      <Header title="Équipe" subtitle="Administrateurs et employés de votre entreprise" />
      <div className="space-y-4 p-3 sm:p-4 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-[#6B7682]"><Users size={17} /> {members.length} membre(s)</div>
          {isAdmin && (
            <Button
              onClick={() => { setError(''); setOpen(true) }}
              disabled={isTeamLimitReached}
              title={isTeamLimitReached ? `Limite atteinte sur le plan ${currentPlanName}` : 'Ajouter un membre'}
            >
              <UserPlus size={16} /> Ajouter un membre
            </Button>
          )}
        </div>
        {isTeamLimitReached && (
          <UsageLimitNotice
            tone="danger"
            title="Limite equipe atteinte"
            detail={`Le plan ${currentPlanName} autorise ${teamLimit} utilisateur(s) au total. Passez a une formule superieure pour agrandir l'equipe.`}
          />
        )}
        {isTeamLimitNear && teamLimit && (
          <UsageLimitNotice
            title="Capacite equipe bientot atteinte"
            detail={`${members.length} utilisateur(s) actifs sur ${teamLimit}. Vous arrivez au plafond du plan ${currentPlanName}.`}
          />
        )}
        {notice && <div role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-700">{notice}</div>}
        {error && <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-600">{error}</div>}
        {!isAdmin && !loading && <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700">Seul un administrateur peut modifier l&apos;équipe.</div>}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {members.map((member) => {
            const isOwner = member.id === ownerId
            return (
              <Card key={member.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#1A3636]">{member.full_name || 'Utilisateur'}</p>
                    <p className="truncate text-xs text-[#6B7682]">{member.email}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${member.role === 'admin' ? 'bg-violet-500/10 text-violet-700' : 'bg-sky-500/10 text-sky-700'}`}>
                    {member.role === 'admin' ? 'Administrateur' : 'Employé'}
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  {isAdmin && !isOwner ? (
                    <>
                      <Select
                        value={member.role}
                        onChange={(e) => void changeRole(member, e.target.value as TeamMember['role'])}
                        options={[{ value: 'employee', label: 'Employé' }, { value: 'admin', label: 'Administrateur' }]}
                      />
                      <button type="button" onClick={() => void remove(member)} className="rounded-xl p-2 text-red-500 hover:bg-red-500/10" aria-label="Retirer le membre"><Trash2 size={16} /></button>
                    </>
                  ) : (
                    <p className="flex items-center gap-1.5 text-xs text-[#6B7682]"><ShieldCheck size={14} /> {isOwner ? 'Propriétaire du compte' : 'Accès partagé'}</p>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      <Modal isOpen={open} onClose={() => !saving && setOpen(false)} title="Ajouter un membre" footer={<><Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Annuler</Button><Button onClick={() => void add()} isLoading={saving} disabled={!email.trim()}>Ajouter</Button></>}>
        <div className="space-y-4">
          <p className="text-xs text-[#6B7682]">L&apos;employé doit d&apos;abord créer gratuitement son compte Saytu Yëf avec cette adresse email.</p>
          {isTeamLimitReached && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700">
              Votre formule actuelle a atteint sa limite equipe. Passez par <Link href="/settings?tab=subscription" className="font-semibold underline">Abonnement</Link> avant d&apos;ajouter un nouveau compte.
            </div>
          )}
          <Input label="Email du compte" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="employe@exemple.com" />
          <Select label="Rôle" value={role} onChange={(e) => setRole(e.target.value as TeamMember['role'])} options={[{ value: 'employee', label: 'Employé — ventes et stock' }, { value: 'admin', label: 'Administrateur — accès complet' }]} />
          {error && <div role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-600">{error}</div>}
        </div>
      </Modal>
    </div>
  )
}
