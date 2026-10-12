-- Isolated, synthetic PostgreSQL fixture. Never run against a production database.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
GRANT USAGE ON SCHEMA auth, storage, public TO anon, authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY, account_owner_id uuid REFERENCES public.profiles(id),
  role text NOT NULL DEFAULT 'admin', subscription_plan text NOT NULL DEFAULT 'free', email text, business_name text,
  subscription_status text DEFAULT 'active', current_period_ends_at timestamptz, created_at timestamptz DEFAULT now());
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read profiles" ON public.profiles FOR SELECT USING(true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING(id = auth.uid());
CREATE TABLE public.support_account_controls(account_id uuid PRIMARY KEY REFERENCES public.profiles(id), access_status text DEFAULT 'active');
CREATE TABLE public.categories(id uuid PRIMARY KEY, user_id uuid REFERENCES public.profiles(id));
CREATE TABLE public.suppliers(id uuid PRIMARY KEY, user_id uuid REFERENCES public.profiles(id));
CREATE TABLE public.products(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id),
  supplier_id uuid REFERENCES public.suppliers(id), category_id uuid REFERENCES public.categories(id), name text NOT NULL, status text DEFAULT 'active', currency text DEFAULT 'XOF',
  buying_price numeric(15,2) NOT NULL DEFAULT 0, selling_price numeric(15,2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 0, updated_at timestamptz DEFAULT now());
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.current_account_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(account_owner_id,id) FROM public.profiles WHERE id = auth.uid();
$$;
CREATE FUNCTION public.is_account_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE((SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid()),false);
$$;
CREATE POLICY "Account products" ON public.products FOR ALL TO authenticated
  USING(user_id = public.current_account_id()) WITH CHECK(user_id = public.current_account_id());
CREATE TABLE public.cash_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES public.profiles(id),
  member_id uuid REFERENCES public.profiles(id), status text DEFAULT 'open', opened_at timestamptz DEFAULT now());
CREATE FUNCTION public.current_open_cash_session_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT id FROM public.cash_sessions WHERE member_id = auth.uid() AND user_id = public.current_account_id() AND status = 'open' LIMIT 1;
$$;
CREATE TABLE public.sales(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id),
  seller_id uuid REFERENCES public.profiles(id),cash_session_id uuid REFERENCES public.cash_sessions(id),customer_name text,customer_phone text,
  subtotal numeric(15,2),discount numeric(5,2),tax numeric(15,2),total numeric(15,2),amount_paid numeric(15,2),amount_due numeric(15,2),
  payment_method text,payment_status text,notes text,reversed_at timestamptz,reversal_reason text,created_at timestamptz DEFAULT now());
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Account sales" ON public.sales FOR ALL TO authenticated
  USING(user_id = public.current_account_id()) WITH CHECK(user_id = public.current_account_id());
CREATE TABLE public.sale_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),sale_id uuid NOT NULL REFERENCES public.sales(id),
  product_id uuid REFERENCES public.products(id),product_name text,quantity integer,unit_price numeric(15,2),total numeric(15,2));
CREATE TABLE public.sale_payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),sale_id uuid REFERENCES public.sales(id),user_id uuid REFERENCES public.profiles(id),
  recorded_by_id uuid REFERENCES public.profiles(id),cash_session_id uuid REFERENCES public.cash_sessions(id),amount numeric(15,2),payment_method text,
  note text,created_at timestamptz DEFAULT now());
CREATE TABLE public.stock_movements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES public.profiles(id),
  product_id uuid REFERENCES public.products(id),movement_type text,quantity integer,previous_quantity integer,new_quantity integer,reason text);
CREATE TABLE public.subscription_requests(id uuid PRIMARY KEY,requested_by_id uuid REFERENCES public.profiles(id));
CREATE FUNCTION public.append_subscription_request_audit(uuid,text,text,jsonb) RETURNS void LANGUAGE sql AS $$ SELECT; $$;
CREATE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$;
CREATE FUNCTION public.subscription_plan_price(text) RETURNS numeric LANGUAGE sql AS $$ SELECT 0; $$;
CREATE FUNCTION public.subscription_request_type(text,text,text) RETURNS text LANGUAGE sql AS $$ SELECT 'new'; $$;
CREATE FUNCTION public.current_support_email() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT email FROM public.profiles WHERE id = auth.uid(); $$;
CREATE FUNCTION public.is_support_operator() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT COALESCE(public.current_support_email() = 'contact@xelltekk.com',false); $$;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid PRIMARY KEY,name text,bucket_id text REFERENCES storage.buckets(id));
CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1,'/'); $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
