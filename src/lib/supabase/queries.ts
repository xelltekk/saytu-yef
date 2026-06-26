import { createClient } from './client'
import type { Product, Category, Supplier, Sale, AbroadProduct, StockMovement, TeamMember } from '@/types'

export async function getTeamContext(): Promise<{ current: TeamMember; members: TeamMember[] }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connecté')

  const { data: members, error } = await supabase
    .from('profiles')
    .select('id,email,full_name,role,account_owner_id,created_at')
    .order('created_at')
  if (error) throw error

  const current = (members ?? []).find((member) => member.id === user.id)
  if (!current) throw new Error('Profil introuvable')
  return { current: current as TeamMember, members: (members ?? []) as TeamMember[] }
}

export async function addTeamMember(email: string, role: TeamMember['role']): Promise<TeamMember> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('add_team_member', { p_email: email, p_role: role })
  if (error) throw error
  return data as TeamMember
}

export async function updateTeamMemberRole(id: string, role: TeamMember['role']): Promise<TeamMember> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('update_team_member_role', { p_member_id: id, p_role: role })
  if (error) throw error
  return data as TeamMember
}

export async function removeTeamMember(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc('remove_team_member', { p_member_id: id })
  if (error) throw error
}

// ─── PRODUITS ────────────────────────────────────────────────────────────────

export async function getProducts(): Promise<Product[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(id,name,color,user_id,created_at), supplier:suppliers(id,name,country,user_id,created_at)')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Product[]
}

export async function addProduct(product: Omit<Product, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'category' | 'supplier'>): Promise<Product> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connecté')

  const { data, error } = await supabase
    .from('products')
    .insert({ ...product, user_id: user.id })
    .select()
    .single()

  if (error) throw error
  return data as Product
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('products')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

export async function deleteProduct(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}

export async function adjustStock(id: string, quantityChange: number, reason?: string): Promise<number> {
  if (!Number.isInteger(quantityChange) || quantityChange === 0) {
    throw new Error('La quantité doit être un nombre entier différent de zéro')
  }

  const supabase = createClient()
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('quantity')
    .eq('id', id)
    .single()

  if (productError) throw productError
  if (!product) throw new Error('Produit introuvable')

  const newQuantity = product.quantity + quantityChange
  if (newQuantity < 0) throw new Error('La sortie dépasse le stock disponible')

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('Non connecté')

  const { error: updateError } = await supabase
    .from('products')
    .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (updateError) throw updateError

  const { error: movementError } = await supabase
    .from('stock_movements')
    .insert({
      user_id: user.id,
      product_id: id,
      movement_type: quantityChange > 0 ? 'in' : 'out',
      quantity: Math.abs(quantityChange),
      previous_quantity: product.quantity,
      new_quantity: newQuantity,
      reason,
    })
  if (movementError) {
    await supabase
      .from('products')
      .update({ quantity: product.quantity, updated_at: new Date().toISOString() })
      .eq('id', id)
    throw movementError
  }

  return newQuantity
}

export async function getStockMovements(productId: string, currentQuantity: number, limit = 50): Promise<StockMovement[]> {
  const supabase = createClient()
  const [movementsResult, saleItemsResult] = await Promise.all([
    supabase
      .from('stock_movements')
      .select('id,user_id,product_id,movement_type,quantity,previous_quantity,new_quantity,reason,created_at')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('sale_items')
      .select('id,sale_id,product_id,quantity,created_at')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(limit),
  ])

  if (movementsResult.error) throw movementsResult.error
  if (saleItemsResult.error) throw saleItemsResult.error

  const movements = (movementsResult.data ?? []) as StockMovement[]
  const representedSaleIds = new Set(
    movements
      .map((movement) => movement.reason?.match(/^Vente ([0-9a-f-]+)$/i)?.[1])
      .filter((saleId): saleId is string => !!saleId)
  )
  const saleMovements: StockMovement[] = (saleItemsResult.data ?? [])
    .filter((item) => !representedSaleIds.has(item.sale_id))
    .map((item) => ({
      id: `sale-item:${item.id}`,
      user_id: '',
      product_id: item.product_id,
      movement_type: 'out',
      quantity: item.quantity,
      previous_quantity: 0,
      new_quantity: 0,
      reason: `Vente ${item.sale_id}`,
      created_at: item.created_at,
    }))

  let runningQuantity = currentQuantity
  return [...movements, ...saleMovements]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)
    .map((movement) => {
      if (movement.id.startsWith('sale-item:')) {
        const reconstructed = {
          ...movement,
          previous_quantity: runningQuantity + movement.quantity,
          new_quantity: runningQuantity,
        }
        runningQuantity = reconstructed.previous_quantity
        return reconstructed
      }

      runningQuantity = movement.previous_quantity
      return movement
    })
}

