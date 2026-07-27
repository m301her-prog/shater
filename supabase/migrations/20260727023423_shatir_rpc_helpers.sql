-- RPC helpers for the custom users-table auth flow (crypt/bcrypt password hashing).
-- These are called from the frontend service layer (dbService.js / authService.js)
-- via the PostgREST /rest/v1/rpc/<name> endpoint.

-- verify_user_credentials: returns the user row if email+password match AND account is active.
-- Returns no rows if credentials are wrong or the account is inactive.
CREATE OR REPLACE FUNCTION public.verify_user_credentials(p_email TEXT, p_password TEXT)
RETURNS TABLE (
  id UUID, full_name VARCHAR, email VARCHAR, role VARCHAR, is_active BOOLEAN, created_at TIMESTAMPTZ
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT id, full_name, email, role, is_active, created_at
  FROM public.users
  WHERE email = p_email
    AND password_hash = crypt(p_password, password_hash)
    AND is_active = TRUE;
$$;

-- check_user_credentials: returns user row (including inactive) so the frontend can show
-- a "pending approval" message when the password is correct but is_active = FALSE.
CREATE OR REPLACE FUNCTION public.check_user_credentials(p_email TEXT, p_password TEXT)
RETURNS TABLE (
  id UUID, full_name VARCHAR, email VARCHAR, role VARCHAR, is_active BOOLEAN, created_at TIMESTAMPTZ
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT id, full_name, email, role, is_active, created_at
  FROM public.users
  WHERE email = p_email
    AND password_hash = crypt(p_password, password_hash);
$$;

-- register_new_user: inserts a new user with a bcrypt-hashed password, is_active = FALSE.
-- Returns the new user row (without password_hash).
CREATE OR REPLACE FUNCTION public.register_new_user(p_full_name TEXT, p_email TEXT, p_password TEXT)
RETURNS TABLE (
  id UUID, full_name VARCHAR, email VARCHAR, role VARCHAR, is_active BOOLEAN, created_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO public.users (full_name, email, password_hash, role, is_active)
  VALUES (p_full_name, p_email, crypt(p_password, gen_salt('bf')), 'user', FALSE)
  RETURNING id INTO new_id;

  RETURN QUERY
    SELECT id, full_name, email, role, is_active, created_at
    FROM public.users WHERE id = new_id;
END;
$$;

-- create_invoice_with_items: atomic insert of an invoice + its line items in one call.
-- p_type: 'PURCHASE' | 'SALE'
-- p_items: JSON array [{ product_id, quantity, unit_price, subtotal }, ...]
-- Returns the generated invoice row.
CREATE OR REPLACE FUNCTION public.create_invoice_with_items(
  p_type TEXT,
  p_total_amount NUMERIC,
  p_created_by UUID,
  p_items JSON
)
RETURNS TABLE (
  id UUID, invoice_number VARCHAR, type VARCHAR, total_amount NUMERIC, created_by UUID, created_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_inv_id UUID;
  item JSON;
BEGIN
  INSERT INTO public.invoices (type, total_amount, created_by)
  VALUES (p_type, p_total_amount, p_created_by)
  RETURNING id INTO new_inv_id;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items::jsonb)
  LOOP
    INSERT INTO public.invoice_items (invoice_id, product_id, quantity, unit_price, subtotal)
    VALUES (
      new_inv_id,
      (item->>'product_id')::UUID,
      (item->>'quantity')::INT,
      (item->>'unit_price')::NUMERIC,
      (item->>'subtotal')::NUMERIC
    );
  END LOOP;

  RETURN QUERY
    SELECT id, invoice_number, type, total_amount, created_by, created_at
    FROM public.invoices WHERE id = new_inv_id;
END;
$$;
