-- Support console operations:
-- - account administration (watchlist, suspension, internal notes)
-- - cross-account members visibility
-- - billing follow-up tracking

CREATE TABLE IF NOT EXISTS public.support_account_controls (
  account_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_status TEXT NOT NULL DEFAULT 'active' CHECK (access_status IN ('active', 'restricted')),
  watch_level TEXT NOT NULL DEFAULT 'normal' CHECK (watch_level IN ('normal', 'priority', 'critical')),
  internal_note TEXT,
  follow_up_note TEXT,
  next_follow_up_at TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,
  updated_by_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.support_account_controls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Support operators can read support account controls" ON public.support_account_controls;
CREATE POLICY "Support operators can read support account controls"
  ON public.support_account_controls
  FOR SELECT
  USING (public.is_support_operator());

DROP POLICY IF EXISTS "Support operators can manage support account controls" ON public.support_account_controls;
CREATE POLICY "Support operators can manage support account controls"
  ON public.support_account_controls
  FOR ALL
  USING (public.is_support_operator())
  WITH CHECK (public.is_support_operator());

CREATE OR REPLACE FUNCTION public.current_account_access_status()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_account_id UUID;
  current_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'active';
  END IF;

  owner_account_id := public.current_account_id();

  IF owner_account_id IS NULL THEN
    RETURN 'active';
  END IF;

  SELECT control.access_status
  INTO current_status
  FROM public.support_account_controls control
  WHERE control.account_id = owner_account_id;

  RETURN COALESCE(current_status, 'active');
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
  last_request_at TIMESTAMPTZ,
  access_status TEXT,
  watch_level TEXT,
  internal_note TEXT,
  follow_up_note TEXT,
  next_follow_up_at TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,
  last_sale_at TIMESTAMPTZ
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
    request_stats.last_request_at,
    COALESCE(control.access_status, 'active') AS access_status,
    COALESCE(control.watch_level, 'normal') AS watch_level,
    control.internal_note,
    control.follow_up_note,
    control.next_follow_up_at,
    control.last_contacted_at,
    sale_stats.last_sale_at
  FROM owner_profiles owner
  LEFT JOIN public.support_account_controls control
    ON control.account_id = owner.id
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
    SELECT MAX(sale.created_at) AS last_sale_at
    FROM public.sales sale
    WHERE sale.user_id = owner.id
  ) AS sale_stats ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (WHERE req.status IN ('sent', 'in_progress')) AS total,
      MAX(req.created_at) AS last_request_at
    FROM public.subscription_requests req
    WHERE req.user_id = owner.id
  ) AS request_stats ON TRUE
  ORDER BY
    CASE COALESCE(control.access_status, 'active')
      WHEN 'restricted' THEN 0
      ELSE 1
    END,
    CASE COALESCE(control.watch_level, 'normal')
      WHEN 'critical' THEN 0
      WHEN 'priority' THEN 1
      ELSE 2
    END,
    COALESCE(request_stats.last_request_at, owner.created_at) DESC,
    owner.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 50), 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_support_platform_members(
  p_limit INTEGER DEFAULT 80,
  p_search TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL,
  p_access_status TEXT DEFAULT NULL
)
RETURNS TABLE (
  member_id UUID,
  account_id UUID,
  business_name TEXT,
  owner_full_name TEXT,
  full_name TEXT,
  email TEXT,
  role TEXT,
  access_status TEXT,
  created_at TIMESTAMPTZ,
  last_sale_at TIMESTAMPTZ,
  monthly_sales_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cleaned_search TEXT := NULLIF(BTRIM(COALESCE(p_search, '')), '');
  cleaned_role TEXT := NULLIF(BTRIM(COALESCE(p_role, '')), '');
  cleaned_access_status TEXT := NULLIF(BTRIM(COALESCE(p_access_status, '')), '');
BEGIN
  IF NOT public.is_support_operator() THEN
    RAISE EXCEPTION 'Acces support requis';
  END IF;

  RETURN QUERY
  WITH member_profiles AS (
    SELECT
      member.id AS member_id,
      COALESCE(member.account_owner_id, member.id) AS account_id,
      COALESCE(NULLIF(BTRIM(owner.business_name), ''), 'Boutique sans nom') AS business_name,
      COALESCE(NULLIF(BTRIM(owner.full_name), ''), 'Compte proprietaire') AS owner_full_name,
      COALESCE(NULLIF(BTRIM(member.full_name), ''), NULLIF(BTRIM(member.email), ''), 'Utilisateur') AS full_name,
      COALESCE(NULLIF(BTRIM(member.email), ''), 'email indisponible') AS email,
      COALESCE(member.role, 'employee') AS role,
      member.created_at
    FROM public.profiles member
    JOIN public.profiles owner
      ON owner.id = COALESCE(member.account_owner_id, member.id)
    WHERE (
      cleaned_search IS NULL
      OR LOWER(COALESCE(member.full_name, '')) LIKE '%' || LOWER(cleaned_search) || '%'
      OR LOWER(COALESCE(member.email, '')) LIKE '%' || LOWER(cleaned_search) || '%'
      OR LOWER(COALESCE(owner.business_name, '')) LIKE '%' || LOWER(cleaned_search) || '%'
    )
      AND (cleaned_role IS NULL OR COALESCE(member.role, 'employee') = cleaned_role)
  )
  SELECT
    member.member_id,
    member.account_id,
    member.business_name,
    member.owner_full_name,
    member.full_name,
    member.email,
    member.role,
    COALESCE(control.access_status, 'active') AS access_status,
    member.created_at,
    sale_stats.last_sale_at,
    COALESCE(sale_stats.monthly_sales_count, 0)::BIGINT AS monthly_sales_count
  FROM member_profiles member
  LEFT JOIN public.support_account_controls control
    ON control.account_id = member.account_id
  LEFT JOIN LATERAL (
    SELECT
      MAX(sale.created_at) AS last_sale_at,
      COUNT(*) FILTER (
        WHERE sale.created_at >= date_trunc('month', NOW())
      ) AS monthly_sales_count
    FROM public.sales sale
    WHERE sale.user_id = member.account_id
      AND (
        sale.seller_id = member.member_id
        OR (member.member_id = member.account_id AND sale.seller_id IS NULL)
      )
  ) AS sale_stats ON TRUE
  WHERE cleaned_access_status IS NULL OR COALESCE(control.access_status, 'active') = cleaned_access_status
  ORDER BY COALESCE(sale_stats.last_sale_at, member.created_at) DESC, member.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 80), 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_support_account_control(
  p_account_id UUID,
  p_access_status TEXT DEFAULT 'active',
  p_watch_level TEXT DEFAULT 'normal',
  p_internal_note TEXT DEFAULT NULL,
  p_follow_up_note TEXT DEFAULT NULL,
  p_next_follow_up_at TIMESTAMPTZ DEFAULT NULL,
  p_last_contacted_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  account_id UUID,
  access_status TEXT,
  watch_level TEXT,
  internal_note TEXT,
  follow_up_note TEXT,
  next_follow_up_at TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,
  updated_by_email TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cleaned_access_status TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_access_status), ''), 'active'));
  cleaned_watch_level TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_watch_level), ''), 'normal'));
  operator_email TEXT := NULLIF(public.current_support_email(), '');
