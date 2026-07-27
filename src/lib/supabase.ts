import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error('Supabase env vars missing. Check .env for VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl as string, supabaseAnonKey as string, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type Role = 'admin' | 'user';

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  created_at: string;
};

export type Product = {
  id: string;
  sku: string | null;
  name: string;
  quantity: number;
  cost_price: number;
  selling_price: number;
  category: string;
  low_stock_threshold: number;
  updated_at: string;
};

export type InvoiceType = 'PURCHASE' | 'SALE';

export type Invoice = {
  id: string;
  invoice_number: string | null;
  type: InvoiceType;
  total_amount: number;
  tax_amount: number;
  created_by: string | null;
  created_at: string;
};

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  product?: Product;
};

export type InvoiceWithItems = Invoice & {
  items: InvoiceItem[];
};