// ─── CATÉGORIES ───────────────────────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name')

  if (error) throw error
  return (data ?? []) as Category[]
}

export async function addCategory(name: string, color: string): Promise<Category> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('categories')
    .insert({ name, color, user_id: user!.id })
    .select()
    .single()

  if (error) throw error
  return data as Category
}

export async function updateCategory(id: string, updates: { name?: string; color?: string }): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('categories').update(updates).eq('id', id)
  if (error) throw error
}

export async function deleteCategory(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
}

// ─── FOURNISSEURS ─────────────────────────────────────────────────────────────

export async function getSuppliers(): Promise<Supplier[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('name')

  if (error) throw error
  return (data ?? []) as Supplier[]
}

// ─── VENTES ───────────────────────────────────────────────────────────────────

export async function addSupplier(
  supplier: Omit<Supplier, 'id' | 'user_id' | 'created_at'>
): Promise<Supplier> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connecté')

  const { data, error } = await supabase
    .from('suppliers')
    .insert({ ...supplier, user_id: user.id })
    .select()
    .single()

  if (error) throw error
  return data as Supplier
}

export async function updateSupplier(
  id: string,
  updates: Partial<Omit<Supplier, 'id' | 'user_id' | 'created_at'>>
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('suppliers').update(updates).eq('id', id)
  if (error) throw error
}

export async function deleteSupplier(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('suppliers').delete().eq('id', id)
  if (error) throw error
}

export async function getSales(limit = 50, offset = 0): Promise<Sale[]> {
  const supabase = createClient()
  const pageSize = Math.max(1, Math.floor(limit))
  const start = Math.max(0, Math.floor(offset))
  const end = start + pageSize - 1
  const { data, error } = await supabase
    .from('sales')
    .select('*, items:sale_items(*), payments:sale_payments(*)')
    .order('created_at', { ascending: false })
    .range(start, end)

  if (error && isMissingSchemaObject(error, 'sale_payments')) {
    const fallback = await supabase
      .from('sales')
      .select('*, items:sale_items(*)')
      .order('created_at', { ascending: false })
      .range(start, end)

    if (fallback.error) throw fallback.error
    return (fallback.data ?? []) as Sale[]
  }

  if (error) throw error
  return (data ?? []) as Sale[]
}

type CreateSaleInput = {
  customer_name?: string
  customer_phone?: string
  items: { product_id: string; product_name: string; quantity: number; unit_price: number; total: number }[]
  subtotal: number
  discount: number
  tax: number
  total: number
  amount_paid?: number
  payment_method: 'cash' | 'wave' | 'orange_money' | 'card'
  notes?: string
}

type RecordSalePaymentInput = {
  amount: number
  payment_method: 'cash' | 'wave' | 'orange_money' | 'card'
  note?: string
}

type SupabaseLikeError = {
  code?: string
  message?: string
  details?: string
  hint?: string
}

function getSupabaseErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const err = error as SupabaseLikeError
    const parts = [err.message, err.details, err.hint].filter(Boolean)
    if (parts.length > 0) return parts.join(' ')
  }
  if (typeof error === 'string' && error.trim()) return error
  return fallback
}

function isMissingRpc(error: unknown, rpcName: string): boolean {
  if (!error || typeof error !== 'object') return false
  const err = error as SupabaseLikeError
  const code = err.code ?? ''
  const text = `${err.message ?? ''} ${err.details ?? ''} ${err.hint ?? ''}`.toLowerCase()

  return (
    code === 'PGRST202' ||
    code === '42883' ||
    (
      text.includes(rpcName.toLowerCase()) &&
      (text.includes('could not find') || text.includes('does not exist') || text.includes('schema cache'))
    )
  )
}

function isMissingSchemaObject(error: unknown, objectName: string): boolean {
  if (!error || typeof error !== 'object') return false
  const err = error as SupabaseLikeError
  const code = err.code ?? ''
  const text = `${err.message ?? ''} ${err.details ?? ''} ${err.hint ?? ''}`.toLowerCase()

  return (
    code === 'PGRST200' ||
    code === '42P01' ||
    code === '42703' ||
    (
      text.includes(objectName.toLowerCase()) &&
      (text.includes('could not find') || text.includes('does not exist') || text.includes('relationship'))
    )
  )
}

