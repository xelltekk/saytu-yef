-- Preserve signed-in application RPCs; deny anonymous access to privileged code.
DO $$
DECLARE f record; signed_in boolean;
BEGIN
  FOR f IN SELECT p.oid,p.oid::regprocedure AS signature,p.prorettype
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
  LOOP
    signed_in := has_function_privilege('authenticated', f.oid, 'EXECUTE');
    IF f.prorettype = 'trigger'::regtype THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',f.signature);
    ELSE
      IF signed_in THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);
      END IF;
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon',f.signature);
    END IF;
  END LOOP;
END;
$$;

-- JWT extraction alone does not need table-owner privileges.
ALTER FUNCTION public.current_support_email() SECURITY INVOKER;

-- These internal tables are read through checked owner-run RPCs, never directly.
REVOKE ALL ON public.support_admins, public.subscription_request_audit_logs,
  public.customer_payment_requests FROM PUBLIC, anon, authenticated;

-- ALL already includes SELECT with the same predicate; remove duplicated policies.
DROP POLICY IF EXISTS "Support operators can read support account controls" ON public.support_account_controls;
DROP POLICY IF EXISTS "Support operators can read support tickets" ON public.support_tickets;
ALTER POLICY "Support operators can manage support account controls" ON public.support_account_controls
  TO authenticated USING ((SELECT public.is_support_operator())) WITH CHECK ((SELECT public.is_support_operator()));
ALTER POLICY "Support operators can manage support tickets" ON public.support_tickets
  TO authenticated USING ((SELECT public.is_support_operator())) WITH CHECK ((SELECT public.is_support_operator()));

-- Future RPCs require an explicit grant. The public health probe already has one.
-- PUBLIC's built-in default is global; a schema-only REVOKE cannot remove it.
-- Existing functions and other owners are unaffected; Storage's explicit grants remain.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
