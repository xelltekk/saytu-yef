-- Match account-scoped inventory and sales history ordering under RLS.
CREATE INDEX IF NOT EXISTS idx_products_account_created_at
  ON public.products (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_account_created_at
  ON public.sales (user_id, created_at DESC);
