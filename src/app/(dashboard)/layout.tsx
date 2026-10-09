import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'
import { BusinessOnboarding } from '@/components/onboarding/BusinessOnboarding'
import { SessionBootstrap } from '@/components/auth/SessionBootstrap'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const [{ data: sessionData }, { data: userData }] = await Promise.all([
    supabase.auth.getSession(),
    supabase.auth.getUser(),
  ])
  const session = sessionData.session
  const user = userData.user

  if (!user) {
    redirect('/login')
  }

  return (
    <SessionBootstrap
      initialAccessToken={session?.access_token ?? null}
      initialRefreshToken={session?.refresh_token ?? null}
    >
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">{children}</main>
        </div>
        <BottomNav />
        <InstallPrompt />
        <BusinessOnboarding />
      </div>
    </SessionBootstrap>
  )
}
