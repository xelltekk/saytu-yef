-- Operating expenses are private to the business owner, not delegated administrators.
CREATE OR REPLACE FUNCTION public.can_manage_expenses()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND public.current_account_id() = auth.uid()
    AND public.is_account_admin() AND public.current_account_access_status() = 'active';
$$;
REVOKE ALL ON FUNCTION public.can_manage_expenses() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_expenses() TO authenticated;

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 160),
  category text NOT NULL CHECK (category IN ('rent','utilities','transport','wages','marketing','maintenance','fees','other')),
  amount numeric(14,2) NOT NULL CHECK (amount > 0 AND amount <= 999999999999 AND amount = trunc(amount)),
  currency text NOT NULL DEFAULT 'XOF' CHECK (currency = 'XOF'),
  expense_date date NOT NULL CHECK (expense_date BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'),
  payment_method text NOT NULL CHECK (payment_method IN ('cash','wave','orange_money','card','bank_transfer','other')),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
  receipt_path text CHECK (receipt_path IS NULL OR (
    receipt_path LIKE (user_id::text || '/%')
    AND receipt_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp)$')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  revision integer NOT NULL DEFAULT 1,
  voided_at timestamptz
);
CREATE INDEX expenses_owner_date_idx ON public.expenses(user_id,expense_date DESC,id DESC) WHERE voided_at IS NULL;
CREATE INDEX expenses_owner_idx ON public.expenses(user_id);
CREATE INDEX expenses_owner_category_date_idx ON public.expenses(user_id,category,expense_date) WHERE voided_at IS NULL;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.expenses FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.expenses TO authenticated;
GRANT INSERT(id,user_id,label,category,amount,expense_date,payment_method,notes,receipt_path) ON public.expenses TO authenticated;
GRANT UPDATE(label,category,amount,expense_date,payment_method,notes,receipt_path,voided_at) ON public.expenses TO authenticated;
CREATE POLICY "Owner reads expenses" ON public.expenses FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) AND (SELECT public.can_manage_expenses()));
CREATE POLICY "Owner creates expenses" ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND (SELECT public.can_manage_expenses()) AND voided_at IS NULL AND revision = 1);
CREATE POLICY "Owner updates expenses" ON public.expenses FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND (SELECT public.can_manage_expenses()))
  WITH CHECK (user_id = (SELECT auth.uid()) AND (SELECT public.can_manage_expenses()));

CREATE OR REPLACE FUNCTION public.touch_expense()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF OLD.voided_at IS NOT NULL THEN RAISE EXCEPTION 'Cette depense est deja annulee'; END IF;
  IF NEW.id <> OLD.id OR NEW.user_id <> OLD.user_id THEN RAISE EXCEPTION 'Identite de depense non modifiable'; END IF;
  NEW.updated_at := clock_timestamp();
  NEW.revision := OLD.revision + 1;
  IF NEW.voided_at IS NOT NULL THEN NEW.voided_at := NEW.updated_at; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.touch_expense() FROM PUBLIC, anon;
CREATE TRIGGER touch_expense BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.touch_expense();

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('expense-receipts','expense-receipts',false,5242880,ARRAY['image/jpeg','image/png','image/webp']);
CREATE POLICY "Owner reads expense receipts" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='expense-receipts' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text AND (SELECT public.can_manage_expenses()));
CREATE POLICY "Owner uploads expense receipts" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='expense-receipts' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text AND (SELECT public.can_manage_expenses()));
CREATE POLICY "Owner replaces expense receipts" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='expense-receipts' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text AND (SELECT public.can_manage_expenses()))
  WITH CHECK (bucket_id='expense-receipts' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text AND (SELECT public.can_manage_expenses()));

CREATE OR REPLACE FUNCTION public.get_expenses_page(p_options jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  owner_id uuid := auth.uid();
  first_date date := coalesce(nullif(p_options->>'startDate','')::date,date_trunc('month',current_date)::date);
  last_date date := coalesce(nullif(p_options->>'endExclusive','')::date,(first_date + interval '1 month')::date);
  selected_category text := coalesce(p_options->>'category','');
  page_offset integer := greatest(0,least(1000000,coalesce((p_options->>'offset')::integer,0)));
  page_limit integer := greatest(1,least(50,coalesce((p_options->>'limit')::integer,25)));
  result jsonb;
BEGIN
  IF NOT coalesce(public.can_manage_expenses(),false) THEN RAISE EXCEPTION 'Acces reserve au proprietaire' USING ERRCODE='42501'; END IF;
  IF first_date < DATE '2000-01-01' OR last_date > DATE '2101-01-01' OR last_date <= first_date OR last_date-first_date > 3660
    OR selected_category NOT IN ('','rent','utilities','transport','wages','marketing','maintenance','fees','other')
    THEN RAISE EXCEPTION 'Periode ou categorie de depenses invalide'; END IF;
  WITH scoped AS MATERIALIZED (
    SELECT id,category,amount,expense_date,revision FROM public.expenses WHERE user_id=owner_id AND voided_at IS NULL
      AND expense_date >= first_date AND expense_date < last_date
      AND (selected_category='' OR category=selected_category)
  ), categories AS (
    SELECT category,sum(amount) AS total,count(*) AS count FROM scoped GROUP BY category
  ), months AS (
    SELECT to_char(expense_date,'YYYY-MM') AS month,sum(amount) AS total,count(*) AS count FROM scoped GROUP BY 1
  )
  SELECT jsonb_build_object(
    'ownerId',owner_id,'startDate',first_date,'endExclusive',last_date,'offset',page_offset,'limit',page_limit,
    'version',(SELECT md5(coalesce(string_agg(id::text || ':' || revision::text,',' ORDER BY id),'')) FROM scoped),
    'count',(SELECT count(*) FROM scoped),'total',(SELECT coalesce(sum(amount),0) FROM scoped),
    'byCategory',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.total DESC,c.category) FROM categories c),'[]'::jsonb),
    'byMonth',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.month) FROM months m),'[]'::jsonb),
    'expenses',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.expense_date DESC,e.id DESC)
      FROM (SELECT e.* FROM public.expenses e JOIN scoped s ON s.id=e.id WHERE e.user_id=owner_id
        ORDER BY e.expense_date DESC,e.id DESC OFFSET page_offset LIMIT page_limit) e),'[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_expenses_page(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_expenses_page(jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
