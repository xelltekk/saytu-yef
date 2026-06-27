'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, CheckCircle2, Phone, ReceiptText } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { createClient } from '@/lib/supabase/client'
import { useAccountRole } from '@/hooks/useAccountRole'

type BusinessForm = {
  businessName: string
  phone: string
  address: string
  currency: string
  taxEnabled: boolean
}

type ProfileRecord = {
  business_name: string | null
  business_address: string | null
  phone: string | null
  currency: string | null
  tax_enabled: boolean | null
}

const CURRENCY_OPTIONS = [
  { value: 'XOF', label: 'FCFA (XOF)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'USD', label: 'Dollar (USD)' },
]

function isBusinessReady(form: BusinessForm) {
  return form.businessName.trim().length >= 2 && form.phone.trim().length >= 6
}

export function BusinessOnboarding() {
  const { isAdmin, loading: loadingRole } = useAccountRole()
  const [userId, setUserId] = useState('')
  const [open, setOpen] = useState(false)
  const [checked, setChecked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<BusinessForm>({
    businessName: '',
    phone: '',
    address: '',
    currency: 'XOF',
    taxEnabled: false,
  })

  const sessionKey = useMemo(() => (userId ? `saytu-yef:onboarding-dismissed:${userId}` : ''), [userId])

  const loadBusiness = useCallback(async () => {
    if (loadingRole) return
    if (!isAdmin) {
      setChecked(true)
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setChecked(true)
      return
    }

    setUserId(user.id)
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('business_name,business_address,phone,currency,tax_enabled')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error(profileError)
      setChecked(true)
      return
    }

    const profile = (data ?? {}) as Partial<ProfileRecord>
    const metadata = user.user_metadata ?? {}
    const nextForm = {
      businessName: profile.business_name || (metadata.business_name as string) || '',
      phone: profile.phone || (metadata.phone as string) || '',
      address: profile.business_address || (metadata.address as string) || '',
      currency: profile.currency || (metadata.currency as string) || 'XOF',
      taxEnabled: Boolean(profile.tax_enabled ?? metadata.tva_enabled),
    }

    setForm(nextForm)
    setChecked(true)

    const dismissed = window.sessionStorage.getItem(`saytu-yef:onboarding-dismissed:${user.id}`) === '1'
    if (!isBusinessReady(nextForm) && !dismissed) {
      setOpen(true)
    }
  }, [isAdmin, loadingRole])

  useEffect(() => {
    void loadBusiness()
  }, [loadBusiness])

  const dismissForSession = () => {
    if (sessionKey) window.sessionStorage.setItem(sessionKey, '1')
    setOpen(false)
  }

  const saveBusiness = async () => {
    if (!userId) return
    if (!form.businessName.trim()) {
      setError('Ajoutez le nom de la boutique.')
      return
    }
    if (!form.phone.trim()) {
      setError('Ajoutez le téléphone de la boutique.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const supabase = createClient()
      const payload = {
        business_name: form.businessName.trim(),
        business_address: form.address.trim() || null,
        phone: form.phone.trim(),
        currency: form.currency,
        tax_enabled: form.taxEnabled,
        tax_rate: form.taxEnabled ? 18 : 0,
        updated_at: new Date().toISOString(),
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', userId)
      if (profileError) throw profileError

      const { error: authError } = await supabase.auth.updateUser({
        data: { business_name: payload.business_name },
      })
      if (authError) throw authError

      if (sessionKey) window.sessionStorage.setItem(sessionKey, '1')
      setOpen(false)
    } catch (saveError: unknown) {
      console.error(saveError)
      setError(saveError instanceof Error ? saveError.message : 'Impossible d’enregistrer la boutique.')
    } finally {
      setSaving(false)
    }
  }

  if (!checked) return null

  return (
    <Modal
      isOpen={open}
      onClose={dismissForSession}
      title="Finaliser votre boutique"
      size="md"
      footer={
        <>
          <Button variant="ghost" className="w-full sm:w-auto" onClick={dismissForSession} disabled={saving}>
            Plus tard
          </Button>
          <Button variant="primary" className="w-full sm:w-auto" onClick={() => void saveBusiness()} isLoading={saving}>
            Enregistrer la boutique
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-[#2D7D7D]/10 bg-[#F4F7FB] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2D7D7D]/10 text-[#2D7D7D]">
              <Building2 size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1A3636]">Une bonne fiche boutique rend l’app prête à vendre.</p>
              <p className="mt-1 text-xs leading-relaxed text-[#5C6B73]">
                Ces informations apparaissent sur les reçus, les relances clients et les exports.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-600">
            {error}
          </div>
        )}

        <Input
          label="Nom de la boutique"
          value={form.businessName}
          onChange={(event) => setForm((current) => ({ ...current, businessName: event.target.value }))}
          placeholder="Ex : Chez Awa Télécom"
          leftAddon={<Building2 size={14} />}
          required
        />

        <Input
          label="Téléphone boutique"
          type="tel"
          value={form.phone}
          onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
          placeholder="+221 77 123 45 67"
          leftAddon={<Phone size={14} />}
          required
        />

        <Input
          label="Adresse"
          value={form.address}
          onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
          placeholder="Marché, quartier ou ville"
          leftAddon={<ReceiptText size={14} />}
          hint="Optionnel, mais conseillé pour les reçus."
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Devise principale"
            value={form.currency}
            onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}
            options={CURRENCY_OPTIONS}
          />
          <button
            type="button"
            onClick={() => setForm((current) => ({ ...current, taxEnabled: !current.taxEnabled }))}
            className={`flex h-12 items-center justify-between rounded-full border px-4 text-sm transition-all ${
              form.taxEnabled
                ? 'border-[#6C5CE7]/30 bg-[#6C5CE7]/10 text-[#1A3636]'
                : 'border-[#2D7D7D]/[0.14] bg-white text-[#5C6B73]'
            }`}
          >
            <span>TVA 18%</span>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full ${form.taxEnabled ? 'bg-[#6C5CE7] text-white' : 'bg-[#F4F7FB] text-transparent'}`}>
              <CheckCircle2 size={15} />
            </span>
          </button>
        </div>
      </div>
    </Modal>
  )
}
