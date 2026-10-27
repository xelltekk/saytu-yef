ALTER TABLE public.abroad_products
  ADD COLUMN transferred_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN inventory_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;
-- Historical activations consumed the whole entry; do not invent a destination or receipt.
UPDATE public.abroad_products SET transferred_quantity = greatest(quantity, 0) WHERE activated;
ALTER TABLE public.abroad_products ADD CONSTRAINT abroad_transfer_balance
  CHECK (quantity > 0 AND transferred_quantity BETWEEN 0 AND quantity
    AND activated = (transferred_quantity = quantity)) NOT VALID;
CREATE INDEX abroad_inventory_product_idx ON public.abroad_products(inventory_product_id);

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA app_private TO authenticated;

CREATE TABLE public.abroad_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  abroad_product_id uuid NOT NULL REFERENCES public.abroad_products(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  request_id uuid NOT NULL,
  fingerprint text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  buying_price numeric(12,2) NOT NULL,
  selling_price numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, request_id)
);
CREATE INDEX abroad_transfers_entry_idx ON public.abroad_transfers(abroad_product_id,created_at DESC);
CREATE INDEX abroad_transfers_product_idx ON public.abroad_transfers(product_id);
CREATE INDEX abroad_transfers_actor_idx ON public.abroad_transfers(created_by);
ALTER TABLE public.abroad_transfers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.abroad_transfers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.abroad_transfers TO authenticated;
CREATE POLICY abroad_transfers_read ON public.abroad_transfers FOR SELECT TO authenticated
  USING (user_id = (SELECT public.current_account_id()) AND (SELECT public.can_manage_stock()));

-- Clients can edit purchases, but only the atomic transfer may consume their balance.
CREATE OR REPLACE FUNCTION app_private.guard_abroad_transfer_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.transferred_quantity > 0 AND current_user IN ('authenticated','anon') THEN
      RAISE EXCEPTION 'Une saisie deja transferee doit etre conservee dans l historique';
    END IF;
    RETURN OLD;
  END IF;
  IF current_user IN ('authenticated','anon') THEN
    IF (TG_OP = 'INSERT' AND (NEW.transferred_quantity <> 0 OR NEW.activated OR NEW.inventory_product_id IS NOT NULL))
      OR (TG_OP = 'UPDATE' AND (NEW.transferred_quantity IS DISTINCT FROM OLD.transferred_quantity
        OR NEW.activated IS DISTINCT FROM OLD.activated
        OR (NEW.inventory_product_id IS DISTINCT FROM OLD.inventory_product_id AND NEW.inventory_product_id IS NOT NULL))) THEN
      RAISE EXCEPTION 'Utilisez le transfert pour modifier les quantites transferees' USING ERRCODE='42501';
    END IF;
    -- ON DELETE SET NULL may unlink a deleted destination, never reset the consumed quantity.
    IF TG_OP = 'UPDATE' AND NEW.inventory_product_id IS DISTINCT FROM OLD.inventory_product_id
      AND EXISTS(SELECT 1 FROM public.products WHERE id=OLD.inventory_product_id) THEN
      RAISE EXCEPTION 'La destination du transfert ne peut pas etre modifiee' USING ERRCODE='42501';
    END IF;
  END IF;
  NEW.activated := NEW.transferred_quantity = NEW.quantity;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION app_private.guard_abroad_transfer_balance() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_abroad_transfer_balance BEFORE INSERT OR UPDATE OR DELETE ON public.abroad_products
  FOR EACH ROW EXECUTE FUNCTION app_private.guard_abroad_transfer_balance();
CREATE POLICY abroad_stock_managers ON public.abroad_products AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.can_manage_stock())) WITH CHECK ((SELECT public.can_manage_stock()));

