ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_group_id UUID;

CREATE INDEX IF NOT EXISTS idx_products_group_id
  ON public.products(product_group_id);
