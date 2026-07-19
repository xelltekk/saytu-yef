ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS barcode TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_user_barcode_unique
  ON public.products(user_id, lower(btrim(barcode)))
  WHERE barcode IS NOT NULL AND btrim(barcode) <> '';
