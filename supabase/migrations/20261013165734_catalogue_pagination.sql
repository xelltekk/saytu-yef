-- Pages contain complete groups. Large images are only projected for selected rows.
CREATE OR REPLACE FUNCTION public.catalogue_normalize_code(p_value text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY INVOKER SET search_path = '' AS $$
  SELECT lower(regexp_replace(upper(pg_catalog.normalize(coalesce(p_value,''),'NFD')),'[^A-Z0-9]','','g'));
$$;
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
      p.quantity, coalesce(p.min_quantity, 0) AS min_quantity, p.buying_price, p.selling_price,
      c.name AS category_name, s.name AS supplier_name
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id AND c.user_id = owner_id
    LEFT JOIN public.suppliers s ON s.id = p.supplier_id AND s.user_id = owner_id
    WHERE p.user_id = owner_id
      AND (scope_name = 'inventory' OR (p.status = 'active' AND p.quantity > 0 AND p.currency = 'XOF'))
  ), groups AS MATERIALIZED (
    SELECT group_id, min(name) AS name, max(updated_at) AS updated_at, sum(quantity) AS quantity,
      count(*) AS variants, bool_and(quantity = 0) AS all_out,
      bool_or(quantity > 0 AND quantity <= min_quantity) AS has_low,
      bool_or(quantity > min_quantity) AS has_available,
      sum(CASE WHEN quantity <= min_quantity THEN greatest(min_quantity - quantity + 1, 1) ELSE 0 END) AS restock_units,
      sum(CASE WHEN quantity <= min_quantity THEN greatest(min_quantity - quantity + 1, 1) * buying_price ELSE 0 END) AS restock_cost,
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
        OR (stock_filter = 'restock' AND restock_units > 0))
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
      WHERE scope_name='inventory' OR (p.status='active' AND p.quantity>0 AND p.currency='XOF')),'[]'::jsonb),
    'categories', coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.name) FROM public.categories c
      WHERE c.user_id=owner_id AND c.id IN (SELECT category_id FROM scoped)),'[]'::jsonb),
    'suppliers', coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.name) FROM public.suppliers s
      WHERE s.user_id=owner_id AND s.id IN (SELECT supplier_id FROM scoped)),'[]'::jsonb),
    'summary', jsonb_build_object(
      'products',(SELECT count(*) FROM groups), 'variants',(SELECT count(*) FROM scoped),
      'units',(SELECT coalesce(sum(quantity),0) FROM scoped),
      'buyingValue',(SELECT coalesce(sum(quantity*buying_price),0) FROM scoped),
      'sellingValue',(SELECT coalesce(sum(quantity*selling_price),0) FROM scoped),
      'lowVariants',(SELECT count(*) FROM scoped WHERE quantity>0 AND quantity<=min_quantity),
      'outVariants',(SELECT count(*) FROM scoped WHERE quantity=0),
      'restockProducts',(SELECT count(*) FROM groups WHERE restock_units>0),
      'restockUnits',(SELECT coalesce(sum(restock_units),0) FROM groups),
      'restockCost',(SELECT coalesce(sum(restock_cost),0) FROM groups)),
    'excludedCurrencyCount', (SELECT count(*) FROM public.products WHERE user_id=owner_id
      AND status='active' AND quantity>0 AND currency<>'XOF')
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
      AND (p_scope='inventory' OR (p.status='active' AND p.quantity>0 AND p.currency='XOF'));
  IF jsonb_array_length(matches)=0 THEN
    SELECT coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) INTO matches FROM public.products p
      WHERE p.user_id=owner_id AND public.catalogue_normalize_code(p.barcode)=normalized_code
        AND (p_scope='inventory' OR (p.status='active' AND p.quantity>0 AND p.currency='XOF'));
  END IF;
  IF jsonb_array_length(matches)=0 THEN
    SELECT coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) INTO matches FROM public.products p
      WHERE p.user_id=owner_id AND public.catalogue_normalize_code(p.sku)=normalized_code
        AND (p_scope='inventory' OR (p.status='active' AND p.quantity>0 AND p.currency='XOF'));
  END IF;
  IF jsonb_array_length(matches)>1 THEN RAISE EXCEPTION 'Reference ambigue : utilisez le code-barres unique de la variante'; END IF;
  RETURN jsonb_build_object('ownerId',owner_id,'product',matches->0);
END;
$$;
REVOKE ALL ON FUNCTION public.list_catalogue_page(jsonb), public.lookup_catalogue_code(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_catalogue_page(jsonb), public.lookup_catalogue_code(text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.catalogue_normalize_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalogue_normalize_code(text) TO authenticated;
