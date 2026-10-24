import { createRoot } from 'react-dom/client'
import ExpensesPage from '../src/app/(dashboard)/expenses/page'
import { Sidebar } from '../src/components/layout/Sidebar'

createRoot(document.getElementById('root')!).render(<div className="flex"><Sidebar /><div className="min-w-0 flex-1"><ExpensesPage /></div></div>)
