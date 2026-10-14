'use client'

import { useRef, useState } from 'react'
import { Camera, ImageIcon, LoaderCircle, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { compressImage } from '@/lib/utils'

interface ProductPhotoPickerProps {
  value: string
  onChange: (image: string) => void
  onBusyChange: (busy: boolean) => void
  disabled?: boolean
}

export function ProductPhotoPicker({ value, onChange, onBusyChange, disabled }: ProductPhotoPickerProps) {
  const uploadRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || busy || disabled) return
    setError('')
    if (!file.type.startsWith('image/') || file.size > 15 * 1024 * 1024) {
      setError('Choisissez une image de moins de 15 Mo.')
      return
    }
    setBusy(true)
    onBusyChange(true)
    try {
      // Keep offline drafts small enough for the existing local persistence.
      const image = await compressImage(file, 700, 0.72)
      if (image.length > 300_000) throw new Error('Photo trop volumineuse. Choisissez une image plus petite.')
      onChange(image)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de charger l'image.")
    } finally {
      setBusy(false)
      onBusyChange(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-[#2D7D7D]/10 bg-[#F4F7FB]">
          {busy ? <LoaderCircle className="m-auto h-full animate-spin text-[#6C5CE7]" size={22} aria-label="Chargement de la photo" />
            : value ? <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value} alt="Apercu du produit" className="h-full w-full object-contain p-1.5" />
              <button type="button" title="Retirer la photo" aria-label="Retirer la photo" disabled={disabled}
                onClick={() => { onChange(''); setError('') }}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-50">
                <X size={14} />
              </button>
            </> : <ImageIcon size={24} className="m-auto h-full text-[#9AA7AE]" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-xs font-medium text-[#5C6B73]">Photo du produit</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" leftIcon={<Upload size={14} />}
              disabled={busy || disabled} onClick={() => uploadRef.current?.click()}>Charger</Button>
            <Button type="button" variant="outline" size="sm" leftIcon={<Camera size={14} />}
              disabled={busy || disabled} onClick={() => cameraRef.current?.click()}>Photo</Button>
          </div>
          <input ref={uploadRef} type="file" accept="image/*" aria-label="Charger une photo du produit" onChange={handleFile} disabled={busy || disabled} className="hidden" />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" aria-label="Prendre une photo du produit" onChange={handleFile} disabled={busy || disabled} className="hidden" />
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
