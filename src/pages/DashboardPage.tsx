import { useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  Users,
  Wallet,
  ArrowRightLeft,
  Receipt,
} from 'lucide-react';
import { supabase, type Profile, type Product } from '@/lib/supabase';
import { formatCurrency, formatNumber, formatDate } from '@/lib/format';

type Stats = {
  totalRevenue: number;
  totalPurchases: number;
  inventoryValue: number;
  lowStock: number;
  productCount: number;
  recentInvoices: {
    id: string;
    invoice_number: string | null;
    type: 'PURCHASE' | 'SALE';
    total_amount: number;
    created_at: string;
  }[];
};

export function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: products }, { data: sales }, { data: purchases }, { data: recent }, { data: profiles }] =
          await Promise.all([
            supabase.from('products').select('*'),
            supabase.from('invoices').select('total_amount').eq('type', 'SALE'),
            supabase.from('invoices').select('total_amount').eq('type', 'PURCHASE'),
            supabase
              .from('invoices')
              .select('id, invoice_number, type, total_amount, created_at')
              .order('created_at', { ascending: false })
              .limit(6),
            supabase.from('profiles').select('*').order('created_at', { ascending: false }),
          ]);

        const productList = (products as Product[]) || [];
        const salesList = (sales as { total_amount: number }[]) || [];
        const purList = (purchases as { total_amount: number }[]) || [];

        const totalRevenue = salesList.reduce((s, r) => s + Number(r.total_amount), 0);
        const totalPurchases = purList.reduce((s, r) => s + Number(r.total_amount), 0);
        const inventoryValue = productList.reduce(
          (s, p) => s + p.quantity * Number(p.cost_price),
          0
        );
        const lowStock = productList.filter(
          (p) => p.quantity <= (p.low_stock_threshold ?? 5)
        ).length;

        setStats({
          totalRevenue,
          totalPurchases,
          inventoryValue,
          lowStock,
          productCount: productList.length,
          recentInvoices: (recent as Stats['recentInvoices']) || [],
        });
        setUsers((profiles as Profile[]) || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  const cards = [
    {
      label: 'إجمالي المبيعات',
      value: formatCurrency(stats.totalRevenue),
      icon: TrendingUp,
      color: 'from-emerald-500 to-green-600',
      ring: 'bg-emerald-50 dark:bg-emerald-950/40',
    },
    {
      label: 'إجمالي المشتريات',
      value: formatCurrency(stats.totalPurchases),
      icon: TrendingDown,
      color: 'from-blue-500 to-indigo-600',
      ring: 'bg-blue-50 dark:bg-blue-950/40',
    },
    {
      label: 'قيمة المخزون',
      value: formatCurrency(stats.inventoryValue),
      icon: Wallet,
      color: 'from-amber-500 to-orange-600',
      ring: 'bg-amber-50 dark:bg-amber-950/40',
    },
    {
      label: 'تنبيهات نقص المخزون',
      value: formatNumber(stats.lowStock) + ' صنف',
      icon: AlertTriangle,
      color: 'from-rose-500 to-red-600',
      ring: 'bg-rose-50 dark:bg-rose-950/40',
    },
  ];

  return (
    <div className="space-y-6 animate-fadein">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white">لوحة التحكم</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          نظرة عامة على أداء متجرك
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-5 relative overflow-hidden">
            <div className={`absolute -top-8 -left-8 w-24 h-24 rounded-full ${c.ring}`} />
            <div className="relative flex items-start justify-between">
              <div>
                <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  {c.label}
                </div>
                <div className="text-2xl font-extrabold mt-2 text-slate-800 dark:text-white">
                  {c.value}
                </div>
              </div>
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center shadow-md`}>
                <c.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent invoices */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-indigo-600" /> آخر الفواتير
            </h2>
          </div>
          <div className="space-y-2">
            {stats.recentInvoices.length === 0 && (
              <p className="text-sm text-slate-400 py-6 text-center">لا توجد فواتير بعد</p>
            )}
            {stats.recentInvoices.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      inv.type === 'SALE'
                        ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300'
                    }`}
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm" dir="ltr">
                      {inv.invoice_number}
                    </div>
                    <div className="text-xs text-slate-400">{formatDate(inv.created_at)}</div>
                  </div>
                </div>
                <div className="text-left">
                  <div className="font-bold text-sm">{formatCurrency(Number(inv.total_amount))}</div>
                  <span className={`badge text-[10px] ${
                    inv.type === 'SALE'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                  }`}>
                    {inv.type === 'SALE' ? 'بيع' : 'شراء'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick info */}
        <div className="card p-5">
          <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-indigo-600" /> ملخص المخزون
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">عدد الأصناف</span>
              <span className="font-bold">{formatNumber(stats.productCount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">أصناف منخفضة</span>
              <span className="font-bold text-rose-600 dark:text-rose-400">{formatNumber(stats.lowStock)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">قيمة المخزون</span>
              <span className="font-bold">{formatCurrency(stats.inventoryValue)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Users management */}
      <div className="card p-5">
        <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-indigo-600" /> إدارة المستخدمين
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="py-2 px-3 font-semibold">الاسم</th>
                <th className="py-2 px-3 font-semibold">البريد</th>
                <th className="py-2 px-3 font-semibold">الدور</th>
                <th className="py-2 px-3 font-semibold">تاريخ الإنشاء</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={4} className="text-center text-slate-400 py-6">لا يوجد مستخدمون</td></tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800/60">
                  <td className="py-3 px-3 font-semibold">{u.full_name || '—'}</td>
                  <td className="py-3 px-3 text-slate-500" dir="ltr">{u.email}</td>
                  <td className="py-3 px-3">
                    <span className={`badge ${
                      u.role === 'admin'
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {u.role === 'admin' ? 'مدير' : 'مستخدم'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-400">{formatDate(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