function normalizeAmountPaid(total: number, amountPaid?: number): number {
  if (typeof amountPaid !== 'number' || Number.isNaN(amountPaid)) return total
  return Math.max(0, Math.min(amountPaid, total))
}

function getPartialPaymentSetupMessage(): string {
  return 'Les paiements partiels demandent la mise a jour SQL Supabase du module dettes clients.'
}

function throwSupabaseError(error: unknown, fallback: string): never {
  throw new Error(getSupabaseErrorMessage(error, fallback))
}

async function createSaleLegacy(sale: CreateSaleInput, userId: string): Promise<Sale> {
  const amountPaid = normalizeAmountPaid(sale.total, sale.amount_paid)
  if (Math.abs(amountPaid - sale.total) > 0.001) {
    throw new Error(getPartialPaymentSetupMessage())
  }

  const supabase = createClient()
  const productIds = sale.items.map((item) => item.product_id)
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, quantity')
    .in('id', productIds)

  if (productsError) throwSupabaseError(productsError, 'Impossible de vérifier le stock')

  for (const item of sale.items) {
    const product = products?.find((p) => p.id === item.product_id)
    if (!product) throw new Error(`Produit introuvable: ${item.product_name}`)
    if (product.quantity < item.quantity) {
      throw new Error(`Stock insuffisant pour ${product.name}. Disponible: ${product.quantity}`)
    }
  }

  const { data: saleData, error: saleError } = await supabase
    .from('sales')
    .insert({
      user_id: userId,
      customer_name: sale.customer_name,
      customer_phone: sale.customer_phone,
      subtotal: sale.subtotal,
      discount: sale.discount,
      tax: sale.tax,
      total: sale.total,
      payment_method: sale.payment_method,
      payment_status: 'completed',
      notes: sale.notes,
    })
    .select()
    .single()

  if (saleError) throwSupabaseError(saleError, 'Impossible de créer la vente')

  const { error: itemsError } = await supabase
    .from('sale_items')
    .insert(
      sale.items.map((item) => ({
        sale_id: saleData.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
      }))
    )

  if (itemsError) {
    await supabase.from('sales').delete().eq('id', saleData.id)
    throwSupabaseError(itemsError, "Impossible d'enregistrer les articles de la vente")
  }

  return { ...saleData, items: sale.items } as Sale
}

export async function createSale(sale: CreateSaleInput): Promise<Sale> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connecté')

  const amountPaid = normalizeAmountPaid(sale.total, sale.amount_paid)
  const isPartialPayment = Math.abs(amountPaid - sale.total) > 0.001

  const { data, error } = await supabase
    .rpc('create_sale_with_items_v2', {
      p_customer_name: sale.customer_name ?? null,
      p_customer_phone: sale.customer_phone ?? null,
      p_items: sale.items,
      p_subtotal: sale.subtotal,
      p_discount: sale.discount,
      p_tax: sale.tax,
      p_total: sale.total,
      p_amount_paid: amountPaid,
      p_payment_method: sale.payment_method,
      p_notes: sale.notes ?? null,
    })

  if (error) {
    if (isMissingRpc(error, 'create_sale_with_items_v2')) {
      if (isPartialPayment) {
        throw new Error(getPartialPaymentSetupMessage())
      }

      const { data: legacyData, error: legacyError } = await supabase
        .rpc('create_sale_with_items', {
          p_customer_name: sale.customer_name ?? null,
          p_customer_phone: sale.customer_phone ?? null,
          p_items: sale.items,
          p_subtotal: sale.subtotal,
          p_discount: sale.discount,
          p_tax: sale.tax,
          p_total: sale.total,
          p_payment_method: sale.payment_method,
          p_notes: sale.notes ?? null,
        })

      if (legacyError) {
        if (isMissingRpc(legacyError, 'create_sale_with_items')) {
          return createSaleLegacy(sale, user.id)
        }

        throwSupabaseError(legacyError, 'Erreur lors du paiement')
      }

      return { ...(legacyData as Omit<Sale, 'items'>), items: sale.items } as Sale
    }

    throwSupabaseError(
      error,
      isPartialPayment ? "Erreur lors de l'enregistrement du paiement partiel" : 'Erreur lors du paiement'
    )
  }

  return { ...(data as Omit<Sale, 'items'>), items: sale.items } as Sale
}

export async function updateSale(id: string, updates: {
  customer_name?: string
  customer_phone?: string
  payment_method?: 'cash' | 'wave' | 'orange_money' | 'card'
  payment_status?: 'completed' | 'partial' | 'pending' | 'cancelled' | 'refunded'
  notes?: string
}): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('sales').update(updates).eq('id', id)
  if (error) throw error
}

