export type SubscriptionPlan = 'free' | 'starter' | 'pro' | 'enterprise' | 'lifetime'
export type SubscriptionStatus = 'free' | 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'expired'
export type BillingCycle = 'monthly' | 'quarterly' | 'yearly' | 'manual'
export type SubscriptionRequestStatus = 'sent' | 'in_progress' | 'activated' | 'cancelled'
export type SubscriptionRequestType = 'activation' | 'upgrade' | 'renewal' | 'reactivation' | 'downgrade'
export type SubscriptionPaymentMethod = 'cash' | 'wave' | 'orange_money' | 'card' | 'bank_transfer' | 'other'

export interface User {
  id: string
  email: string
  full_name: string
  business_name: string
  avatar_url?: string
  role: 'admin' | 'employee' | 'cashier'
  subscription_plan: SubscriptionPlan
  subscription_status?: SubscriptionStatus
  billing_cycle?: BillingCycle
  trial_ends_at?: string | null
  current_period_ends_at?: string | null
  created_at: string
}

export interface TeamMember {
  id: string
  email: string
  full_name?: string
  role: 'admin' | 'employee' | 'cashier'
  account_owner_id?: string
  created_at: string
}

export interface Product {
  id: string
  user_id: string
  product_group_id?: string | null
  name: string
  sku: string
  description?: string
  size?: string
  color?: string
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

export interface ProductGroup {
  id: string
  user_id: string
  product_group_id?: string | null
  name: string
  description?: string
  category_id: string
  supplier_id?: string
  image_url?: string
  currency: string
  status: 'active' | 'inactive' | 'pending'
  created_at: string
  updated_at: string
  category?: Category
  supplier?: Supplier
  variants: Product[]
  quantity: number
  variant_count: number
  low_variant_count: number
  out_variant_count: number
  price_min: number
  price_max: number
  sizes: string[]
  colors: string[]
}

export interface ProductVariantDraft {
  id?: string
  sku: string
  size?: string
  color?: string
  buying_price: number
  selling_price: number
  quantity: number
  min_quantity: number
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
  exchange_rate?: number
  converted_purchase_price?: number
  rate_source?: string
  rate_updated_at?: string
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
  seller_id?: string | null
  seller_name?: string
  seller_email?: string
  seller_role?: TeamMember['role'] | null
  cash_session_id?: string | null
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
  reversed_at?: string
  reversal_reason?: string
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
  product_base_name?: string
  variant_label?: string
  size?: string
  color?: string
  sku?: string
}

export interface SalePayment {
  id: string
  sale_id: string
  user_id: string
  recorded_by_id?: string | null
  cash_session_id?: string | null
  amount: number
  payment_method: 'cash' | 'wave' | 'orange_money' | 'card'
  note?: string
  created_at: string
}

export interface CashSessionSummary {
  sales_count: number
  payments_count: number
  total_invoiced: number
  total_collected: number
  total_due: number
  cash_collected: number
  expected_cash_amount: number
  average_ticket: number
}

export interface CashSession {
  id: string
  user_id: string
  member_id: string
  opening_amount: number
  opening_note?: string | null
  status: 'open' | 'closed'
  opened_at: string
  closed_at?: string | null
  closing_amount?: number | null
  closing_note?: string | null
  expected_cash_amount?: number | null
  cash_gap?: number | null
  sales_count?: number | null
  payments_count?: number | null
  total_invoiced?: number | null
  total_collected?: number | null
  total_due?: number | null
  cash_collected?: number | null
  created_at: string
  updated_at: string
  live_summary?: CashSessionSummary | null
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

export interface SubscriptionCatalogPlan {
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

export interface SubscriptionRequest {
  id: string
  user_id: string
  requested_by_id?: string | null
  requested_by_email?: string | null
  business_name?: string | null
  current_plan: SubscriptionPlan
  requested_plan: SubscriptionPlan
  request_type: SubscriptionRequestType
  status: SubscriptionRequestStatus
  notes?: string | null
  support_note?: string | null
  payment_method?: SubscriptionPaymentMethod | null
  payment_amount?: number | null
  payment_reference?: string | null
  payment_confirmed_at?: string | null
  processed_by_email?: string | null
  activated_at?: string | null
  created_at: string
  updated_at: string
}

export interface SalesReport {
  period: string
  total_sales: number
  total_revenue: number
  total_profit: number
  avg_order_value: number
  data_points: { date: string; revenue: number; sales: number }[]
}