CREATE OR REPLACE FUNCTION app_private.transfer_abroad_product(
  p_request_id uuid, p_abroad_id uuid, p_quantity integer, p_options jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  owner_id uuid := public.current_account_id();
  source public.abroad_products%ROWTYPE;
  destination public.products%ROWTYPE;
  receipt public.abroad_transfers%ROWTYPE;
  fingerprint text := md5(jsonb_build_array(p_abroad_id,p_quantity,p_options)::text);
  previous_qty integer;
  owner_plan text;
  product_limit integer;
  buy_price numeric;
  sell_price numeric;
BEGIN
  IF auth.uid() IS NULL OR owner_id IS NULL OR NOT public.can_manage_stock() THEN
    RAISE EXCEPTION 'Transfert non autorise' USING ERRCODE='42501';
  END IF;
  IF p_request_id IS NULL OR p_quantity IS NULL OR p_quantity <= 0
    OR p_options IS NULL OR jsonb_typeof(p_options) <> 'object' THEN
    RAISE EXCEPTION 'Quantite ou demande de transfert invalide';
  END IF;
  -- Same lock order as checkout/restocking; retries cannot create a second destination.
  SELECT subscription_plan INTO owner_plan FROM public.profiles WHERE id=owner_id FOR NO KEY UPDATE;
  SELECT * INTO source FROM public.abroad_products WHERE id=p_abroad_id AND user_id=owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Saisie introuvable' USING ERRCODE='42501'; END IF;
  SELECT * INTO receipt FROM public.abroad_transfers WHERE user_id=owner_id AND request_id=p_request_id;
  IF FOUND THEN
    IF receipt.fingerprint <> fingerprint OR receipt.created_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Cette demande correspond a un autre transfert';
    END IF;
    SELECT * INTO destination FROM public.products WHERE id=receipt.product_id AND user_id=owner_id;
    RETURN jsonb_build_object('abroad',to_jsonb(source),'product',CASE WHEN destination.id IS NOT NULL THEN to_jsonb(destination) END,
      'transfer',to_jsonb(receipt));
  END IF;
  IF (p_options->>'expected_transferred')::integer IS DISTINCT FROM source.transferred_quantity THEN
    RAISE EXCEPTION 'Cette saisie a change. Actualisez la liste avant de reessayer.' USING ERRCODE='40001';
  END IF;
  IF p_quantity > source.quantity - source.transferred_quantity THEN
    RAISE EXCEPTION 'La quantite depasse le reste a transferer (%)', source.quantity - source.transferred_quantity;
  END IF;
  IF source.inventory_product_id IS NULL THEN
    IF source.transferred_quantity > 0 THEN
      RAISE EXCEPTION 'La fiche produit de destination a ete supprimee. Le transfert est bloque pour eviter un doublon.';
    END IF;
    buy_price := (p_options->>'buying_price')::numeric;
    sell_price := (p_options->>'selling_price')::numeric;
    IF buy_price IS NULL OR sell_price IS NULL OR buy_price < 0 OR sell_price <= 0
      OR buy_price::text IN ('NaN','Infinity','-Infinity') OR sell_price::text IN ('NaN','Infinity','-Infinity')
      OR buy_price >= 1e10 OR sell_price >= 1e10 OR round(buy_price,2) <> buy_price OR round(sell_price,2) <> sell_price THEN
      RAISE EXCEPTION 'Prix FCFA invalide';
    END IF;
    product_limit := CASE owner_plan WHEN 'starter' THEN 500 WHEN 'pro' THEN NULL
      WHEN 'enterprise' THEN NULL WHEN 'lifetime' THEN NULL ELSE 50 END;
    IF product_limit IS NOT NULL AND (SELECT count(*) FROM public.products WHERE user_id=owner_id) >= product_limit THEN
      RAISE EXCEPTION 'Le plafond de produits de votre abonnement est atteint';
    END IF;
    IF NULLIF(p_options->>'category_id','') IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM public.categories WHERE id=(p_options->>'category_id')::uuid AND user_id=owner_id) THEN
      RAISE EXCEPTION 'Categorie non autorisee' USING ERRCODE='42501';
    END IF;
    INSERT INTO public.products(user_id,name,sku,description,image_url,category_id,buying_price,selling_price,quantity,min_quantity,currency,status)
      VALUES(owner_id,source.name,p_options->>'sku',source.notes,source.image_url,NULLIF(p_options->>'category_id','')::uuid,
        buy_price,sell_price,p_quantity,5,'XOF','active') RETURNING * INTO destination;
    previous_qty := 0;
  ELSE
    SELECT * INTO destination FROM public.products WHERE id=source.inventory_product_id AND user_id=owner_id FOR UPDATE;
    IF NOT FOUND OR NOT destination.track_stock OR destination.currency <> 'XOF' OR destination.status <> 'active' THEN
      RAISE EXCEPTION 'La fiche de destination ne permet pas de recevoir du stock';
    END IF;
    previous_qty := destination.quantity;
    UPDATE public.products SET quantity=quantity+p_quantity,updated_at=now()
      WHERE id=destination.id RETURNING * INTO destination;
  END IF;
  INSERT INTO public.stock_movements(user_id,product_id,movement_type,quantity,previous_quantity,new_quantity,reason)
    VALUES(owner_id,destination.id,'in',p_quantity,previous_qty,destination.quantity,'Saisie etrangere '||source.id);
  INSERT INTO public.abroad_transfers(user_id,abroad_product_id,product_id,created_by,request_id,fingerprint,quantity,buying_price,selling_price)
    VALUES(owner_id,source.id,destination.id,auth.uid(),p_request_id,fingerprint,p_quantity,destination.buying_price,destination.selling_price)
    RETURNING * INTO receipt;
  UPDATE public.abroad_products SET transferred_quantity=transferred_quantity+p_quantity,
    inventory_product_id=destination.id, synced=true,
    converted_purchase_price=destination.buying_price,
    exchange_rate=coalesce((p_options->>'exchange_rate')::numeric,exchange_rate),
    rate_source=coalesce(p_options->>'rate_source',rate_source),
    rate_updated_at=coalesce((p_options->>'rate_updated_at')::timestamptz,rate_updated_at)
    WHERE id=source.id RETURNING * INTO source;
  RETURN jsonb_build_object('abroad',to_jsonb(source),'product',to_jsonb(destination),'transfer',to_jsonb(receipt));
END;
$$;
REVOKE ALL ON FUNCTION app_private.transfer_abroad_product(uuid,uuid,integer,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.transfer_abroad_product(uuid,uuid,integer,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.transfer_abroad_product(p_request_id uuid,p_abroad_id uuid,p_quantity integer,p_options jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT app_private.transfer_abroad_product(p_request_id,p_abroad_id,p_quantity,p_options);
$$;
REVOKE ALL ON FUNCTION public.transfer_abroad_product(uuid,uuid,integer,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_abroad_product(uuid,uuid,integer,jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