export async function recordSalePayment(id: string, payment: RecordSalePaymentInput): Promise<Sale> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('record_sale_payment', {
    p_sale_id: id,
    p_amount: payment.amount,
    p_payment_method: payment.payment_method,
    p_note: payment.note ?? null,
  })

  if (error) {
    if (isMissingRpc(error, 'record_sale_payment')) {
      throw new Error(getPartialPaymentSetupMessage())
    }

    throwSupabaseError(error, "Erreur lors de l'enregistrement du versement")
  }

  return data as Sale
}

// ─── PRODUITS ÉTRANGER ────────────────────────────────────────────────────────

export async function reverseSale(
  id: string,
  targetStatus: 'cancelled' | 'refunded',
  reason: string
): Promise<Sale> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('reverse_sale_with_stock', {
    p_sale_id: id,
    p_target_status: targetStatus,
    p_reason: reason.trim(),
  })

  if (error) {
    if (isMissingRpc(error, 'reverse_sale_with_stock')) {
      throw new Error('La migration d’annulation et remboursement doit être appliquée dans Supabase.')
    }

    throwSupabaseError(
      error,
      targetStatus === 'refunded'
        ? 'Erreur lors du remboursement de la vente'
        : 'Erreur lors de l’annulation de la vente'
    )
  }

  return data as Sale
}

export async function getAbroadProducts(): Promise<AbroadProduct[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('abroad_products')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as AbroadProduct[]
}

export async function saveAbroadProduct(product: Omit<AbroadProduct, 'id' | 'user_id' | 'created_at'>): Promise<AbroadProduct> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('abroad_products')
    .insert({ ...product, user_id: user!.id })
    .select()
    .single()

  if (error) throw error
  return data as AbroadProduct
}

export async function updateAbroadProductRecord(
  id: string,
  updates: Partial<Omit<AbroadProduct, 'id' | 'user_id' | 'created_at'>>
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('abroad_products').update(updates).eq('id', id)
  if (error) throw error
}

export async function activateAbroadProduct(
  abroadId: string,
  productPayload: Omit<Product, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'category' | 'supplier'>,
  conversion?: Pick<AbroadProduct, 'exchange_rate' | 'converted_purchase_price' | 'rate_source' | 'rate_updated_at'>
): Promise<Product> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Créer le produit dans l'inventaire principal
  const { data: newProduct, error: productError } = await supabase
    .from('products')
    .insert({ ...productPayload, user_id: user!.id })
    .select()
    .single()

  if (productError) throw productError

  // Marquer comme activé dans abroad_products
  await supabase
    .from('abroad_products')
    .update({ activated: true, synced: true, ...conversion })
    .eq('id', abroadId)

  return newProduct as Product
}

export async function deleteAbroadProduct(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('abroad_products').delete().eq('id', id)
  if (error) throw error
}

// ─── MÉTRIQUES DASHBOARD ─────────────────────────────────────────────────────

