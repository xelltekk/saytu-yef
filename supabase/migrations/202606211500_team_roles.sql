-- Shared business accounts with administrator/employee permissions.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.profiles
SET role = CASE WHEN role = 'staff' THEN 'employee' ELSE 'admin' END,
    account_owner_id = COALESCE(account_owner_id, id);

ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'admin';
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'employee'));

CREATE OR REPLACE FUNCTION public.current_account_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(account_owner_id, id)
  FROM public.profiles
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_account_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT role = 'admin'
    FROM public.profiles
    WHERE id = auth.uid()
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.assign_account_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_id UUID := public.current_account_id();
BEGIN
  IF account_id IS NOT NULL THEN
    NEW.user_id := account_id;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'categories', 'suppliers', 'products', 'abroad_products',
    'sales', 'sale_payments', 'stock_movements'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS assign_account_owner_before_write ON public.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER assign_account_owner_before_write BEFORE INSERT OR UPDATE OF user_id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.assign_account_owner()',
      table_name
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Users can manage their own profile" ON public.profiles;
CREATE POLICY "Account members can view their team" ON public.profiles
  FOR SELECT USING (COALESCE(account_owner_id, id) = public.current_account_id());
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, business_name, avatar_url, currency, business_address, phone, tax_enabled, tax_rate, updated_at)
  ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Users can manage their own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can manage their own suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can manage their own products" ON public.products;
DROP POLICY IF EXISTS "Users can manage their own abroad products" ON public.abroad_products;
DROP POLICY IF EXISTS "Users can manage their own sales" ON public.sales;
DROP POLICY IF EXISTS "Users can manage their own sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Users can manage their own sale payments" ON public.sale_payments;
DROP POLICY IF EXISTS "Users can manage their own stock movements" ON public.stock_movements;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'categories', 'suppliers', 'products', 'abroad_products',
    'sales', 'sale_payments', 'stock_movements'
  ]
  LOOP
    EXECUTE format('CREATE POLICY "Account members can read %1$s" ON public.%1$I FOR SELECT USING (user_id = public.current_account_id())', table_name);
    EXECUTE format('CREATE POLICY "Account members can insert %1$s" ON public.%1$I FOR INSERT WITH CHECK (user_id = public.current_account_id())', table_name);
    EXECUTE format('CREATE POLICY "Account members can update %1$s" ON public.%1$I FOR UPDATE USING (user_id = public.current_account_id()) WITH CHECK (user_id = public.current_account_id())', table_name);
    EXECUTE format('CREATE POLICY "Admins can delete %1$s" ON public.%1$I FOR DELETE USING (user_id = public.current_account_id() AND public.is_account_admin())', table_name);
  END LOOP;
END $$;

CREATE POLICY "Account members can read sale items" ON public.sale_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND sales.user_id = public.current_account_id()
  ));
CREATE POLICY "Account members can insert sale items" ON public.sale_items
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND sales.user_id = public.current_account_id()
  ));
CREATE POLICY "Account members can update sale items" ON public.sale_items
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND sales.user_id = public.current_account_id()
  ));
CREATE POLICY "Admins can delete sale items" ON public.sale_items
  FOR DELETE USING (public.is_account_admin() AND EXISTS (
    SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND sales.user_id = public.current_account_id()
  ));

CREATE OR REPLACE FUNCTION public.add_team_member(p_email TEXT, p_role TEXT DEFAULT 'employee')
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID := public.current_account_id();
  member public.profiles%ROWTYPE;
BEGIN
  IF NOT public.is_account_admin() THEN RAISE EXCEPTION 'Action reservee a un administrateur'; END IF;
  IF p_role NOT IN ('admin', 'employee') THEN RAISE EXCEPTION 'Role invalide'; END IF;

  SELECT * INTO member FROM public.profiles WHERE LOWER(email) = LOWER(BTRIM(p_email)) FOR UPDATE;
  IF member.id IS NULL THEN RAISE EXCEPTION 'Ce compte n existe pas encore. L employe doit d abord creer son compte.'; END IF;
  IF member.id = owner_id THEN RAISE EXCEPTION 'Ce compte est deja administrateur principal'; END IF;
  IF COALESCE(member.account_owner_id, member.id) <> member.id AND member.account_owner_id <> owner_id THEN
    RAISE EXCEPTION 'Ce compte appartient deja a une autre entreprise';
  END IF;

  UPDATE public.profiles SET account_owner_id = owner_id, role = p_role, updated_at = NOW()
  WHERE id = member.id RETURNING * INTO member;
  RETURN member;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_team_member_role(p_member_id UUID, p_role TEXT)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE member public.profiles%ROWTYPE;
