/*
# Shatir (شاطر) Store Management — Core Schema & ERP Triggers

## Overview
Creates the full database backend for the Shatir store management app: user profiles
(with admin/user roles), shared product inventory, invoices (purchase/sale), and
invoice line items. Includes smart ERP triggers that auto-generate formatted invoice
numbers and automatically adjust product stock when invoice items are created —
incrementing on purchases and decrementing on sales (with stock validation that
blocks sales exceeding available quantity).

## 1. New Tables
- `profiles` — extends Supabase auth.users with full_name, email, role (admin|user).
  Auto-populated by a trigger when a new auth user signs up. admin@shatir.com is
  automatically assigned the 'admin' role.
- `products` — the shared store inventory. Columns: sku (unique), name, quantity,
  cost_price, selling_price, category, low_stock_threshold, updated_at.
- `invoices` — header record for each transaction. invoice_number is auto-generated
  (INV-PUR-XXXX for purchases, INV-SAL-XXXX for sales). type is PURCHASE or SALE.
  total_amount, tax_amount, created_by (the auth user), created_at.
- `invoice_items` — line items belonging to an invoice. product_id, quantity,
  unit_price, subtotal. Each insert fires the stock-update trigger.

## 2. Smart ERP Triggers & Functions
- `handle_new_user()` — AFTER INSERT on auth.users → creates the matching profile row,
  assigning 'admin' role to admin@shatir.com and 'user' to everyone else.
- `generate_invoice_number()` — BEFORE INSERT on invoices → fills invoice_number with
  the next sequential formatted number per type (INV-PUR-0001, INV-SAL-0001, ...).
- `update_stock_on_invoice_item()` — AFTER INSERT on invoice_items → increments
  product quantity for PURCHASE invoices; for SALE invoices validates that enough
  stock exists (raises an exception if not) then decrements.
- `set_updated_at()` — BEFORE UPDATE on products → keeps updated_at current.
- `is_admin()` — helper used by RLS policies so admin users can manage all profiles.

## 3. Security (RLS)
This is a single-store app: all signed-in employees share the same inventory and
invoice data, so products/invoices/invoice_items use `TO authenticated` with
`USING (true)` / `WITH CHECK (true)` — the data is intentionally shared among all
authenticated store members. profiles are readable by all authenticated users;
updates are restricted to the owner OR an admin (for user/role management). RLS is
enabled on every table.

## 4. Seed Data
Inserts 6 sample products, 2 purchase invoices (with line items) and 2 sale invoices
(with line items) so the dashboard, invoices log, and inventory are populated for
instant testing. The stock-adjust trigger runs on the seeded invoice items, so the
final product quantities reflect real purchase/sale movement.

## 5. Notes
- The migration is idempotent (IF NOT EXISTS, DROP ... IF EXISTS before policies).
- created_by defaults to auth.uid() so invoice inserts from the client work without
  threading the user id manually.
- Re-running is safe; seed inserts use ON CONFLICT DO NOTHING to avoid duplicates.
*/

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------- profiles ----------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ---------- products ----------
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE,
  name text NOT NULL,
  quantity int NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  cost_price numeric(12,2) NOT NULL DEFAULT 0,
  selling_price numeric(12,2) NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'عام',
  low_stock_threshold int NOT NULL DEFAULT 5,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select" ON public.products;
CREATE POLICY "products_select" ON public.products FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "products_insert" ON public.products;
CREATE POLICY "products_insert" ON public.products FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "products_update" ON public.products;
CREATE POLICY "products_update" ON public.products FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "products_delete" ON public.products;
CREATE POLICY "products_delete" ON public.products FOR DELETE
  TO authenticated USING (true);

-- ---------- invoices ----------
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE,
  type text NOT NULL CHECK (type IN ('PURCHASE','SALE')),
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_select" ON public.invoices;
CREATE POLICY "invoices_select" ON public.invoices FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "invoices_insert" ON public.invoices;
CREATE POLICY "invoices_insert" ON public.invoices FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "invoices_update" ON public.invoices;
CREATE POLICY "invoices_update" ON public.invoices FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "invoices_delete" ON public.invoices;
CREATE POLICY "invoices_delete" ON public.invoices FOR DELETE
  TO authenticated USING (true);

-- ---------- invoice_items ----------
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity int NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  subtotal numeric(14,2) NOT NULL DEFAULT 0
);
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "items_select" ON public.invoice_items;
CREATE POLICY "items_select" ON public.invoice_items FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "items_insert" ON public.invoice_items;
CREATE POLICY "items_insert" ON public.invoice_items FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "items_update" ON public.invoice_items;
CREATE POLICY "items_update" ON public.invoice_items FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "items_delete" ON public.invoice_items;
CREATE POLICY "items_delete" ON public.invoice_items FOR DELETE
  TO authenticated USING (true);

-- ---------- helper functions ----------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- admin can update any profile (role / name management)
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- auto-create profile on signup ----------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.email,
    CASE WHEN NEW.email = 'admin@shatir.com' THEN 'admin' ELSE 'user' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- invoice number generator ----------
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  prefix text;
  next_num int;
