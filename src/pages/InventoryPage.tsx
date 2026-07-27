import { useEffect, useMemo, useState } from 'react';
import { Package, Search, Plus, Pencil, Loader2, X, Save, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { supabase, type Product } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { formatCurrency, formatNumber } from '@/lib/format';

export function InventoryPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'in' | 'low' | 'out'>('all');
  const [editing, setEditing] = useState<Product | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from('products').select('*').order('name');
    if (error) toast('تعذّر تحميل المخزون', 'error');
    setProducts((data as Product[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim();
    return products.filter((p) => {
      const matchSearch = !q || p.name.includes(q) || (p.sku ?? '').includes(q) || p.category.includes(q);
      const low = p.quantity <= (p.low_stock_threshold ?? 5);
      const matchFilter =
        filter === 'all' ? true :
        filter === 'in' ? p.quantity > (p.low_stock_threshold ?? 5) :
        filter === 'low' ? low && p.quantity > 0 :
        filter === 'out' ? p.quantity <= 0 : true;
      return matchSearch && matchFilter;
    });
  }, [products, search, filter]);

  function statusOf(p: Product): { label: string; cls: string; icon: typeof CheckCircle2 } {
    if (p.quantity <= 0) return { label: 'نفد المخزون', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300', icon: XCircle };
    if (p.quantity <= (p.low_stock_threshold ?? 5)) return { label: 'مخزون منخفض', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', icon: AlertTriangle };
    return { label: 'متوفر', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', icon: CheckCircle2 };
  }

  return (
    <div className="space-y-6 animate-fadein">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-indigo-600" /> صفحة المخزن
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            عرض وتعديل المخزون لحظياً
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus className="w-5 h-5" /> صنف جديد
        </button>
      </div>

      <div className="card p-5">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pr-10" placeholder="بحث عن صنف..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            {([
              ['all', 'الكل'],
              ['in', 'متوفر'],
              ['low', 'منخفض'],
              ['out', 'نفد'],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilter(val)}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                  filter === val ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-3 font-semibold">الصنف</th>
                  <th className="py-3 px-3 font-semibold">الرمز</th>
                  <th className="py-3 px-3 font-semibold">الفئة</th>
                  <th className="py-3 px-3 font-semibold">الكمية</th>
                  <th className="py-3 px-3 font-semibold">سعر التكلفة</th>
                  <th className="py-3 px-3 font-semibold">سعر البيع</th>
                  <th className="py-3 px-3 font-semibold">الحالة</th>
                  <th className="py-3 px-3 font-semibold">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const st = statusOf(p);
                  return (
                    <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-3 font-semibold">{p.name}</td>
                      <td className="py-3 px-3 text-slate-500" dir="ltr">{p.sku || '—'}</td>
                      <td className="py-3 px-3 text-slate-500">{p.category}</td>
                      <td className="py-3 px-3 font-bold">{formatNumber(p.quantity)}</td>
                      <td className="py-3 px-3 text-slate-500">{formatCurrency(Number(p.cost_price))}</td>
                      <td className="py-3 px-3 font-semibold">{formatCurrency(Number(p.selling_price))}</td>
                      <td className="py-3 px-3">
                        <span className={`badge ${st.cls}`}>
                          <st.icon className="w-3.5 h-3.5" /> {st.label}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <button onClick={() => setEditing(p)} className="btn-ghost p-2">
                          <Pencil className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-slate-400 py-8">لا توجد أصناف</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(editing || showAdd) && (
        <ProductEditModal
          product={editing}
          onClose={() => { setEditing(null); setShowAdd(false); }}
          onSaved={() => { setEditing(null); setShowAdd(false); load(); }}
        />
      )}
    </div>
  );
}

function ProductEditModal({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!product;
  const [form, setForm] = useState({
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    category: product?.category ?? 'عام',
    quantity: product?.quantity ?? 0,
    cost_price: product?.cost_price ?? 0,
    selling_price: product?.selling_price ?? 0,
    low_stock_threshold: product?.low_stock_threshold ?? 5,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.name.trim()) {
      toast('اسم المنتج مطلوب', 'error');
      return;
    }
    setSaving(true);
    try {
      if (isEdit && product) {
        const { error } = await supabase
          .from('products')
          .update({
            name: form.name.trim(),
            sku: form.sku.trim() || null,
            category: form.category.trim() || 'عام',
            quantity: Number(form.quantity),
            cost_price: Number(form.cost_price),
            selling_price: Number(form.selling_price),
            low_stock_threshold: Number(form.low_stock_threshold),
          })
          .eq('id', product.id);
        if (error) throw error;
        toast('تم تحديث الصنف', 'success');
      } else {
        const { error } = await supabase.from('products').insert({
          name: form.name.trim(),
          sku: form.sku.trim() || null,
          category: form.category.trim() || 'عام',
          quantity: Number(form.quantity),
          cost_price: Number(form.cost_price),
          selling_price: Number(form.selling_price),
          low_stock_threshold: Number(form.low_stock_threshold),
        });
        if (error) throw error;
        toast('تمت إضافة الصنف', 'success');
      }
      onSaved();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fadein">
      <div className="card max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">{isEdit ? 'تعديل صنف' : 'صنف جديد'}</h3>
          <button onClick={onClose} className="btn-ghost p-2"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="label">اسم المنتج</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">الرمز SKU</label>
            <input className="input" dir="ltr" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </div>
          <div>
            <label className="label">الفئة</label>
            <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <div>
            <label className="label">الكمية</label>
            <input type="number" className="input" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">حد التنبيه</label>
            <input type="number" className="input" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">سعر التكلفة</label>
            <input type="number" step="0.01" className="input" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">سعر البيع</label>
            <input type="number" step="0.01" className="input" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: Number(e.target.value) })} />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={save} disabled={saving} className="btn-primary flex-1">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            حفظ
          </button>
          <button onClick={onClose} className="btn-secondary">إلغاء</button>
        </div>
      </div>
    </div>
  );
}