export async function getDashboardMetrics() {
  const supabase = createClient()
  const activeSaleStatuses: Sale['payment_status'][] = ['completed', 'partial', 'pending']

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const [salesToday, salesMonth, products, recentSales] = await Promise.all([
    supabase
      .from('sales')
      .select('total, amount_due')
      .gte('created_at', today.toISOString())
      .in('payment_status', activeSaleStatuses),

    supabase
      .from('sales')
      .select('total, amount_due, created_at')
      .gte('created_at', startOfMonth.toISOString())
      .in('payment_status', activeSaleStatuses),

    supabase
      .from('products')
      .select('id, quantity, min_quantity, buying_price, selling_price, status'),

    supabase
      .from('sales')
      .select('*, items:sale_items(*)')
      .in('payment_status', activeSaleStatuses)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const dashboardError = salesToday.error ?? salesMonth.error ?? products.error ?? recentSales.error
  if (dashboardError) throw dashboardError

  const revenueToday = (salesToday.data ?? []).reduce((s, r) => s + Number(r.total), 0)
  const revenueMonth = (salesMonth.data ?? []).reduce((s, r) => s + Number(r.total), 0)
  const dueToday = (salesToday.data ?? []).reduce((sum, sale) => sum + Number(sale.amount_due ?? 0), 0)
  const dueMonth = (salesMonth.data ?? []).reduce((sum, sale) => sum + Number(sale.amount_due ?? 0), 0)
  const inventoryProducts = ((products.data ?? []) as unknown as Array<Pick<Product, 'quantity' | 'min_quantity' | 'buying_price' | 'selling_price' | 'status'>>)
  const activeProducts = inventoryProducts.filter((product) => product.status === 'active')
  const totalProducts = activeProducts.length
  const lowStockCount = activeProducts.filter((product) => product.quantity <= product.min_quantity).length

  // Calcul marge moyenne
  const validProducts = activeProducts.filter((product) => product.selling_price > 0)
  const avgMargin = validProducts.length
    ? validProducts.reduce((s, p) => s + ((p.selling_price - p.buying_price) / p.selling_price) * 100, 0) / validProducts.length
    : 0

  return {
    revenueToday,
    revenueMonth,
    dueToday,
    dueMonth,
    salesToday: salesToday.data?.length ?? 0,
    salesMonth: salesMonth.data?.length ?? 0,
    totalProducts,
    lowStockCount,
    avgMargin,
    recentSales: (recentSales.data ?? []) as Sale[],
    salesChartData: buildChartData(salesMonth.data ?? []),
  }
}

function buildChartData(sales: { total: number; created_at: string }[]) {
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
  const map: Record<string, number> = {}

  sales.forEach((s) => {
    const d = new Date(s.created_at)
    const label = days[d.getDay()]
    map[label] = (map[label] ?? 0) + Number(s.total)
  })

  return days.map((day) => ({ day, revenue: map[day] ?? 0 }))
}

// ─── RAPPORTS ─────────────────────────────────────────────────────────────────

export async function getReportsData(months = 6) {
  const supabase = createClient()
  const monthCount = Math.max(1, Math.floor(months))
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - monthCount + 1, 1)

  const [salesResult, productsResult] = await Promise.all([
    supabase
      .from('sales')
      .select('total, tax, created_at, items:sale_items(product_id, product_name, quantity, unit_price, total)')
      .gte('created_at', start.toISOString())
      .in('payment_status', ['completed', 'partial', 'pending'])
      .order('created_at'),
    supabase
      .from('products')
      .select('id, name, buying_price, selling_price, quantity'),
  ])

  if (salesResult.error) throw salesResult.error
  if (productsResult.error) throw productsResult.error

  const sales = salesResult.data ?? []
  const products = productsResult.data ?? []

  const productMap = Object.fromEntries(products.map((product) => [product.id, product]))

  // Données mensuelles
  const monthlyMap: Record<string, { month: string; revenue: number; profit: number }> = {}
  const productSales: Record<string, { name: string; sold: number; revenue: number; profit: number }> = {}

  for (let index = 0; index < monthCount; index += 1) {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    monthlyMap[key] = {
      month: date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
      revenue: 0,
      profit: 0,
    }
  }

  sales.forEach((sale) => {
    const saleDate = new Date(sale.created_at)
    const monthKey = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`
    const month = monthlyMap[monthKey]
    if (!month) return
    const netSaleRevenue = Math.max(0, Number(sale.total) - Number(sale.tax ?? 0))
    month.revenue += netSaleRevenue

    const saleItems = (sale.items ?? []) as { product_id: string | null; product_name: string; quantity: number; unit_price: number; total: number }[]
    const grossItemsTotal = saleItems.reduce((sum, item) => sum + Number(item.total), 0)
    const revenueFactor = grossItemsTotal > 0 ? netSaleRevenue / grossItemsTotal : 1

    saleItems.forEach((item) => {
      const prod = productMap[item.product_id ?? '']
      const quantity = Number(item.quantity)
      const revenue = Number(item.total) * revenueFactor
      const profit = prod ? revenue - Number(prod.buying_price) * quantity : 0
      month.profit += profit

      const productKey = item.product_id ?? `deleted:${item.product_name}`
      if (!productSales[productKey]) {
        productSales[productKey] = { name: item.product_name, sold: 0, revenue: 0, profit: 0 }
      }
      productSales[productKey].sold += quantity
      productSales[productKey].revenue += revenue
      productSales[productKey].profit += profit
    })
  })

  const allProductSales = Object.entries(productSales)
    .map(([id, v]) => ({ id, ...v, margin: v.revenue > 0 ? (v.profit / v.revenue) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue)
  const totalSold = allProductSales.reduce((sum, product) => sum + product.sold, 0)
  const totalProductRevenue = allProductSales.reduce((sum, product) => sum + product.revenue, 0)
  const totalProductProfit = allProductSales.reduce((sum, product) => sum + product.profit, 0)

  return {
    monthlyData: Object.values(monthlyMap),
    allProducts: allProductSales,
    topProducts: allProductSales.slice(0, 10),
    totalSold,
    avgMargin: totalProductRevenue > 0 ? (totalProductProfit / totalProductRevenue) * 100 : 0,
  }
}
