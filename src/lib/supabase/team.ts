import type { TeamMember } from '@/types'
import { canEditTeamMember, validateTeamMember, type TeamMemberDraft } from '@/lib/team'
import { getAccountContext, invalidateAccountContext } from './account'
import { createClient, ensureBrowserSupabaseSession } from './client'

export async function updateTeamMember(member: TeamMember, draft: TeamMemberDraft): Promise<TeamMember> {
  const values = validateTeamMember(draft)
  const context = await getAccountContext()
  const current = { ...context.member, id: context.user.id } as TeamMember
  if (!canEditTeamMember(current, member)) throw new Error('Modification non autorisee pour ce membre.')
  if (!member.updated_at) throw new Error('Rechargez la liste avant de modifier ce membre.')
  const client = createClient()
  await ensureBrowserSupabaseSession(client)
  const { data, error } = await client.rpc('update_team_member', {
    p_member_id: member.id, p_full_name: values.full_name, p_role: values.role,
    p_expected_updated_at: member.updated_at,
  })
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      throw new Error('La migration de modification des membres doit etre appliquee dans Supabase.')
    }
    throw new Error(error.message || 'Modification impossible.')
  }
  invalidateAccountContext()
  return data as TeamMember
}