BEGIN
  IF NOT public.is_account_admin() THEN RAISE EXCEPTION 'Action reservee a un administrateur'; END IF;
  IF p_role NOT IN ('admin', 'employee') THEN RAISE EXCEPTION 'Role invalide'; END IF;
  IF p_member_id = public.current_account_id() THEN RAISE EXCEPTION 'Le role du proprietaire ne peut pas etre modifie'; END IF;
  UPDATE public.profiles SET role = p_role, updated_at = NOW()
  WHERE id = p_member_id AND account_owner_id = public.current_account_id()
  RETURNING * INTO member;
  IF member.id IS NULL THEN RAISE EXCEPTION 'Membre introuvable'; END IF;
  RETURN member;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_team_member(p_member_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_account_admin() THEN RAISE EXCEPTION 'Action reservee a un administrateur'; END IF;
  IF p_member_id = public.current_account_id() THEN RAISE EXCEPTION 'Le proprietaire ne peut pas etre retire'; END IF;
  UPDATE public.profiles SET account_owner_id = id, role = 'admin', updated_at = NOW()
  WHERE id = p_member_id AND account_owner_id = public.current_account_id();
  IF NOT FOUND THEN RAISE EXCEPTION 'Membre introuvable'; END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_account_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_team_member(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_team_member_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_team_member(UUID) TO authenticated;

-- Payments and reversals must target the shared account, not the employee user id.
CREATE OR REPLACE FUNCTION public.record_sale_payment(
  p_sale_id UUID, p_amount NUMERIC, p_payment_method TEXT, p_note TEXT DEFAULT NULL
)
RETURNS public.sales AS $$
DECLARE
  account_id UUID := public.current_account_id();
  sale_row public.sales%ROWTYPE;
  next_amount_paid NUMERIC; next_amount_due NUMERIC; next_status TEXT;
BEGIN
  IF account_id IS NULL THEN RAISE EXCEPTION 'Non connecte'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Le montant doit etre superieur a zero'; END IF;
  IF p_payment_method NOT IN ('cash', 'wave', 'orange_money', 'card') THEN RAISE EXCEPTION 'Mode de paiement invalide'; END IF;
  SELECT * INTO sale_row FROM public.sales WHERE id = p_sale_id AND user_id = account_id FOR UPDATE;
  IF sale_row.id IS NULL THEN RAISE EXCEPTION 'Vente introuvable'; END IF;
  IF sale_row.payment_status IN ('cancelled', 'refunded') THEN RAISE EXCEPTION 'Versement impossible sur cette vente'; END IF;
  IF p_amount > GREATEST(sale_row.amount_due, 0) THEN RAISE EXCEPTION 'Le versement depasse le reste du'; END IF;
  INSERT INTO public.sale_payments (sale_id, user_id, amount, payment_method, note)
  VALUES (sale_row.id, account_id, p_amount, p_payment_method, NULLIF(BTRIM(p_note), ''));
  next_amount_paid := LEAST(sale_row.total, COALESCE(sale_row.amount_paid, 0) + p_amount);
  next_amount_due := GREATEST(sale_row.total - next_amount_paid, 0);
  next_status := CASE WHEN next_amount_due <= 0 THEN 'completed' WHEN next_amount_paid > 0 THEN 'partial' ELSE 'pending' END;
  UPDATE public.sales SET amount_paid = next_amount_paid, amount_due = next_amount_due,
    payment_method = p_payment_method, payment_status = next_status
  WHERE id = sale_row.id RETURNING * INTO sale_row;
  RETURN sale_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.reverse_sale_with_stock(p_sale_id UUID, p_target_status TEXT, p_reason TEXT)
RETURNS public.sales AS $$
DECLARE
  account_id UUID := public.current_account_id(); sale_row public.sales%ROWTYPE; item_row RECORD;
  previous_qty INTEGER; next_qty INTEGER; movement_reason TEXT;
BEGIN
  IF NOT public.is_account_admin() THEN RAISE EXCEPTION 'Remboursement reserve a un administrateur'; END IF;
  IF p_target_status NOT IN ('cancelled', 'refunded') THEN RAISE EXCEPTION 'Type d operation invalide'; END IF;
  IF NULLIF(BTRIM(p_reason), '') IS NULL THEN RAISE EXCEPTION 'Le motif est requis'; END IF;
  SELECT * INTO sale_row FROM public.sales WHERE id = p_sale_id AND user_id = account_id FOR UPDATE;
  IF sale_row.id IS NULL THEN RAISE EXCEPTION 'Vente introuvable'; END IF;
  IF sale_row.payment_status IN ('cancelled', 'refunded') THEN RAISE EXCEPTION 'Vente deja annulee ou remboursee'; END IF;
  IF p_target_status = 'cancelled' AND COALESCE(sale_row.amount_paid, 0) > 0 THEN RAISE EXCEPTION 'Une vente encaissee doit etre remboursee'; END IF;
  IF p_target_status = 'refunded' AND COALESCE(sale_row.amount_paid, 0) <= 0 THEN RAISE EXCEPTION 'Aucun montant encaisse'; END IF;
  IF EXISTS (SELECT 1 FROM public.sale_items WHERE sale_id = sale_row.id AND product_id IS NULL) THEN
    RAISE EXCEPTION 'Restauration impossible: produit supprime';
  END IF;
  movement_reason := CASE p_target_status WHEN 'refunded' THEN 'Remboursement vente ' ELSE 'Annulation vente ' END
    || sale_row.id::TEXT || ' - ' || BTRIM(p_reason);
  FOR item_row IN SELECT product_id, quantity FROM public.sale_items WHERE sale_id = sale_row.id ORDER BY product_id LOOP
    SELECT quantity INTO previous_qty FROM public.products WHERE id = item_row.product_id AND user_id = account_id FOR UPDATE;
    IF previous_qty IS NULL THEN RAISE EXCEPTION 'Restauration impossible: produit introuvable'; END IF;
    next_qty := previous_qty + item_row.quantity;
    UPDATE public.products SET quantity = next_qty, updated_at = NOW() WHERE id = item_row.product_id AND user_id = account_id;
    INSERT INTO public.stock_movements (user_id, product_id, movement_type, quantity, previous_quantity, new_quantity, reason)
    VALUES (account_id, item_row.product_id, 'in', item_row.quantity, previous_qty, next_qty, movement_reason);
  END LOOP;
  UPDATE public.sales SET payment_status = p_target_status, amount_due = 0, reversed_at = NOW(), reversal_reason = BTRIM(p_reason)
  WHERE id = sale_row.id RETURNING * INTO sale_row;
  RETURN sale_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
