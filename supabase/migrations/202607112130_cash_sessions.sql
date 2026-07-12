-- Cash opening / closing sessions by member with session-linked sales and payments.

CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  opening_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  opening_note TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  closing_amount NUMERIC(12,2),
  closing_note TEXT,
  expected_cash_amount NUMERIC(12,2),
  cash_gap NUMERIC(12,2),
  sales_count INTEGER NOT NULL DEFAULT 0,
  payments_count INTEGER NOT NULL DEFAULT 0,
  total_invoiced NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_collected NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_due NUMERIC(12,2) NOT NULL DEFAULT 0,
  cash_collected NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can read cash_sessions" ON public.cash_sessions;
CREATE POLICY "Account members can read cash_sessions" ON public.cash_sessions
  FOR SELECT USING (user_id = public.current_account_id());

DROP POLICY IF EXISTS "Account members can insert cash_sessions" ON public.cash_sessions;
CREATE POLICY "Account members can insert cash_sessions" ON public.cash_sessions
  FOR INSERT WITH CHECK (user_id = public.current_account_id());

DROP POLICY IF EXISTS "Account members can update cash_sessions" ON public.cash_sessions;
CREATE POLICY "Account members can update cash_sessions" ON public.cash_sessions
  FOR UPDATE USING (user_id = public.current_account_id())
  WITH CHECK (user_id = public.current_account_id());

DROP POLICY IF EXISTS "Admins can delete cash_sessions" ON public.cash_sessions;
CREATE POLICY "Admins can delete cash_sessions" ON public.cash_sessions
  FOR DELETE USING (user_id = public.current_account_id() AND public.is_account_admin());

DROP TRIGGER IF EXISTS assign_account_owner_before_write ON public.cash_sessions;
CREATE TRIGGER assign_account_owner_before_write
  BEFORE INSERT OR UPDATE OF user_id ON public.cash_sessions
  FOR EACH ROW EXECUTE FUNCTION public.assign_account_owner();

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS cash_session_id UUID REFERENCES public.cash_sessions(id) ON DELETE SET NULL;

