-- Atomic stock operations and retry-safe checkouts. Historical costs remain unknown.
CREATE OR REPLACE FUNCTION public.current_account_access_status()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE((SELECT access_status FROM public.support_account_controls
    WHERE account_id = public.current_account_id()), 'active');
$$;
REVOKE ALL ON FUNCTION public.current_account_access_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_account_access_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_stock()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()
    AND role IN ('admin', 'employee')) AND public.current_account_access_status() = 'active';
$$;
REVOKE ALL ON FUNCTION public.can_manage_stock() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_stock() TO authenticated;
CREATE POLICY "Stock managers only insert" ON public.products AS RESTRICTIVE
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.can_manage_stock()));
CREATE POLICY "Stock managers only update" ON public.products AS RESTRICTIVE
  FOR UPDATE TO authenticated USING ((SELECT public.can_manage_stock()))
  WITH CHECK ((SELECT public.can_manage_stock()));
CREATE POLICY "Only admins edit sale metadata" ON public.sales AS RESTRICTIVE
  FOR UPDATE TO authenticated USING ((SELECT public.is_account_admin())) WITH CHECK ((SELECT public.is_account_admin()));
REVOKE INSERT,UPDATE,DELETE ON public.stock_movements FROM authenticated,anon;

CREATE OR REPLACE FUNCTION public.validate_product_account_links()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.category_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.categories WHERE id = NEW.category_id AND user_id = NEW.user_id)
    THEN RAISE EXCEPTION 'Categorie non autorisee'; END IF;
  IF NEW.supplier_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.suppliers WHERE id = NEW.supplier_id AND user_id = NEW.user_id)
    THEN RAISE EXCEPTION 'Fournisseur non autorise'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_product_account_links BEFORE INSERT OR UPDATE OF category_id,supplier_id,user_id ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.validate_product_account_links();
REVOKE ALL ON FUNCTION public.validate_product_account_links() FROM PUBLIC,anon,authenticated;

ALTER TABLE public.products ADD CONSTRAINT products_nonnegative_quantity CHECK (quantity >= 0) NOT VALID;
ALTER TABLE public.products VALIDATE CONSTRAINT products_nonnegative_quantity;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS unit_cost numeric(15,2);
ALTER TABLE public.sales ALTER COLUMN discount TYPE numeric(15,2);
ALTER TABLE public.sale_items ADD CONSTRAINT sale_items_positive_quantity CHECK (quantity > 0) NOT VALID;
ALTER TABLE public.sale_items VALIDATE CONSTRAINT sale_items_positive_quantity;

CREATE OR REPLACE FUNCTION public.snapshot_sale_item_cost()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  SELECT p.buying_price INTO NEW.unit_cost FROM public.products p
    JOIN public.sales s ON s.user_id = p.user_id
    WHERE s.id = NEW.sale_id AND p.id = NEW.product_id FOR UPDATE OF p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable ou non autorise'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER snapshot_sale_item_cost BEFORE INSERT ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_sale_item_cost();

