-- Saytu Yëf Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users profile (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  business_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'owner' CHECK (role IN ('owner', 'manager', 'staff')),
  subscription_plan TEXT DEFAULT 'free' CHECK (subscription_plan IN ('free', 'starter', 'pro', 'enterprise')),
  currency TEXT DEFAULT 'XOF',
  business_address TEXT,
  phone TEXT,
  tax_enabled BOOLEAN DEFAULT false,
  tax_rate NUMERIC(5,2) DEFAULT 18.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#4f6ef7',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  country TEXT DEFAULT 'SN',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products
CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  sku TEXT,
  description TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  buying_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_quantity INTEGER DEFAULT 5,
  image_url TEXT,
  currency TEXT DEFAULT 'XOF',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Abroad products (offline-first)
CREATE TABLE IF NOT EXISTS public.abroad_products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  purchase_price NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CNY',
  quantity INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  source_country TEXT DEFAULT 'CN',
  synced BOOLEAN DEFAULT false,
  activated BOOLEAN DEFAULT false,
  local_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(5,2) DEFAULT 0,
  tax NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'wave', 'orange_money', 'card')),
  payment_status TEXT DEFAULT 'completed' CHECK (payment_status IN ('completed', 'pending', 'cancelled', 'refunded')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sale items
CREATE TABLE IF NOT EXISTS public.sale_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock movements
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  movement_type TEXT CHECK (movement_type IN ('in', 'out', 'adjustment')),
  quantity INTEGER NOT NULL,
  previous_quantity INTEGER,
  new_quantity INTEGER,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abroad_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only see their own data)
CREATE POLICY "Users can manage their own profile" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users can manage their own categories" ON public.categories FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own suppliers" ON public.suppliers FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own products" ON public.products FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own abroad products" ON public.abroad_products FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own sales" ON public.sales FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own sale items" ON public.sale_items FOR ALL USING (auth.uid() = (SELECT user_id FROM public.sales WHERE id = sale_id));
CREATE POLICY "Users can manage their own stock movements" ON public.stock_movements FOR ALL USING (auth.uid() = user_id);

-- Trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: update product quantity on sale
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
CREATE OR REPLACE TRIGGER on_sale_item_created
  AFTER INSERT ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.update_stock_on_sale();

-- RPC: create a complete sale atomically
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON public.sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_abroad_products_user_id ON public.abroad_products(user_id);
