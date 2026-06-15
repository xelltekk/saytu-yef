-- Harden sales creation and stock updates.
-- Run this in Supabase SQL Editor after the base schema if the database already exists.

CREATE OR REPLACE FUNCTION public.update_stock_on_sale()
RETURNS TRIGGER AS $$
DECLARE
  sale_user_id UUID;
  previous_qty INTEGER;
  new_qty INTEGER;
  product_label TEXT;
BEGIN
  SELECT user_id INTO sale_user_id
  FROM public.sales
  WHERE id = NEW.sale_id;

  IF sale_user_id IS NULL THEN
    RAISE EXCEPTION 'Vente introuvable pour la ligne de vente';
  END IF;

  SELECT quantity, name INTO previous_qty, product_label
  FROM public.products
  WHERE id = NEW.product_id
    AND user_id = sale_user_id
  FOR UPDATE;

  IF previous_qty IS NULL THEN
    RAISE EXCEPTION 'Produit introuvable ou non autorisé';
  END IF;

  IF NEW.quantity <= 0 THEN
    RAISE EXCEPTION 'La quantité vendue doit être supérieure à zéro';
  END IF;

  IF previous_qty < NEW.quantity THEN
    RAISE EXCEPTION 'Stock insuffisant pour %. Disponible: %', product_label, previous_qty;
  END IF;

  new_qty := previous_qty - NEW.quantity;

  UPDATE public.products
  SET quantity = new_qty,
      updated_at = NOW()
  WHERE id = NEW.product_id
    AND user_id = sale_user_id;

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
    sale_user_id,
    NEW.product_id,
    'out',
    NEW.quantity,
    previous_qty,
    new_qty,
    'Vente ' || NEW.sale_id::TEXT
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_sale_item_created ON public.sale_items;
CREATE TRIGGER on_sale_item_created
  AFTER INSERT ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.update_stock_on_sale();

CREATE OR REPLACE FUNCTION public.create_sale_with_items(
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_items JSONB,
  p_subtotal NUMERIC,
  p_discount NUMERIC,
  p_tax NUMERIC,
  p_total NUMERIC,
  p_payment_method TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.sales AS $$
DECLARE
  current_user_id UUID := auth.uid();
  sale_row public.sales%ROWTYPE;
  item JSONB;
  item_product_id UUID;
  item_product_name TEXT;
  item_quantity INTEGER;
  item_unit_price NUMERIC;
  item_total NUMERIC;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Non connecté';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Le panier est vide';
  END IF;

  IF p_payment_method NOT IN ('cash', 'wave', 'orange_money', 'card') THEN
    RAISE EXCEPTION 'Mode de paiement invalide';
  END IF;

  IF p_subtotal < 0 OR p_discount < 0 OR p_tax < 0 OR p_total < 0 THEN
    RAISE EXCEPTION 'Les montants ne peuvent pas être négatifs';
  END IF;

  INSERT INTO public.sales (
    user_id,
    customer_name,
    customer_phone,
    subtotal,
    discount,
    tax,
    total,
    payment_method,
    payment_status,
    notes
  )
  VALUES (
    current_user_id,
    NULLIF(BTRIM(p_customer_name), ''),
    NULLIF(BTRIM(p_customer_phone), ''),
    p_subtotal,
    p_discount,
    p_tax,
    p_total,
    p_payment_method,
    'completed',
    NULLIF(BTRIM(p_notes), '')
  )
  RETURNING * INTO sale_row;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    item_product_id := (item->>'product_id')::UUID;
    item_product_name := NULLIF(BTRIM(item->>'product_name'), '');
    item_quantity := (item->>'quantity')::INTEGER;
    item_unit_price := (item->>'unit_price')::NUMERIC;
    item_total := (item->>'total')::NUMERIC;

    IF item_product_id IS NULL OR item_product_name IS NULL THEN
      RAISE EXCEPTION 'Article invalide';
    END IF;

    IF item_quantity <= 0 THEN
      RAISE EXCEPTION 'La quantité doit être supérieure à zéro';
    END IF;

    IF item_unit_price < 0 OR item_total < 0 THEN
      RAISE EXCEPTION 'Le prix d''un article ne peut pas être négatif';
    END IF;

    INSERT INTO public.sale_items (
      sale_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      total
    )
    VALUES (
      sale_row.id,
      item_product_id,
      item_product_name,
      item_quantity,
      item_unit_price,
      item_total
    );
  END LOOP;

  RETURN sale_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.create_sale_with_items(
  TEXT,
  TEXT,
  JSONB,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  TEXT,
  TEXT
) TO authenticated;
