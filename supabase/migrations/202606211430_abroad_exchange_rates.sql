ALTER TABLE public.abroad_products
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18,8),
  ADD COLUMN IF NOT EXISTS converted_purchase_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS rate_source TEXT,
  ADD COLUMN IF NOT EXISTS rate_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.abroad_products.exchange_rate IS 'Taux appliqué pour convertir une unité de la devise source en XOF.';
COMMENT ON COLUMN public.abroad_products.converted_purchase_price IS 'Prix d achat converti en XOF au moment du transfert.';
