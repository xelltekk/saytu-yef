ALTER TABLE public.sale_payments ADD COLUMN IF NOT EXISTS request_id uuid;
CREATE UNIQUE INDEX sale_payments_request_unique ON public.sale_payments(user_id, request_id);
CREATE OR REPLACE FUNCTION public.record_sale_payment_v2(p_request_id uuid, p_sale_id uuid, p_amount numeric, p_payment_method text, p_note text DEFAULT NULL)
RETURNS public.sales LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE owner_id uuid := public.current_account_id(); prior public.sale_payments%ROWTYPE; row public.sales%ROWTYPE;
  original_method text; before_ids uuid[];
BEGIN
  IF auth.uid() IS NULL OR owner_id IS NULL OR public.current_account_access_status() <> 'active' OR p_request_id IS NULL
    THEN RAISE EXCEPTION 'Acces non autorise'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount::text IN ('NaN','Infinity','-Infinity') OR round(p_amount,2) <> p_amount
    OR p_payment_method IS NULL THEN RAISE EXCEPTION 'Montant ou mode invalide'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(owner_id::text || p_request_id::text,0));
  PERFORM id FROM public.profiles WHERE id = owner_id FOR NO KEY UPDATE;
  SELECT * INTO prior FROM public.sale_payments WHERE user_id = owner_id AND request_id = p_request_id;
  IF FOUND THEN
    IF prior.sale_id <> p_sale_id OR prior.amount <> p_amount OR prior.payment_method <> p_payment_method OR prior.recorded_by_id <> auth.uid()
      THEN RAISE EXCEPTION 'Cette demande correspond a un autre versement'; END IF;
    SELECT * INTO row FROM public.sales WHERE id = p_sale_id AND user_id = owner_id;
    RETURN row;
  END IF;
  PERFORM id FROM public.cash_sessions WHERE id = public.current_open_cash_session_id() FOR UPDATE;
  SELECT payment_method INTO original_method FROM public.sales WHERE id = p_sale_id AND user_id = owner_id FOR UPDATE;
  SELECT COALESCE(array_agg(id),ARRAY[]::uuid[]) INTO before_ids FROM public.sale_payments WHERE sale_id = p_sale_id;
  SELECT * INTO row FROM public.record_sale_payment(p_sale_id,p_amount,p_payment_method,p_note);
  UPDATE public.sale_payments SET request_id = p_request_id WHERE sale_id = p_sale_id AND NOT(id = ANY(before_ids));
  UPDATE public.sales SET payment_method = original_method WHERE id = p_sale_id RETURNING * INTO row;
  RETURN row;