CREATE OR REPLACE FUNCTION public.update_stock_on_sale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE owner_id uuid; previous_qty integer; next_qty integer;
BEGIN
  SELECT user_id INTO owner_id FROM public.sales WHERE id = NEW.sale_id;
  SELECT quantity INTO previous_qty FROM public.products
    WHERE id = NEW.product_id AND user_id = owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable ou non autorise'; END IF;
  IF NEW.quantity <= 0 OR NEW.quantity > previous_qty THEN
    RAISE EXCEPTION 'Stock insuffisant. Disponible: %', previous_qty;
  END IF;
  next_qty := previous_qty - NEW.quantity;
  UPDATE public.products SET quantity = next_qty, updated_at = now() WHERE id = NEW.product_id;
  INSERT INTO public.stock_movements(user_id, product_id, movement_type, quantity, previous_quantity, new_quantity, reason)
    VALUES(owner_id, NEW.product_id, 'out', NEW.quantity, previous_qty, next_qty, 'Vente ' || NEW.sale_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_product_stock(p_product_id uuid, p_quantity integer, p_absolute boolean DEFAULT false, p_reason text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE old_qty integer; next_qty integer; owner_id uuid := public.current_account_id();
BEGIN
  IF NOT public.can_manage_stock() THEN RAISE EXCEPTION 'Acces inventaire non autorise'; END IF;
  IF p_quantity IS NULL THEN RAISE EXCEPTION 'Quantite requise'; END IF;
  -- Serialize account writes without blocking foreign-key KEY SHARE checks.
  PERFORM id FROM public.profiles WHERE id = owner_id FOR NO KEY UPDATE;
  SELECT quantity INTO old_qty FROM public.products WHERE id = p_product_id AND user_id = owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable'; END IF;
  next_qty := CASE WHEN p_absolute THEN p_quantity ELSE old_qty + p_quantity END;
  IF next_qty < 0 THEN RAISE EXCEPTION 'La sortie depasse le stock disponible'; END IF;
  IF next_qty = old_qty THEN RETURN next_qty; END IF;
  UPDATE public.products SET quantity = next_qty, updated_at = now() WHERE id = p_product_id;
  INSERT INTO public.stock_movements(user_id, product_id, movement_type, quantity, previous_quantity, new_quantity, reason)
    VALUES(owner_id, p_product_id, CASE WHEN p_absolute THEN 'adjustment' WHEN next_qty > old_qty THEN 'in' ELSE 'out' END,
      abs(next_qty - old_qty), old_qty, next_qty, NULLIF(btrim(p_reason), ''));
  RETURN next_qty;
END;
$$;
REVOKE ALL ON FUNCTION public.adjust_product_stock(uuid,integer,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_product_stock(uuid,integer,boolean,text) TO authenticated;
REVOKE ALL ON FUNCTION public.snapshot_sale_item_cost(), public.update_stock_on_sale() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.append_subscription_request_audit(uuid,text,text,jsonb) FROM PUBLIC, anon, authenticated;

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  identity_key text NOT NULL,
  name text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, identity_key)
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Account customers" ON public.customers FOR SELECT TO authenticated
  USING (user_id = (SELECT public.current_account_id()));
REVOKE ALL ON public.customers FROM anon, authenticated;
GRANT SELECT ON public.customers TO authenticated;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id);
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS checkout_request_id uuid;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS checkout_fingerprint text;
CREATE UNIQUE INDEX sales_checkout_request_unique ON public.sales(user_id, checkout_request_id);
CREATE INDEX sales_customer_date_idx ON public.sales(customer_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.attach_sale_customer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE customer_name_clean text := btrim(COALESCE(NEW.customer_name, ''));
  phone_clean text := regexp_replace(COALESCE(NEW.customer_phone, ''), '[^0-9]', '', 'g');
BEGIN
  IF phone_clean LIKE '00221%' AND length(phone_clean) = 14 THEN phone_clean := substr(phone_clean, 6); END IF;
  IF phone_clean LIKE '221%' AND length(phone_clean) = 12 THEN phone_clean := substr(phone_clean, 4); END IF;
  IF customer_name_clean = '' AND phone_clean = '' THEN NEW.customer_id := NULL; RETURN NEW; END IF;
  INSERT INTO public.customers(user_id, identity_key, name, phone)
    VALUES(NEW.user_id, lower(customer_name_clean) || '|' || phone_clean, customer_name_clean, phone_clean)
    ON CONFLICT(user_id, identity_key) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO NEW.customer_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER attach_sale_customer BEFORE INSERT OR UPDATE OF customer_name, customer_phone ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.attach_sale_customer();
UPDATE public.sales SET customer_name = customer_name WHERE customer_id IS NULL;
REVOKE ALL ON FUNCTION public.attach_sale_customer() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.checkout_sale(p_request_id uuid, p_sale jsonb, p_payments jsonb)
RETURNS public.sales LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE owner_id uuid := public.current_account_id(); sale_row public.sales%ROWTYPE;
  fingerprint text := md5(p_sale::text || p_payments::text); item jsonb; payment jsonb;
  subtotal numeric := 0; discount_amount numeric; tax_amount numeric; total_amount numeric;
  paid numeric; method text; product_id uuid; item_qty integer; item_price numeric; owner_plan text;
BEGIN
  IF auth.uid() IS NULL OR owner_id IS NULL THEN RAISE EXCEPTION 'Non connecte'; END IF;
  IF public.current_account_access_status() <> 'active' THEN RAISE EXCEPTION 'Compte suspendu'; END IF;
  IF p_request_id IS NULL OR p_sale IS NULL OR p_payments IS NULL THEN RAISE EXCEPTION 'Donnees de vente requises'; END IF;
  -- Serialize retries for this account/request without blocking unrelated checkouts.
  PERFORM pg_advisory_xact_lock(hashtextextended(owner_id::text || p_request_id::text, 0));
  SELECT * INTO sale_row FROM public.sales WHERE user_id = owner_id AND checkout_request_id = p_request_id;
  IF FOUND THEN
    IF sale_row.checkout_fingerprint <> fingerprint THEN RAISE EXCEPTION 'Cette demande correspond a une autre vente'; END IF;
    IF sale_row.seller_id <> auth.uid() THEN RAISE EXCEPTION 'Demande non autorisee'; END IF;
    RETURN sale_row;
  END IF;
  IF p_sale->'items' IS NULL OR jsonb_typeof(p_sale->'items') <> 'array' OR jsonb_array_length(p_sale->'items') NOT BETWEEN 1 AND 500
    THEN RAISE EXCEPTION 'Panier invalide'; END IF;
  IF jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) > 4 THEN RAISE EXCEPTION 'Paiements invalides'; END IF;
  SELECT subscription_plan INTO owner_plan FROM public.profiles WHERE id = owner_id FOR NO KEY UPDATE;
  IF owner_plan = 'free' AND (SELECT count(*) FROM public.sales WHERE user_id = owner_id
    AND created_at >= date_trunc('month', now()) AND payment_status IN ('completed','partial','pending')) >= 10
    THEN RAISE EXCEPTION 'Le plan Gratuit autorise 10 ventes par mois'; END IF;
  PERFORM id FROM public.cash_sessions WHERE id = public.current_open_cash_session_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ouvrez votre caisse avant de vendre'; END IF;
  -- Lock products in deterministic order, including carts containing several variants.
  PERFORM p.id FROM public.products p JOIN (SELECT DISTINCT (value->>'product_id')::uuid id
    FROM jsonb_array_elements(p_sale->'items')) ids ON ids.id = p.id
    WHERE p.user_id = owner_id ORDER BY p.id FOR UPDATE OF p;
  FOR item IN SELECT value FROM jsonb_array_elements(p_sale->'items') LOOP
    product_id := (item->>'product_id')::uuid; item_qty := (item->>'quantity')::integer; item_price := (item->>'unit_price')::numeric;
    IF product_id IS NULL OR item_qty IS NULL OR item_qty <= 0 OR item_price IS NULL OR item_price < 0
      OR item_price::text IN ('NaN','Infinity','-Infinity') OR round(item_price, 2) <> item_price
      OR (item->>'total')::numeric IS DISTINCT FROM item_qty * item_price THEN RAISE EXCEPTION 'Montant article invalide'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.products WHERE id = product_id AND user_id = owner_id AND status = 'active' AND currency = 'XOF')
      THEN RAISE EXCEPTION 'Produit indisponible'; END IF;
    subtotal := subtotal + item_qty * item_price;
  END LOOP;
  discount_amount := round((p_sale->>'discount')::numeric, 2); tax_amount := round((p_sale->>'tax')::numeric, 2);
  IF discount_amount IS NULL OR tax_amount IS NULL OR discount_amount < 0 OR discount_amount > subtotal OR tax_amount < 0
    OR discount_amount::text IN ('NaN','Infinity','-Infinity') OR tax_amount::text IN ('NaN','Infinity','-Infinity')
    THEN RAISE EXCEPTION 'Remise ou taxe invalide'; END IF;
  total_amount := subtotal - discount_amount + tax_amount;
  IF abs(total_amount - (p_sale->>'total')::numeric) > 0.02 OR (p_sale->>'total') IS NULL
    OR (p_sale->>'total')::numeric::text IN ('NaN','Infinity','-Infinity')
    THEN RAISE EXCEPTION 'Total incoherent'; END IF;
  paid := 0;
  FOR payment IN SELECT value FROM jsonb_array_elements(p_payments) LOOP
    method := payment->>'payment_method';
    IF method IS NULL OR method NOT IN ('cash','wave','orange_money','card') OR (payment->>'amount') IS NULL
      OR (payment->>'amount')::numeric <= 0 OR (payment->>'amount')::numeric::text IN ('NaN','Infinity','-Infinity')
      OR round((payment->>'amount')::numeric, 2) <> (payment->>'amount')::numeric THEN RAISE EXCEPTION 'Versement invalide'; END IF;
    paid := paid + (payment->>'amount')::numeric;
  END LOOP;
  IF paid > total_amount THEN RAISE EXCEPTION 'Les versements depassent le total'; END IF;
  IF paid < total_amount AND NULLIF(btrim(COALESCE(p_sale->>'customer_name','')), '') IS NULL
    AND NULLIF(btrim(COALESCE(p_sale->>'customer_phone','')), '') IS NULL THEN RAISE EXCEPTION 'Client requis pour une dette'; END IF;
  SELECT * INTO sale_row FROM public.create_sale_with_items_v2(p_sale->>'customer_name', p_sale->>'customer_phone',
    p_sale->'items', subtotal, discount_amount, tax_amount, total_amount, 0,
    COALESCE(p_payments->0->>'payment_method', 'cash'), p_sale->>'notes');
  FOR payment IN SELECT value FROM jsonb_array_elements(p_payments) LOOP
    SELECT * INTO sale_row FROM public.record_sale_payment(sale_row.id, (payment->>'amount')::numeric,
      payment->>'payment_method', 'Paiement initial');
  END LOOP;
  UPDATE public.sales SET checkout_request_id = p_request_id, checkout_fingerprint = fingerprint,
    due_date = NULLIF(p_sale->>'due_date', '')::date,
    payment_method = COALESCE(p_payments->0->>'payment_method', 'cash'),
    payment_status = CASE WHEN total_amount = paid THEN 'completed' WHEN paid > 0 THEN 'partial' ELSE 'pending' END
    WHERE id = sale_row.id RETURNING * INTO sale_row;
  RETURN sale_row;