BEGIN
  IF NOT public.is_support_operator() THEN
    RAISE EXCEPTION 'Acces support requis';
  END IF;

  IF cleaned_access_status NOT IN ('active', 'restricted') THEN
    RAISE EXCEPTION 'Statut acces invalide';
  END IF;

  IF cleaned_watch_level NOT IN ('normal', 'priority', 'critical') THEN
    RAISE EXCEPTION 'Niveau de suivi invalide';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles profile
    WHERE profile.id = p_account_id
      AND COALESCE(profile.account_owner_id, profile.id) = profile.id
  ) THEN
    RAISE EXCEPTION 'Compte proprietaire introuvable';
  END IF;

  INSERT INTO public.support_account_controls (
    account_id,
    access_status,
    watch_level,
    internal_note,
    follow_up_note,
    next_follow_up_at,
    last_contacted_at,
    updated_by_email,
    updated_at
  )
  VALUES (
    p_account_id,
    cleaned_access_status,
    cleaned_watch_level,
    NULLIF(BTRIM(COALESCE(p_internal_note, '')), ''),
    NULLIF(BTRIM(COALESCE(p_follow_up_note, '')), ''),
    p_next_follow_up_at,
    p_last_contacted_at,
    operator_email,
    NOW()
  )
  ON CONFLICT (account_id)
  DO UPDATE
    SET access_status = EXCLUDED.access_status,
        watch_level = EXCLUDED.watch_level,
        internal_note = EXCLUDED.internal_note,
        follow_up_note = EXCLUDED.follow_up_note,
        next_follow_up_at = EXCLUDED.next_follow_up_at,
        last_contacted_at = EXCLUDED.last_contacted_at,
        updated_by_email = EXCLUDED.updated_by_email,
        updated_at = NOW();

  RETURN QUERY
  SELECT
    control.account_id,
    control.access_status,
    control.watch_level,
    control.internal_note,
    control.follow_up_note,
    control.next_follow_up_at,
    control.last_contacted_at,
    control.updated_by_email,
    control.updated_at
  FROM public.support_account_controls control
  WHERE control.account_id = p_account_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_account_access_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_support_platform_accounts(INTEGER, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_support_platform_members(INTEGER, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_support_account_control(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
