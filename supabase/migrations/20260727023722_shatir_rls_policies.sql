-- RLS policies for the custom Shatir tables (custom auth flow, anon-key access).
-- The app authenticates against the `users` table via RPC functions (bcrypt),
-- not Supabase Auth, so all tables are accessed with the anon key and need
-- permissive policies. This is a single-store app where all authenticated
-- store members share the data.

-- users: the frontend needs to read the user list (admin panel) and update
-- is_active. Password_hash is NOT selected by the frontend (we only select
-- id, full_name, email, role, is_active, created_at), but we still allow
-- SELECT for the list. RPC functions are SECURITY DEFINER so they bypass RLS.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_all" ON public.users;
CREATE POLICY "users_select_all" ON public.users FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "users_update_all" ON public.users;
CREATE POLICY "users_update_all" ON public.users FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "users_insert_all" ON public.users;
CREATE POLICY "users_insert_all" ON public.users FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select" ON public.products;
CREATE POLICY "products_select" ON public.products FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "products_insert" ON public.products;
CREATE POLICY "products_insert" ON public.products FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "products_update" ON public.products;
CREATE POLICY "products_update" ON public.products FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "products_delete" ON public.products;
CREATE POLICY "products_delete" ON public.products FOR DELETE
  TO anon, authenticated USING (true);

-- invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_select" ON public.invoices;
CREATE POLICY "invoices_select" ON public.invoices FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "invoices_insert" ON public.invoices;
CREATE POLICY "invoices_insert" ON public.invoices FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "invoices_update" ON public.invoices;
CREATE POLICY "invoices_update" ON public.invoices FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "invoices_delete" ON public.invoices;
CREATE POLICY "invoices_delete" ON public.invoices FOR DELETE
  TO anon, authenticated USING (true);

-- invoice_items
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "items_select" ON public.invoice_items;
CREATE POLICY "items_select" ON public.invoice_items FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "items_insert" ON public.invoice_items;
CREATE POLICY "items_insert" ON public.invoice_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "items_update" ON public.invoice_items;
CREATE POLICY "items_update" ON public.invoice_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "items_delete" ON public.invoice_items;
CREATE POLICY "items_delete" ON public.invoice_items FOR DELETE
  TO anon, authenticated USING (true);