ALTER TABLE public.sale_payments
  ADD COLUMN IF NOT EXISTS cash_session_id UUID REFERENCES public.cash_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cash_sessions_user_member_opened_at
  ON public.cash_sessions(user_id, member_id, opened_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_sessions_one_open_per_member
  ON public.cash_sessions(user_id, member_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_sales_seller_session_created_at
  ON public.sales(seller_id, cash_session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sale_payments_session_created_at
  ON public.sale_payments(recorded_by_id, cash_session_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.current_open_cash_session_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.cash_sessions
  WHERE user_id = public.current_account_id()
    AND member_id = auth.uid()
    AND status = 'open'
  ORDER BY opened_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.open_cash_session(
  p_opening_amount NUMERIC,
  p_note TEXT DEFAULT NULL
)
RETURNS public.cash_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  account_id UUID := public.current_account_id();
  existing_session_id UUID;
  session_row public.cash_sessions%ROWTYPE;
BEGIN
  IF current_user_id IS NULL OR account_id IS NULL THEN
    RAISE EXCEPTION 'Non connecte';
  END IF;

  IF p_opening_amount IS NULL OR p_opening_amount < 0 THEN
    RAISE EXCEPTION 'Le fond initial doit etre positif ou nul';
  END IF;

  SELECT id
  INTO existing_session_id
  FROM public.cash_sessions
  WHERE user_id = account_id
    AND member_id = current_user_id
    AND status = 'open'
  ORDER BY opened_at DESC
  LIMIT 1;

  IF existing_session_id IS NOT NULL THEN
    RAISE EXCEPTION 'Une caisse est deja ouverte pour cet utilisateur';
  END IF;

  INSERT INTO public.cash_sessions (
    user_id,
    member_id,
    opening_amount,
    opening_note,
    status,
    opened_at,
    created_at,
    updated_at
  )
  VALUES (
    account_id,
    current_user_id,
    p_opening_amount,
    NULLIF(BTRIM(p_note), ''),
    'open',
    NOW(),
    NOW(),
    NOW()
  )
  RETURNING * INTO session_row;

  RETURN session_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_cash_session(
  p_session_id UUID,
  p_closing_amount NUMERIC,
  p_note TEXT DEFAULT NULL
)
RETURNS public.cash_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  account_id UUID := public.current_account_id();
  session_row public.cash_sessions%ROWTYPE;
  active_sales_count INTEGER := 0;
  active_total_invoiced NUMERIC := 0;
  active_total_due NUMERIC := 0;
  session_payments_count INTEGER := 0;
  session_total_collected NUMERIC := 0;
  session_cash_collected NUMERIC := 0;
  expected_cash NUMERIC := 0;
  computed_gap NUMERIC := 0;
BEGIN
  IF current_user_id IS NULL OR account_id IS NULL THEN
    RAISE EXCEPTION 'Non connecte';
  END IF;

  IF p_closing_amount IS NULL OR p_closing_amount < 0 THEN
    RAISE EXCEPTION 'Le montant de cloture doit etre positif ou nul';
  END IF;

  SELECT *
  INTO session_row
  FROM public.cash_sessions
  WHERE id = p_session_id
    AND user_id = account_id
    AND member_id = current_user_id
    AND status = 'open'
  FOR UPDATE;

  IF session_row.id IS NULL THEN
    RAISE EXCEPTION 'Session de caisse introuvable ou deja cloturee';
  END IF;

  SELECT
    COUNT(*)::INTEGER,
    COALESCE(SUM(total), 0),
    COALESCE(SUM(amount_due), 0)
  INTO
    active_sales_count,
    active_total_invoiced,
    active_total_due
  FROM public.sales
  WHERE user_id = account_id
    AND seller_id = current_user_id
    AND cash_session_id = session_row.id
    AND payment_status NOT IN ('cancelled', 'refunded');

  SELECT
    COUNT(*)::INTEGER,
    COALESCE(SUM(amount), 0),
    COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END), 0)
  INTO
    session_payments_count,
    session_total_collected,
    session_cash_collected
  FROM public.sale_payments
  WHERE user_id = account_id
    AND recorded_by_id = current_user_id
    AND cash_session_id = session_row.id;

  expected_cash := COALESCE(session_row.opening_amount, 0) + COALESCE(session_cash_collected, 0);
  computed_gap := COALESCE(p_closing_amount, 0) - expected_cash;

  IF ABS(computed_gap) > 0.009 AND NULLIF(BTRIM(p_note), '') IS NULL THEN
    RAISE EXCEPTION 'Ajoutez une note de cloture pour expliquer l''ecart de caisse';
  END IF;

  UPDATE public.cash_sessions
  SET status = 'closed',
      closed_at = NOW(),
      closing_amount = p_closing_amount,
      closing_note = NULLIF(BTRIM(p_note), ''),
      expected_cash_amount = expected_cash,
      cash_gap = computed_gap,
      sales_count = active_sales_count,
      payments_count = session_payments_count,
      total_invoiced = active_total_invoiced,
      total_collected = session_total_collected,
      total_due = active_total_due,
      cash_collected = session_cash_collected,
      updated_at = NOW()
  WHERE id = session_row.id
  RETURNING * INTO session_row;

  RETURN session_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_sale_with_items(
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_items JSONB,
  p_subtotal NUMERIC,
  p_discount NUMERIC,
  p_tax NUMERIC,
  p_total NUMERIC,
  p_payment_method TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  account_id UUID := public.current_account_id();
  current_session_id UUID := public.current_open_cash_session_id();
  sale_row public.sales%ROWTYPE;
  item JSONB;
  item_product_id UUID;
  item_product_name TEXT;
  item_quantity INTEGER;
  item_unit_price NUMERIC;
  item_total NUMERIC;
BEGIN
  IF current_user_id IS NULL OR account_id IS NULL THEN
    RAISE EXCEPTION 'Non connecte';
  END IF;

  IF current_session_id IS NULL THEN
    RAISE EXCEPTION 'Ouvrez d''abord votre caisse avec un fond initial avant d''enregistrer une vente';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Le panier est vide';
  END IF;

  IF p_payment_method NOT IN ('cash', 'wave', 'orange_money', 'card') THEN
    RAISE EXCEPTION 'Mode de paiement invalide';
  END IF;

  IF p_subtotal < 0 OR p_discount < 0 OR p_tax < 0 OR p_total < 0 THEN
    RAISE EXCEPTION 'Les montants ne peuvent pas etre negatifs';
  END IF;

  INSERT INTO public.sales (
    user_id,
    seller_id,
    cash_session_id,
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
    account_id,
    current_user_id,
    current_session_id,
    NULLIF(BTRIM(p_customer_name), ''),
    NULLIF(BTRIM(p_customer_phone), ''),
    p_subtotal,
    p_discount,
    p_tax,
    p_total,
    p_total,
    0,
    p_payment_method,
    'completed',
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

  INSERT INTO public.sale_payments (
    sale_id,
    user_id,
    recorded_by_id,
    cash_session_id,
    amount,
    payment_method,
    note
  )
  VALUES (
    sale_row.id,
    account_id,
    current_user_id,
    current_session_id,
    p_total,
    p_payment_method,
    'Paiement initial'
  );

  RETURN sale_row;
END;
$$;

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
RETURNS public.sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  account_id UUID := public.current_account_id();
  current_session_id UUID := public.current_open_cash_session_id();
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
  IF current_user_id IS NULL OR account_id IS NULL THEN
    RAISE EXCEPTION 'Non connecte';
  END IF;

  IF current_session_id IS NULL THEN
    RAISE EXCEPTION 'Ouvrez d''abord votre caisse avec un fond initial avant d''enregistrer une vente';
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
    seller_id,
    cash_session_id,
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
    account_id,
    current_user_id,
    current_session_id,
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
      recorded_by_id,
      cash_session_id,
      amount,
      payment_method,
      note
    )
    VALUES (
      sale_row.id,
      account_id,
      current_user_id,
      current_session_id,
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
$$;

CREATE OR REPLACE FUNCTION public.record_sale_payment(
  p_sale_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS public.sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  account_id UUID := public.current_account_id();
  current_session_id UUID := public.current_open_cash_session_id();
  sale_row public.sales%ROWTYPE;
  next_amount_paid NUMERIC;
  next_amount_due NUMERIC;
  next_status TEXT;
BEGIN
  IF current_user_id IS NULL OR account_id IS NULL THEN
    RAISE EXCEPTION 'Non connecte';
  END IF;

  IF current_session_id IS NULL THEN
    RAISE EXCEPTION 'Ouvrez d''abord votre caisse avant d''enregistrer un versement client';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Le montant doit etre superieur a zero';
  END IF;

  IF p_payment_method NOT IN ('cash', 'wave', 'orange_money', 'card') THEN
    RAISE EXCEPTION 'Mode de paiement invalide';
  END IF;

  SELECT *
  INTO sale_row
  FROM public.sales
  WHERE id = p_sale_id
    AND user_id = account_id
  FOR UPDATE;

  IF sale_row.id IS NULL THEN
    RAISE EXCEPTION 'Vente introuvable';
  END IF;

  IF sale_row.payment_status IN ('cancelled', 'refunded') THEN
    RAISE EXCEPTION 'Versement impossible sur cette vente';
  END IF;

  IF p_amount > GREATEST(sale_row.amount_due, 0) THEN
    RAISE EXCEPTION 'Le versement depasse le reste du';
  END IF;

  INSERT INTO public.sale_payments (
    sale_id,
    user_id,
    recorded_by_id,
    cash_session_id,
    amount,
    payment_method,
    note
  )
  VALUES (
    sale_row.id,
    account_id,
    current_user_id,
    current_session_id,
    p_amount,
    p_payment_method,
    NULLIF(BTRIM(p_note), '')
  );

  next_amount_paid := LEAST(sale_row.total, COALESCE(sale_row.amount_paid, 0) + p_amount);
  next_amount_due := GREATEST(sale_row.total - next_amount_paid, 0);
  next_status := CASE
    WHEN next_amount_due <= 0 THEN 'completed'
    WHEN next_amount_paid > 0 THEN 'partial'
    ELSE 'pending'
  END;

  UPDATE public.sales
  SET amount_paid = next_amount_paid,
      amount_due = next_amount_due,
      payment_method = p_payment_method,
      payment_status = next_status
  WHERE id = sale_row.id
  RETURNING * INTO sale_row;

  RETURN sale_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_open_cash_session_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_cash_session(NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_cash_session(UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_sale_with_items(
  TEXT,
  TEXT,
  JSONB,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  TEXT,
  TEXT
) TO authenticated;
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
GRANT EXECUTE ON FUNCTION public.record_sale_payment(UUID, NUMERIC, TEXT, TEXT) TO authenticated;
