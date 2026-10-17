-- Existing products and historical sales retain their original stock semantics.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS track_stock boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true;
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS stock_tracked boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.sale_items.stock_tracked IS
  'Server-side snapshot: whether this sale deducted stock, used for refunds even after mode changes.';

CREATE OR REPLACE FUNCTION public.snapshot_sale_item_cost()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE product_row public.products%ROWTYPE;
BEGIN
  SELECT p.* INTO product_row FROM public.products p
    JOIN public.sales s ON s.user_id = p.user_id
    WHERE s.id = NEW.sale_id AND p.id = NEW.product_id FOR UPDATE OF p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable ou non autorise'; END IF;
  IF product_row.status <> 'active' OR NOT product_row.is_available THEN
    RAISE EXCEPTION 'Produit indisponible';
  END IF;
  NEW.unit_cost := product_row.buying_price;
  NEW.stock_tracked := product_row.track_stock;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_stock_on_sale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE owner_id uuid; previous_qty integer; next_qty integer; tracked boolean;
BEGIN
  SELECT user_id INTO owner_id FROM public.sales WHERE id = NEW.sale_id;
  SELECT quantity, track_stock INTO previous_qty, tracked FROM public.products
    WHERE id = NEW.product_id AND user_id = owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable ou non autorise'; END IF;
  IF NEW.quantity IS NULL OR NEW.quantity <= 0 THEN RAISE EXCEPTION 'Quantite invalide'; END IF;
  IF NOT tracked THEN RETURN NEW; END IF;
  IF NEW.quantity > previous_qty THEN RAISE EXCEPTION 'Stock insuffisant. Disponible: %', previous_qty; END IF;
  next_qty := previous_qty - NEW.quantity;
  UPDATE public.products SET quantity = next_qty, updated_at = now() WHERE id = NEW.product_id;
  INSERT INTO public.stock_movements(user_id, product_id, movement_type, quantity, previous_quantity, new_quantity, reason)
    VALUES(owner_id, NEW.product_id, 'out', NEW.quantity, previous_qty, next_qty, 'Vente ' || NEW.sale_id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.snapshot_sale_item_cost(), public.update_stock_on_sale() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.adjust_product_stock(p_product_id uuid, p_quantity integer, p_absolute boolean DEFAULT false, p_reason text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE old_qty integer; next_qty integer; tracked boolean; owner_id uuid := public.current_account_id();
BEGIN
  IF NOT public.can_manage_stock() THEN RAISE EXCEPTION 'Acces inventaire non autorise'; END IF;
  IF p_quantity IS NULL THEN RAISE EXCEPTION 'Quantite requise'; END IF;
  PERFORM id FROM public.profiles WHERE id = owner_id FOR NO KEY UPDATE;
  SELECT quantity, track_stock INTO old_qty, tracked FROM public.products WHERE id = p_product_id AND user_id = owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable'; END IF;
  IF NOT tracked THEN RAISE EXCEPTION 'Ce produit est sans suivi de stock'; END IF;
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

CREATE OR REPLACE FUNCTION public.reverse_sale_with_stock(p_sale_id uuid, p_target_status text, p_reason text)
RETURNS public.sales LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE account_id uuid := public.current_account_id(); sale_row public.sales%ROWTYPE; item_row record;
  previous_qty integer; next_qty integer; movement_reason text;
BEGIN
  IF NOT public.is_account_admin() OR public.current_account_access_status() IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Remboursement reserve a un administrateur';
  END IF;
  IF p_target_status IS NULL OR p_target_status NOT IN ('cancelled', 'refunded') THEN RAISE EXCEPTION 'Type d operation invalide'; END IF;
  IF NULLIF(btrim(p_reason), '') IS NULL THEN RAISE EXCEPTION 'Le motif est requis'; END IF;
  -- Match checkout's lock order before locking individual product rows.
  PERFORM id FROM public.profiles WHERE id = account_id FOR NO KEY UPDATE;
  SELECT * INTO sale_row FROM public.sales WHERE id = p_sale_id AND user_id = account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vente introuvable'; END IF;
  IF sale_row.payment_status IN ('cancelled', 'refunded') THEN RAISE EXCEPTION 'Vente deja annulee ou remboursee'; END IF;
  IF p_target_status = 'cancelled' AND coalesce(sale_row.amount_paid, 0) > 0 THEN RAISE EXCEPTION 'Une vente encaissee doit etre remboursee'; END IF;
  IF p_target_status = 'refunded' AND coalesce(sale_row.amount_paid, 0) <= 0 THEN RAISE EXCEPTION 'Aucun montant encaisse'; END IF;
  IF EXISTS (SELECT 1 FROM public.sale_items WHERE sale_id = sale_row.id AND stock_tracked AND product_id IS NULL) THEN
    RAISE EXCEPTION 'Restauration impossible: produit supprime';
  END IF;
  movement_reason := CASE p_target_status WHEN 'refunded' THEN 'Remboursement vente ' ELSE 'Annulation vente ' END
    || sale_row.id::text || ' - ' || btrim(p_reason);
  FOR item_row IN SELECT product_id, quantity FROM public.sale_items
    WHERE sale_id = sale_row.id AND stock_tracked ORDER BY product_id LOOP
    SELECT quantity INTO previous_qty FROM public.products WHERE id = item_row.product_id AND user_id = account_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Restauration impossible: produit introuvable'; END IF;
    next_qty := previous_qty + item_row.quantity;
    UPDATE public.products SET quantity = next_qty, updated_at = now() WHERE id = item_row.product_id AND user_id = account_id;
    INSERT INTO public.stock_movements(user_id, product_id, movement_type, quantity, previous_quantity, new_quantity, reason)
      VALUES(account_id, item_row.product_id, 'in', item_row.quantity, previous_qty, next_qty, movement_reason);
  END LOOP;
  UPDATE public.sales SET payment_status = p_target_status, amount_due = 0, reversed_at = now(), reversal_reason = btrim(p_reason)
    WHERE id = sale_row.id RETURNING * INTO sale_row;
  RETURN sale_row;
END;
$$;
REVOKE ALL ON FUNCTION public.reverse_sale_with_stock(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverse_sale_with_stock(uuid,text,text) TO authenticated;

-- Catalogue respects manual availability and excludes untracked stock from valuations.
CREATE OR REPLACE FUNCTION public.list_catalogue_page(p_options jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  owner_id uuid := public.current_account_id();
  scope_name text := coalesce(p_options->>'scope', 'inventory');
  query_text text := lower(btrim(coalesce(p_options->>'search', '')));
  code_text text := lower(btrim(coalesce(p_options->>'code', '')));
  category_filter text := coalesce(p_options->>'category', 'all');
  supplier_filter text := coalesce(p_options->>'supplier', 'all');
  stock_filter text := coalesce(p_options->>'stock', 'all');
  sort_name text := coalesce(p_options->>'sort', 'recent');
  page_offset integer := greatest(coalesce((p_options->>'offset')::integer, 0), 0);
  page_limit integer := least(greatest(coalesce((p_options->>'limit')::integer, 24), 1), 50);
  result jsonb;
BEGIN
  IF auth.uid() IS NULL OR owner_id IS NULL OR public.current_account_access_status() IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Acces non autorise';
  END IF;
  IF scope_name NOT IN ('inventory', 'pos') THEN RAISE EXCEPTION 'Catalogue invalide'; END IF;

  WITH scoped AS MATERIALIZED (
    SELECT p.id, coalesce(p.product_group_id, p.id) AS group_id, p.name, p.description,
      p.sku, p.barcode, p.size, p.color, p.category_id, p.supplier_id, p.updated_at,
      p.quantity, p.track_stock, p.is_available, p.status, coalesce(p.min_quantity, 0) AS min_quantity, p.buying_price, p.selling_price,
      c.name AS category_name, s.name AS supplier_name
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id AND c.user_id = owner_id
    LEFT JOIN public.suppliers s ON s.id = p.supplier_id AND s.user_id = owner_id
    WHERE p.user_id = owner_id
      AND (scope_name = 'inventory' OR (p.status = 'active' AND p.is_available AND (NOT p.track_stock OR p.quantity > 0) AND p.currency = 'XOF'))
  ), groups AS MATERIALIZED (
    SELECT group_id, min(name) AS name, max(updated_at) AS updated_at, sum(CASE WHEN track_stock THEN quantity ELSE 0 END) AS quantity,
      count(*) AS variants, bool_and(track_stock AND quantity = 0) AS all_out,
      bool_or(track_stock AND quantity > 0 AND quantity <= min_quantity) AS has_low,
      bool_or(status='active' AND is_available AND (NOT track_stock OR quantity > min_quantity)) AS has_available,
      bool_or(NOT track_stock) AS has_untracked,
      bool_or(status='active' AND is_available AND (NOT track_stock OR quantity > 0)) AS has_saleable,
      sum(CASE WHEN track_stock AND quantity <= min_quantity THEN greatest(min_quantity - quantity + 1, 1) ELSE 0 END) AS restock_units,
      sum(CASE WHEN track_stock AND quantity <= min_quantity THEN greatest(min_quantity - quantity + 1, 1) * buying_price ELSE 0 END) AS restock_cost,
      bool_or((category_filter = 'all' OR category_id::text = category_filter)
        AND (supplier_filter = 'all' OR (supplier_filter = 'none' AND supplier_id IS NULL) OR supplier_id::text = supplier_filter)) AS matches_facets,
      bool_or((query_text = '' AND code_text = '') OR
        (query_text <> '' AND (strpos(lower(coalesce(name,'')),query_text)>0
          OR strpos(lower(coalesce(description,'')),query_text)>0
          OR strpos(lower(coalesce(category_name,'')),query_text)>0
          OR strpos(lower(coalesce(supplier_name,'')),query_text)>0
          OR strpos(lower(coalesce(size,'')),query_text)>0 OR strpos(lower(coalesce(color,'')),query_text)>0))
        OR (code_text <> '' AND (strpos(public.catalogue_normalize_code(barcode),code_text)>0
          OR strpos(public.catalogue_normalize_code(sku),code_text)>0))) AS matches_search
    FROM scoped GROUP BY group_id
  ), filtered AS MATERIALIZED (
    SELECT * FROM groups WHERE matches_facets AND matches_search
      AND (coalesce(p_options->>'group','')='' OR group_id::text=p_options->>'group') AND
      (stock_filter = 'all' OR (stock_filter = 'available' AND has_available)
        OR (stock_filter = 'low' AND NOT all_out AND has_low) OR (stock_filter = 'out' AND all_out)
        OR (stock_filter = 'restock' AND restock_units > 0)
        OR (stock_filter = 'untracked' AND has_untracked) OR (stock_filter = 'unavailable' AND NOT has_saleable))
  ), selected AS (
    SELECT *, row_number() OVER (ORDER BY
      CASE WHEN sort_name = 'name' THEN lower(name) END ASC,
      CASE WHEN sort_name = 'stock-low' THEN quantity END ASC,
      CASE WHEN sort_name = 'stock-high' THEN quantity END DESC,
      CASE WHEN sort_name = 'variants' THEN variants END DESC,
      CASE WHEN sort_name = 'restock-cost' THEN restock_cost END DESC,
      CASE WHEN sort_name NOT IN ('name','stock-low','stock-high','variants','restock-cost') THEN updated_at END DESC,
      group_id) AS ordinal
    FROM filtered
  ), page AS (SELECT * FROM selected ORDER BY ordinal OFFSET page_offset LIMIT page_limit)
  SELECT jsonb_build_object(
    'ownerId', owner_id, 'offset', page_offset, 'limit', page_limit,
    'version', (SELECT md5(coalesce(string_agg(to_jsonb(scoped)::text,'|' ORDER BY id),'')) FROM scoped),
    'totalGroups', (SELECT count(*) FROM filtered),
    'totalVariants', (SELECT coalesce(sum(variants),0) FROM filtered),
    'groupIds', coalesce((SELECT jsonb_agg(group_id ORDER BY ordinal) FROM page),'[]'::jsonb),
    'products', coalesce((SELECT jsonb_agg(
      (to_jsonb(p) - 'image_url') || jsonb_build_object(
        'image_url', CASE WHEN coalesce((p_options->>'images')::boolean,true) THEN p.image_url ELSE NULL END,
        'category', to_jsonb(c), 'supplier', to_jsonb(s)) ORDER BY pg.ordinal,p.created_at DESC,p.id)
      FROM page pg JOIN public.products p ON coalesce(p.product_group_id,p.id)=pg.group_id AND p.user_id=owner_id
      LEFT JOIN public.categories c ON c.id=p.category_id AND c.user_id=owner_id
      LEFT JOIN public.suppliers s ON s.id=p.supplier_id AND s.user_id=owner_id
      WHERE scope_name='inventory' OR (p.status='active' AND p.is_available AND (NOT p.track_stock OR p.quantity>0) AND p.currency='XOF')),'[]'::jsonb),
    'categories', coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.name) FROM public.categories c
      WHERE c.user_id=owner_id AND c.id IN (SELECT category_id FROM scoped)),'[]'::jsonb),
    'suppliers', coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.name) FROM public.suppliers s
      WHERE s.user_id=owner_id AND s.id IN (SELECT supplier_id FROM scoped)),'[]'::jsonb),
    'summary', jsonb_build_object(
      'products',(SELECT count(*) FROM groups), 'variants',(SELECT count(*) FROM scoped),
      'units',(SELECT coalesce(sum(quantity) FILTER (WHERE track_stock),0) FROM scoped),
      'buyingValue',(SELECT coalesce(sum(quantity*buying_price) FILTER (WHERE track_stock),0) FROM scoped),
      'sellingValue',(SELECT coalesce(sum(quantity*selling_price) FILTER (WHERE track_stock),0) FROM scoped),
      'lowVariants',(SELECT count(*) FROM scoped WHERE track_stock AND quantity>0 AND quantity<=min_quantity),
      'outVariants',(SELECT count(*) FROM scoped WHERE track_stock AND quantity=0),
      'restockProducts',(SELECT count(*) FROM groups WHERE restock_units>0),
      'restockUnits',(SELECT coalesce(sum(restock_units),0) FROM groups),
      'restockCost',(SELECT coalesce(sum(restock_cost),0) FROM groups)),
    'excludedCurrencyCount', (SELECT count(*) FROM public.products WHERE user_id=owner_id
      AND status='active' AND is_available AND (NOT track_stock OR quantity>0) AND currency<>'XOF')
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.lookup_catalogue_code(p_code text, p_scope text DEFAULT 'inventory')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  owner_id uuid := public.current_account_id();
  code_text text := lower(btrim(p_code));
  normalized_code text := public.catalogue_normalize_code(p_code);
  matches jsonb;
