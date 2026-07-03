'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Header } from '@/components/layout/Header'
import { SubscriptionCenter } from '@/components/settings/SubscriptionCenter'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Input'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, Bell, Building, Check, CreditCard, Shield, User } from 'lucide-react'

type SettingsTab = 'profile' | 'business' | 'billing' | 'notifications' | 'security'

const NOTIFICATION_SETTINGS_KEY = 'saytu-yef:notification-preferences'

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-all duration-200 ${checked ? 'bg-[#6C5CE7]' : 'bg-[#2D7D7D]/[0.15]'}`}
      role="switch"
      aria-checked={checked}
    >
      <div className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function Feedback({ state }: { state: { type: 'success' | 'error'; msg: string } | null }) {
  if (!state) return null

  return (
    <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs ${state.type === 'success' ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-700' : 'border border-red-500/20 bg-red-500/10 text-red-600'}`}>
      {state.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
      {state.msg}
    </div>
  )
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
  const { user, loading } = useUser()

  const [profile, setProfile] = useState({ firstName: '', lastName: '', phone: '', language: 'fr' })
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const [business, setBusiness] = useState({ name: '', ninea: '', address: '', city: '', currency: 'XOF', tva: false })
  const [savingBusiness, setSavingBusiness] = useState(false)
  const [businessMsg, setBusinessMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const [notifs, setNotifs] = useState({ lowStock: true, newSale: true, dailyReport: false, weeklyReport: true, abroadSync: true })
  const [savingNotifs, setSavingNotifs] = useState(false)
  const [notifMsg, setNotifMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const [pwd, setPwd] = useState({ next: '', confirm: '' })
  const [savingPwd, setSavingPwd] = useState(false)
  const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    if (!user) return

    const meta = user.user_metadata ?? {}
    const fullName = (meta.full_name || meta.name || '') as string
    const [firstName, ...rest] = fullName.split(' ')

    setProfile({
      firstName: firstName || '',
      lastName: rest.join(' '),
      phone: (meta.phone as string) || '',
      language: (meta.language as string) || 'fr',
    })

    setBusiness({
      name: (meta.business_name as string) || '',
      ninea: (meta.ninea as string) || '',
      address: (meta.address as string) || '',
      city: (meta.city as string) || '',
      currency: (meta.currency as string) || 'XOF',
      tva: Boolean(meta.tva_enabled),
    })

    try {
      const storedNotifs = window.localStorage.getItem(NOTIFICATION_SETTINGS_KEY)
      if (storedNotifs) {
        setNotifs((current) => ({ ...current, ...(JSON.parse(storedNotifs) as Partial<typeof current>) }))
      }
    } catch (storageError) {
      console.error(storageError)
    }

    let active = true
    const loadProfileRecord = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name,business_name,currency,business_address,phone,tax_enabled')
        .eq('id', user.id)
        .maybeSingle()

      if (!active) return
      if (error) {
        console.error(error)
        return
      }

      if (data?.full_name) {
        const [storedFirstName, ...storedRest] = data.full_name.split(' ')
        setProfile((current) => ({
          ...current,
          firstName: storedFirstName || current.firstName,
          lastName: storedRest.join(' ') || current.lastName,
        }))
      }

      if (data?.phone) {
        setProfile((current) => ({ ...current, phone: data.phone }))
      }

      if (data?.business_name) {
        setBusiness((current) => ({ ...current, name: data.business_name }))
      }

      setBusiness((current) => ({
        ...current,
        address: data?.business_address || current.address,
        currency: data?.currency || current.currency,
        tva: data?.tax_enabled ?? current.tva,
      }))
    }

    void loadProfileRecord()
    return () => {
      active = false
    }
  }, [user])

  const tabs: Array<{ id: SettingsTab; label: string; icon: ReactNode }> = [
    { id: 'profile', label: 'Profil', icon: <User size={15} /> },
    { id: 'business', label: 'Entreprise', icon: <Building size={15} /> },
    { id: 'billing', label: 'Abonnement', icon: <CreditCard size={15} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={15} /> },
    { id: 'security', label: 'Securite', icon: <Shield size={15} /> },
  ]

  const saveProfile = async () => {
    if (!user) {
      setProfileMsg({ type: 'error', msg: 'Session utilisateur introuvable.' })
      return
    }

    setSavingProfile(true)
    setProfileMsg(null)

    try {
      const supabase = createClient()
      const full_name = `${profile.firstName} ${profile.lastName}`.trim()
      const { error } = await supabase.auth.updateUser({ data: { full_name } })
      if (error) throw error

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name,
          phone: profile.phone.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (profileError) throw profileError
      setProfileMsg({ type: 'success', msg: 'Profil enregistre.' })
    } catch (error) {
      setProfileMsg({ type: 'error', msg: error instanceof Error ? error.message : "Erreur d'enregistrement." })
    } finally {
      setSavingProfile(false)
    }
  }

  const saveBusiness = async () => {
    if (!user) {
      setBusinessMsg({ type: 'error', msg: 'Session utilisateur introuvable.' })
      return
    }

    setSavingBusiness(true)
    setBusinessMsg(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        data: { business_name: business.name.trim() || '' },
      })
      if (error) throw error

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          business_name: business.name.trim() || null,
          business_address: business.address.trim() || null,
          currency: business.currency,
          tax_enabled: business.tva,
          tax_rate: 18,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (profileError) throw profileError
      setBusinessMsg({ type: 'success', msg: 'Informations entreprise enregistrees.' })
    } catch (error) {
      setBusinessMsg({ type: 'error', msg: error instanceof Error ? error.message : "Erreur d'enregistrement." })
    } finally {
      setSavingBusiness(false)
    }
  }

  const saveNotifs = async () => {
    setSavingNotifs(true)
    setNotifMsg(null)

    try {
      window.localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(notifs))
      setNotifMsg({ type: 'success', msg: 'Preferences enregistrees.' })
    } catch (error) {
      setNotifMsg({ type: 'error', msg: error instanceof Error ? error.message : "Erreur d'enregistrement." })
    } finally {
      setSavingNotifs(false)
    }
  }

  const changePassword = async () => {
    setPwdMsg(null)

    if (pwd.next.length < 8) {
      setPwdMsg({ type: 'error', msg: 'Le mot de passe doit faire au moins 8 caracteres.' })
      return
    }

    if (pwd.next !== pwd.confirm) {
      setPwdMsg({ type: 'error', msg: 'Les mots de passe ne correspondent pas.' })
      return
    }

    setSavingPwd(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: pwd.next })
      if (error) throw error

      setPwd({ next: '', confirm: '' })
      setPwdMsg({ type: 'success', msg: 'Mot de passe modifie.' })
    } catch (error) {
      setPwdMsg({ type: 'error', msg: error instanceof Error ? error.message : 'Erreur lors de la modification.' })
    } finally {
      setSavingPwd(false)
    }
  }

  return (
    <div className="min-h-screen">
      <Header title="Parametres" subtitle="Configurez votre compte et votre activite" />

      <div className="p-3 sm:p-4 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
          <div className="flex snap-x gap-1 overflow-x-auto pb-1 lg:w-48 lg:flex-col lg:overflow-visible lg:pb-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-h-11 snap-start items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${activeTab === tab.id ? 'border border-[#6C5CE7]/20 bg-[#6C5CE7]/10 text-[#6C5CE7]' : 'text-[#6B7682] hover:bg-[#F4F7FB] hover:text-[#1A3636]'}`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 space-y-4">
            {activeTab === 'profile' && (
              <Card className="p-4 sm:p-5">
                <h3 className="mb-5 text-sm font-semibold text-[#1A3636]">Informations personnelles</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input label="Prenom" value={profile.firstName} onChange={(event) => setProfile((current) => ({ ...current, firstName: event.target.value }))} />
                    <Input label="Nom" value={profile.lastName} onChange={(event) => setProfile((current) => ({ ...current, lastName: event.target.value }))} />
                  </div>
                  <Input label="Email" type="email" value={user?.email ?? ''} disabled hint="L'email ne peut pas etre modifie ici." />
                  <Input label="Telephone" type="tel" value={profile.phone} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} placeholder="+221 77 123 45 67" />
                  <Select
                    label="Langue"
                    value={profile.language}
                    onChange={(event) => setProfile((current) => ({ ...current, language: event.target.value }))}
                    options={[
                      { value: 'fr', label: 'Francais' },
                      { value: 'wolof', label: 'Wolof' },
                      { value: 'en', label: 'English' },
                    ]}
                  />
                  <Feedback state={profileMsg} />
                  <div className="flex justify-end pt-1">
                    <Button variant="primary" onClick={saveProfile} isLoading={savingProfile} disabled={loading} className="w-full sm:w-auto">
                      Sauvegarder
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'business' && (
              <Card className="p-4 sm:p-5">
                <h3 className="mb-5 text-sm font-semibold text-[#1A3636]">Informations entreprise</h3>
                <div className="space-y-4">
                  <Input label="Nom de l'entreprise" value={business.name} onChange={(event) => setBusiness((current) => ({ ...current, name: event.target.value }))} />
                  <Input label="NINEA / RCCM" value={business.ninea} onChange={(event) => setBusiness((current) => ({ ...current, ninea: event.target.value }))} placeholder="ex: 001234567 2A1" />
                  <Input label="Adresse" value={business.address} onChange={(event) => setBusiness((current) => ({ ...current, address: event.target.value }))} placeholder="ex: Marche Sandaga, Dakar" />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input label="Ville" value={business.city} onChange={(event) => setBusiness((current) => ({ ...current, city: event.target.value }))} placeholder="Dakar" />
                    <Select
                      label="Devise principale"
                      value={business.currency}
                      onChange={(event) => setBusiness((current) => ({ ...current, currency: event.target.value }))}
                      options={[
                        { value: 'XOF', label: 'FCFA (XOF)' },
                        { value: 'EUR', label: 'Euro (EUR)' },
                        { value: 'USD', label: 'Dollar (USD)' },
                      ]}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-[#2D7D7D]/[0.08] bg-[#F4F7FB] p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1A3636]">TVA activee</p>
                      <p className="text-xs text-[#6B7682]">Appliquer la TVA (18%) sur les ventes</p>
                    </div>
                    <Toggle checked={business.tva} onChange={(value) => setBusiness((current) => ({ ...current, tva: value }))} />
                  </div>
                  <Feedback state={businessMsg} />
                  <div className="flex justify-end">
                    <Button variant="primary" onClick={saveBusiness} isLoading={savingBusiness} disabled={loading} className="w-full sm:w-auto">
                      Sauvegarder
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'billing' && <SubscriptionCenter />}

            {activeTab === 'notifications' && (
              <Card className="p-4 sm:p-5">
                <h3 className="mb-5 text-sm font-semibold text-[#1A3636]">Preferences de notifications</h3>
                <div className="space-y-3">
                  {([
                    { key: 'lowStock', label: 'Stock faible', desc: 'Alerte quand un produit atteint le stock minimum' },
                    { key: 'newSale', label: 'Nouvelle vente', desc: 'Notification pour chaque vente completee' },
                    { key: 'dailyReport', label: 'Rapport journalier', desc: 'Resume des ventes a 20h chaque jour' },
                    { key: 'weeklyReport', label: 'Rapport hebdomadaire', desc: 'Rapport complet chaque lundi matin' },
                    { key: 'abroadSync', label: 'Synchronisation etranger', desc: 'Quand vos produits saisis a l etranger sont synchronises' },
                  ] as const).map((notice) => (
                    <div key={notice.key} className="flex items-center justify-between rounded-xl border border-[#2D7D7D]/[0.06] bg-[#F4F7FB] p-3">
                      <div className="pr-3">
                        <p className="text-sm font-medium text-[#1A3636]">{notice.label}</p>
                        <p className="text-xs text-[#6B7682]">{notice.desc}</p>
                      </div>
                      <Toggle checked={notifs[notice.key]} onChange={(value) => setNotifs((current) => ({ ...current, [notice.key]: value }))} />
                    </div>
                  ))}
                  <Feedback state={notifMsg} />
                  <div className="flex justify-end">
                    <Button variant="primary" onClick={saveNotifs} isLoading={savingNotifs} disabled={loading} className="w-full sm:w-auto">
                      Sauvegarder
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'security' && (
              <Card className="p-4 sm:p-5">
                <h3 className="mb-5 text-sm font-semibold text-[#1A3636]">Securite du compte</h3>
                <div className="space-y-4">
                  <Input label="Nouveau mot de passe" type="password" autoComplete="new-password" value={pwd.next} onChange={(event) => setPwd((current) => ({ ...current, next: event.target.value }))} placeholder="Min. 8 caracteres" />
                  <Input label="Confirmer le mot de passe" type="password" autoComplete="new-password" value={pwd.confirm} onChange={(event) => setPwd((current) => ({ ...current, confirm: event.target.value }))} placeholder="........" />
                  <Feedback state={pwdMsg} />
                  <div className="flex justify-end">
                    <Button variant="primary" onClick={changePassword} isLoading={savingPwd} className="w-full sm:w-auto">
                      Modifier le mot de passe
                    </Button>
                  </div>
                  <div className="border-t border-[#2D7D7D]/[0.08] pt-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-[#1A3636]">Authentification a deux facteurs</p>
                        <p className="text-xs text-[#6B7682]">Securisez votre compte avec 2FA</p>
                      </div>
                      <Button variant="outline" size="sm" disabled>
                        Bientot disponible
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
