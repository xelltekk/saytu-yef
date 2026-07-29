-- Harden support-console access and expose support operator management.

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

CREATE OR REPLACE FUNCTION public.list_support_admins()
RETURNS TABLE (
  email TEXT,
  full_name TEXT,
  active BOOLEAN,
  created_at TIMESTAMPTZ,
  is_current_operator BOOLEAN
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
    sa.email,
    sa.full_name,
    sa.active,
    sa.created_at,
    LOWER(sa.email) = public.current_support_email() AS is_current_operator
  FROM public.support_admins sa
  ORDER BY
    sa.active DESC,
    CASE
      WHEN LOWER(sa.email) = public.current_support_email() THEN 0
      ELSE 1
    END,
    sa.created_at ASC,
    sa.email ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_support_admin_access(
  p_email TEXT,
  p_full_name TEXT DEFAULT NULL,
  p_active BOOLEAN DEFAULT true
)
RETURNS TABLE (
  email TEXT,
  full_name TEXT,
  active BOOLEAN,
  created_at TIMESTAMPTZ,
  is_current_operator BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cleaned_email TEXT := LOWER(NULLIF(BTRIM(COALESCE(p_email, '')), ''));
  cleaned_full_name TEXT := NULLIF(BTRIM(COALESCE(p_full_name, '')), '');
  target_exists BOOLEAN := false;
  target_is_active BOOLEAN := false;
  remaining_active_count INTEGER := 0;
BEGIN
  IF NOT public.is_support_operator() THEN
    RAISE EXCEPTION 'Acces support requis';
  END IF;

  IF cleaned_email IS NULL OR cleaned_email !~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' THEN
    RAISE EXCEPTION 'Email support invalide';
  END IF;

  SELECT
    EXISTS(SELECT 1 FROM public.support_admins sa WHERE LOWER(sa.email) = cleaned_email),
    EXISTS(SELECT 1 FROM public.support_admins sa WHERE LOWER(sa.email) = cleaned_email AND sa.active = true)
  INTO target_exists, target_is_active;

  IF COALESCE(p_active, true) = false THEN
    IF NOT target_exists THEN
      RAISE EXCEPTION 'Operateur support introuvable';
    END IF;

    SELECT COUNT(*)
    INTO remaining_active_count
    FROM public.support_admins sa
    WHERE sa.active = true
      AND LOWER(sa.email) <> cleaned_email;

    IF target_is_active AND remaining_active_count = 0 THEN
      RAISE EXCEPTION 'Impossible de retirer le dernier operateur support actif';
    END IF;
  END IF;

  INSERT INTO public.support_admins (email, full_name, active)
  VALUES (cleaned_email, cleaned_full_name, COALESCE(p_active, true))
  ON CONFLICT (email) DO UPDATE
    SET
      full_name = COALESCE(EXCLUDED.full_name, public.support_admins.full_name),
      active = EXCLUDED.active;

  RETURN QUERY
  SELECT
    sa.email,
    sa.full_name,
    sa.active,
    sa.created_at,
    LOWER(sa.email) = public.current_support_email() AS is_current_operator
  FROM public.support_admins sa
  WHERE LOWER(sa.email) = cleaned_email
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_support_admins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_support_admin_access(TEXT, TEXT, BOOLEAN) TO authenticated;
