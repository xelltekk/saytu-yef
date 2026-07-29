-- Extend the support console with:
-- - direct admin account actions
-- - support tickets
-- - SaaS analytics/CRM fields

CREATE TABLE IF NOT EXISTS public.support_account_controls (
  account_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_status TEXT NOT NULL DEFAULT 'active',
  watch_level TEXT NOT NULL DEFAULT 'normal',
  internal_note TEXT,
  follow_up_note TEXT,
  next_follow_up_at TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,
  crm_stage TEXT NOT NULL DEFAULT 'monitoring',
  crm_value_estimate NUMERIC(12,2),
  crm_next_step TEXT,
  crm_owner_email TEXT,
  updated_by_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.support_account_controls
  DROP CONSTRAINT IF EXISTS support_account_controls_access_status_check;

ALTER TABLE public.support_account_controls
  ADD CONSTRAINT support_account_controls_access_status_check
  CHECK (access_status IN ('active', 'restricted'));

ALTER TABLE public.support_account_controls
  DROP CONSTRAINT IF EXISTS support_account_controls_watch_level_check;

ALTER TABLE public.support_account_controls
  ADD CONSTRAINT support_account_controls_watch_level_check
  CHECK (watch_level IN ('normal', 'priority', 'critical'));

ALTER TABLE public.support_account_controls
  ADD COLUMN IF NOT EXISTS crm_stage TEXT NOT NULL DEFAULT 'monitoring',
  ADD COLUMN IF NOT EXISTS crm_value_estimate NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS crm_next_step TEXT,
  ADD COLUMN IF NOT EXISTS crm_owner_email TEXT;

ALTER TABLE public.support_account_controls
  DROP CONSTRAINT IF EXISTS support_account_controls_crm_stage_check;

ALTER TABLE public.support_account_controls
  ADD CONSTRAINT support_account_controls_crm_stage_check
  CHECK (crm_stage IN ('monitoring', 'prospect', 'follow_up', 'negotiation', 'won', 'risk'));

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

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  account_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  subject TEXT NOT NULL,
  details TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  requester_email TEXT,
  assigned_to_email TEXT,
  channel TEXT NOT NULL DEFAULT 'internal',
  due_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_by_email TEXT,
  updated_by_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_category_check;

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_category_check
  CHECK (category IN ('billing', 'technical', 'onboarding', 'commercial', 'incident', 'other'));

ALTER TABLE public.support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_status_check;

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_status_check
  CHECK (status IN ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed'));

ALTER TABLE public.support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_priority_check;

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_priority_check
  CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

ALTER TABLE public.support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_channel_check;

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_channel_check
  CHECK (channel IN ('email', 'phone', 'whatsapp', 'onsite', 'internal', 'other'));

CREATE INDEX IF NOT EXISTS idx_support_tickets_account_status
  ON public.support_tickets (account_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status_priority_due
  ON public.support_tickets (status, priority, due_at);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Support operators can read support tickets" ON public.support_tickets;
CREATE POLICY "Support operators can read support tickets"
  ON public.support_tickets
  FOR SELECT
  USING (public.is_support_operator());

DROP POLICY IF EXISTS "Support operators can manage support tickets" ON public.support_tickets;
CREATE POLICY "Support operators can manage support tickets"
  ON public.support_tickets
  FOR ALL
  USING (public.is_support_operator())
  WITH CHECK (public.is_support_operator());

DROP FUNCTION IF EXISTS public.list_support_platform_accounts(INTEGER, TEXT, TEXT, TEXT);

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
  last_sale_at TIMESTAMPTZ,
  crm_stage TEXT,
  crm_value_estimate NUMERIC,
  crm_next_step TEXT,
  crm_owner_email TEXT
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
    sale_stats.last_sale_at,
    COALESCE(control.crm_stage, 'monitoring') AS crm_stage,
    control.crm_value_estimate,
    control.crm_next_step,
    control.crm_owner_email
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

DROP FUNCTION IF EXISTS public.upsert_support_account_control(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.upsert_support_account_control(
  p_account_id UUID,
  p_access_status TEXT DEFAULT 'active',
  p_watch_level TEXT DEFAULT 'normal',
  p_internal_note TEXT DEFAULT NULL,
  p_follow_up_note TEXT DEFAULT NULL,
  p_next_follow_up_at TIMESTAMPTZ DEFAULT NULL,
  p_last_contacted_at TIMESTAMPTZ DEFAULT NULL,
  p_crm_stage TEXT DEFAULT 'monitoring',
  p_crm_value_estimate NUMERIC DEFAULT NULL,
  p_crm_next_step TEXT DEFAULT NULL,
  p_crm_owner_email TEXT DEFAULT NULL
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
  updated_at TIMESTAMPTZ,
  crm_stage TEXT,
  crm_value_estimate NUMERIC,
  crm_next_step TEXT,
  crm_owner_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cleaned_access_status TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_access_status), ''), 'active'));
  cleaned_watch_level TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_watch_level), ''), 'normal'));
  cleaned_crm_stage TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_crm_stage), ''), 'monitoring'));
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

  IF cleaned_crm_stage NOT IN ('monitoring', 'prospect', 'follow_up', 'negotiation', 'won', 'risk') THEN
    RAISE EXCEPTION 'Etape CRM invalide';
  END IF;

  IF p_crm_value_estimate IS NOT NULL AND p_crm_value_estimate < 0 THEN
    RAISE EXCEPTION 'Valeur CRM invalide';
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
    crm_stage,
    crm_value_estimate,
    crm_next_step,
    crm_owner_email,
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
    cleaned_crm_stage,
    p_crm_value_estimate,
    NULLIF(BTRIM(COALESCE(p_crm_next_step, '')), ''),
    NULLIF(BTRIM(COALESCE(p_crm_owner_email, '')), ''),
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
        crm_stage = EXCLUDED.crm_stage,
        crm_value_estimate = EXCLUDED.crm_value_estimate,
        crm_next_step = EXCLUDED.crm_next_step,
        crm_owner_email = EXCLUDED.crm_owner_email,
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
    control.updated_at,
    control.crm_stage,
    control.crm_value_estimate,
    control.crm_next_step,
    control.crm_owner_email
  FROM public.support_account_controls control
  WHERE control.account_id = p_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_support_tickets(
  p_limit INTEGER DEFAULT 80,
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT NULL
)
RETURNS TABLE (
  ticket_id UUID,
  account_id UUID,
  business_name TEXT,
  owner_email TEXT,
  subject TEXT,
  details TEXT,
  category TEXT,
  status TEXT,
  priority TEXT,
  requester_email TEXT,
  assigned_to_email TEXT,
  channel TEXT,
  due_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_by_email TEXT,
  updated_by_email TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cleaned_search TEXT := NULLIF(BTRIM(COALESCE(p_search, '')), '');
  cleaned_status TEXT := NULLIF(BTRIM(COALESCE(p_status, '')), '');
  cleaned_category TEXT := NULLIF(BTRIM(COALESCE(p_category, '')), '');
  cleaned_priority TEXT := NULLIF(BTRIM(COALESCE(p_priority, '')), '');
BEGIN
  IF NOT public.is_support_operator() THEN
    RAISE EXCEPTION 'Acces support requis';
  END IF;

  RETURN QUERY
  SELECT
    ticket.id AS ticket_id,
    ticket.account_id,
    COALESCE(NULLIF(BTRIM(owner.business_name), ''), 'Boutique sans nom') AS business_name,
    COALESCE(NULLIF(BTRIM(owner.email), ''), 'email indisponible') AS owner_email,
    ticket.subject,
    ticket.details,
    ticket.category,
    ticket.status,
    ticket.priority,
    ticket.requester_email,
    ticket.assigned_to_email,
    ticket.channel,
    ticket.due_at,
    ticket.resolved_at,
    ticket.created_by_email,
    ticket.updated_by_email,
    ticket.created_at,
    ticket.updated_at
  FROM public.support_tickets ticket
  JOIN public.profiles owner
    ON owner.id = ticket.account_id
  WHERE (cleaned_status IS NULL OR ticket.status = cleaned_status)
    AND (cleaned_category IS NULL OR ticket.category = cleaned_category)
    AND (cleaned_priority IS NULL OR ticket.priority = cleaned_priority)
    AND (
      cleaned_search IS NULL
      OR LOWER(COALESCE(ticket.subject, '')) LIKE '%' || LOWER(cleaned_search) || '%'
      OR LOWER(COALESCE(ticket.details, '')) LIKE '%' || LOWER(cleaned_search) || '%'
      OR LOWER(COALESCE(ticket.requester_email, '')) LIKE '%' || LOWER(cleaned_search) || '%'
      OR LOWER(COALESCE(ticket.assigned_to_email, '')) LIKE '%' || LOWER(cleaned_search) || '%'
      OR LOWER(COALESCE(owner.business_name, '')) LIKE '%' || LOWER(cleaned_search) || '%'
      OR LOWER(COALESCE(owner.email, '')) LIKE '%' || LOWER(cleaned_search) || '%'
    )
  ORDER BY
    CASE ticket.status
      WHEN 'open' THEN 0
      WHEN 'in_progress' THEN 1
      WHEN 'waiting_customer' THEN 2
      WHEN 'resolved' THEN 3
      ELSE 4
    END,
    CASE ticket.priority
      WHEN 'urgent' THEN 0
      WHEN 'high' THEN 1
      WHEN 'medium' THEN 2
      ELSE 3
    END,
    COALESCE(ticket.due_at, ticket.created_at + INTERVAL '365 days') ASC,
    ticket.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 80), 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_support_ticket(
  p_account_id UUID,
  p_subject TEXT,
  p_details TEXT DEFAULT NULL,
  p_category TEXT DEFAULT 'other',
  p_priority TEXT DEFAULT 'medium',
  p_requester_email TEXT DEFAULT NULL,
  p_assigned_to_email TEXT DEFAULT NULL,
  p_channel TEXT DEFAULT 'internal',
  p_due_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  ticket_id UUID,
  account_id UUID,
  business_name TEXT,
  owner_email TEXT,
  subject TEXT,
  details TEXT,
  category TEXT,
  status TEXT,
  priority TEXT,
  requester_email TEXT,
  assigned_to_email TEXT,
  channel TEXT,
  due_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_by_email TEXT,
  updated_by_email TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  operator_email TEXT := NULLIF(public.current_support_email(), '');
  cleaned_subject TEXT := NULLIF(BTRIM(COALESCE(p_subject, '')), '');
  cleaned_category TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_category), ''), 'other'));
  cleaned_priority TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_priority), ''), 'medium'));
  cleaned_channel TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_channel), ''), 'internal'));
  cleaned_requester_email TEXT := NULLIF(BTRIM(COALESCE(p_requester_email, '')), '');
  cleaned_assigned_to_email TEXT := NULLIF(BTRIM(COALESCE(p_assigned_to_email, '')), '');
  owner_profile public.profiles%ROWTYPE;
  created_ticket_id UUID;
