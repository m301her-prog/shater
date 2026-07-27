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
  Loader2,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react';
import { fetchStats, fetchUsers, toggleUserStatus } from '@/services/dbService';
import { formatCurrency, formatNumber, formatDate } from '@/lib/format';
import { useToast } from '@/context/ToastContext';

export function AdminPanel() {
  const { toast } = useToast();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    try {
      const [s, u] = await Promise.all([fetchStats(), fetchUsers()]);
      setStats(s);
      setUsers(u);
    } catch (e) {
      toast('تعذّر تحميل البيانات', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleToggle(user) {
    try {
      await toggleUserStatus(user.id, !user.is_active);
      toast(user.is_active ? 'تم تجميد الحساب' : 'تم تفعيل الحساب', 'success');
      setUsers((arr) => arr.map((u) => (u.id === user.id ? { ...u, is_active: !u.is_active } : u)));
    } catch (e) {
      toast('تعذّر تحديث الحساب', 'error');
    }
  }

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
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
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">نظرة عامة على أداء متجرك وإدارة المستخدمين</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-5 relative overflow-hidden">
            <div className={`absolute -top-8 -left-8 w-24 h-24 rounded-full ${c.ring}`} />
            <div className="relative flex items-start justify-between">
              <div>
                <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">{c.label}</div>
                <div className="text-2xl font-extrabold mt-2 text-slate-800 dark:text-white">{c.value}</div>
              </div>
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center shadow-md`}>
                <c.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Users management */}
      <div className="card p-5">
        <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-indigo-600" /> مركز إدارة المستخدمين والتفعيل
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="py-2 px-3 font-semibold">الاسم</th>
                <th className="py-2 px-3 font-semibold">البريد</th>
                <th className="py-2 px-3 font-semibold">الدور</th>
                <th className="py-2 px-3 font-semibold">الحالة</th>
                <th className="py-2 px-3 font-semibold">تاريخ الإنشاء</th>
                <th className="py-2 px-3 font-semibold">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={6} className="text-center text-slate-400 py-6">لا يوجد مستخدمون</td></tr>
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
                  <td className="py-3 px-3">
                    {u.is_active ? (
                      <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">مفعّل</span>
                    ) : (
                      <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">بانتظار التفعيل</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-slate-400">{formatDate(u.created_at)}</td>
                  <td className="py-3 px-3">
                    {u.role === 'admin' ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : u.is_active ? (
                      <button
                        onClick={() => handleToggle(u)}
                        className="btn-secondary text-xs py-1.5 px-3 text-rose-600 dark:text-rose-400"
                      >
                        <ShieldOff className="w-4 h-4" /> تجميد الحساب
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggle(u)}
                        className="btn-primary text-xs py-1.5 px-3"
                      >
                        <ShieldCheck className="w-4 h-4" /> تفعيل الحساب
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inventory summary */}
      <div className="card p-5">
        <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-indigo-600" /> ملخص المخزون
        </h2>
        <div className="space-y-3">
          <div className="flex justify-between text-sm"><span className="text-slate-500">عدد الأصناف</span><span className="font-bold">{formatNumber(stats.productCount)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">أصناف منخفضة</span><span className="font-bold text-rose-600 dark:text-rose-400">{formatNumber(stats.lowStock)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">قيمة المخزون</span><span className="font-bold">{formatCurrency(stats.inventoryValue)}</span></div>
        </div>
      </div>
    </div>
  );
}
