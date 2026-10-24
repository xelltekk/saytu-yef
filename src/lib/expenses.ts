export const EXPENSE_CATEGORIES = [
  { value: 'rent', label: 'Loyer' }, { value: 'utilities', label: 'Eau, electricite et internet' },
  { value: 'transport', label: 'Transport' }, { value: 'wages', label: 'Salaires' },
  { value: 'marketing', label: 'Publicite' }, { value: 'maintenance', label: 'Entretien et reparations' },
  { value: 'fees', label: 'Frais et commissions' }, { value: 'other', label: 'Autres frais (hors achats de stock)' },
] as const
export const EXPENSE_METHODS = [
  { value: 'cash', label: 'Especes' }, { value: 'wave', label: 'Wave' }, { value: 'orange_money', label: 'Orange Money' },
  { value: 'card', label: 'Carte' }, { value: 'bank_transfer', label: 'Virement' }, { value: 'other', label: 'Autre' },
] as const
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]['value']
export type ExpenseMethod = typeof EXPENSE_METHODS[number]['value']
export type ExpenseDraft = {
  label: string; category: ExpenseCategory; amount: number; expense_date: string; payment_method: ExpenseMethod; notes: string; receipt_path: string | null
}
export type Expense = ExpenseDraft & {
  id: string; user_id: string; currency: 'XOF'; created_at: string; updated_at: string; revision: number; voided_at: string | null
}
export type ExpenseSummary = {
  ownerId: string; startDate: string; endExclusive: string; version: string; count: number; total: number
  byCategory: { category: ExpenseCategory; total: number; count: number }[]
  byMonth: { month: string; total: number; count: number }[]
}
export type ExpensePage = ExpenseSummary & { expenses: Expense[]; offset: number; limit: number }
export type ExpenseOptions = { startDate: string; endExclusive: string; category?: string; offset?: number; limit?: number }
export const expenseCategoryLabel = (value: string) => EXPENSE_CATEGORIES.find((item) => item.value === value)?.label ?? value
export const expenseMethodLabel = (value: string) => EXPENSE_METHODS.find((item) => item.value === value)?.label ?? value

export function isBusinessOwner(actorId?: string | null, ownerId?: string | null, role?: string | null) {
  return !!actorId && actorId === ownerId && role === 'admin'
}
export function dateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
export function expenseMonthRange(month: string) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Choisissez un mois valide.')
  const [year, index] = month.split('-').map(Number)
  return { startDate: `${month}-01`, endExclusive: dateInputValue(new Date(year,index,1)) }
}
export function validateExpense(draft: ExpenseDraft) {
  if (!draft.label.trim() || draft.label.trim().length > 160) throw new Error('Le libelle doit contenir entre 1 et 160 caracteres.')
  if (!Number.isSafeInteger(draft.amount) || draft.amount <= 0 || draft.amount > 999999999999) throw new Error('Saisissez un montant entier positif en FCFA (maximum 999 999 999 999).')
  if (!EXPENSE_CATEGORIES.some((item) => item.value === draft.category) || !EXPENSE_METHODS.some((item) => item.value === draft.payment_method)) throw new Error('Categorie ou paiement invalide.')
  const date = new Date(`${draft.expense_date}T12:00:00`)
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(draft.expense_date) || !Number.isFinite(date.getTime()) || dateInputValue(date) !== draft.expense_date) throw new Error('Date de depense invalide.')
  if (draft.notes.length > 2000) throw new Error('Les notes ne doivent pas depasser 2000 caracteres.')
}

export async function prepareExpenseReceipt(file: File): Promise<Blob> {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5*1024*1024) throw new Error('Choisissez une photo JPG, PNG ou WebP de 5 Mo maximum.')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    if (image.naturalWidth*image.naturalHeight > 24000000) throw new Error('Image trop grande. Choisissez une photo de moins de 24 megapixels.')
    const scale = Math.min(1,1800/Math.max(image.naturalWidth,image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1,Math.round(image.naturalWidth*scale))
    canvas.height = Math.max(1,Math.round(image.naturalHeight*scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Preparation de la photo impossible.')
    context.fillStyle = '#fff'
    context.fillRect(0,0,canvas.width,canvas.height)
    context.drawImage(image,0,0,canvas.width,canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve,'image/jpeg',0.88))
    if (!blob || blob.size > 5*1024*1024) throw new Error('Photo trop volumineuse apres preparation.')
    return blob
  } finally { URL.revokeObjectURL(url) }
}