END;
$$;
REVOKE ALL ON FUNCTION public.record_sale_payment_v2(uuid,uuid,numeric,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_sale_payment_v2(uuid,uuid,numeric,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.record_sale_payment(uuid,numeric,text,text) FROM PUBLIC, anon, authenticated;

CREATE TABLE public.customer_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  recorded_by_id uuid NOT NULL REFERENCES public.profiles(id),
  channel text NOT NULL CHECK(channel IN ('phone','whatsapp','other')),
  note text NOT NULL CHECK(length(btrim(note)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customer_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Account reminder history" ON public.customer_reminders FOR SELECT TO authenticated
  USING(user_id = (SELECT public.current_account_id()));
REVOKE ALL ON public.customer_reminders FROM anon, authenticated;
GRANT SELECT ON public.customer_reminders TO authenticated;
CREATE INDEX customer_reminders_customer_date_idx ON public.customer_reminders(customer_id, created_at DESC);
CREATE INDEX customer_reminders_user_idx ON public.customer_reminders(user_id);
CREATE INDEX customer_reminders_actor_idx ON public.customer_reminders(recorded_by_id);

CREATE OR REPLACE FUNCTION public.log_customer_reminder(p_customer_id uuid, p_channel text, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR public.current_account_access_status() <> 'active' OR NOT EXISTS(
    SELECT 1 FROM public.customers WHERE id = p_customer_id AND user_id = public.current_account_id())
    THEN RAISE EXCEPTION 'Client non autorise'; END IF;
  INSERT INTO public.customer_reminders(user_id, customer_id, recorded_by_id, channel, note)
    VALUES(public.current_account_id(), p_customer_id, auth.uid(), p_channel, btrim(p_note));
END;
$$;
REVOKE ALL ON FUNCTION public.log_customer_reminder(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_customer_reminder(uuid,text,text) TO authenticated;

CREATE TABLE public.customer_payment_requests (
  user_id uuid NOT NULL REFERENCES public.profiles(id), request_id uuid NOT NULL,
  recorded_by_id uuid NOT NULL REFERENCES public.profiles(id), customer_id uuid NOT NULL REFERENCES public.customers(id),
  amount numeric(15,2) NOT NULL, payment_method text NOT NULL, result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id, request_id)
);
ALTER TABLE public.customer_payment_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_payment_requests FROM anon, authenticated;
CREATE INDEX customer_payment_requests_customer_idx ON public.customer_payment_requests(customer_id);
CREATE INDEX customer_payment_requests_actor_idx ON public.customer_payment_requests(recorded_by_id);

CREATE OR REPLACE FUNCTION public.pay_customer_debts(p_request_id uuid, p_customer_id uuid, p_amount numeric, p_method text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE owner_id uuid := public.current_account_id(); remaining numeric := p_amount;
  row public.sales%ROWTYPE; allocation numeric; result jsonb := '[]'; prior public.customer_payment_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR owner_id IS NULL OR public.current_account_access_status() <> 'active' THEN RAISE EXCEPTION 'Acces non autorise'; END IF;
  IF p_request_id IS NULL OR p_amount IS NULL OR p_amount <= 0 OR p_amount::text IN ('NaN','Infinity','-Infinity')
    OR round(p_amount,2) <> p_amount OR p_method IS NULL OR p_method NOT IN ('cash','wave','orange_money','card') THEN RAISE EXCEPTION 'Versement invalide'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(owner_id::text || p_request_id::text, 0));
  PERFORM id FROM public.profiles WHERE id = owner_id FOR NO KEY UPDATE;
  SELECT * INTO prior FROM public.customer_payment_requests WHERE user_id = owner_id AND request_id = p_request_id;
  IF FOUND THEN
    IF prior.customer_id <> p_customer_id OR prior.amount <> p_amount OR prior.payment_method <> p_method OR prior.recorded_by_id <> auth.uid()
      THEN RAISE EXCEPTION 'Cette demande correspond a un autre versement'; END IF;
    RETURN prior.result;
  END IF;
  PERFORM id FROM public.customers WHERE id = p_customer_id AND user_id = owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Client introuvable'; END IF;
  -- Lock the full allocation set before validating the amount; no partial commits.
  PERFORM id FROM public.sales WHERE customer_id = p_customer_id AND user_id = owner_id
    AND payment_status IN ('completed','partial','pending') ORDER BY id FOR UPDATE;
  IF p_amount > (SELECT COALESCE(sum(amount_due),0) FROM public.sales WHERE customer_id = p_customer_id AND user_id = owner_id
    AND payment_status IN ('completed','partial','pending')) THEN RAISE EXCEPTION 'Le versement depasse le reste du'; END IF;
  FOR row IN SELECT * FROM public.sales WHERE customer_id = p_customer_id AND user_id = owner_id AND amount_due > 0
    AND payment_status IN ('partial','pending') ORDER BY due_date NULLS LAST, created_at, id LOOP
    EXIT WHEN remaining <= 0;
    allocation := LEAST(remaining, row.amount_due);
    PERFORM public.record_sale_payment_v2(gen_random_uuid(), row.id, allocation, p_method, 'Reglement global client');
    result := result || jsonb_build_array(jsonb_build_object('sale_id', row.id, 'amount', allocation));
    remaining := remaining - allocation;
  END LOOP;
  IF remaining <> 0 THEN RAISE EXCEPTION 'Allocation incomplete'; END IF;
  INSERT INTO public.customer_payment_requests(user_id, request_id, recorded_by_id, customer_id, amount, payment_method, result)
    VALUES(owner_id, p_request_id, auth.uid(), p_customer_id, p_amount, p_method, result);
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.pay_customer_debts(uuid,uuid,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_customer_debts(uuid,uuid,numeric,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_customer_accounts(p_search text DEFAULT '', p_filter text DEFAULT 'all',
  p_sort text DEFAULT 'priority', p_offset integer DEFAULT 0, p_limit integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE owner_id uuid := public.current_account_id(); result jsonb;
BEGIN
  IF auth.uid() IS NULL OR owner_id IS NULL OR public.current_account_access_status() <> 'active' THEN RAISE EXCEPTION 'Acces non autorise'; END IF;
  WITH accounts AS (
    SELECT c.id, c.name, c.phone, count(s.id) sale_count,
      COALESCE(sum(s.total) FILTER(WHERE s.payment_status IN ('completed','partial','pending')),0) purchases,
      COALESCE(sum(s.amount_paid) FILTER(WHERE s.payment_status IN ('completed','partial','pending')),0) paid,
      COALESCE(sum(s.amount_due) FILTER(WHERE s.payment_status IN ('completed','partial','pending')),0) due,
      count(s.id) FILTER(WHERE s.amount_due > 0 AND s.payment_status IN ('partial','pending')) debt_count,
      COALESCE(sum(s.total) FILTER(WHERE s.amount_due > 0 AND s.payment_status IN ('partial','pending')),0) open_debt_total,
      COALESCE(sum(s.amount_paid) FILTER(WHERE s.amount_due > 0 AND s.payment_status IN ('partial','pending')),0) open_debt_paid,
      count(s.id) FILTER(WHERE s.amount_due > 0 AND s.due_date < current_date AND s.payment_status IN ('partial','pending')) overdue_count,
      max(s.created_at) last_purchase,
      (SELECT max(r.created_at) FROM public.customer_reminders r WHERE r.customer_id = c.id) last_reminder
    FROM public.customers c LEFT JOIN public.sales s ON s.customer_id = c.id AND s.user_id = owner_id
    WHERE c.user_id = owner_id GROUP BY c.id
  ), filtered AS (
    SELECT * FROM accounts WHERE (COALESCE(p_search,'') = '' OR name ILIKE '%' || p_search || '%' OR phone ILIKE '%' || p_search || '%')
      AND CASE p_filter WHEN 'debt' THEN due > 0 WHEN 'overdue' THEN overdue_count > 0
        WHEN 'settled' THEN due = 0 WHEN 'missing_phone' THEN due > 0 AND phone = '' ELSE true END
  ), page AS (
    SELECT * FROM filtered ORDER BY
      CASE WHEN p_sort = 'name' THEN name END,
      CASE WHEN p_sort = 'recent' THEN last_purchase END DESC NULLS LAST,
      CASE WHEN p_sort = 'purchases' THEN purchases END DESC,
      CASE WHEN p_sort = 'priority' THEN due END DESC, id
    OFFSET greatest(p_offset,0) LIMIT least(greatest(p_limit,1),100)
  ) SELECT jsonb_build_object('customers', COALESCE((SELECT jsonb_agg(to_jsonb(page)) FROM page),'[]'),
    'count',(SELECT count(*) FROM filtered), 'total_due',(SELECT COALESCE(sum(due),0) FROM accounts),
    'debtors',(SELECT count(*) FROM accounts WHERE due > 0)) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.list_customer_accounts(text,text,text,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_customer_accounts(text,text,text,integer,integer) TO authenticated;

CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id), created_by_id uuid NOT NULL REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'ordered' CHECK(status IN ('ordered','received','cancelled')),
  notes text, created_at timestamptz NOT NULL DEFAULT now(), received_at timestamptz
);
CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id), quantity integer NOT NULL CHECK(quantity > 0),
  unit_cost numeric(15,2) NOT NULL CHECK(unit_cost >= 0 AND unit_cost::text <> 'NaN')
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read orders" ON public.purchase_orders FOR SELECT TO authenticated
  USING(user_id = (SELECT public.current_account_id()) AND (SELECT public.can_manage_stock()));
CREATE POLICY "Managers read order lines" ON public.purchase_order_items FOR SELECT TO authenticated
  USING(EXISTS(SELECT 1 FROM public.purchase_orders o WHERE o.id = order_id AND o.user_id = (SELECT public.current_account_id())));
REVOKE ALL ON public.purchase_orders, public.purchase_order_items FROM anon, authenticated;
GRANT SELECT ON public.purchase_orders, public.purchase_order_items TO authenticated;
CREATE INDEX purchase_orders_account_date_idx ON public.purchase_orders(user_id, created_at DESC);
CREATE INDEX purchase_orders_supplier_idx ON public.purchase_orders(supplier_id);
CREATE INDEX purchase_orders_actor_idx ON public.purchase_orders(created_by_id);
CREATE INDEX purchase_order_items_order_idx ON public.purchase_order_items(order_id);
CREATE INDEX purchase_order_items_product_idx ON public.purchase_order_items(product_id);

CREATE OR REPLACE FUNCTION public.create_purchase_order(p_supplier_id uuid, p_items jsonb, p_notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE owner_id uuid := public.current_account_id(); order_id uuid; item jsonb;
BEGIN
  IF NOT public.can_manage_stock() THEN RAISE EXCEPTION 'Acces fournisseur non autorise'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.suppliers WHERE id = p_supplier_id AND user_id = owner_id)
    THEN RAISE EXCEPTION 'Fournisseur non autorise'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 500
    THEN RAISE EXCEPTION 'Commande vide ou invalide'; END IF;
  INSERT INTO public.purchase_orders(user_id,supplier_id,created_by_id,notes)
    VALUES(owner_id,p_supplier_id,auth.uid(),NULLIF(btrim(p_notes),'')) RETURNING id INTO order_id;
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF NOT EXISTS(SELECT 1 FROM public.products WHERE id = (item->>'product_id')::uuid AND user_id = owner_id AND supplier_id = p_supplier_id AND currency = 'XOF')
      THEN RAISE EXCEPTION 'Produit non autorise pour ce fournisseur'; END IF;
    INSERT INTO public.purchase_order_items(order_id,product_id,quantity,unit_cost)
      VALUES(order_id,(item->>'product_id')::uuid,(item->>'quantity')::integer,(item->>'unit_cost')::numeric);
  END LOOP;
  RETURN order_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.update_purchase_order(p_order_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE order_row public.purchase_orders%ROWTYPE; item record;
BEGIN
  IF NOT public.can_manage_stock() OR p_status IS NULL OR p_status NOT IN ('received','cancelled') THEN RAISE EXCEPTION 'Action non autorisee'; END IF;
  SELECT * INTO order_row FROM public.purchase_orders WHERE id = p_order_id AND user_id = public.current_account_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF order_row.status = p_status THEN RETURN; END IF;
  IF order_row.status <> 'ordered' THEN RAISE EXCEPTION 'Commande deja terminee'; END IF;
  IF p_status = 'received' THEN
    FOR item IN SELECT * FROM public.purchase_order_items WHERE order_id = p_order_id ORDER BY product_id LOOP
      PERFORM public.adjust_product_stock(item.product_id, item.quantity, false, 'Reception commande ' || p_order_id);
      UPDATE public.products SET buying_price = item.unit_cost WHERE id = item.product_id;
    END LOOP;
  END IF;
  UPDATE public.purchase_orders SET status = p_status, received_at = CASE WHEN p_status = 'received' THEN now() END WHERE id = p_order_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_purchase_order(uuid,jsonb,text), public.update_purchase_order(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_purchase_order(uuid,jsonb,text), public.update_purchase_order(uuid,text) TO authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  VALUES('product-images','product-images',true,2097152,ARRAY['image/png','image/jpeg','image/webp'])
  ON CONFLICT(id) DO NOTHING;
CREATE POLICY "Managers upload product images" ON storage.objects FOR INSERT TO authenticated WITH CHECK(
  bucket_id = 'product-images' AND (storage.foldername(name))[1] = (SELECT public.current_account_id())::text AND (SELECT public.can_manage_stock()));
CREATE POLICY "Managers read own product image metadata" ON storage.objects FOR SELECT TO authenticated USING(
  bucket_id = 'product-images' AND (storage.foldername(name))[1] = (SELECT public.current_account_id())::text AND (SELECT public.can_manage_stock()));
CREATE POLICY "Managers delete product images" ON storage.objects FOR DELETE TO authenticated USING(
  bucket_id = 'product-images' AND (storage.foldername(name))[1] = (SELECT public.current_account_id())::text AND (SELECT public.can_manage_stock()));
CREATE OR REPLACE FUNCTION public.support_growth_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_support_operator() OR public.current_support_email() NOT IN ('contact@xelltekk.com','kha2006dim@gmail.com')
    THEN RAISE EXCEPTION 'Acces support requis'; END IF;
  WITH accounts AS (
    SELECT p.id, p.business_name, p.email, p.subscription_plan, p.subscription_status, p.current_period_ends_at, p.created_at,
      (SELECT max(s.created_at) FROM public.sales s WHERE s.user_id = p.id AND s.payment_status IN ('completed','partial','pending')) last_sale_at
    FROM public.profiles p WHERE COALESCE(p.account_owner_id,p.id) = p.id
  ), renewals AS (
    SELECT * FROM accounts WHERE subscription_plan NOT IN ('free','lifetime') AND subscription_status IN ('active','past_due')
      AND current_period_ends_at >= now() AND current_period_ends_at <= now() + interval '14 days'
    ORDER BY current_period_ends_at LIMIT 20
  ), inactive AS (
    SELECT * FROM accounts WHERE created_at < now() - interval '30 days' AND COALESCE(last_sale_at,created_at) < now() - interval '30 days'
    ORDER BY last_sale_at NULLS FIRST, created_at LIMIT 20
  ) SELECT jsonb_build_object(
    'new_accounts_30d',(SELECT count(*) FROM accounts WHERE created_at >= now() - interval '30 days'),
    'active_accounts_30d',(SELECT count(*) FROM accounts WHERE last_sale_at >= now() - interval '30 days'),
    'inactive_accounts_30d',(SELECT count(*) FROM accounts WHERE created_at < now() - interval '30 days' AND COALESCE(last_sale_at,created_at) < now() - interval '30 days'),
    'expired_paid_accounts',(SELECT count(*) FROM accounts WHERE subscription_plan NOT IN ('free','lifetime') AND current_period_ends_at < now()),
    'mrr_estimated',(SELECT COALESCE(sum(public.subscription_plan_price(subscription_plan)),0) FROM accounts
      WHERE subscription_status = 'active' AND subscription_plan IN ('starter','pro') AND (current_period_ends_at IS NULL OR current_period_ends_at > now())),
    'renewals',COALESCE((SELECT jsonb_agg(to_jsonb(renewals)) FROM renewals),'[]'),
    'inactive',COALESCE((SELECT jsonb_agg(to_jsonb(inactive)) FROM inactive),'[]')) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.support_growth_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_growth_overview() TO authenticated;
NOTIFY pgrst, 'reload schema';