END;
$$;
REVOKE ALL ON FUNCTION public.checkout_sale(uuid,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkout_sale(uuid,jsonb,jsonb) TO authenticated;
-- No non-transactional writes to financial rows from browser clients.
REVOKE INSERT, UPDATE, DELETE ON public.sale_items, public.sale_payments FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.sales FROM authenticated, anon;
GRANT UPDATE(customer_name, customer_phone, notes, due_date) ON public.sales TO authenticated;
REVOKE ALL ON FUNCTION public.create_sale_with_items_v2(text,text,jsonb,numeric,numeric,numeric,numeric,numeric,text,text),
  public.create_sale_with_items(text,text,jsonb,numeric,numeric,numeric,numeric,text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.database_health()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$ SELECT true; $$;
REVOKE ALL ON FUNCTION public.database_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.database_health() TO anon, authenticated;

CREATE INDEX IF NOT EXISTS cash_sessions_member_idx ON public.cash_sessions(member_id);
CREATE INDEX IF NOT EXISTS categories_user_idx ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS products_supplier_idx ON public.products(supplier_id);
CREATE INDEX IF NOT EXISTS profiles_owner_idx ON public.profiles(account_owner_id);
CREATE INDEX IF NOT EXISTS sale_items_product_idx ON public.sale_items(product_id);
CREATE INDEX IF NOT EXISTS sale_payments_session_idx ON public.sale_payments(cash_session_id);
CREATE INDEX IF NOT EXISTS sales_session_idx ON public.sales(cash_session_id);
CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS stock_movements_user_idx ON public.stock_movements(user_id);
CREATE INDEX IF NOT EXISTS subscription_requests_actor_idx ON public.subscription_requests(requested_by_id);
CREATE INDEX IF NOT EXISTS suppliers_user_idx ON public.suppliers(user_id);
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.subscription_plan_price(text) SET search_path = public;
ALTER FUNCTION public.subscription_request_type(text,text,text) SET search_path = public;
ALTER POLICY "Users can update their own profile" ON public.profiles
  USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));
NOTIFY pgrst, 'reload schema';
