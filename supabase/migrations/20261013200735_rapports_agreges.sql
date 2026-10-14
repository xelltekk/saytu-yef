-- Read-only summaries and keyset-paged product exports. No sale rows reach the browser.
CREATE OR REPLACE FUNCTION public.get_reports_summary(p_options jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  owner_id uuid := public.current_account_id();
  actor_id uuid := auth.uid();
  actor_role text;
  seller_filter uuid := nullif(p_options->>'sellerId','')::uuid;
  range_start timestamptz := (p_options->>'start')::timestamptz;
  range_end timestamptz := (p_options->>'endExclusive')::timestamptz;
  bucket_kind text := coalesce(p_options->>'granularity','month');
  zone_name text := coalesce(p_options->>'timeZone','UTC');
  export_mode boolean := coalesce(p_options->>'mode','summary') = 'products';
  page_limit integer := least(greatest(coalesce((p_options->>'limit')::integer,50),1),100);
  after_revenue numeric := (p_options->'after'->>'revenue')::numeric;
  after_id text := p_options->'after'->>'id';
  result jsonb;
BEGIN
  IF actor_id IS NULL OR owner_id IS NULL OR public.current_account_access_status() IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Acces non autorise';
  END IF;
  SELECT role INTO actor_role FROM public.profiles
    WHERE id=actor_id AND coalesce(account_owner_id,id)=owner_id;
  IF actor_role IS NULL OR actor_role NOT IN ('admin','employee','cashier') THEN RAISE EXCEPTION 'Acces non autorise'; END IF;
  IF actor_role='cashier' THEN seller_filter := actor_id; END IF;
  IF range_start IS NULL OR range_end IS NULL OR range_end<=range_start OR range_end>range_start+interval '10 years'
    OR bucket_kind NOT IN ('day','month') OR (bucket_kind='day' AND range_end-range_start>interval '62 days') THEN
    RAISE EXCEPTION 'Periode de rapport invalide (10 ans maximum)';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=zone_name) THEN RAISE EXCEPTION 'Fuseau horaire invalide'; END IF;
  IF seller_filter IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.profiles
    WHERE id=seller_filter AND coalesce(account_owner_id,id)=owner_id) THEN RAISE EXCEPTION 'Vendeur invalide'; END IF;
  IF (after_id IS NULL) IS DISTINCT FROM (after_revenue IS NULL) THEN RAISE EXCEPTION 'Curseur invalide'; END IF;

  WITH scoped_sales AS MATERIALIZED (
    SELECT s.id,s.seller_id,s.customer_name,s.customer_phone,s.total,s.payment_status,s.payment_method,s.created_at,
      greatest(s.total-coalesce(s.tax,0),0) AS net,
      greatest(coalesce(s.amount_paid,greatest(s.total-coalesce(s.amount_due,0),0)),0) AS paid,
      greatest(coalesce(s.amount_due,greatest(s.total-coalesce(s.amount_paid,greatest(s.total-coalesce(s.amount_due,0),0)),0)),0) AS due,
      date_trunc(bucket_kind,s.created_at AT TIME ZONE zone_name) AS bucket
    FROM public.sales s WHERE s.user_id=owner_id AND s.created_at>=range_start AND s.created_at<range_end
      AND s.payment_status IN ('completed','partial','pending') AND (seller_filter IS NULL OR s.seller_id=seller_filter)
  ), item_base AS MATERIALIZED (
    SELECT i.id,i.sale_id,i.product_id,i.product_name,i.quantity,i.total,i.unit_cost,
      s.net,s.bucket,s.created_at,p.buying_price,
      sum(i.total) OVER(PARTITION BY i.sale_id) AS gross
    FROM scoped_sales s JOIN public.sale_items i ON i.sale_id=s.id
    LEFT JOIN public.products p ON p.id=i.product_id AND p.user_id=owner_id AND i.unit_cost IS NULL
  ), items AS MATERIALIZED (
    SELECT *,total*CASE WHEN gross>0 THEN net/gross ELSE 1 END AS revenue,
      CASE WHEN coalesce(unit_cost,buying_price) IS NULL THEN 0
        ELSE total*CASE WHEN gross>0 THEN net/gross ELSE 1 END-coalesce(unit_cost,buying_price)*quantity END AS profit
    FROM item_base
  ), product_totals AS MATERIALIZED (
    SELECT coalesce(product_id::text,'deleted:'||product_name) AS id,
      (array_agg(product_name ORDER BY created_at,sale_id,id))[1] AS name,
      sum(quantity) AS sold,sum(revenue) AS revenue,sum(profit) AS profit
    FROM items GROUP BY coalesce(product_id::text,'deleted:'||product_name)
  ), products AS MATERIALIZED (
    SELECT *,CASE WHEN revenue>0 THEN profit/revenue*100 ELSE 0 END AS margin FROM product_totals
  ), sale_totals AS (
    SELECT count(*) AS "salesCount",coalesce(sum(total),0) AS "totalInvoiced",
      coalesce(sum(paid),0) AS "totalCollected",coalesce(sum(due),0) AS "totalDue",
      coalesce(avg(total),0) AS "averageTicket",
      CASE WHEN sum(total)>0 THEN sum(paid)/sum(total)*100 ELSE 0 END AS "collectionRate",
      count(*) FILTER(WHERE payment_status='completed') AS "completedCount",
      count(*) FILTER(WHERE payment_status='partial') AS "partialCount",
      count(*) FILTER(WHERE payment_status='pending') AS "pendingCount"
    FROM scoped_sales
  ), period_sales AS (
    SELECT bucket,sum(net) AS revenue FROM scoped_sales GROUP BY bucket
  ), period_items AS (
    SELECT bucket,sum(profit) AS profit FROM items GROUP BY bucket
  ), periods AS MATERIALIZED (
    SELECT to_char(b,CASE WHEN bucket_kind='month' THEN 'YYYY-MM' ELSE 'YYYY-MM-DD' END) AS key,
      coalesce(s.revenue,0) AS revenue,coalesce(i.profit,0) AS profit
    FROM generate_series(date_trunc(bucket_kind,range_start AT TIME ZONE zone_name),
      date_trunc(bucket_kind,(range_end-interval '1 microsecond') AT TIME ZONE zone_name),
      CASE WHEN bucket_kind='month' THEN interval '1 month' ELSE interval '1 day' END) b
    LEFT JOIN period_sales s ON s.bucket=b LEFT JOIN period_items i ON i.bucket=b
  ), payments AS MATERIALIZED (
    -- Payment dates, not sale dates; includes receipts for older debts.
    SELECT p.payment_method,p.amount FROM public.sale_payments p
    JOIN public.sales s ON s.id=p.sale_id AND s.user_id=owner_id
    WHERE p.user_id=owner_id AND p.created_at>=range_start AND p.created_at<range_end
      AND s.payment_status IN ('completed','partial','pending') AND (seller_filter IS NULL OR s.seller_id=seller_filter)
  ), methods AS MATERIALIZED (
    SELECT method,(SELECT count(*) FROM scoped_sales WHERE payment_method=method) AS count,
      coalesce((SELECT sum(total) FROM scoped_sales WHERE payment_method=method),0) AS invoiced,
      coalesce((SELECT sum(amount) FROM payments WHERE payment_method=method),0) AS collected,
      coalesce((SELECT sum(due) FROM scoped_sales WHERE payment_method=method),0) AS due
    FROM unnest(ARRAY['cash','wave','orange_money','card']) method
  ), client_totals AS (
    SELECT lower(btrim(coalesce(customer_name,'')))||'|'||btrim(coalesce(customer_phone,'')) AS key,
      (array_agg(coalesce(nullif(btrim(customer_name),''),btrim(customer_phone)) ORDER BY created_at,id))[1] AS name,
      btrim(coalesce(customer_phone,'')) AS phone,count(*) AS "salesCount",sum(total) AS invoiced,sum(paid) AS collected,sum(due) AS due
    FROM scoped_sales WHERE btrim(coalesce(customer_name,''))<>'' OR btrim(coalesce(customer_phone,''))<>''
    GROUP BY lower(btrim(coalesce(customer_name,''))),btrim(coalesce(customer_phone,''))
  ), clients AS MATERIALIZED (
    SELECT *,CASE WHEN invoiced>0 THEN collected/invoiced*100 ELSE 0 END AS "collectionRate" FROM client_totals
  ), seller_units AS (
    SELECT s.seller_id,sum(i.quantity) AS sold FROM scoped_sales s JOIN items i ON i.sale_id=s.id GROUP BY s.seller_id
  ), seller_totals AS (
    SELECT s.seller_id,count(*) AS count,sum(s.total) AS invoiced,sum(s.paid) AS collected,sum(s.due) AS due,max(s.created_at) AS latest
    FROM scoped_sales s GROUP BY s.seller_id
  ), sellers AS MATERIALIZED (
    SELECT coalesce(t.seller_id::text,'unassigned') AS "sellerId",
      coalesce(nullif(btrim(p.full_name),''),nullif(p.email,''),'Vente non attribuee') AS "sellerName",
      coalesce(p.email,'') AS "sellerEmail",coalesce(p.role,'employee') AS "sellerRole",
      t.count AS "salesCount",coalesce(u.sold,0) AS "totalSold",t.invoiced AS "totalInvoiced",
      t.collected AS "totalCollected",t.due AS "totalDue",t.invoiced/t.count AS "averageTicket",
      CASE WHEN t.invoiced>0 THEN t.collected/t.invoiced*100 ELSE 0 END AS "collectionRate",t.latest AS "lastSaleAt"
    FROM seller_totals t LEFT JOIN seller_units u ON u.seller_id IS NOT DISTINCT FROM t.seller_id
    LEFT JOIN public.profiles p ON p.id=t.seller_id AND coalesce(p.account_owner_id,p.id)=owner_id
  ), identity AS (
    SELECT md5(jsonb_build_object('totals',(SELECT to_jsonb(t) FROM sale_totals t),
      'products',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM products p),
      'periods',(SELECT jsonb_agg(to_jsonb(p) ORDER BY key) FROM periods p),
      'payments',(SELECT jsonb_agg(to_jsonb(m) ORDER BY method) FROM methods m),
      'sellers',(SELECT jsonb_agg(to_jsonb(s) ORDER BY "sellerId") FROM sellers s),
      'estimated',(SELECT count(*) FROM items WHERE unit_cost IS NULL))::text) AS version
  ), export_page AS MATERIALIZED (
    SELECT * FROM products WHERE after_id IS NULL OR revenue<after_revenue OR (revenue=after_revenue AND id>after_id)
    ORDER BY revenue DESC,id LIMIT page_limit
  )
  SELECT jsonb_build_object('ownerId',owner_id,'version',(SELECT version FROM identity),'appliedSellerId',seller_filter) ||
    CASE WHEN export_mode THEN jsonb_build_object(
      'products',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY revenue DESC,id) FROM export_page p),'[]'::jsonb),
      'nextCursor',(SELECT jsonb_build_object('id',id,'revenue',revenue::text) FROM export_page ORDER BY revenue ASC,id DESC LIMIT 1),
      'totalProducts',(SELECT count(*) FROM products))
    ELSE (SELECT to_jsonb(t) FROM sale_totals t) || jsonb_build_object(
      'monthlyData',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY key) FROM periods p),'[]'::jsonb),
      'topProducts',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY revenue DESC,id)
        FROM (SELECT * FROM products ORDER BY revenue DESC,id LIMIT 10) p),'[]'::jsonb),
      'paymentMethodData',(SELECT jsonb_agg(to_jsonb(m)) FROM methods m),
      'cashCollected',coalesce((SELECT sum(amount) FROM payments),0),
      'estimatedProfitCount',(SELECT count(*) FROM items WHERE unit_cost IS NULL),
      'totalSold',coalesce((SELECT sum(sold) FROM products),0),
      'avgMargin',(SELECT CASE WHEN sum(revenue)>0 THEN sum(profit)/sum(revenue)*100 ELSE 0 END FROM products),
      'topClients',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY invoiced DESC,due DESC,"salesCount" DESC,key)
        FROM (SELECT * FROM clients ORDER BY invoiced DESC,due DESC,"salesCount" DESC,key LIMIT 8) c),'[]'::jsonb),
      'bestClientByRevenue',(SELECT to_jsonb(c) FROM clients c ORDER BY invoiced DESC,due DESC,"salesCount" DESC,key LIMIT 1),
      'highestDueClient',(SELECT to_jsonb(c) FROM clients c ORDER BY due DESC,invoiced DESC,key LIMIT 1),
      'bestMonth',(SELECT to_jsonb(p) FROM periods p WHERE revenue>0 OR profit>0 ORDER BY revenue DESC,profit DESC,key LIMIT 1),
      'bestProductByUnits',(SELECT to_jsonb(p) FROM products p ORDER BY sold DESC,revenue DESC,id LIMIT 1),
      'bestProductByProfit',(SELECT to_jsonb(p) FROM products p ORDER BY profit DESC,revenue DESC,id LIMIT 1),
      'sellerBreakdown',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY "totalInvoiced" DESC,"totalCollected" DESC,"salesCount" DESC,"sellerId") FROM sellers s),'[]'::jsonb),
      'sellerOptions',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'label',coalesce(nullif(btrim(p.full_name),''),nullif(p.email,''),'Utilisateur'),'role',p.role) ORDER BY p.full_name,p.id)
        FROM public.profiles p WHERE coalesce(p.account_owner_id,p.id)=owner_id AND (actor_role<>'cashier' OR p.id=actor_id)),'[]'::jsonb)
    ) END INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_reports_summary(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_reports_summary(jsonb) TO authenticated;
