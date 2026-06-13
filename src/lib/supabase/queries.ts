import { createClient } from './client'
import type { Product, Category, Supplier, Sale, AbroadProduct } from '@/types'

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

export async function adjustStock(id: string, quantityChange: number, reason?: string): Promise<void> {
  const supabase = createClient()
  const { data: product } = await supabase.from('products').select('quantity').eq('id', id).single()
  if (!product) throw new Error('Produit introuvable')

  const newQuantity = Math.max(0, product.quantity + quantityChange)
  const { data: { user } } = await supabase.auth.getUser()

  await Promise.all([
    supabase.from('products').update({ quantity: newQuantity, updated_at: new Date().toISOString() }).eq('id', id),
    supabase.from('stock_movements').insert({
      user_id: user!.id,
      product_id: id,
      movement_type: quantityChange > 0 ? 'in' : 'out',
      quantity: Math.abs(quantityChange),
      previous_quantity: product.quantity,
      new_quantity: newQuantity,
      reason,
    }),
  ])
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

export async function getSales(limit = 50): Promise<Sale[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('sales')
    .select('*, items:sale_items(*)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as Sale[]
}

export async function createSale(sale: {
  customer_name?: string
  customer_phone?: string
  items: { product_id: string; product_name: string; quantity: number; unit_price: number; total: number }[]
  subtotal: number
  discount: number
  tax: number
  total: number
  payment_method: 'cash' | 'wave' | 'orange_money' | 'card'
  notes?: string
}): Promise<Sale> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connecté')

  // Créer la vente
  const { data: saleData, error: saleError } = await supabase
    .from('sales')
    .insert({
      user_id: user.id,
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

  if (saleError) throw saleError

  // Insérer les articles (le trigger SQL mettra à jour le stock automatiquement)
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

  if (itemsError) throw itemsError

  return { ...saleData, items: sale.items } as Sale
}

// ─── PRODUITS ÉTRANGER ────────────────────────────────────────────────────────

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

export async function activateAbroadProduct(
  abroadId: string,
  productPayload: Omit<Product, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'category' | 'supplier'>
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
    .update({ activated: true, synced: true })
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

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay())

  const [salesToday, salesMonth, products, , recentSales] = await Promise.all([
    supabase
      .from('sales')
      .select('total')
      .gte('created_at', today.toISOString())
      .eq('payment_status', 'completed'),

    supabase
      .from('sales')
      .select('total, created_at')
      .gte('created_at', startOfMonth.toISOString())
      .eq('payment_status', 'completed'),

    supabase.from('products').select('id, quantity, min_quantity, buying_price, selling_price'),

    supabase
      .from('products')
      .select('id, name, quantity, min_quantity')
      .filter('quantity', 'lte', 'min_quantity'),

    supabase
      .from('sales')
      .select('*, items:sale_items(*)')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const revenueToday = (salesToday.data ?? []).reduce((s, r) => s + Number(r.total), 0)
  const revenueMonth = (salesMonth.data ?? []).reduce((s, r) => s + Number(r.total), 0)
  const totalProducts = products.data?.length ?? 0
  const lowStockCount = (products.data ?? []).filter(p => p.quantity <= p.min_quantity).length

  // Calcul marge moyenne
  const validProducts = (products.data ?? []).filter(p => p.selling_price > 0)
  const avgMargin = validProducts.length
    ? validProducts.reduce((s, p) => s + ((p.selling_price - p.buying_price) / p.selling_price) * 100, 0) / validProducts.length
    : 0

  return {
    revenueToday,
    revenueMonth,
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
  const start = new Date()
  start.setMonth(start.getMonth() - months)

  const { data: sales } = await supabase
    .from('sales')
    .select('total, created_at, items:sale_items(product_id, product_name, quantity, unit_price, total)')
    .gte('created_at', start.toISOString())
    .eq('payment_status', 'completed')
    .order('created_at')

  const { data: products } = await supabase
    .from('products')
    .select('id, name, buying_price, selling_price, quantity')

  const productMap = Object.fromEntries((products ?? []).map(p => [p.id, p]))

  // Données mensuelles
  const monthlyMap: Record<string, { revenue: number; profit: number }> = {}
  const productSales: Record<string, { name: string; sold: number; revenue: number; profit: number }> = {}

  ;(sales ?? []).forEach((sale) => {
    const month = new Date(sale.created_at).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
    if (!monthlyMap[month]) monthlyMap[month] = { revenue: 0, profit: 0 }
    monthlyMap[month].revenue += Number(sale.total)

    ;(sale.items as { product_id: string; product_name: string; quantity: number; unit_price: number; total: number }[]).forEach((item) => {
      const prod = productMap[item.product_id]
      const profit = prod ? (item.unit_price - prod.buying_price) * item.quantity : 0
      monthlyMap[month].profit += profit

      if (!productSales[item.product_id]) {
        productSales[item.product_id] = { name: item.product_name, sold: 0, revenue: 0, profit: 0 }
      }
      productSales[item.product_id].sold += item.quantity
      productSales[item.product_id].revenue += item.total
      productSales[item.product_id].profit += profit
    })
  })

  const monthlyData = Object.entries(monthlyMap).map(([month, v]) => ({ month, ...v }))
  const topProducts = Object.entries(productSales)
    .map(([id, v]) => ({ id, ...v, margin: v.revenue > 0 ? (v.profit / v.revenue) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  return { monthlyData, topProducts }
}
