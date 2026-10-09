-- Discounts are currency amounts, with the same precision as the sale total.
ALTER TABLE public.sales
  ALTER COLUMN discount TYPE NUMERIC(12,2)
  USING discount::NUMERIC(12,2);
