import type { TeamMember } from '@/types'

export type TeamMemberDraft = { full_name: string; role: TeamMember['role'] }

export function validateTeamMember(draft: TeamMemberDraft): TeamMemberDraft {
  const full_name = draft.full_name.trim()
  if (!full_name || full_name.length > 120) throw new Error('Le nom doit contenir entre 1 et 120 caracteres.')
  if (!['admin', 'employee', 'cashier'].includes(draft.role)) throw new Error('Role invalide.')
  return { full_name, role: draft.role }
}

export function canEditTeamMember(current: TeamMember, member: TeamMember) {
  const owner = current.account_owner_id ?? current.id
  return current.role === 'admin' && member.id !== owner && member.id !== current.id
    && (member.account_owner_id ?? member.id) === owner
}

export function filterTeamMembers(members: TeamMember[], search: string, role: string) {
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr')
  const term = normalize(search.trim())
  return members.filter((member) => (!role || member.role === role)
    && normalize(`${member.full_name ?? ''} ${member.email}`).includes(term))
}
