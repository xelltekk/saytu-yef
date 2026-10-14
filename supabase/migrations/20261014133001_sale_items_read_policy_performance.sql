-- Keep the same parent-sale/account authorization without a lookup per item.
-- Sales RLS still applies inside the set; no extra privileges or write changes.
ALTER POLICY "Account members can read sale items" ON public.sale_items
  TO authenticated
  USING (sale_id IN (
    SELECT id FROM public.sales
    WHERE user_id = (SELECT public.current_account_id())
  ));

NOTIFY pgrst, 'reload schema';
