-- Global SaaS console for XELLTEKK support:
-- - portfolio overview
-- - platform accounts list
-- - support audit timeline

CREATE OR REPLACE FUNCTION public.support_console_overview()
RETURNS TABLE (
  total_accounts BIGINT,
  total_members BIGINT,
  active_paid_accounts BIGINT,
  trial_accounts BIGINT,
  free_accounts BIGINT,
  lifetime_accounts BIGINT,
  pending_requests BIGINT,
  expiring_soon_accounts BIGINT,
  monthly_recurring_revenue NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_support_operator() THEN
    RAISE EXCEPTION 'Acces support requis';
  END IF;

  RETURN QUERY
  WITH owner_profiles AS (
    SELECT p.*
    FROM public.profiles p
    WHERE COALESCE(p.account_owner_id, p.id) = p.id
  )
  SELECT
    COUNT(*)::BIGINT AS total_accounts,
    (SELECT COUNT(*)::BIGINT FROM public.profiles) AS total_members,
    (COUNT(*) FILTER (
      WHERE COALESCE(owner_profiles.subscription_status, 'free') = 'active'
        AND COALESCE(owner_profiles.subscription_plan, 'free') NOT IN ('free', 'lifetime')
    ))::BIGINT AS active_paid_accounts,
    (COUNT(*) FILTER (
      WHERE COALESCE(owner_profiles.subscription_status, 'trial') = 'trial'
    ))::BIGINT AS trial_accounts,
    (COUNT(*) FILTER (
      WHERE COALESCE(owner_profiles.subscription_plan, 'free') = 'free'
         OR COALESCE(owner_profiles.subscription_status, 'free') = 'free'
    ))::BIGINT AS free_accounts,
    (COUNT(*) FILTER (
      WHERE COALESCE(owner_profiles.subscription_plan, 'free') = 'lifetime'
        AND COALESCE(owner_profiles.subscription_status, 'free') = 'active'
    ))::BIGINT AS lifetime_accounts,
    (
      SELECT COUNT(*)::BIGINT
      FROM public.subscription_requests req
      WHERE req.status IN ('sent', 'in_progress')
    ) AS pending_requests,
    (COUNT(*) FILTER (
      WHERE COALESCE(owner_profiles.subscription_plan, 'free') NOT IN ('free', 'lifetime')
        AND COALESCE(owner_profiles.subscription_status, 'free') IN ('active', 'past_due')
        AND owner_profiles.current_period_ends_at IS NOT NULL
        AND owner_profiles.current_period_ends_at <= NOW() + INTERVAL '7 days'
    ))::BIGINT AS expiring_soon_accounts,
    COALESCE(SUM(
      CASE
        WHEN COALESCE(owner_profiles.subscription_status, 'free') = 'active'
          AND COALESCE(owner_profiles.subscription_plan, 'free') = 'starter' THEN 10000
        WHEN COALESCE(owner_profiles.subscription_status, 'free') = 'active'
          AND COALESCE(owner_profiles.subscription_plan, 'free') = 'pro' THEN 20000
        ELSE 0
      END
    ), 0)::NUMERIC AS monthly_recurring_revenue
  FROM owner_profiles;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_support_platform_accounts(
  p_limit INTEGER DEFAULT 50,
  p_search TEXT DEFAULT NULL,
  p_plan TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
  account_id UUID,
  business_name TEXT,
  owner_full_name TEXT,
  owner_email TEXT,
  subscription_plan TEXT,
  subscription_status TEXT,
  billing_cycle TEXT,
  created_at TIMESTAMPTZ,
  current_period_ends_at TIMESTAMPTZ,
  team_members_count BIGINT,
  products_count BIGINT,
  monthly_sales_count BIGINT,
  pending_requests_count BIGINT,
  last_request_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cleaned_search TEXT := NULLIF(BTRIM(COALESCE(p_search, '')), '');
  cleaned_plan TEXT := NULLIF(BTRIM(COALESCE(p_plan, '')), '');
  cleaned_status TEXT := NULLIF(BTRIM(COALESCE(p_status, '')), '');
BEGIN
  IF NOT public.is_support_operator() THEN
    RAISE EXCEPTION 'Acces support requis';
  END IF;

  RETURN QUERY
  WITH owner_profiles AS (
    SELECT
      p.id,
      COALESCE(NULLIF(BTRIM(p.business_name), ''), 'Boutique sans nom') AS business_name,
      COALESCE(NULLIF(BTRIM(p.full_name), ''), 'Compte proprietaire') AS owner_full_name,
      COALESCE(NULLIF(BTRIM(p.email), ''), 'email indisponible') AS owner_email,
      COALESCE(p.subscription_plan, 'free') AS subscription_plan,
      COALESCE(p.subscription_status, 'free') AS subscription_status,
      COALESCE(
        p.billing_cycle,
        CASE
          WHEN COALESCE(p.subscription_plan, 'free') IN ('free', 'lifetime') THEN 'manual'
          ELSE 'monthly'
        END
      ) AS billing_cycle,
      p.created_at,
      p.current_period_ends_at
    FROM public.profiles p
    WHERE COALESCE(p.account_owner_id, p.id) = p.id
      AND (
        cleaned_search IS NULL
        OR LOWER(COALESCE(p.business_name, '')) LIKE '%' || LOWER(cleaned_search) || '%'
        OR LOWER(COALESCE(p.full_name, '')) LIKE '%' || LOWER(cleaned_search) || '%'
        OR LOWER(COALESCE(p.email, '')) LIKE '%' || LOWER(cleaned_search) || '%'
      )
      AND (cleaned_plan IS NULL OR COALESCE(p.subscription_plan, 'free') = cleaned_plan)
      AND (cleaned_status IS NULL OR COALESCE(p.subscription_status, 'free') = cleaned_status)
  )
  SELECT
    owner.id AS account_id,
    owner.business_name,
    owner.owner_full_name,
    owner.owner_email,
    owner.subscription_plan,
    owner.subscription_status,
    owner.billing_cycle,
    owner.created_at,
    owner.current_period_ends_at,
    COALESCE(team_stats.total, 0)::BIGINT AS team_members_count,
    COALESCE(product_stats.total, 0)::BIGINT AS products_count,
    COALESCE(monthly_sales.total, 0)::BIGINT AS monthly_sales_count,
    COALESCE(request_stats.total, 0)::BIGINT AS pending_requests_count,
    request_stats.last_request_at
  FROM owner_profiles owner
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS total
    FROM public.profiles member
    WHERE COALESCE(member.account_owner_id, member.id) = owner.id
  ) AS team_stats ON TRUE
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS total
    FROM public.products product
    WHERE product.user_id = owner.id
  ) AS product_stats ON TRUE
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS total
    FROM public.sales sale
    WHERE sale.user_id = owner.id
      AND sale.created_at >= date_trunc('month', NOW())
  ) AS monthly_sales ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (WHERE req.status IN ('sent', 'in_progress')) AS total,
      MAX(req.created_at) AS last_request_at
    FROM public.subscription_requests req
    WHERE req.user_id = owner.id
  ) AS request_stats ON TRUE
  ORDER BY COALESCE(request_stats.last_request_at, owner.created_at) DESC, owner.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 50), 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_support_subscription_request_audit(
  p_limit INTEGER DEFAULT 24
)
RETURNS TABLE (
  audit_id UUID,
  request_id UUID,
  action TEXT,
  actor_email TEXT,
  note TEXT,
  created_at TIMESTAMPTZ,
  business_name TEXT,
  requested_by_email TEXT,
  current_plan TEXT,
  requested_plan TEXT,
  request_type TEXT,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_support_operator() THEN
    RAISE EXCEPTION 'Acces support requis';
  END IF;

  RETURN QUERY
  SELECT
    audit.id AS audit_id,
    req.id AS request_id,
    audit.action,
    audit.actor_email,
    audit.note,
    audit.created_at,
    COALESCE(NULLIF(BTRIM(req.business_name), ''), 'Boutique sans nom') AS business_name,
    req.requested_by_email,
    req.current_plan,
    req.requested_plan,
    req.request_type,
    req.status
  FROM public.subscription_request_audit_logs audit
  JOIN public.subscription_requests req
    ON req.id = audit.request_id
  ORDER BY audit.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 24), 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.support_console_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_support_platform_accounts(INTEGER, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_support_subscription_request_audit(INTEGER) TO authenticated;