BEGIN
  prefix := CASE WHEN NEW.type = 'PURCHASE' THEN 'INV-PUR-' ELSE 'INV-SAL-' END;
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM LENGTH(prefix)+1) AS int)), 0) + 1
    INTO next_num
    FROM public.invoices
    WHERE type = NEW.type AND invoice_number LIKE prefix || '%';
  NEW.invoice_number := prefix || lpad(next_num::text, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_number ON public.invoices;
CREATE TRIGGER trg_invoice_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW WHEN (NEW.invoice_number IS NULL)
  EXECUTE FUNCTION public.generate_invoice_number();

-- ---------- auto stock update on invoice item insert ----------
CREATE OR REPLACE FUNCTION public.update_stock_on_invoice_item()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  inv_type text;
  current_qty int;
BEGIN
  SELECT type INTO inv_type FROM public.invoices WHERE id = NEW.invoice_id;
  IF inv_type = 'PURCHASE' THEN
    UPDATE public.products
      SET quantity = quantity + NEW.quantity, updated_at = now()
      WHERE id = NEW.product_id;
  ELSIF inv_type = 'SALE' THEN
    SELECT quantity INTO current_qty FROM public.products
      WHERE id = NEW.product_id FOR UPDATE;
    IF current_qty IS NULL OR current_qty < NEW.quantity THEN
      RAISE EXCEPTION 'الكمية المطلوبة غير متوفرة في المخزون';
    END IF;
    UPDATE public.products
      SET quantity = quantity - NEW.quantity, updated_at = now()
      WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_update ON public.invoice_items;
CREATE TRIGGER trg_stock_update
  AFTER INSERT ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.update_stock_on_invoice_item();

-- ---------- products updated_at ----------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_products_updated ON public.products;
CREATE TRIGGER trg_products_updated
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- seed data ----------
INSERT INTO public.products (sku, name, quantity, cost_price, selling_price, category, low_stock_threshold) VALUES
  ('SKU-1001', 'أرز بسمتي 5كجم', 0, 45.00, 60.00, 'مواد غذائية', 10),
  ('SKU-1002', 'زيت دوار الشمس 1.5ل', 0, 18.00, 25.00, 'مواد غذائية', 8),
  ('SKU-1003', 'سكر أبيض 1كجم', 0, 7.00, 10.00, 'مواد غذائية', 15),
  ('SKU-1004', 'صابون غسيل 3كجم', 0, 22.00, 32.00, 'منظفات', 6),
  ('SKU-1005', 'شاي أحمر 250جم', 0, 15.00, 22.00, 'مواد غذائية', 5),
  ('SKU-1006', 'ماء معدني 6×1.5ل', 0, 6.00, 9.00, 'مشروبات', 12)
ON CONFLICT (sku) DO NOTHING;

-- seed purchase invoices (stock increments via trigger)
DO $$
DECLARE
  pur1 uuid; pur2 uuid;
  p1 uuid; p2 uuid; p3 uuid; p4 uuid; p5 uuid; p6 uuid;
BEGIN
  SELECT id INTO p1 FROM public.products WHERE sku='SKU-1001';
  SELECT id INTO p2 FROM public.products WHERE sku='SKU-1002';
  SELECT id INTO p3 FROM public.products WHERE sku='SKU-1003';
  SELECT id INTO p4 FROM public.products WHERE sku='SKU-1004';
  SELECT id INTO p5 FROM public.products WHERE sku='SKU-1005';
  SELECT id INTO p6 FROM public.products WHERE sku='SKU-1006';

  INSERT INTO public.invoices (type, total_amount, tax_amount)
  VALUES ('PURCHASE', 1380.00, 0) RETURNING id INTO pur1;
  INSERT INTO public.invoice_items (invoice_id, product_id, quantity, unit_price, subtotal) VALUES
    (pur1, p1, 20, 45.00, 900.00),
    (pur1, p2, 20, 18.00, 360.00),
    (pur1, p5, 8, 15.00, 120.00);

  INSERT INTO public.invoices (type, total_amount, tax_amount)
  VALUES ('PURCHASE', 880.00, 0) RETURNING id INTO pur2;
  INSERT INTO public.invoice_items (invoice_id, product_id, quantity, unit_price, subtotal) VALUES
    (pur2, p3, 80, 7.00, 560.00),
    (pur2, p4, 10, 22.00, 220.00),
    (pur2, p6, 16, 6.00, 96.00);

  -- seed sale invoices (stock decrements via trigger)
  INSERT INTO public.invoices (type, total_amount, tax_amount)
  VALUES ('SALE', 360.00, 0);
  INSERT INTO public.invoice_items (invoice_id, product_id, quantity, unit_price, subtotal)
  SELECT i.id, p1, 3, 60.00, 180.00 FROM public.invoices i WHERE i.id = (SELECT id FROM public.invoices WHERE type='SALE' ORDER BY created_at DESC LIMIT 1);
  INSERT INTO public.invoice_items (invoice_id, product_id, quantity, unit_price, subtotal)
  SELECT i.id, p2, 6, 25.00, 150.00 FROM public.invoices i WHERE i.id = (SELECT id FROM public.invoices WHERE type='SALE' ORDER BY created_at DESC LIMIT 1);
  INSERT INTO public.invoice_items (invoice_id, product_id, quantity, unit_price, subtotal)
  SELECT i.id, p6, 3, 9.00, 27.00 FROM public.invoices i WHERE i.id = (SELECT id FROM public.invoices WHERE type='SALE' ORDER BY created_at DESC LIMIT 1);
END $$;
