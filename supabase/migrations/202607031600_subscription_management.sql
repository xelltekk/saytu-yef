-- Subscription tracking for manual onboarding, trials, and renewals.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_notes TEXT;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_status_check
  CHECK (subscription_status IN ('free', 'trial', 'active', 'past_due', 'suspended', 'cancelled', 'expired'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_billing_cycle_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_billing_cycle_check
  CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly', 'manual'));

UPDATE public.profiles
SET
  subscription_status = COALESCE(
    subscription_status,
    CASE
      WHEN subscription_plan = 'free' AND created_at >= NOW() - INTERVAL '14 days' THEN 'trial'
      WHEN subscription_plan = 'free' THEN 'free'
      ELSE 'active'
    END
  ),
  billing_cycle = COALESCE(
    billing_cycle,
    CASE
      WHEN subscription_plan = 'free' THEN 'manual'
      ELSE 'monthly'
    END
  ),
  trial_started_at = COALESCE(
    trial_started_at,
    CASE
      WHEN subscription_plan = 'free' THEN created_at
      ELSE NULL
    END
  ),
  trial_ends_at = COALESCE(
    trial_ends_at,
    CASE
      WHEN subscription_plan = 'free' AND created_at >= NOW() - INTERVAL '14 days' THEN created_at + INTERVAL '14 days'
      ELSE NULL
    END
  ),
  subscription_started_at = COALESCE(
    subscription_started_at,
    CASE
      WHEN subscription_plan <> 'free' THEN created_at
      ELSE NULL
    END
  ),
  current_period_ends_at = COALESCE(
    current_period_ends_at,
    CASE
      WHEN subscription_plan <> 'free' THEN created_at + INTERVAL '30 days'
      ELSE NULL
    END
  );
