import { useEffect, useMemo, useState } from 'react';
import { Receipt, Search, Plus, Minus, Trash2, Loader2, ShoppingCart, CheckCircle2, X } from 'lucide-react';
import { supabase, type Product, type InvoiceWithItems } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { formatCurrency, formatDate } from '@/lib/format';
import { InvoiceModal } from '@/components/InvoiceModal';

type CartLine = {
  product: Product;
  quantity: number;
};

export function SalesPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<InvoiceWithItems | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('products').select('*').order('name');
      if (error) toast('تعذّر تحميل المنتجات', 'error');
      setProducts((data as Product[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return products;
    return products.filter(
      (p) => p.name.includes(q) || (p.sku ?? '').includes(q) || p.category.includes(q)
    );
  }, [products, search]);

  function addToCart(p: Product) {
    if (p.quantity <= 0) {
      toast('هذا الصنف غير متوفر في المخزون', 'error');
      return;
    }
    setCart((c) => {
      const found = c.find((x) => x.product.id === p.id);
      if (found) {
        if (found.quantity + 1 > p.quantity) {
          toast('الكمية المطلوبة تتجاوز المخزون', 'error');
          return c;
        }
        return c.map((x) => (x.product.id === p.id ? { ...x, quantity: x.quantity + 1 } : x));
      }
      return [...c, { product: p, quantity: 1 }];
    });
  }

  function setQty(productId: string, qty: number) {
    setCart((c) =>
      c.map((x) => {
        if (x.product.id !== productId) return x;
        const clamped = Math.max(1, Math.min(qty, x.product.quantity));
        return { ...x, quantity: clamped };
      })
    );
  }
  function removeLine(productId: string) {
    setCart((c) => c.filter((x) => x.product.id !== productId));
  }
  function clearCart() {
    setCart([]);
  }

  const subtotal = cart.reduce((s, l) => s + l.quantity * Number(l.product.selling_price), 0);
  const tax = Math.round(subtotal * 0.15 * 100) / 100; // 15% VAT
  const total = subtotal + tax;

  async function handleCheckout() {
    if (cart.length === 0) {
      toast('السلة فارغة', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const { data: inv, error: invErr } = await supabase
        .from('invoices')
        .insert({
          type: 'SALE',
          total_amount: total,
          tax_amount: tax,
        })
        .select()
        .single();
      if (invErr) throw invErr;

      const items = cart.map((l) => ({
        invoice_id: (inv as { id: string }).id,
        product_id: l.product.id,
        quantity: l.quantity,
        unit_price: Number(l.product.selling_price),
        subtotal: l.quantity * Number(l.product.selling_price),
      }));
      const { error: itemsErr } = await supabase.from('invoice_items').insert(items);
      if (itemsErr) throw itemsErr;

      // Build invoice preview object
      const built: InvoiceWithItems = {
        ...(inv as InvoiceWithItems),
        items: cart.map((l) => ({
          id: l.product.id,
          invoice_id: (inv as { id: string }).id,
          product_id: l.product.id,
          quantity: l.quantity,
          unit_price: Number(l.product.selling_price),
          subtotal: l.quantity * Number(l.product.selling_price),
          product: l.product,
        })),
      };

      toast('تمت عملية البيع بنجاح', 'success');
      setLastInvoice(built);
      clearCart();

      // refresh products to reflect new stock
      const { data: refreshed } = await supabase.from('products').select('*').order('name');
      setProducts((refreshed as Product[]) || []);
    } catch (e) {
      toast((e as Error).message || 'تعذّر إتمام البيع', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 animate-fadein">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
          <Receipt className="w-6 h-6 text-indigo-600" /> صفحة المبيعات
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          نقطة بيع سريعة — اختر الأصناف وأتمم البيع
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product grid */}
        <div className="lg:col-span-2 card p-5">
          <div className="relative mb-4">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pr-10"
              placeholder="بحث بالاسم أو الرمز..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map((p) => {
                const out = p.quantity <= 0;
                const low = p.quantity <= (p.low_stock_threshold ?? 5) && !out;
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={out}
                    className={`text-right p-3 rounded-xl border transition-all ${
                      out
                        ? 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-50 cursor-not-allowed'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400" dir="ltr">{p.sku || '—'}</span>
                      {out ? (
                        <span className="badge bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300">نفد</span>
                      ) : low ? (
                        <span className="badge bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">منخفض</span>
                      ) : (
                        <span className="badge bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">متوفر</span>
                      )}
                    </div>
                    <div className="font-semibold text-sm leading-tight mb-1 line-clamp-2 h-9">{p.name}</div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                        {formatCurrency(Number(p.selling_price))}
                      </span>
                      <span className="text-xs text-slate-400">×{p.quantity}</span>
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="col-span-full text-center text-slate-400 py-8 text-sm">لا توجد أصناف</div>
              )}
            </div>
          )}
        </div>

        {/* Cart */}
        <div className="card p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-indigo-600" /> السلة
            </h2>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-xs text-rose-600 hover:underline">تفريغ</button>
            )}
          </div>

          <div className="flex-1 space-y-2 min-h-[200px]">
            {cart.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-12">السلة فارغة — اختر أصنافاً للبيع</p>
            ) : (
              cart.map((l) => (
                <div key={l.product.id} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{l.product.name}</div>
                    <div className="text-xs text-slate-400">{formatCurrency(Number(l.product.selling_price))}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setQty(l.product.id, l.quantity - 1)} className="btn-ghost p-1.5">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-bold">{l.quantity}</span>
                    <button onClick={() => setQty(l.product.id, l.quantity + 1)} className="btn-ghost p-1.5">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button onClick={() => removeLine(l.product.id)} className="btn-ghost p-1.5 text-rose-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">المجموع الفرعي</span><span className="font-semibold">{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">الضريبة (15%)</span><span className="font-semibold">{formatCurrency(tax)}</span></div>
            <div className="flex justify-between text-base pt-1"><span className="font-bold">الإجمالي</span><span className="font-extrabold text-indigo-600 dark:text-indigo-400">{formatCurrency(total)}</span></div>
          </div>

          <button onClick={handleCheckout} disabled={submitting || cart.length === 0} className="btn-primary mt-4 py-3 w-full">
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            تأكيد البيع
          </button>
        </div>
      </div>

      {lastInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fadein">
          <div className="card max-w-md w-full p-6 relative">
            <button onClick={() => setLastInvoice(null)} className="absolute top-3 left-3 btn-ghost p-2">
              <X className="w-5 h-5" />
            </button>
            <div className="text-center mb-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-extrabold">تم البيع بنجاح</h3>
              <p className="text-sm text-slate-500 mt-1">
                رقم الفاتورة: <span dir="ltr" className="font-mono font-bold">{lastInvoice.invoice_number}</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">{formatDate(lastInvoice.created_at)}</p>
            </div>
            <InvoiceModal invoice={lastInvoice} onClose={() => setLastInvoice(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
