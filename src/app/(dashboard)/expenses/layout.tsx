import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ExpensesLayout({ children }: { children: React.ReactNode }) {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) redirect('/login')
  const { data, error } = await client.from('profiles').select('id,role,account_owner_id').eq('id',user.id).maybeSingle()
  if (error || !data || data.role !== 'admin' || (data.account_owner_id ?? data.id) !== user.id) redirect('/reports')
  return children
}
