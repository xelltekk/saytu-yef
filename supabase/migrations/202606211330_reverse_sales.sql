-- Cancel or refund a sale and restore every sold item atomically.

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversal_reason TEXT;

CREATE OR REPLACE FUNCTION public.reverse_sale_with_stock(
  p_sale_id UUID,
  p_target_status TEXT,
  p_reason TEXT
)
RETURNS public.sales AS $$
DECLARE
  current_user_id UUID := auth.uid();
  sale_row public.sales%ROWTYPE;
  item_row RECORD;
  previous_qty INTEGER;
  next_qty INTEGER;
  movement_reason TEXT;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Non connecte';
  END IF;

  IF p_target_status NOT IN ('cancelled', 'refunded') THEN
    RAISE EXCEPTION 'Type d''operation invalide';
  END IF;

  IF NULLIF(BTRIM(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Le motif est requis';
  END IF;

  SELECT *
  INTO sale_row
  FROM public.sales
  WHERE id = p_sale_id
    AND user_id = current_user_id
  FOR UPDATE;

  IF sale_row.id IS NULL THEN
    RAISE EXCEPTION 'Vente introuvable';
  END IF;

  IF sale_row.payment_status IN ('cancelled', 'refunded') THEN
    RAISE EXCEPTION 'Cette vente a deja ete annulee ou remboursee';
  END IF;

  IF p_target_status = 'cancelled' AND COALESCE(sale_row.amount_paid, 0) > 0 THEN
    RAISE EXCEPTION 'Une vente deja encaissee doit etre remboursee';
  END IF;

  IF p_target_status = 'refunded' AND COALESCE(sale_row.amount_paid, 0) <= 0 THEN
    RAISE EXCEPTION 'Aucun montant encaisse a rembourser';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.sale_items
    WHERE sale_id = sale_row.id
      AND product_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Restauration impossible: un produit de cette vente a ete supprime';
  END IF;

  movement_reason := CASE p_target_status
    WHEN 'refunded' THEN 'Remboursement vente '
    ELSE 'Annulation vente '
  END || sale_row.id::TEXT || ' - ' || BTRIM(p_reason);

  FOR item_row IN
    SELECT product_id, quantity
    FROM public.sale_items
    WHERE sale_id = sale_row.id
    ORDER BY product_id
  LOOP
    SELECT quantity
    INTO previous_qty
    FROM public.products
    WHERE id = item_row.product_id
      AND user_id = current_user_id
    FOR UPDATE;

    IF previous_qty IS NULL THEN
      RAISE EXCEPTION 'Restauration impossible: produit introuvable';
    END IF;

    next_qty := previous_qty + item_row.quantity;

    UPDATE public.products
    SET quantity = next_qty,
        updated_at = NOW()
    WHERE id = item_row.product_id
      AND user_id = current_user_id;

    INSERT INTO public.stock_movements (
      user_id,
      product_id,
      movement_type,
      quantity,
      previous_quantity,
      new_quantity,
      reason
    )
    VALUES (
      current_user_id,
      item_row.product_id,
      'in',
      item_row.quantity,
      previous_qty,
      next_qty,
      movement_reason
    );
  END LOOP;

  UPDATE public.sales
  SET payment_status = p_target_status,
      amount_due = 0,
      reversed_at = NOW(),
      reversal_reason = BTRIM(p_reason)
  WHERE id = sale_row.id
  RETURNING * INTO sale_row;

  RETURN sale_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.reverse_sale_with_stock(UUID, TEXT, TEXT) TO authenticated;
