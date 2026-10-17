import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { POSInterface } from '../src/components/sales/POSInterface'
import { ProductTable } from '../src/components/inventory/ProductTable'
import { useSalesStore } from '../src/store/salesStore'
import { AddProductModal } from '../src/components/inventory/AddProductModal'
import { PaymentModal } from '../src/components/sales/PaymentModal'

function App() {
  const [mode, setMode] = useState('pos')
  const [edited, setEdited] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [addOpen, setAddOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const cart = useSalesStore((state) => state.cart)
  return <main className="mx-auto max-w-[1500px] p-3 sm:p-6">
    <header className="mb-4 flex flex-wrap items-center gap-3 border-b pb-3">
      <button onClick={() => setMode('pos')}>Test POS</button>
      <button onClick={() => setMode('inventory')}>Test inventaire</button>
      <button onClick={() => setRefresh((n) => n + 1)}>Test actualiser</button>
      <button onClick={() => setAddOpen(true)}>Test nouveau produit</button>
      <output data-testid="cart">{cart.map((item) => `${item.product_id}:${item.quantity}`).join(',')}</output>
      <output data-testid="edited">{edited}</output>
    </header>
    <AddProductModal isOpen={addOpen} onClose={() => setAddOpen(false)} onSaved={() => setRefresh((n) => n + 1)} />
    <PaymentModal isOpen={paymentOpen} onClose={() => setPaymentOpen(false)} />
    {mode === 'pos' ? <POSInterface refreshKey={refresh} onCheckout={() => setPaymentOpen(true)} />
      : <ProductTable refreshKey={refresh} onAddProduct={() => {}} onEditProduct={(group) => setEdited(`${group.id}:${group.variants.length}:${Boolean(group.image_url)}`)} />}
  </main>
}
createRoot(document.getElementById('root')!).render(<App />)
