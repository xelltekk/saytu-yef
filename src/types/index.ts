export interface User {
  id: string
  email: string
  full_name: string
  business_name: string
  avatar_url?: string
  role: 'owner' | 'manager' | 'staff'
  subscription_plan: 'free' | 'starter' | 'pro' | 'enterprise'
  created_at: string
}

export interface Product {
  id: string
  user_id: string
  name: string
  sku: string
  description?: string
  category_id: string
  supplier_id?: string
  buying_price: number
  selling_price: number
  quantity: number
  min_quantity: number
  image_url?: string
  currency: string
  status: 'active' | 'inactive' | 'pending'
  created_at: string
  updated_at: string
  category?: Category
  supplier?: Supplier
}

export interface StockMovement {
  id: string
  user_id: string
  product_id: string
  movement_type: 'in' | 'out' | 'adjustment'
  quantity: number
  previous_quantity: number
  new_quantity: number
  reason?: string
  created_at: string
}

export interface AbroadProduct {
  id: string
  user_id: string
  name: string
  purchase_price: number
  currency: string
  quantity: number
  notes?: string
  source_country: string
  synced: boolean
  activated: boolean
  created_at: string
  local_id?: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

export interface Supplier {
  id: string
  user_id: string
  name: string
  contact_name?: string
  phone?: string
  email?: string
  address?: string
  country: string
  created_at: string
}

export interface Sale {
  id: string
  user_id: string
  customer_name?: string
  customer_phone?: string
  items: SaleItem[]
  subtotal: number
  discount: number
  tax: number
  total: number
  amount_paid?: number
  amount_due?: number
  payment_method: 'cash' | 'wave' | 'orange_money' | 'card'
  payment_status: 'completed' | 'partial' | 'pending' | 'cancelled' | 'refunded'
  notes?: string
  created_at: string
  payments?: SalePayment[]
}

export interface SaleItem {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  total: number
}

export interface CartItem extends SaleItem {
  image_url?: string
  max_quantity: number
}

export interface SalePayment {
  id: string
  sale_id: string
  user_id: string
  amount: number
  payment_method: 'cash' | 'wave' | 'orange_money' | 'card'
  note?: string
  created_at: string
}

export interface DashboardMetrics {
  total_sales_today: number
  total_sales_week: number
  total_sales_month: number
  total_revenue_today: number
  total_revenue_month: number
  total_products: number
  low_stock_count: number
  pending_orders: number
  profit_margin: number
  top_products: TopProduct[]
  recent_sales: Sale[]
}

export interface TopProduct {
  product_id: string
  product_name: string
  total_sold: number
  revenue: number
}

export interface SubscriptionPlan {
  id: string
  name: string
  price_monthly: number
  price_yearly: number
  features: string[]
  max_products: number
  max_users: number
  has_reports: boolean
  has_api: boolean
}

export interface SalesReport {
  period: string
  total_sales: number
  total_revenue: number
  total_profit: number
  avg_order_value: number
  data_points: { date: string; revenue: number; sales: number }[]
}
