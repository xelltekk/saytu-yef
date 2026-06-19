ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_due NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.sales
  DROP CONSTRAINT IF EXISTS sales_payment_status_check;

ALTER TABLE public.sales
  ADD CONSTRAINT sales_payment_status_check
  CHECK (payment_status IN ('completed', 'partial', 'pending', 'cancelled', 'refunded'));

UPDATE public.sales
SET amount_paid = CASE
      WHEN payment_status IN ('completed', 'refunded') THEN total
      WHEN payment_status = 'cancelled' THEN 0
      ELSE COALESCE(amount_paid, 0)
    END,
    amount_due = CASE
      WHEN payment_status IN ('completed', 'refunded', 'cancelled') THEN 0
      ELSE GREATEST(
        total - CASE
          WHEN payment_status IN ('completed', 'refunded') THEN total
          WHEN payment_status = 'cancelled' THEN 0
          ELSE COALESCE(amount_paid, 0)
        END,
        0
      )
    END;

CREATE TABLE IF NOT EXISTS public.sale_payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'wave', 'orange_money', 'card')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own sale payments" ON public.sale_payments;
CREATE POLICY "Users can manage their own sale payments"
  ON public.sale_payments
  FOR ALL
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.create_sale_with_items_v2(
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_items JSONB,
  p_subtotal NUMERIC,
  p_discount NUMERIC,
  p_tax NUMERIC,
  p_total NUMERIC,
  p_amount_paid NUMERIC,
  p_payment_method TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.sales AS $$
DECLARE
  current_user_id UUID := auth.uid();
  sale_row public.sales%ROWTYPE;
  item JSONB;
  item_product_id UUID;
  item_product_name TEXT;
  item_quantity INTEGER;
  item_unit_price NUMERIC;
  item_total NUMERIC;
  normalized_amount_paid NUMERIC := LEAST(GREATEST(COALESCE(p_amount_paid, p_total), 0), p_total);
  computed_amount_due NUMERIC := GREATEST(p_total - LEAST(GREATEST(COALESCE(p_amount_paid, p_total), 0), p_total), 0);
  computed_status TEXT;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Non connecte';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Le panier est vide';
  END IF;

  IF p_payment_method NOT IN ('cash', 'wave', 'orange_money', 'card') THEN
    RAISE EXCEPTION 'Mode de paiement invalide';
  END IF;

  IF p_subtotal < 0 OR p_discount < 0 OR p_tax < 0 OR p_total < 0 OR normalized_amount_paid < 0 THEN
    RAISE EXCEPTION 'Les montants ne peuvent pas etre negatifs';
  END IF;

  IF normalized_amount_paid >= p_total THEN
    computed_status := 'completed';
  ELSIF normalized_amount_paid > 0 THEN
    computed_status := 'partial';
  ELSE
    computed_status := 'pending';
  END IF;

  INSERT INTO public.sales (
    user_id,
    customer_name,
    customer_phone,
    subtotal,
    discount,
    tax,
    total,
    amount_paid,
    amount_due,
    payment_method,
    payment_status,
    notes
  )
  VALUES (
    current_user_id,
    NULLIF(BTRIM(p_customer_name), ''),
    NULLIF(BTRIM(p_customer_phone), ''),
    p_subtotal,
    p_discount,
    p_tax,
    p_total,
    normalized_amount_paid,
    computed_amount_due,
    p_payment_method,
    computed_status,
    NULLIF(BTRIM(p_notes), '')
  )
  RETURNING * INTO sale_row;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    item_product_id := (item->>'product_id')::UUID;
    item_product_name := NULLIF(BTRIM(item->>'product_name'), '');
    item_quantity := (item->>'quantity')::INTEGER;
    item_unit_price := (item->>'unit_price')::NUMERIC;
    item_total := (item->>'total')::NUMERIC;

    IF item_product_id IS NULL OR item_product_name IS NULL THEN
      RAISE EXCEPTION 'Article invalide';
    END IF;

    IF item_quantity <= 0 THEN
      RAISE EXCEPTION 'La quantite doit etre superieure a zero';
    END IF;

    IF item_unit_price < 0 OR item_total < 0 THEN
      RAISE EXCEPTION 'Le prix d''un article ne peut pas etre negatif';
    END IF;

    INSERT INTO public.sale_items (
      sale_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      total
    )
    VALUES (
      sale_row.id,
      item_product_id,
      item_product_name,
      item_quantity,
      item_unit_price,
      item_total
    );
  END LOOP;

  IF normalized_amount_paid > 0 THEN
    INSERT INTO public.sale_payments (
      sale_id,
      user_id,
      amount,
      payment_method,
      note
    )
    VALUES (
      sale_row.id,
      current_user_id,
      normalized_amount_paid,
      p_payment_method,
      CASE
        WHEN computed_amount_due > 0 THEN 'Paiement initial partiel'
        ELSE 'Paiement initial'
      END
    );
  END IF;

  RETURN sale_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.create_sale_with_items_v2(
  TEXT,
  TEXT,
  JSONB,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  TEXT,
  TEXT
) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_sale_payment(
  p_sale_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS public.sales AS $$
DECLARE
  current_user_id UUID := auth.uid();
  sale_row public.sales%ROWTYPE;
  next_amount_paid NUMERIC;
  next_amount_due NUMERIC;
  next_status TEXT;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Non connecte';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Le montant du versement doit etre superieur a zero';
  END IF;

  IF p_payment_method NOT IN ('cash', 'wave', 'orange_money', 'card') THEN
    RAISE EXCEPTION 'Mode de paiement invalide';
  END IF;

  SELECT *
  INTO sale_row
  FROM public.sales
  WHERE id = p_sale_id
    AND user_id = current_user_id
  FOR UPDATE;

  IF sale_row.id IS NULL THEN
    RAISE EXCEPTION 'Vente introuvable';
  END IF;

  IF sale_row.payment_status IN ('cancelled', 'refunded') THEN
    RAISE EXCEPTION 'Impossible d''encaisser un versement sur cette vente';
  END IF;

  IF p_amount > GREATEST(sale_row.amount_due, 0) THEN
    RAISE EXCEPTION 'Le versement depasse le reste du';
  END IF;

  INSERT INTO public.sale_payments (
    sale_id,
    user_id,
    amount,
    payment_method,
    note
  )
  VALUES (
    sale_row.id,
    current_user_id,
    p_amount,
    p_payment_method,
    NULLIF(BTRIM(p_note), '')
  );

  next_amount_paid := LEAST(sale_row.total, COALESCE(sale_row.amount_paid, 0) + p_amount);
  next_amount_due := GREATEST(sale_row.total - next_amount_paid, 0);

  IF next_amount_due <= 0 THEN
    next_status := 'completed';
  ELSIF next_amount_paid > 0 THEN
    next_status := 'partial';
  ELSE
    next_status := 'pending';
  END IF;

  UPDATE public.sales
  SET amount_paid = next_amount_paid,
      amount_due = next_amount_due,
      payment_method = p_payment_method,
      payment_status = next_status
  WHERE id = sale_row.id
  RETURNING * INTO sale_row;

  RETURN sale_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.record_sale_payment(
  UUID,
  NUMERIC,
  TEXT,
  TEXT
) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_sale_payments_sale_id ON public.sale_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_user_id ON public.sale_payments(user_id);
