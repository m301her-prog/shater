import { useEffect, useMemo, useState } from 'react';
import { FileText, Search, Loader2, X, ArrowRightLeft } from 'lucide-react';
import { fetchInvoices, fetchInvoiceItems } from '@/services/dbService';
import { useToast } from '@/context/ToastContext';
import { formatCurrency, formatDateShort } from '@/lib/format';
import { InvoiceModal } from '@/components/InvoiceModal';

export function InvoicesPage() {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchInvoices();
        setInvoices(data);
      } catch (e) {
        toast('تعذّر تحميل الفواتير', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (typeFilter !== 'all' && inv.type !== typeFilter) return false;
      if (search.trim() && !(inv.invoice_number ?? '').includes(search.trim())) return false;
      const d = new Date(inv.created_at).getTime();
      if (dateFrom && d < new Date(dateFrom).getTime()) return false;
      if (dateTo && d > new Date(dateTo).getTime() + 86400000) return false;
      return true;
    });
  }, [invoices, typeFilter, search, dateFrom, dateTo]);

  async function openInvoice(inv) {
    setOpening(true);
    try {
      const items = await fetchInvoiceItems(inv.id);
      setSelected({ ...inv, items });
    } catch (e) {
      toast('تعذّر فتح الفاتورة', 'error');
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="space-y-6 animate-fadein">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
          <FileText className="w-6 h-6 text-indigo-600" /> صفحة الفواتير
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">سجل جميع فواتير المشتريات والمبيعات</p>
      </div>

      <div className="card p-5">
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pr-10" placeholder="رقم الفاتورة..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            {[
              ['all', 'الكل'],
              ['PURCHASE', 'المشتريات'],
              ['SALE', 'المبيعات'],
            ].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setTypeFilter(val)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                  typeFilter === val ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div>
            <input type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <input type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-3 font-semibold">رقم الفاتورة</th>
                  <th className="py-3 px-3 font-semibold">النوع</th>
                  <th className="py-3 px-3 font-semibold">التاريخ</th>
                  <th className="py-3 px-3 font-semibold">الإجمالي</th>
                  <th className="py-3 px-3 font-semibold">عرض</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-3 font-mono font-bold" dir="ltr">{inv.invoice_number}</td>
                    <td className="py-3 px-3">
                      <span className={`badge ${inv.type === 'SALE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'}`}>
                        {inv.type === 'SALE' ? 'بيع' : 'شراء'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500">{formatDateShort(inv.created_at)}</td>
                    <td className="py-3 px-3 font-bold">{formatCurrency(Number(inv.total_amount))}</td>
                    <td className="py-3 px-3">
                      <button onClick={() => openInvoice(inv)} disabled={opening} className="btn-ghost p-2">
                        {opening ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-slate-400 py-8">لا توجد فواتير مطابقة</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fadein">
          <div className="card max-w-md w-full p-6 relative">
            <button onClick={() => setSelected(null)} className="absolute top-3 left-3 btn-ghost p-2 z-10">
              <X className="w-5 h-5" />
            </button>
            <InvoiceModal invoice={selected} onClose={() => setSelected(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