BEGIN
  IF auth.uid() IS NULL OR owner_id IS NULL OR public.current_account_access_status() IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Acces non autorise';
  END IF;
  IF p_scope NOT IN ('inventory','pos') THEN RAISE EXCEPTION 'Catalogue invalide'; END IF;
  IF normalized_code='' THEN RETURN jsonb_build_object('ownerId',owner_id,'product',NULL); END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) INTO matches FROM public.products p
    WHERE p.user_id=owner_id AND lower(btrim(p.barcode))=code_text
      AND (p_scope='inventory' OR (p.status='active' AND p.is_available AND (NOT p.track_stock OR p.quantity>0) AND p.currency='XOF'));
  IF jsonb_array_length(matches)=0 THEN
    SELECT coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) INTO matches FROM public.products p
      WHERE p.user_id=owner_id AND public.catalogue_normalize_code(p.barcode)=normalized_code
        AND (p_scope='inventory' OR (p.status='active' AND p.is_available AND (NOT p.track_stock OR p.quantity>0) AND p.currency='XOF'));
  END IF;
  IF jsonb_array_length(matches)=0 THEN
    SELECT coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) INTO matches FROM public.products p
      WHERE p.user_id=owner_id AND public.catalogue_normalize_code(p.sku)=normalized_code
        AND (p_scope='inventory' OR (p.status='active' AND p.is_available AND (NOT p.track_stock OR p.quantity>0) AND p.currency='XOF'));
  END IF;
  IF jsonb_array_length(matches)>1 THEN RAISE EXCEPTION 'Reference ambigue : utilisez le code-barres unique de la variante'; END IF;
  RETURN jsonb_build_object('ownerId',owner_id,'product',matches->0);
END;
$$;
REVOKE ALL ON FUNCTION public.list_catalogue_page(jsonb), public.lookup_catalogue_code(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_catalogue_page(jsonb), public.lookup_catalogue_code(text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.catalogue_normalize_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalogue_normalize_code(text) TO authenticated;


NOTIFY pgrst, 'reload schema';

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
    IF NOT EXISTS(SELECT 1 FROM public.products WHERE id = (item->>'product_id')::uuid AND user_id = owner_id AND supplier_id = p_supplier_id AND currency = 'XOF' AND track_stock)
      THEN RAISE EXCEPTION 'Produit non autorise pour ce fournisseur'; END IF;
    INSERT INTO public.purchase_order_items(order_id,product_id,quantity,unit_cost)
      VALUES(order_id,(item->>'product_id')::uuid,(item->>'quantity')::integer,(item->>'unit_cost')::numeric);
  END LOOP;
  RETURN order_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_purchase_order(uuid,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_purchase_order(uuid,jsonb,text) TO authenticated;