BEGIN
  IF NOT public.is_support_operator() THEN
    RAISE EXCEPTION 'Acces support requis';
  END IF;

  IF cleaned_subject IS NULL OR LENGTH(cleaned_subject) < 4 THEN
    RAISE EXCEPTION 'Sujet du ticket invalide';
  END IF;

  IF cleaned_category NOT IN ('billing', 'technical', 'onboarding', 'commercial', 'incident', 'other') THEN
    RAISE EXCEPTION 'Categorie ticket invalide';
  END IF;

  IF cleaned_priority NOT IN ('low', 'medium', 'high', 'urgent') THEN
    RAISE EXCEPTION 'Priorite ticket invalide';
  END IF;

  IF cleaned_channel NOT IN ('email', 'phone', 'whatsapp', 'onsite', 'internal', 'other') THEN
    RAISE EXCEPTION 'Canal ticket invalide';
  END IF;

  SELECT *
  INTO owner_profile
  FROM public.profiles profile
  WHERE profile.id = p_account_id
    AND COALESCE(profile.account_owner_id, profile.id) = profile.id
  FOR UPDATE;

  IF owner_profile.id IS NULL THEN
    RAISE EXCEPTION 'Compte proprietaire introuvable';
  END IF;

  INSERT INTO public.support_tickets (
    account_id,
    subject,
    details,
    category,
    status,
    priority,
    requester_email,
    assigned_to_email,
    channel,
    due_at,
    created_by_email,
    updated_by_email
  )
  VALUES (
    p_account_id,
    cleaned_subject,
    NULLIF(BTRIM(COALESCE(p_details, '')), ''),
    cleaned_category,
    'open',
    cleaned_priority,
    COALESCE(cleaned_requester_email, NULLIF(BTRIM(COALESCE(owner_profile.email, '')), '')),
    COALESCE(cleaned_assigned_to_email, operator_email),
    cleaned_channel,
    p_due_at,
    operator_email,
    operator_email
  )
  RETURNING id INTO created_ticket_id;

  RETURN QUERY
  SELECT
    ticket.id AS ticket_id,
    ticket.account_id,
    COALESCE(NULLIF(BTRIM(owner.business_name), ''), 'Boutique sans nom') AS business_name,
    COALESCE(NULLIF(BTRIM(owner.email), ''), 'email indisponible') AS owner_email,
    ticket.subject,
    ticket.details,
    ticket.category,
    ticket.status,
    ticket.priority,
    ticket.requester_email,
    ticket.assigned_to_email,
    ticket.channel,
    ticket.due_at,
    ticket.resolved_at,
    ticket.created_by_email,
    ticket.updated_by_email,
    ticket.created_at,
    ticket.updated_at
  FROM public.support_tickets ticket
  JOIN public.profiles owner
    ON owner.id = ticket.account_id
  WHERE ticket.id = created_ticket_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_support_ticket(
  p_ticket_id UUID,
  p_status TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT NULL,
  p_assigned_to_email TEXT DEFAULT NULL,
  p_channel TEXT DEFAULT NULL,
  p_due_at TIMESTAMPTZ DEFAULT NULL,
  p_details TEXT DEFAULT NULL,
  p_subject TEXT DEFAULT NULL
)
RETURNS TABLE (
  ticket_id UUID,
  account_id UUID,
  business_name TEXT,
  owner_email TEXT,
  subject TEXT,
  details TEXT,
  category TEXT,
  status TEXT,
  priority TEXT,
  requester_email TEXT,
  assigned_to_email TEXT,
  channel TEXT,
  due_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_by_email TEXT,
  updated_by_email TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  operator_email TEXT := NULLIF(public.current_support_email(), '');
  current_ticket public.support_tickets%ROWTYPE;
  next_status TEXT;
  next_priority TEXT;
  next_channel TEXT;
  next_subject TEXT;
  next_details TEXT;
  next_assigned_to_email TEXT;
  next_resolved_at TIMESTAMPTZ;
BEGIN
  IF NOT public.is_support_operator() THEN
    RAISE EXCEPTION 'Acces support requis';
  END IF;

  SELECT *
  INTO current_ticket
  FROM public.support_tickets ticket
  WHERE ticket.id = p_ticket_id
  FOR UPDATE;

  IF current_ticket.id IS NULL THEN
    RAISE EXCEPTION 'Ticket introuvable';
  END IF;

  next_status := LOWER(COALESCE(NULLIF(BTRIM(p_status), ''), current_ticket.status));
  next_priority := LOWER(COALESCE(NULLIF(BTRIM(p_priority), ''), current_ticket.priority));
  next_channel := LOWER(COALESCE(NULLIF(BTRIM(p_channel), ''), current_ticket.channel));
  next_subject := COALESCE(NULLIF(BTRIM(p_subject), ''), current_ticket.subject);
  next_details := COALESCE(NULLIF(BTRIM(p_details), ''), current_ticket.details);
  next_assigned_to_email := COALESCE(NULLIF(BTRIM(COALESCE(p_assigned_to_email, '')), ''), current_ticket.assigned_to_email);

  IF next_status NOT IN ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed') THEN
    RAISE EXCEPTION 'Statut ticket invalide';
  END IF;

  IF next_priority NOT IN ('low', 'medium', 'high', 'urgent') THEN
    RAISE EXCEPTION 'Priorite ticket invalide';
  END IF;

  IF next_channel NOT IN ('email', 'phone', 'whatsapp', 'onsite', 'internal', 'other') THEN
    RAISE EXCEPTION 'Canal ticket invalide';
  END IF;

  IF next_subject IS NULL OR LENGTH(next_subject) < 4 THEN
    RAISE EXCEPTION 'Sujet du ticket invalide';
  END IF;

  next_resolved_at := CASE
    WHEN next_status IN ('resolved', 'closed') THEN COALESCE(current_ticket.resolved_at, NOW())
    ELSE NULL
  END;

  UPDATE public.support_tickets
  SET status = next_status,
      priority = next_priority,
      assigned_to_email = next_assigned_to_email,
      channel = next_channel,
      due_at = COALESCE(p_due_at, current_ticket.due_at),
      details = next_details,
      subject = next_subject,
      resolved_at = next_resolved_at,
      updated_by_email = operator_email,
      updated_at = NOW()
  WHERE id = p_ticket_id;

  RETURN QUERY
  SELECT
    ticket.id AS ticket_id,
    ticket.account_id,
    COALESCE(NULLIF(BTRIM(owner.business_name), ''), 'Boutique sans nom') AS business_name,
    COALESCE(NULLIF(BTRIM(owner.email), ''), 'email indisponible') AS owner_email,
    ticket.subject,
    ticket.details,
    ticket.category,
    ticket.status,
    ticket.priority,
    ticket.requester_email,
    ticket.assigned_to_email,
    ticket.channel,
    ticket.due_at,
    ticket.resolved_at,
    ticket.created_by_email,
    ticket.updated_by_email,
    ticket.created_at,
    ticket.updated_at
  FROM public.support_tickets ticket
  JOIN public.profiles owner
    ON owner.id = ticket.account_id
  WHERE ticket.id = p_ticket_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_support_platform_accounts(INTEGER, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_support_platform_members(INTEGER, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_support_account_control(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_support_tickets(INTEGER, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_support_ticket(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_support_ticket(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
