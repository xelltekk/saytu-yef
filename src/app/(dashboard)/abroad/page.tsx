import { Header } from '@/components/layout/Header'
import { AbroadBatchEntry } from '@/components/inventory/AbroadBatchEntry'

export default function AbroadPage() {
  return (
    <div className="min-h-screen">
      <Header title="Saisie depuis l'Étranger" subtitle="Enregistrez vos achats en déplacement (hors ligne)" />
      <div className="p-4 lg:p-6">
        <AbroadBatchEntry />
      </div>
    </div>
  )
}
