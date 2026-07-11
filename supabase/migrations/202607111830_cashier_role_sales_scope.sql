-- Add cashier role and seller tracking for shared business accounts.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'employee', 'cashier'));

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.sale_payments
  ADD COLUMN IF NOT EXISTS recorded_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.sales
SET seller_id = COALESCE(seller_id, user_id)
WHERE seller_id IS NULL;

UPDATE public.sale_payments
SET recorded_by_id = COALESCE(recorded_by_id, user_id)
WHERE recorded_by_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_sales_seller_id_created_at
  ON public.sales (seller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sale_payments_recorded_by_id_created_at
  ON public.sale_payments (recorded_by_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.add_team_member(p_email TEXT, p_role TEXT DEFAULT 'employee')
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID := public.current_account_id();
  member public.profiles%ROWTYPE;
BEGIN
  IF NOT public.is_account_admin() THEN RAISE EXCEPTION 'Action reservee a un administrateur'; END IF;
  IF p_role NOT IN ('admin', 'employee', 'cashier') THEN RAISE EXCEPTION 'Role invalide'; END IF;

  SELECT * INTO member FROM public.profiles WHERE LOWER(email) = LOWER(BTRIM(p_email)) FOR UPDATE;
  IF member.id IS NULL THEN RAISE EXCEPTION 'Ce compte n existe pas encore. L employe doit d abord creer son compte.'; END IF;
  IF member.id = owner_id THEN RAISE EXCEPTION 'Ce compte est deja administrateur principal'; END IF;
  IF COALESCE(member.account_owner_id, member.id) <> member.id AND member.account_owner_id <> owner_id THEN
    RAISE EXCEPTION 'Ce compte appartient deja a une autre entreprise';
  END IF;

  UPDATE public.profiles
  SET account_owner_id = owner_id,
      role = p_role,
      updated_at = NOW()
  WHERE id = member.id
  RETURNING * INTO member;

  RETURN member;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_team_member_role(p_member_id UUID, p_role TEXT)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member public.profiles%ROWTYPE;
BEGIN
  IF NOT public.is_account_admin() THEN RAISE EXCEPTION 'Action reservee a un administrateur'; END IF;
  IF p_role NOT IN ('admin', 'employee', 'cashier') THEN RAISE EXCEPTION 'Role invalide'; END IF;
  IF p_member_id = public.current_account_id() THEN RAISE EXCEPTION 'Le role du proprietaire ne peut pas etre modifie'; END IF;

  UPDATE public.profiles
  SET role = p_role,
      updated_at = NOW()
  WHERE id = p_member_id
    AND account_owner_id = public.current_account_id()
  RETURNING * INTO member;

  IF member.id IS NULL THEN RAISE EXCEPTION 'Membre introuvable'; END IF;
  RETURN member;
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
    customer_name,
    customer_phone,
    subtotal,
    discount,
    tax,
    total,
    payment_method,
    payment_status,
    notes
  )
  VALUES (
    account_id,
    current_user_id,
    NULLIF(BTRIM(p_customer_name), ''),
    NULLIF(BTRIM(p_customer_phone), ''),
    p_subtotal,
    p_discount,
    p_tax,
    p_total,
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
      amount,
      payment_method,
      note
    )
    VALUES (
      sale_row.id,
      account_id,
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
  sale_row public.sales%ROWTYPE;
  next_amount_paid NUMERIC;
  next_amount_due NUMERIC;
  next_status TEXT;
BEGIN
  IF current_user_id IS NULL OR account_id IS NULL THEN
    RAISE EXCEPTION 'Non connecte';
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
    amount,
    payment_method,
    note
  )
  VALUES (
    sale_row.id,
    account_id,
    current_user_id,
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

GRANT EXECUTE ON FUNCTION public.add_team_member(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_team_member_role(UUID, TEXT) TO authenticated;
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
