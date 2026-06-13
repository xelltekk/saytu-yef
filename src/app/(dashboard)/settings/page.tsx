'use client'
import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { User, Building, Bell, Shield, CreditCard, Check } from 'lucide-react'

const PLANS = [
  { id: 'free', name: 'Gratuit', price: 0, features: ['50 produits', '10 ventes/mois', '1 utilisateur', 'Rapports basiques'] },
  { id: 'starter', name: 'Starter', price: 9900, features: ['500 produits', 'Ventes illimitées', '3 utilisateurs', 'Wave & Orange Money', 'Rapports avancés'] },
  { id: 'pro', name: 'Pro', price: 24900, features: ['Produits illimités', 'Ventes illimitées', '10 utilisateurs', 'Toutes intégrations', 'API access', 'Support prioritaire'] },
]

type SettingsTab = 'profile' | 'business' | 'billing' | 'notifications' | 'security'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
  const [currentPlan] = useState('starter')

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'Profil', icon: <User size={15} /> },
    { id: 'business', label: 'Entreprise', icon: <Building size={15} /> },
    { id: 'billing', label: 'Abonnement', icon: <CreditCard size={15} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={15} /> },
    { id: 'security', label: 'Sécurité', icon: <Shield size={15} /> },
  ]

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
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-[#4f6ef7]/10 text-[#4f6ef7] border border-[#4f6ef7]/20' : 'text-[#8892aa] hover:text-[#f0f2f8] hover:bg-white/[0.04]'}`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 space-y-4">
            {activeTab === 'profile' && (
              <Card>
                <h3 className="text-sm font-semibold text-[#f0f2f8] mb-5">Informations personnelles</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Prénom" defaultValue="Moussa" />
                    <Input label="Nom" defaultValue="Diallo" />
                  </div>
                  <Input label="Email" type="email" defaultValue="moussa@example.com" />
                  <Input label="Téléphone" type="tel" defaultValue="+221 77 123 45 67" />
                  <Select label="Langue" options={[{ value: 'fr', label: 'Français' }, { value: 'wolof', label: 'Wolof' }, { value: 'en', label: 'English' }]} />
                  <div className="flex justify-end pt-2">
                    <Button variant="primary">Sauvegarder</Button>
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'business' && (
              <Card>
                <h3 className="text-sm font-semibold text-[#f0f2f8] mb-5">Informations entreprise</h3>
                <div className="space-y-4">
                  <Input label="Nom de l'entreprise" defaultValue="Diallo Commerce" />
                  <Input label="NINEA / RCCM" placeholder="ex: 001234567 2A1" />
                  <Input label="Adresse" defaultValue="Marché Sandaga, Dakar" />
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Ville" defaultValue="Dakar" />
                    <Select label="Devise principale" options={[
                      { value: 'XOF', label: 'FCFA (XOF)' },
                      { value: 'EUR', label: 'Euro (EUR)' },
                      { value: 'USD', label: 'Dollar (USD)' },
                    ]} />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <div>
                      <p className="text-sm font-medium text-[#f0f2f8]">TVA activée</p>
                      <p className="text-xs text-[#8892aa]">Appliquer la TVA (18%) sur les ventes</p>
                    </div>
                    <button className="w-11 h-6 rounded-full bg-white/[0.06] relative transition-colors">
                      <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-[#8892aa] transition-transform" />
                    </button>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="primary">Sauvegarder</Button>
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'billing' && (
              <div className="space-y-4">
                <Card>
                  <h3 className="text-sm font-semibold text-[#f0f2f8] mb-5">Choisir un plan</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {PLANS.map((plan) => (
                      <div
                        key={plan.id}
                        className={`relative p-4 rounded-2xl border transition-all ${currentPlan === plan.id ? 'border-[#4f6ef7] bg-[#4f6ef7]/5' : 'border-white/[0.08] hover:border-white/[0.16]'}`}
                      >
                        {plan.id === 'starter' && (
                          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#4f6ef7] text-[10px] text-white font-medium">
                            Populaire
                          </div>
                        )}
                        <h4 className="text-sm font-bold text-[#f0f2f8]">{plan.name}</h4>
                        <p className="text-xl font-bold text-[#f0f2f8] mt-1">
                          {plan.price === 0 ? 'Gratuit' : `${plan.price.toLocaleString('fr-SN')} F`}
                          {plan.price > 0 && <span className="text-xs text-[#8892aa] font-normal">/mois</span>}
                        </p>
                        <ul className="mt-3 space-y-1.5">
                          {plan.features.map((f) => (
                            <li key={f} className="flex items-center gap-2 text-xs text-[#8892aa]">
                              <Check size={12} className="text-emerald-400 flex-shrink-0" />
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
                <h3 className="text-sm font-semibold text-[#f0f2f8] mb-5">Préférences de notifications</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Stock faible', desc: 'Alerte quand un produit atteint le stock minimum', enabled: true },
                    { label: 'Nouvelle vente', desc: 'Notification pour chaque vente complétée', enabled: true },
                    { label: 'Rapport journalier', desc: 'Résumé des ventes à 20h chaque jour', enabled: false },
                    { label: 'Rapport hebdomadaire', desc: 'Rapport complet chaque lundi matin', enabled: true },
                    { label: 'Synchronisation étranger', desc: 'Quand vos produits étranger sont synchronisés', enabled: true },
                  ].map((notif) => (
                    <div key={notif.label} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                      <div>
                        <p className="text-sm font-medium text-[#f0f2f8]">{notif.label}</p>
                        <p className="text-xs text-[#8892aa]">{notif.desc}</p>
                      </div>
                      <button
                        className={`w-11 h-6 rounded-full relative transition-all duration-200 ${notif.enabled ? 'bg-[#4f6ef7]' : 'bg-white/[0.06]'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${notif.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {activeTab === 'security' && (
              <Card>
                <h3 className="text-sm font-semibold text-[#f0f2f8] mb-5">Sécurité du compte</h3>
                <div className="space-y-4">
                  <Input label="Mot de passe actuel" type="password" placeholder="••••••••" />
                  <Input label="Nouveau mot de passe" type="password" placeholder="••••••••" />
                  <Input label="Confirmer le mot de passe" type="password" placeholder="••••••••" />
                  <div className="flex justify-end">
                    <Button variant="primary">Modifier le mot de passe</Button>
                  </div>
                  <div className="border-t border-white/[0.06] pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[#f0f2f8]">Authentification à deux facteurs</p>
                        <p className="text-xs text-[#8892aa]">Sécurisez votre compte avec 2FA</p>
                      </div>
                      <Button variant="outline" size="sm">Activer</Button>
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
