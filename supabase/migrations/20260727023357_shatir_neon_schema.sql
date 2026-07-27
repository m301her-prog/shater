-- This mirrors /schema.sql exactly: full Shatir schema with triggers + seed data.
-- Applied via Supabase MCP (Neon tooling not available in this environment).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

CREATE TABLE public.users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     VARCHAR NOT NULL,
  email         VARCHAR UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          VARCHAR DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active     BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_email ON public.users (email);
CREATE INDEX idx_users_role  ON public.users (role);

CREATE TABLE public.products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku           VARCHAR UNIQUE NOT NULL,
  name          VARCHAR NOT NULL,
  quantity      INT DEFAULT 0 CHECK (quantity >= 0),
  cost_price    NUMERIC(10, 2) DEFAULT 0.00,
  selling_price NUMERIC(10, 2) DEFAULT 0.00,
  category      VARCHAR,
  low_stock_threshold INT DEFAULT 5,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_products_sku      ON public.products (sku);
CREATE INDEX idx_products_category ON public.products (category);
CREATE INDEX idx_products_name     ON public.products (name);

CREATE TABLE public.invoices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR UNIQUE NOT NULL,
  type          VARCHAR CHECK (type IN ('PURCHASE', 'SALE')),
  total_amount  NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  created_by    UUID REFERENCES public.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_invoices_type        ON public.invoices (type);
CREATE INDEX idx_invoices_created_at  ON public.invoices (created_at);
CREATE INDEX idx_invoices_created_by  ON public.invoices (created_by);

CREATE TABLE public.invoice_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES public.products(id),
  quantity    INT NOT NULL CHECK (quantity > 0),
  unit_price  NUMERIC(10, 2) NOT NULL,
  subtotal    NUMERIC(10, 2) NOT NULL
);
CREATE INDEX idx_items_invoice_id ON public.invoice_items (invoice_id);
CREATE INDEX idx_items_product_id ON public.invoice_items (product_id);

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  prefix   TEXT;
  next_num INT;
BEGIN
  prefix := CASE WHEN NEW.type = 'PURCHASE' THEN 'INV-PUR-' ELSE 'INV-SAL-' END;
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM LENGTH(prefix) + 1) AS INT)), 1000) + 1
    INTO next_num
    FROM public.invoices
    WHERE type = NEW.type AND invoice_number LIKE prefix || '%';
  NEW.invoice_number := prefix || next_num::text;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_number ON public.invoices;
CREATE TRIGGER trg_invoice_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL OR NEW.invoice_number = '')
  EXECUTE FUNCTION public.generate_invoice_number();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_updated ON public.products;
CREATE TRIGGER trg_products_updated
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.update_stock_on_purchase()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  inv_type TEXT;
BEGIN
  SELECT type INTO inv_type FROM public.invoices WHERE id = NEW.invoice_id;
  IF inv_type = 'PURCHASE' THEN
    UPDATE public.products
      SET quantity   = quantity + NEW.quantity,
          cost_price = NEW.unit_price,
          updated_at = NOW()
      WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_purchase ON public.invoice_items;
CREATE TRIGGER trg_stock_purchase
  AFTER INSERT ON public.invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_stock_on_purchase();

CREATE OR REPLACE FUNCTION public.update_stock_on_sale()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  inv_type     TEXT;
  current_qty  INT;
BEGIN
  SELECT type INTO inv_type FROM public.invoices WHERE id = NEW.invoice_id;
  IF inv_type = 'SALE' THEN
    SELECT quantity INTO current_qty FROM public.products WHERE id = NEW.product_id FOR UPDATE;
    IF current_qty IS NULL OR current_qty < NEW.quantity THEN
      RAISE EXCEPTION 'الكمية المطلوبة غير متوفرة في المخزون (متاح: %)', current_qty;
    END IF;
    UPDATE public.products
      SET quantity   = quantity - NEW.quantity,
          updated_at = NOW()
      WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_sale ON public.invoice_items;
CREATE TRIGGER trg_stock_sale
  AFTER INSERT ON public.invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_stock_on_sale();

-- Seed: admin (password admin123)
INSERT INTO public.users (full_name, email, password_hash, role, is_active)
VALUES (
  'المدير العام',
  'admin@shatir.com',
  crypt('admin123', gen_salt('bf')),
  'admin',
  TRUE
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.products (sku, name, quantity, cost_price, selling_price, category, low_stock_threshold) VALUES
  ('SKU-1001', 'أرز بسمتي 5كجم',       20, 45.00, 60.00, 'مواد غذائية', 10),
  ('SKU-1002', 'زيت دوار الشمس 1.5ل',  20, 18.00, 25.00, 'مواد غذائية',  8),
  ('SKU-1003', 'سكر أبيض 1كجم',        80,  7.00, 10.00, 'مواد غذائية', 15),
  ('SKU-1004', 'صابون غسيل 3كجم',      10, 22.00, 32.00, 'منظفات',       6),
  ('SKU-1005', 'شاي أحمر 250جم',        8, 15.00, 22.00, 'مواد غذائية',  5),
  ('SKU-1006', 'ماء معدني 6×1.5ل',     16,  6.00,  9.00, 'مشروبات',     12)
ON CONFLICT (sku) DO NOTHING;

DO $$
DECLARE
  pur1 UUID; p1 UUID; p2 UUID; p5 UUID; admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM public.users WHERE email = 'admin@shatir.com';
  SELECT id INTO p1 FROM public.products WHERE sku = 'SKU-1001';
  SELECT id INTO p2 FROM public.products WHERE sku = 'SKU-1002';
  SELECT id INTO p5 FROM public.products WHERE sku = 'SKU-1005';
  INSERT INTO public.invoices (type, total_amount, created_by)
  VALUES ('PURCHASE', 1380.00, admin_id) RETURNING id INTO pur1;
  INSERT INTO public.invoice_items (invoice_id, product_id, quantity, unit_price, subtotal) VALUES
    (pur1, p1, 20, 45.00, 900.00),
    (pur1, p2, 20, 18.00, 360.00),
    (pur1, p5,  8, 15.00, 120.00);
END $$;

DO $$
DECLARE
  sal1 UUID; p1 UUID; p2 UUID; p6 UUID; admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM public.users WHERE email = 'admin@shatir.com';
  SELECT id INTO p1 FROM public.products WHERE sku = 'SKU-1001';
  SELECT id INTO p2 FROM public.products WHERE sku = 'SKU-1002';
  SELECT id INTO p6 FROM public.products WHERE sku = 'SKU-1006';
  INSERT INTO public.invoices (type, total_amount, created_by)
  VALUES ('SALE', 357.00, admin_id) RETURNING id INTO sal1;
  INSERT INTO public.invoice_items (invoice_id, product_id, quantity, unit_price, subtotal) VALUES
    (sal1, p1, 3, 60.00, 180.00),
    (sal1, p2, 6, 25.00, 150.00),
    (sal1, p6, 3,  9.00,  27.00);
END $$;
