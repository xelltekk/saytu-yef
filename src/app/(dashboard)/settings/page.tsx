'use client'
import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { User, Building, Bell, Shield, CreditCard, Check, AlertCircle } from 'lucide-react'

const PLANS = [
  { id: 'free', name: 'Gratuit', price: 0, features: ['50 produits', '10 ventes/mois', '1 utilisateur', 'Rapports basiques'] },
  { id: 'starter', name: 'Starter', price: 9900, features: ['500 produits', 'Ventes illimitées', '3 utilisateurs', 'Wave & Orange Money', 'Rapports avancés'] },
  { id: 'pro', name: 'Pro', price: 24900, features: ['Produits illimités', 'Ventes illimitées', '10 utilisateurs', 'Toutes intégrations', 'API access', 'Support prioritaire'] },
]

type SettingsTab = 'profile' | 'business' | 'billing' | 'notifications' | 'security'

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full relative transition-all duration-200 flex-shrink-0 ${checked ? 'bg-[#6C5CE7]' : 'bg-[#2D7D7D]/[0.15]'}`}
      role="switch"
      aria-checked={checked}
    >
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function Feedback({ state }: { state: { type: 'success' | 'error'; msg: string } | null }) {
  if (!state) return null
  return (
    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs ${state.type === 'success' ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20' : 'bg-red-500/10 text-red-600 border border-red-500/20'}`}>
      {state.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
      {state.msg}
    </div>
  )
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
  const [currentPlan] = useState('starter')
  const { user, loading } = useUser()

  // ── Profil ──────────────────────────────────────────────
  const [profile, setProfile] = useState({ firstName: '', lastName: '', phone: '', language: 'fr' })
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // ── Entreprise ──────────────────────────────────────────
  const [business, setBusiness] = useState({ name: '', ninea: '', address: '', city: '', currency: 'XOF', tva: false })
  const [savingBusiness, setSavingBusiness] = useState(false)
  const [businessMsg, setBusinessMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // ── Notifications ───────────────────────────────────────
  const [notifs, setNotifs] = useState({ lowStock: true, newSale: true, dailyReport: false, weeklyReport: true, abroadSync: true })
  const [savingNotifs, setSavingNotifs] = useState(false)
  const [notifMsg, setNotifMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // ── Sécurité ────────────────────────────────────────────
  const [pwd, setPwd] = useState({ next: '', confirm: '' })
  const [savingPwd, setSavingPwd] = useState(false)
  const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // Charger les données utilisateur
  useEffect(() => {
    if (!user) return
    const meta = user.user_metadata ?? {}
    const full = (meta.full_name || meta.name || '') as string
    const [firstName, ...rest] = full.split(' ')
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
    if (meta.notifications) setNotifs((n) => ({ ...n, ...(meta.notifications as typeof n) }))
  }, [user])

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'Profil', icon: <User size={15} /> },
    { id: 'business', label: 'Entreprise', icon: <Building size={15} /> },
    { id: 'billing', label: 'Abonnement', icon: <CreditCard size={15} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={15} /> },
    { id: 'security', label: 'Sécurité', icon: <Shield size={15} /> },
  ]

  const saveProfile = async () => {
    setSavingProfile(true)
    setProfileMsg(null)
    try {
      const supabase = createClient()
      const full_name = `${profile.firstName} ${profile.lastName}`.trim()
      const { error } = await supabase.auth.updateUser({
        data: { full_name, phone: profile.phone, language: profile.language },
      })
      if (error) throw error
      setProfileMsg({ type: 'success', msg: 'Profil enregistré.' })
    } catch (e) {
      setProfileMsg({ type: 'error', msg: e instanceof Error ? e.message : 'Erreur d\'enregistrement.' })
    } finally {
      setSavingProfile(false)
    }
  }

  const saveBusiness = async () => {
    setSavingBusiness(true)
    setBusinessMsg(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        data: {
          business_name: business.name, ninea: business.ninea, address: business.address,
          city: business.city, currency: business.currency, tva_enabled: business.tva,
        },
      })
      if (error) throw error
      setBusinessMsg({ type: 'success', msg: 'Informations entreprise enregistrées.' })
    } catch (e) {
      setBusinessMsg({ type: 'error', msg: e instanceof Error ? e.message : 'Erreur d\'enregistrement.' })
    } finally {
      setSavingBusiness(false)
    }
  }

  const saveNotifs = async () => {
    setSavingNotifs(true)
    setNotifMsg(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ data: { notifications: notifs } })
      if (error) throw error
      setNotifMsg({ type: 'success', msg: 'Préférences enregistrées.' })
    } catch (e) {
      setNotifMsg({ type: 'error', msg: e instanceof Error ? e.message : 'Erreur d\'enregistrement.' })
    } finally {
      setSavingNotifs(false)
    }
  }

  const changePassword = async () => {
    setPwdMsg(null)
    if (pwd.next.length < 8) { setPwdMsg({ type: 'error', msg: 'Le mot de passe doit faire au moins 8 caractères.' }); return }
    if (pwd.next !== pwd.confirm) { setPwdMsg({ type: 'error', msg: 'Les mots de passe ne correspondent pas.' }); return }
    setSavingPwd(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: pwd.next })
      if (error) throw error
      setPwd({ next: '', confirm: '' })
      setPwdMsg({ type: 'success', msg: 'Mot de passe modifié.' })
    } catch (e) {
      setPwdMsg({ type: 'error', msg: e instanceof Error ? e.message : 'Erreur lors de la modification.' })
    } finally {
      setSavingPwd(false)
    }
  }

  return (
    <div className="min-h-screen">
      <Header title="Paramètres" subtitle="Configurez votre compte et votre activité" />
      <div className="p-4 lg:p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Side tabs */}
          <div className="lg:w-48 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-[#6C5CE7]/10 text-[#6C5CE7] border border-[#6C5CE7]/20' : 'text-[#6B7682] hover:text-[#1A3636] hover:bg-[#F4F7FB]'}`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 space-y-4">
            {activeTab === 'profile' && (
              <Card>
                <h3 className="text-sm font-semibold text-[#1A3636] mb-5">Informations personnelles</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="Prénom" value={profile.firstName} onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))} />
                    <Input label="Nom" value={profile.lastName} onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))} />
                  </div>
                  <Input label="Email" type="email" value={user?.email ?? ''} disabled hint="L'email ne peut pas être modifié ici." />
                  <Input label="Téléphone" type="tel" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} placeholder="+221 77 123 45 67" />
                  <Select
                    label="Langue"
                    value={profile.language}
                    onChange={(e) => setProfile((p) => ({ ...p, language: e.target.value }))}
                    options={[{ value: 'fr', label: 'Français' }, { value: 'wolof', label: 'Wolof' }, { value: 'en', label: 'English' }]}
                  />
                  <Feedback state={profileMsg} />
                  <div className="flex justify-end pt-1">
                    <Button variant="primary" onClick={saveProfile} isLoading={savingProfile} disabled={loading}>Sauvegarder</Button>
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'business' && (
              <Card>
                <h3 className="text-sm font-semibold text-[#1A3636] mb-5">Informations entreprise</h3>
                <div className="space-y-4">
                  <Input label="Nom de l'entreprise" value={business.name} onChange={(e) => setBusiness((b) => ({ ...b, name: e.target.value }))} />
                  <Input label="NINEA / RCCM" value={business.ninea} onChange={(e) => setBusiness((b) => ({ ...b, ninea: e.target.value }))} placeholder="ex: 001234567 2A1" />
                  <Input label="Adresse" value={business.address} onChange={(e) => setBusiness((b) => ({ ...b, address: e.target.value }))} placeholder="ex: Marché Sandaga, Dakar" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="Ville" value={business.city} onChange={(e) => setBusiness((b) => ({ ...b, city: e.target.value }))} placeholder="Dakar" />
                    <Select
                      label="Devise principale"
                      value={business.currency}
                      onChange={(e) => setBusiness((b) => ({ ...b, currency: e.target.value }))}
                      options={[
                        { value: 'XOF', label: 'FCFA (XOF)' },
                        { value: 'EUR', label: 'Euro (EUR)' },
                        { value: 'USD', label: 'Dollar (USD)' },
                      ]}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#F4F7FB] border border-[#2D7D7D]/[0.08]">
                    <div>
                      <p className="text-sm font-medium text-[#1A3636]">TVA activée</p>
                      <p className="text-xs text-[#6B7682]">Appliquer la TVA (18%) sur les ventes</p>
                    </div>
                    <Toggle checked={business.tva} onChange={(v) => setBusiness((b) => ({ ...b, tva: v }))} />
                  </div>
                  <Feedback state={businessMsg} />
                  <div className="flex justify-end">
                    <Button variant="primary" onClick={saveBusiness} isLoading={savingBusiness} disabled={loading}>Sauvegarder</Button>
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'billing' && (
              <div className="space-y-4">
                <Card>
                  <h3 className="text-sm font-semibold text-[#1A3636] mb-5">Choisir un plan</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {PLANS.map((plan) => (
                      <div
                        key={plan.id}
                        className={`relative p-4 rounded-2xl border transition-all ${currentPlan === plan.id ? 'border-[#6C5CE7] bg-[#6C5CE7]/5' : 'border-[#2D7D7D]/[0.1] hover:border-[#2D7D7D]/[0.2]'}`}
                      >
                        {plan.id === 'starter' && (
                          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#6C5CE7] text-[10px] text-white font-medium">
                            Populaire
                          </div>
                        )}
                        <h4 className="text-sm font-bold text-[#1A3636]">{plan.name}</h4>
                        <p className="text-xl font-bold text-[#1A3636] mt-1">
                          {plan.price === 0 ? 'Gratuit' : `${plan.price.toLocaleString('fr-FR')} FCFA`}
                          {plan.price > 0 && <span className="text-xs text-[#6B7682] font-normal">/mois</span>}
                        </p>
                        <ul className="mt-3 space-y-1.5">
                          {plan.features.map((f) => (
                            <li key={f} className="flex items-center gap-2 text-xs text-[#6B7682]">
                              <Check size={12} className="text-emerald-600 flex-shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>
                        <Button
                          variant={currentPlan === plan.id ? 'glass' : 'primary'}
                          fullWidth
                          size="sm"
                          className="mt-4"
                          disabled={currentPlan === plan.id}
                        >
                          {currentPlan === plan.id ? 'Plan actuel' : 'Choisir'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {activeTab === 'notifications' && (
              <Card>
                <h3 className="text-sm font-semibold text-[#1A3636] mb-5">Préférences de notifications</h3>
                <div className="space-y-3">
                  {([
                    { key: 'lowStock', label: 'Stock faible', desc: 'Alerte quand un produit atteint le stock minimum' },
                    { key: 'newSale', label: 'Nouvelle vente', desc: 'Notification pour chaque vente complétée' },
                    { key: 'dailyReport', label: 'Rapport journalier', desc: 'Résumé des ventes à 20h chaque jour' },
                    { key: 'weeklyReport', label: 'Rapport hebdomadaire', desc: 'Rapport complet chaque lundi matin' },
                    { key: 'abroadSync', label: 'Synchronisation étranger', desc: 'Quand vos produits étranger sont synchronisés' },
                  ] as const).map((n) => (
                    <div key={n.key} className="flex items-center justify-between p-3 rounded-xl bg-[#F4F7FB] border border-[#2D7D7D]/[0.06]">
                      <div className="pr-3">
                        <p className="text-sm font-medium text-[#1A3636]">{n.label}</p>
                        <p className="text-xs text-[#6B7682]">{n.desc}</p>
                      </div>
                      <Toggle checked={notifs[n.key]} onChange={(v) => setNotifs((s) => ({ ...s, [n.key]: v }))} />
                    </div>
                  ))}
                  <Feedback state={notifMsg} />
                  <div className="flex justify-end">
                    <Button variant="primary" onClick={saveNotifs} isLoading={savingNotifs} disabled={loading}>Sauvegarder</Button>
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'security' && (
              <Card>
                <h3 className="text-sm font-semibold text-[#1A3636] mb-5">Sécurité du compte</h3>
                <div className="space-y-4">
                  <Input label="Nouveau mot de passe" type="password" value={pwd.next} onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))} placeholder="Min. 8 caractères" />
                  <Input label="Confirmer le mot de passe" type="password" value={pwd.confirm} onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))} placeholder="••••••••" />
                  <Feedback state={pwdMsg} />
                  <div className="flex justify-end">
                    <Button variant="primary" onClick={changePassword} isLoading={savingPwd}>Modifier le mot de passe</Button>
                  </div>
                  <div className="border-t border-[#2D7D7D]/[0.08] pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[#1A3636]">Authentification à deux facteurs</p>
                        <p className="text-xs text-[#6B7682]">Sécurisez votre compte avec 2FA</p>
                      </div>
                      <Button variant="outline" size="sm" disabled>Bientôt disponible</Button>
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
