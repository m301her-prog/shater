CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------- 1. users / profiles (جدول المستخدمين المحلي لنيون) ----------
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL DEFAULT '',
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL, -- لحفظ كلمة المرور المشفرة
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- 2. products ----------
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

-- ---------- 3. invoices ----------
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE,
  type text NOT NULL CHECK (type IN ('PURCHASE','SALE')),
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- 4. invoice_items ----------
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity int NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  subtotal numeric(14,2) NOT NULL DEFAULT 0
);

-- ---------- 5. invoice number generator ----------
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

-- ---------- 6. auto stock update on invoice item insert ----------
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

-- ---------- 7. products updated_at ----------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_products_updated ON public.products;
CREATE TRIGGER trg_products_updated
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 8. seed data ----------
INSERT INTO public.products (sku, name, quantity, cost_price, selling_price, category, low_stock_threshold) VALUES
  ('SKU-1001', 'أرز بسمتي 5كجم', 0, 45.00, 60.00, 'مواد غذائية', 10),
  ('SKU-1002', 'زيت دوار الشمس 1.5ل', 0, 18.00, 25.00, 'مواد غذائية', 8),
  ('SKU-1003', 'سكر أبيض 1كجم', 0, 7.00, 10.00, 'مواد غذائية', 15),
  ('SKU-1004', 'صابون غسيل 3كجم', 0, 22.00, 32.00, 'منظفات', 6),
  ('SKU-1005', 'شاي أحمر 250جم', 0, 15.00, 22.00, 'مواد غذائية', 5),
  ('SKU-1006', 'ماء معدني 6×1.5ل', 0, 6.00, 9.00, 'مشروبات', 12)
ON CONFLICT (sku) DO NOTHING;

-- Seed Admin User
INSERT INTO public.users (full_name, email, password_hash, role)
VALUES ('مدير النظام', 'admin@shatir.com', 'hashed_password_here', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Seed Purchase & Sale Invoices
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

  -- Seed Sale Invoices
  INSERT INTO public.invoices (type, total_amount, tax_amount)
  VALUES ('SALE', 360.00, 0);
  INSERT INTO public.invoice_items (invoice_id, product_id, quantity, unit_price, subtotal)
  SELECT i.id, p1, 3, 60.00, 180.00 FROM public.invoices i WHERE i.id = (SELECT id FROM public.invoices WHERE type='SALE' ORDER BY created_at DESC LIMIT 1);
  INSERT INTO public.invoice_items (invoice_id, product_id, quantity, unit_price, subtotal)
  SELECT i.id, p2, 6, 25.00, 150.00 FROM public.invoices i WHERE i.id = (SELECT id FROM public.invoices WHERE type='SALE' ORDER BY created_at DESC LIMIT 1);
  INSERT INTO public.invoice_items (invoice_id, product_id, quantity, unit_price, subtotal)
  SELECT i.id, p6, 3, 9.00, 27.00 FROM public.invoices i WHERE i.id = (SELECT id FROM public.invoices WHERE type='SALE' ORDER BY created_at DESC LIMIT 1);
END $$;
