'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  Building2,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  PackagePlus,
  ReceiptText,
  RefreshCw,
  Smartphone,
  Truck,
  WalletCards,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { createClient } from '@/lib/supabase/client'

type ChecklistState = {
  businessReady: boolean
  productCount: number
  supplierCount: number
  saleCount: number
  debtCount: number
  pwaTested: boolean
}

type ChecklistStep = {
  key: keyof ChecklistState
  title: string
  desc: string
  href?: string
  cta?: string
  icon: ReactNode
  done: boolean
  manual?: boolean
}

const STORAGE_KEY = 'saytu-yef:launch-checklist:pwa-tested'

export function LaunchChecklist({ refreshKey = 0 }: { refreshKey?: number }) {
  const [reloadKey, setReloadKey] = useState(0)
  const [state, setState] = useState<ChecklistState>({
    businessReady: false,
    productCount: 0,
    supplierCount: 0,
    saleCount: 0,
    debtCount: 0,
    pwaTested: false,
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    let active = true

    const load = async () => {
      setRefreshing(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (active) {
          setLoading(false)
          setRefreshing(false)
        }
        return
      }

      const pwaTested = window.localStorage.getItem(STORAGE_KEY) === '1'
      const [profileResult, productsResult, suppliersResult, salesResult, debtsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('business_name,phone,business_address')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),
        supabase
          .from('suppliers')
          .select('id', { count: 'exact', head: true }),
        supabase
          .from('sales')
          .select('id', { count: 'exact', head: true })
          .in('payment_status', ['completed', 'partial', 'pending']),
        supabase
          .from('sales')
          .select('id', { count: 'exact', head: true })
          .gt('amount_due', 0)
          .in('payment_status', ['partial', 'pending']),
      ])

      if (!active) return

      if (profileResult.error) console.error(profileResult.error)
      if (productsResult.error) console.error(productsResult.error)
      if (suppliersResult.error) console.error(suppliersResult.error)
      if (salesResult.error) console.error(salesResult.error)
      if (debtsResult.error) console.error(debtsResult.error)

      const profile = profileResult.data
      setState({
        businessReady: Boolean(
          profile?.business_name?.trim()
          && profile?.phone?.trim()
          && profile?.business_address?.trim()
        ),
        productCount: productsResult.count ?? 0,
        supplierCount: suppliersResult.count ?? 0,
        saleCount: salesResult.count ?? 0,
        debtCount: debtsResult.count ?? 0,
        pwaTested,
      })
      setLoading(false)
      setRefreshing(false)
    }

    void load()

    return () => {
      active = false
    }
  }, [refreshKey, reloadKey])

  const steps = useMemo<ChecklistStep[]>(() => ([
    {
      key: 'businessReady',
      title: 'Finaliser la boutique',
      desc: 'Nom, téléphone et adresse pour des reçus propres.',
      href: '/settings',
      cta: 'Paramètres',
      icon: <Building2 size={16} />,
      done: state.businessReady,
    },
    {
      key: 'productCount',
      title: 'Ajouter les premiers produits',
      desc: state.productCount > 0 ? `${state.productCount} produit(s) actif(s)` : 'Ajoutez au moins un produit vendable.',
      href: '/inventory',
      cta: 'Inventaire',
      icon: <PackagePlus size={16} />,
      done: state.productCount > 0,
    },
    {
      key: 'supplierCount',
      title: 'Ajouter un fournisseur',
      desc: state.supplierCount > 0 ? `${state.supplierCount} fournisseur(s)` : 'Utile pour suivre les achats et imports.',
      href: '/suppliers',
      cta: 'Fournisseurs',
      icon: <Truck size={16} />,
      done: state.supplierCount > 0,
    },
    {
      key: 'saleCount',
      title: 'Faire une vente test',
      desc: state.saleCount > 0 ? `${state.saleCount} vente(s) enregistrée(s)` : 'Validez le flux caisse, reçu et stock.',
      href: '/sales',
      cta: 'Ventes',
      icon: <ReceiptText size={16} />,
      done: state.saleCount > 0,
    },
    {
      key: 'debtCount',
      title: 'Tester une dette client',
      desc: state.debtCount > 0 ? `${state.debtCount} dette(s) ouverte(s)` : 'Créez une vente partielle puis encaissez un versement.',
      href: '/clients',
      cta: 'Clients',
      icon: <WalletCards size={16} />,
      done: state.debtCount > 0,
    },
    {
      key: 'pwaTested',
      title: 'Tester sur téléphone',
      desc: 'Installer la PWA, ouvrir en réseau faible et vérifier le reçu.',
      icon: <Smartphone size={16} />,
      done: state.pwaTested,
      manual: true,
    },
  ]), [state])

  const doneCount = steps.filter((step) => step.done).length
  const progress = Math.round((doneCount / steps.length) * 100)

  const markPwaTested = () => {
    window.localStorage.setItem(STORAGE_KEY, '1')
    setState((current) => ({ ...current, pwaTested: true }))
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-[#2D7D7D]/[0.07] bg-gradient-to-r from-[#2D7D7D]/10 to-[#6C5CE7]/10 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#2D7D7D] shadow-sm">
              <ClipboardCheck size={20} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#1A3636]">Préparation commerciale</h2>
              <p className="mt-1 text-xs leading-relaxed text-[#5C6B73]">
                Checklist rapide pour qu’une boutique soit prête à utiliser Saytu Yëf en conditions réelles.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-lg font-bold text-[#1A3636]">{loading ? '…' : `${progress}%`}</p>
              <p className="text-[10px] uppercase tracking-[0.06em] text-[#6B7682]">{doneCount}/{steps.length} étapes</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setLoading(true)
                setReloadKey((current) => current + 1)
              }}
              className="hidden h-9 w-9 items-center justify-center rounded-xl border border-[#2D7D7D]/10 bg-white text-[#2D7D7D] sm:flex"
              aria-label="Rafraîchir la checklist"
              disabled={refreshing}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/70">
          <div className="h-full rounded-full bg-gradient-to-r from-[#2D7D7D] to-[#6C5CE7] transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step) => (
          <div key={step.title} className={`rounded-2xl border p-3 transition-all ${step.done ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-[#2D7D7D]/[0.08] bg-[#F4F7FB]'}`}>
            <div className="flex items-start gap-3">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${step.done ? 'bg-emerald-500/10 text-emerald-700' : 'bg-white text-[#2D7D7D]'}`}>
                {step.done ? <CheckCircle2 size={17} /> : step.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-[#1A3636]">{step.title}</p>
                  {step.done ? <CheckCircle2 size={15} className="shrink-0 text-emerald-600" /> : <Circle size={15} className="shrink-0 text-[#9AA7AE]" />}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[#6B7682]">{step.desc}</p>
                {step.href && !step.done && (
                  <Link href={step.href} className="mt-3 inline-flex text-xs font-semibold text-[#6C5CE7] hover:text-[#5A4BD4]">
                    {step.cta ?? 'Ouvrir'} →
                  </Link>
                )}
                {step.manual && !step.done && (
                  <button
                    type="button"
                    onClick={markPwaTested}
                    className="mt-3 text-xs font-semibold text-[#6C5CE7] hover:text-[#5A4BD4]"
                  >
                    Marquer comme testé →
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
