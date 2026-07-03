-- Track subscription upgrade and activation requests from the app.

CREATE TABLE IF NOT EXISTS public.subscription_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  requested_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  requested_by_email TEXT,
  business_name TEXT,
  current_plan TEXT NOT NULL CHECK (current_plan IN ('free', 'starter', 'pro', 'enterprise')),
  requested_plan TEXT NOT NULL CHECK (requested_plan IN ('free', 'starter', 'pro', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'in_progress', 'activated', 'cancelled')),
  notes TEXT,
  support_note TEXT,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.support_admins (
  email TEXT PRIMARY KEY,
  full_name TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.support_admins ENABLE ROW LEVEL SECURITY;

INSERT INTO public.support_admins (email, full_name)
VALUES ('contact@xelltekk.com', 'Support XELLTEKK')
ON CONFLICT (email) DO NOTHING;

ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS assign_account_owner_before_write ON public.subscription_requests;
CREATE TRIGGER assign_account_owner_before_write
  BEFORE INSERT OR UPDATE OF user_id ON public.subscription_requests
  FOR EACH ROW EXECUTE FUNCTION public.assign_account_owner();

DROP POLICY IF EXISTS "Account members can read subscription requests" ON public.subscription_requests;
CREATE POLICY "Account members can read subscription requests" ON public.subscription_requests
  FOR SELECT USING (user_id = public.current_account_id());

DROP POLICY IF EXISTS "Admins can insert subscription requests" ON public.subscription_requests;
CREATE POLICY "Admins can insert subscription requests" ON public.subscription_requests
  FOR INSERT WITH CHECK (user_id = public.current_account_id() AND public.is_account_admin());

DROP POLICY IF EXISTS "Admins can update subscription requests" ON public.subscription_requests;
CREATE POLICY "Admins can update subscription requests" ON public.subscription_requests
  FOR UPDATE USING (user_id = public.current_account_id() AND public.is_account_admin())
  WITH CHECK (user_id = public.current_account_id() AND public.is_account_admin());

CREATE OR REPLACE FUNCTION public.is_support_operator()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    split_part(LOWER(COALESCE(auth.jwt() ->> 'email', '')), '@', 2) = 'xelltekk.com'
    OR EXISTS (
      SELECT 1
      FROM public.support_admins
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.list_support_subscription_requests(p_limit INTEGER DEFAULT 20)
RETURNS SETOF public.subscription_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_support_operator() THEN
    RAISE EXCEPTION 'Acces support requis';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.subscription_requests
  ORDER BY created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 20), 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_support_subscription_request_action(
  p_request_id UUID,
  p_action TEXT,
  p_support_note TEXT DEFAULT NULL
)
RETURNS SETOF public.subscription_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.subscription_requests%ROWTYPE;
  effective_note TEXT;
BEGIN
  IF NOT public.is_support_operator() THEN
    RAISE EXCEPTION 'Acces support requis';
  END IF;

  SELECT *
  INTO req
  FROM public.subscription_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF req.id IS NULL THEN
    RAISE EXCEPTION 'Demande introuvable';
  END IF;

  IF p_action NOT IN ('mark_in_progress', 'activate', 'cancel') THEN
    RAISE EXCEPTION 'Action support invalide';
  END IF;

  IF p_action = 'mark_in_progress' THEN
    effective_note := COALESCE(NULLIF(BTRIM(p_support_note), ''), 'Prise en charge par le support XELLTEKK.');

    UPDATE public.subscription_requests
    SET status = 'in_progress',
        support_note = effective_note,
        updated_at = NOW()
    WHERE id = req.id;

  ELSIF p_action = 'cancel' THEN
    effective_note := COALESCE(NULLIF(BTRIM(p_support_note), ''), 'Demande annulee par le support.');

    UPDATE public.subscription_requests
    SET status = 'cancelled',
        support_note = effective_note,
        updated_at = NOW()
    WHERE id = req.id;

  ELSIF p_action = 'activate' THEN
    effective_note := COALESCE(NULLIF(BTRIM(p_support_note), ''), 'Activation manuelle confirmee par le support XELLTEKK.');

    UPDATE public.profiles
    SET subscription_plan = req.requested_plan,
        subscription_status = CASE WHEN req.requested_plan = 'free' THEN 'free' ELSE 'active' END,
        billing_cycle = 'manual',
        trial_ends_at = CASE WHEN req.requested_plan = 'free' THEN trial_ends_at ELSE NOW() END,
        subscription_started_at = CASE WHEN req.requested_plan = 'free' THEN subscription_started_at ELSE NOW() END,
        current_period_ends_at = CASE WHEN req.requested_plan = 'free' THEN NULL ELSE NOW() + INTERVAL '30 days' END,
        cancelled_at = NULL,
        subscription_notes = effective_note,
        updated_at = NOW()
    WHERE id = req.user_id;

    UPDATE public.subscription_requests
    SET status = 'cancelled',
        support_note = 'Demande cloturee apres activation d une autre demande.',
        updated_at = NOW()
    WHERE user_id = req.user_id
      AND id <> req.id
      AND status IN ('sent', 'in_progress');

    UPDATE public.subscription_requests
    SET status = 'activated',
        support_note = effective_note,
        activated_at = NOW(),
        updated_at = NOW()
    WHERE id = req.id;
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.subscription_requests
  WHERE id = req.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_support_operator() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_support_subscription_requests(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_support_subscription_request_action(UUID, TEXT, TEXT) TO authenticated;
