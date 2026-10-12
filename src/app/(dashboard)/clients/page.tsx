'use client'
import { Header } from '@/components/layout/Header'
import { CustomerDesk } from '@/components/clients/CustomerDesk'

export default function ClientsPage() {
  return <div><Header title="Clients & dettes" subtitle="Comptes clients et recouvrement" /><CustomerDesk /></div>
}
