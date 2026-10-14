-- The owner identity is constant within a SELECT; evaluate it once, not per row.
-- Keep the same account predicate and leave all write/restrictive policies intact.
DO $$
DECLARE table_name text; policy_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['products','categories','suppliers','sales','sale_payments'] LOOP
    policy_name := 'Account members can read ' || table_name;
    IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=table_name AND policyname=policy_name) THEN
      EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated USING (user_id = (SELECT public.current_account_id()))',policy_name,table_name);
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Account members can view their team') THEN
    ALTER POLICY "Account members can view their team" ON public.profiles TO authenticated
      USING (COALESCE(account_owner_id,id) = (SELECT public.current_account_id()));
  END IF;
END;
$$;
NOTIFY pgrst, 'reload schema';
