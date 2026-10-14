import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BarcodeLabelsModal } from '../src/components/inventory/BarcodeLabelsModal'
import type { Product } from '../src/types'

const variants = [
  { name: 'Telephone portable avec double SIM et protection', size: '128 Go', color: 'Noir', barcode: '2901234567896', sku: 'TEL-128-NOIR' },
  { name: 'Clavier USB', size: '', color: 'Blanc', barcode: 'CLAVIER-USB-01', sku: 'REFERENCE-TRES-LONGUE-POUR-VERIFIER-LE-CADRAGE' },
  { name: 'Adaptateur', size: '', color: '', barcode: '96385074', sku: '' },
  { name: 'Souris USB', size: '', color: 'Gris', barcode: '012345678905', sku: 'SOURIS-1' },
]
const products: Product[] = variants.map((variant, index) => ({
  ...variant, id: `test-${index}`, user_id: 'test', category_id: '', buying_price: 500, selling_price: 999998,
  quantity: 10, min_quantity: 1, currency: 'XOF', status: 'active', created_at: '', updated_at: '',
}))
function App() {
  const [open, setOpen] = useState(true)
  return <main><button onClick={() => setOpen(true)}>Etiquettes test</button>
    <BarcodeLabelsModal group={null} products={products} isOpen={open} onClose={() => setOpen(false)} title="ETIQUETTES TEST" />
  </main>
}
createRoot(document.getElementById('root')!).render(<App />)
