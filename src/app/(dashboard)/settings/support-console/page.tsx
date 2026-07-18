'use client'

import { Header } from '@/components/layout/Header'
import { SupportConsole } from '@/components/support/SupportConsole'

export default function SupportConsolePage() {
  return (
    <div className="min-h-screen">
      <Header
        title="Console SaaS XELLTEKK"
        subtitle="Suivi global des comptes, abonnements et validations support"
      />
      <SupportConsole />
    </div>
  )
}
