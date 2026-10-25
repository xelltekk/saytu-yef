import { beforeEach, expect, it, vi } from 'vitest'
import type { TeamMember } from '@/types'
const mocks=vi.hoisted(() => ({context:vi.fn(),invalidate:vi.fn(),rpc:vi.fn()}))
vi.mock('./account',() => ({getAccountContext:mocks.context,invalidateAccountContext:mocks.invalidate}))
vi.mock('./client',() => ({createClient:() => ({rpc:mocks.rpc}),ensureBrowserSupabaseSession:async () => {}}))
import { updateTeamMember } from './team'
const member:TeamMember={id:'staff',account_owner_id:'owner',email:'staff@test.fr',full_name:'Nom',role:'cashier',created_at:'2026-01-01',updated_at:'2026-10-01'}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.context.mockResolvedValue({user:{id:'owner'},member:{id:'owner',role:'admin'}})
  mocks.rpc.mockResolvedValue({data:{...member,full_name:'Fatou',role:'employee'},error:null})
})
it('sends only validated fields with the previous version and invalidates account caches',async () => {
  const result=await updateTeamMember(member,{full_name:' Fatou ',role:'employee'})
  expect(result.full_name).toBe('Fatou')
  expect(mocks.rpc).toHaveBeenCalledWith('update_team_member',{p_member_id:'staff',p_full_name:'Fatou',p_role:'employee',p_expected_updated_at:'2026-10-01'})
  expect(mocks.invalidate).toHaveBeenCalledOnce()
})
it.each(['employee','cashier'])('rejects a %s actor before any write',async (role) => {
  mocks.context.mockResolvedValue({user:{id:'owner'},member:{role}})
  await expect(updateTeamMember(member,{full_name:'Nom',role:'admin'})).rejects.toThrow(/autorisee/)
  expect(mocks.rpc).not.toHaveBeenCalled()
})
it('requires a loaded version and does not change owners or other businesses',async () => {
  await expect(updateTeamMember({...member,updated_at:undefined},{full_name:'Nom',role:'admin'})).rejects.toThrow(/Rechargez/)
  await expect(updateTeamMember({...member,account_owner_id:'other'},{full_name:'Nom',role:'admin'})).rejects.toThrow(/autorisee/)
  expect(mocks.rpc).not.toHaveBeenCalled()
})
it('clearly reports missing migrations and conflicts',async () => {
  mocks.rpc.mockResolvedValue({data:null,error:{code:'PGRST202'}})
  await expect(updateTeamMember(member,{full_name:'Nom',role:'admin'})).rejects.toThrow(/migration/)
  mocks.rpc.mockResolvedValue({data:null,error:{code:'40001',message:'Ce membre a change.'}})
  await expect(updateTeamMember(member,{full_name:'Nom',role:'admin'})).rejects.toThrow(/change/)
})
