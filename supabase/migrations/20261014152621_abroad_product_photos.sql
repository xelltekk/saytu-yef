ALTER TABLE public.abroad_products
  ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN public.abroad_products.image_url IS
  'Product photo URL in product-images Storage, preserved when transferred to inventory.';
