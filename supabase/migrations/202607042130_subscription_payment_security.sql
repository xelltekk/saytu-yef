-- Harden production subscription/payment handling:
-- - explicit payment proof on paid activations/renewals
-- - support allowlist only
-- - audit trail for support actions
-- - secure request creation on the database side

ALTER TABLE public.subscription_requests
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processed_by_email TEXT;

ALTER TABLE public.subscription_requests
  DROP CONSTRAINT IF EXISTS subscription_requests_payment_method_check;

ALTER TABLE public.subscription_requests
  ADD CONSTRAINT subscription_requests_payment_method_check
  CHECK (payment_method IN ('cash', 'wave', 'orange_money', 'card', 'bank_transfer', 'other'));

CREATE TABLE IF NOT EXISTS public.subscription_request_audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  request_id UUID REFERENCES public.subscription_requests(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  actor_email TEXT,
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subscription_request_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_support_email()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT LOWER(COALESCE(auth.jwt() ->> 'email', ''));
$$;

CREATE OR REPLACE FUNCTION public.is_support_operator()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.support_admins
    WHERE LOWER(email) = public.current_support_email()
      AND active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.subscription_plan_price(p_plan TEXT)
RETURNS NUMERIC
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE p_plan
    WHEN 'starter' THEN 10000
    WHEN 'pro' THEN 20000
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.subscription_request_type(
  p_current_plan TEXT,
  p_requested_plan TEXT,
  p_current_status TEXT
)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_requested_plan = p_current_plan AND p_requested_plan <> 'free' AND p_current_status IN ('past_due', 'expired', 'suspended', 'cancelled') THEN 'reactivation'
    WHEN p_requested_plan = p_current_plan AND p_requested_plan <> 'free' THEN 'renewal'
    WHEN COALESCE(p_current_plan, 'free') = 'free' OR COALESCE(p_current_status, 'trial') = 'trial' THEN 'activation'
    WHEN p_current_plan = 'free' AND p_requested_plan = 'free' THEN 'activation'
    WHEN p_current_plan = 'starter' AND p_requested_plan IN ('pro', 'enterprise') THEN 'upgrade'
    WHEN p_current_plan = 'pro' AND p_requested_plan = 'enterprise' THEN 'upgrade'
    WHEN p_current_plan = 'free' AND p_requested_plan <> 'free' THEN 'activation'
    ELSE 'downgrade'
  END;
$$;

CREATE OR REPLACE FUNCTION public.append_subscription_request_audit(
  p_request_id UUID,
  p_action TEXT,
  p_note TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscription_request_audit_logs (
    request_id,
    action,
    actor_email,
    note,
    metadata
  )
  VALUES (
    p_request_id,
    p_action,
    NULLIF(public.current_support_email(), ''),
    NULLIF(BTRIM(COALESCE(p_note, '')), ''),
    COALESCE(p_metadata, '{}'::JSONB)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_subscription_request_secure(
  p_requested_plan TEXT
)
RETURNS SETOF public.subscription_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_id UUID := public.current_account_id();
  profile_row public.profiles%ROWTYPE;
  request_row public.subscription_requests%ROWTYPE;
  computed_request_type TEXT;
  open_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  IF NOT public.is_account_admin() THEN
    RAISE EXCEPTION 'Action reservee a un administrateur';
  END IF;

  IF p_requested_plan NOT IN ('free', 'starter', 'pro', 'enterprise') THEN
    RAISE EXCEPTION 'Plan abonnement invalide';
  END IF;

  SELECT *
  INTO profile_row
  FROM public.profiles
  WHERE id = account_id
  FOR UPDATE;

  IF profile_row.id IS NULL THEN
    RAISE EXCEPTION 'Profil abonnement introuvable';
  END IF;

  computed_request_type := public.subscription_request_type(
    COALESCE(profile_row.subscription_plan, 'free'),
    p_requested_plan,
    COALESCE(profile_row.subscription_status, 'trial')
  );

  SELECT *
  INTO request_row
  FROM public.subscription_requests
  WHERE user_id = account_id
    AND current_plan = COALESCE(profile_row.subscription_plan, 'free')
    AND requested_plan = p_requested_plan
    AND request_type = computed_request_type
    AND status IN ('sent', 'in_progress')
  ORDER BY created_at DESC
  LIMIT 1;

  IF request_row.id IS NOT NULL THEN
    RETURN QUERY
    SELECT *
    FROM public.subscription_requests
    WHERE id = request_row.id;
    RETURN;
  END IF;

  SELECT COUNT(*)
  INTO open_count
  FROM public.subscription_requests
  WHERE user_id = account_id
    AND created_at >= NOW() - INTERVAL '1 hour'
    AND status IN ('sent', 'in_progress');

  IF open_count >= 5 THEN
    RAISE EXCEPTION 'Trop de demandes en peu de temps. Reessayez plus tard.';
  END IF;

  INSERT INTO public.subscription_requests (
    user_id,
    requested_by_id,
    requested_by_email,
    business_name,
    current_plan,
    requested_plan,
    request_type,
    status,
    notes
  )
  VALUES (
    account_id,
    auth.uid(),
    NULLIF(public.current_support_email(), ''),
    profile_row.business_name,
    COALESCE(profile_row.subscription_plan, 'free'),
    p_requested_plan,
    computed_request_type,
    'sent',
    CASE computed_request_type
      WHEN 'renewal' THEN 'Renouvellement demande depuis le centre d''abonnement.'
      WHEN 'reactivation' THEN 'Reactivation demandee depuis le centre d''abonnement.'
      WHEN 'upgrade' THEN 'Upgrade demande depuis le centre d''abonnement.'
      WHEN 'downgrade' THEN 'Changement de formule demande depuis le centre d''abonnement.'
      ELSE 'Activation demandee depuis le centre d''abonnement.'
    END
  )
  RETURNING *
  INTO request_row;

  PERFORM public.append_subscription_request_audit(
    request_row.id,
    'requested',
    request_row.notes,
    jsonb_build_object(
      'request_type', request_row.request_type,
      'requested_plan', request_row.requested_plan,
      'current_plan', request_row.current_plan
    )
  );

  RETURN QUERY
  SELECT *
  FROM public.subscription_requests
  WHERE id = request_row.id;
END;
$$;

DROP FUNCTION IF EXISTS public.apply_support_subscription_request_action(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.apply_support_subscription_request_action(
  p_request_id UUID,
  p_action TEXT,
  p_support_note TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL,
  p_payment_amount NUMERIC DEFAULT NULL,
  p_payment_reference TEXT DEFAULT NULL
)
RETURNS SETOF public.subscription_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.subscription_requests%ROWTYPE;
  profile_row public.profiles%ROWTYPE;
  effective_note TEXT;
  next_period_end TIMESTAMPTZ;
  operator_email TEXT := NULLIF(public.current_support_email(), '');
  required_payment NUMERIC := 0;
  payment_required BOOLEAN := false;
  cleaned_payment_reference TEXT := NULLIF(BTRIM(COALESCE(p_payment_reference, '')), '');
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

  SELECT *
  INTO profile_row
  FROM public.profiles
  WHERE id = req.user_id
  FOR UPDATE;

  IF profile_row.id IS NULL THEN
    RAISE EXCEPTION 'Profil introuvable pour cette demande';
  END IF;

  IF p_action NOT IN ('mark_in_progress', 'activate', 'cancel') THEN
    RAISE EXCEPTION 'Action support invalide';
  END IF;

  IF p_payment_method IS NOT NULL AND p_payment_method NOT IN ('cash', 'wave', 'orange_money', 'card', 'bank_transfer', 'other') THEN
    RAISE EXCEPTION 'Mode de paiement invalide';
  END IF;

  required_payment := public.subscription_plan_price(req.requested_plan);
  payment_required := required_payment > 0 AND COALESCE(req.request_type, 'activation') IN ('activation', 'upgrade', 'renewal', 'reactivation');

  IF p_action = 'mark_in_progress' THEN
    effective_note := COALESCE(
      NULLIF(BTRIM(p_support_note), ''),
      CASE COALESCE(req.request_type, 'activation')
        WHEN 'renewal' THEN 'Renouvellement en cours de validation par le support XELLTEKK.'
        WHEN 'reactivation' THEN 'Reactivation en cours de validation par le support XELLTEKK.'
        WHEN 'upgrade' THEN 'Changement de formule en cours de validation par le support XELLTEKK.'
        WHEN 'downgrade' THEN 'Ajustement de formule en cours de validation par le support XELLTEKK.'
        ELSE 'Prise en charge par le support XELLTEKK.'
      END
    );

    UPDATE public.subscription_requests
    SET status = 'in_progress',
        support_note = effective_note,
        payment_method = COALESCE(p_payment_method, payment_method),
        payment_amount = COALESCE(p_payment_amount, payment_amount),
        payment_reference = COALESCE(cleaned_payment_reference, payment_reference),
        processed_by_email = COALESCE(operator_email, processed_by_email),
        updated_at = NOW()
    WHERE id = req.id;

    PERFORM public.append_subscription_request_audit(
      req.id,
      'mark_in_progress',
      effective_note,
      jsonb_build_object(
        'payment_method', p_payment_method,
        'payment_amount', p_payment_amount,
        'payment_reference', cleaned_payment_reference
      )
    );

  ELSIF p_action = 'cancel' THEN
    effective_note := COALESCE(NULLIF(BTRIM(p_support_note), ''), 'Demande annulee par le support.');

    UPDATE public.subscription_requests
    SET status = 'cancelled',
        support_note = effective_note,
        processed_by_email = COALESCE(operator_email, processed_by_email),
        updated_at = NOW()
    WHERE id = req.id;

    PERFORM public.append_subscription_request_audit(req.id, 'cancel', effective_note);

  ELSIF p_action = 'activate' THEN
    IF payment_required THEN
      IF cleaned_payment_reference IS NULL OR LENGTH(cleaned_payment_reference) < 4 THEN
        RAISE EXCEPTION 'Reference de paiement obligatoire avant activation';
      END IF;

      IF p_payment_method IS NULL THEN
        RAISE EXCEPTION 'Mode de paiement obligatoire avant activation';
      END IF;

      IF p_payment_amount IS NULL OR p_payment_amount <= 0 THEN
        RAISE EXCEPTION 'Montant de paiement invalide';
      END IF;

      IF p_payment_amount < required_payment THEN
        RAISE EXCEPTION 'Montant de paiement insuffisant pour ce plan';
      END IF;
    END IF;

    effective_note := COALESCE(
      NULLIF(BTRIM(p_support_note), ''),
      CASE COALESCE(req.request_type, 'activation')
        WHEN 'renewal' THEN 'Renouvellement confirme par le support XELLTEKK.'
        WHEN 'reactivation' THEN 'Reactivation confirmee par le support XELLTEKK.'
        WHEN 'upgrade' THEN 'Changement de formule confirme par le support XELLTEKK.'
        WHEN 'downgrade' THEN 'Ajustement de formule confirme par le support XELLTEKK.'
        ELSE 'Activation manuelle confirmee par le support XELLTEKK.'
      END
    );

    next_period_end := CASE
      WHEN req.requested_plan = 'free' THEN NULL
      WHEN COALESCE(req.request_type, 'activation') IN ('renewal', 'reactivation') THEN GREATEST(COALESCE(profile_row.current_period_ends_at, NOW()), NOW()) + INTERVAL '30 days'
      WHEN COALESCE(req.request_type, 'activation') IN ('upgrade', 'downgrade') THEN
        CASE
          WHEN profile_row.current_period_ends_at IS NOT NULL AND profile_row.current_period_ends_at > NOW() THEN profile_row.current_period_ends_at
          ELSE NOW() + INTERVAL '30 days'
        END
      ELSE NOW() + INTERVAL '30 days'
    END;

    UPDATE public.profiles
    SET subscription_plan = req.requested_plan,
        subscription_status = CASE WHEN req.requested_plan = 'free' THEN 'free' ELSE 'active' END,
        billing_cycle = 'manual',
        trial_ends_at = CASE
          WHEN req.requested_plan = 'free' THEN profile_row.trial_ends_at
          ELSE COALESCE(profile_row.trial_ends_at, NOW())
        END,
        subscription_started_at = CASE
          WHEN req.requested_plan = 'free' THEN profile_row.subscription_started_at
          ELSE COALESCE(profile_row.subscription_started_at, NOW())
        END,
        current_period_ends_at = next_period_end,
        cancelled_at = NULL,
        subscription_notes = effective_note,
        updated_at = NOW()
    WHERE id = req.user_id;

    UPDATE public.subscription_requests
    SET status = 'cancelled',
        support_note = 'Demande cloturee apres activation d une autre demande.',
        processed_by_email = COALESCE(operator_email, processed_by_email),
        updated_at = NOW()
    WHERE user_id = req.user_id
      AND id <> req.id
      AND status IN ('sent', 'in_progress');

    UPDATE public.subscription_requests
    SET status = 'activated',
        support_note = effective_note,
        payment_method = COALESCE(p_payment_method, payment_method),
        payment_amount = COALESCE(p_payment_amount, payment_amount),
        payment_reference = COALESCE(cleaned_payment_reference, payment_reference),
        payment_confirmed_at = CASE
          WHEN payment_required OR cleaned_payment_reference IS NOT NULL OR p_payment_amount IS NOT NULL OR p_payment_method IS NOT NULL THEN NOW()
          ELSE payment_confirmed_at
        END,
        processed_by_email = COALESCE(operator_email, processed_by_email),
        activated_at = NOW(),
        updated_at = NOW()
    WHERE id = req.id;

    PERFORM public.append_subscription_request_audit(
      req.id,
      'activate',
      effective_note,
      jsonb_build_object(
        'payment_method', p_payment_method,
        'payment_amount', p_payment_amount,
        'payment_reference', cleaned_payment_reference,
        'required_payment', required_payment,
        'request_type', req.request_type
      )
    );
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.subscription_requests
  WHERE id = req.id;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_subscription_requests_user_status_created
  ON public.subscription_requests(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_request_audit_logs_request_id
  ON public.subscription_request_audit_logs(request_id, created_at DESC);

GRANT EXECUTE ON FUNCTION public.current_support_email() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_support_operator() TO authenticated;
GRANT EXECUTE ON FUNCTION public.subscription_plan_price(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.subscription_request_type(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_subscription_request_secure(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_support_subscription_request_action(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT) TO authenticated;
