-- Add explicit request types and make support activation handle renewals/reactivations properly.

ALTER TABLE public.subscription_requests
  ADD COLUMN IF NOT EXISTS request_type TEXT;

UPDATE public.subscription_requests
SET request_type = CASE
  WHEN requested_plan = current_plan AND requested_plan <> 'free' THEN 'renewal'
  WHEN current_plan = 'free' AND requested_plan <> 'free' THEN 'activation'
  WHEN requested_plan = 'free' THEN 'downgrade'
  WHEN current_plan = requested_plan THEN 'activation'
  WHEN current_plan = 'starter' AND requested_plan IN ('pro', 'enterprise') THEN 'upgrade'
  WHEN current_plan = 'pro' AND requested_plan = 'enterprise' THEN 'upgrade'
  WHEN current_plan = 'free' AND requested_plan = 'free' THEN 'activation'
  ELSE 'downgrade'
END
WHERE request_type IS NULL;

ALTER TABLE public.subscription_requests
  DROP CONSTRAINT IF EXISTS subscription_requests_request_type_check;

ALTER TABLE public.subscription_requests
  ADD CONSTRAINT subscription_requests_request_type_check
  CHECK (request_type IN ('activation', 'upgrade', 'renewal', 'reactivation', 'downgrade'));

ALTER TABLE public.subscription_requests
  ALTER COLUMN request_type SET DEFAULT 'activation';

UPDATE public.subscription_requests
SET request_type = 'activation'
WHERE request_type IS NULL;

ALTER TABLE public.subscription_requests
  ALTER COLUMN request_type SET NOT NULL;

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
  profile_row public.profiles%ROWTYPE;
  effective_note TEXT;
  next_period_end TIMESTAMPTZ;
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

GRANT EXECUTE ON FUNCTION public.apply_support_subscription_request_action(UUID, TEXT, TEXT) TO authenticated;
