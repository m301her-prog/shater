-- Fix ambiguous column reference in create_invoice_with_items by qualifying
-- all column references with the table name.

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
  RETURNING public.invoices.id INTO new_inv_id;

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
    SELECT public.invoices.id, public.invoices.invoice_number, public.invoices.type,
           public.invoices.total_amount, public.invoices.created_by, public.invoices.created_at
    FROM public.invoices WHERE public.invoices.id = new_inv_id;
END;
$$;
