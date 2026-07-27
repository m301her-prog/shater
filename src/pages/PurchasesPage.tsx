import { useEffect, useMemo, useState } from 'react';
import { ShoppingCart, Plus, Trash2, Loader2, PackagePlus, Search } from 'lucide-react';
import { supabase, type Product } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { formatCurrency } from '@/lib/format';

type Line = {
  product_id: string;
  quantity: number;
  unit_price: number;
};

export function PurchasesPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [lines, setLines] = useState<Line[]>([{ product_id: '', quantity: 1, unit_price: 0 }]);
  const [search, setSearch] = useState('');
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', sku: '', cost_price: '', selling_price: '', category: '' });

  const filteredProducts = useMemo(() => {
    const q = search.trim();
    if (!q) return products;
    return products.filter(
      (p) => p.name.includes(q) || (p.sku ?? '').includes(q) || p.category.includes(q)
    );
  }, [products, search]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('products').select('*').order('name');
      if (error) toast('تعذّر تحميل المنتجات', 'error');
      setProducts((data as Product[]) || []);
      setLoadingProducts(false);
    })();
  }, []);

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((ls) => [...ls, { product_id: '', quantity: 1, unit_price: 0 }]);
  }
  function removeLine(idx: number) {
    setLines((ls) => ls.filter((_, i) => i !== idx));
  }

  // when product selected, prefill unit_price with cost
  function selectProduct(idx: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    updateLine(idx, {
      product_id: productId,
      unit_price: p ? Number(p.cost_price) : 0,
    });
  }

  const subtotal = lines.reduce((s, l) => s + (l.quantity || 0) * (l.unit_price || 0), 0);
  const total = subtotal;

  async function addProduct() {
    if (!newProduct.name.trim()) {
      toast('اسم المنتج مطلوب', 'error');
      return;
    }
    const { data, error } = await supabase
      .from('products')
      .insert({
        name: newProduct.name.trim(),
        sku: newProduct.sku.trim() || null,
        cost_price: Number(newProduct.cost_price) || 0,
        selling_price: Number(newProduct.selling_price) || 0,
        category: newProduct.category.trim() || 'عام',
        quantity: 0,
      })
      .select()
      .single();
    if (error) {
      toast(error.message, 'error');
      return;
    }
    const created = data as Product;
    setProducts((p) => [...p, created]);
    toast('تمت إضافة المنتج', 'success');
    setNewProduct({ name: '', sku: '', cost_price: '', selling_price: '', category: '' });
    setShowNewProduct(false);
  }

  async function handleSubmit() {
    const valid = lines.filter((l) => l.product_id && l.quantity > 0);
    if (valid.length === 0) {
      toast('أضف صنفاً واحداً على الأقل', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const { data: inv, error: invErr } = await supabase
        .from('invoices')
        .insert({
          type: 'PURCHASE',
          total_amount: total,
          tax_amount: 0,
        })
        .select()
        .single();
      if (invErr) throw invErr;

      const items = valid.map((l) => ({
        invoice_id: (inv as { id: string }).id,
        product_id: l.product_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
        subtotal: l.quantity * l.unit_price,
      }));
      const { error: itemsErr } = await supabase.from('invoice_items').insert(items);
      if (itemsErr) throw itemsErr;

      toast('تم تسجيل فاتورة الشراء وتحديث المخزون', 'success');
      setLines([{ product_id: '', quantity: 1, unit_price: 0 }]);
      // refresh products to show new stock
      const { data: refreshed } = await supabase.from('products').select('*').order('name');
      setProducts((refreshed as Product[]) || []);
    } catch (e) {
      toast((e as Error).message || 'حدث خطأ', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 animate-fadein">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-indigo-600" /> صفحة المشتريات
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            سجّل فاتورة شراء جديدة — يُحدّث المخزون تلقائياً
          </p>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-800 dark:text-white">أصناف الفاتورة</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowNewProduct((s) => !s)} className="btn-secondary text-sm">
              <PackagePlus className="w-4 h-4" /> صنف جديد
            </button>
          </div>
        </div>

        {showNewProduct && (
          <div className="mb-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold mb-3 text-sm">إضافة منتج جديد للمخزون</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <input className="input" placeholder="اسم المنتج" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
              <input className="input" placeholder="رمز SKU" value={newProduct.sku} onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })} />
              <input type="number" className="input" placeholder="سعر التكلفة" value={newProduct.cost_price} onChange={(e) => setNewProduct({ ...newProduct, cost_price: e.target.value })} />
              <input type="number" className="input" placeholder="سعر البيع" value={newProduct.selling_price} onChange={(e) => setNewProduct({ ...newProduct, selling_price: e.target.value })} />
              <input className="input" placeholder="الفئة" value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} />
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={addProduct} className="btn-primary text-sm">حفظ المنتج</button>
              <button onClick={() => setShowNewProduct(false)} className="btn-ghost text-sm">إلغاء</button>
            </div>
          </div>
        )}

        <div className="mb-3 relative max-w-sm">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pr-10"
            placeholder="بحث عن صنف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loadingProducts ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
        ) : (
          <div className="space-y-3">
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div className="sm:col-span-6">
                  <label className="label">الصنف</label>
                  <select
                    className="input"
                    value={line.product_id}
                    onChange={(e) => selectProduct(idx, e.target.value)}
                  >
                    <option value="">اختر صنفاً</option>
                    {filteredProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.sku ? `(${p.sku})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">الكمية</label>
                  <input
                    type="number"
                    min={1}
                    className="input"
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="label">سعر الشراء</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="input"
                    value={line.unit_price}
                    onChange={(e) => updateLine(idx, { unit_price: Number(e.target.value) })}
                  />
                </div>
                <div className="sm:col-span-1">
                  {lines.length > 1 && (
                    <button onClick={() => removeLine(idx)} className="btn-ghost text-rose-600 p-2.5">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button onClick={addLine} className="btn-secondary text-sm">
              <Plus className="w-4 h-4" /> إضافة صنف
            </button>
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="text-left">
            <div className="text-sm text-slate-500">الإجمالي</div>
            <div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">{formatCurrency(total)}</div>
          </div>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary py-3 px-8">
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShoppingCart className="w-5 h-5" />}
            حفظ فاتورة الشراء
          </button>
        </div>
      </div>
    </div>
  );
}
