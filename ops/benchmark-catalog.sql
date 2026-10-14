\set ON_ERROR_STOP on
BEGIN READ ONLY;
SET LOCAL statement_timeout='5s';
DO $$
DECLARE actor text;
BEGIN
  SELECT user_id::text INTO actor FROM public.products GROUP BY user_id ORDER BY count(*) DESC,user_id LIMIT 1;
  IF actor IS NULL THEN RAISE EXCEPTION 'Catalogue vide'; END IF;
  PERFORM set_config('request.jwt.claim.sub',actor,true);
END;
$$;
SET LOCAL ROLE authenticated;
EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON)
SELECT jsonb_agg(to_jsonb(catalog)) FROM (
  SELECT p.*,to_jsonb(c) AS category,to_jsonb(s) AS supplier
  FROM public.products p LEFT JOIN public.categories c ON c.id=p.category_id
  LEFT JOIN public.suppliers s ON s.id=p.supplier_id
  ORDER BY p.created_at DESC,p.id LIMIT 500
) catalog;
SELECT jsonb_build_object('rows',count(*),'image_bytes',sum(octet_length(coalesce(image_url,''))),
  'fingerprint',md5(string_agg(jsonb_build_array(id,quantity,buying_price,selling_price)::text,'|' ORDER BY id)))
FROM public.products;
ROLLBACK;
