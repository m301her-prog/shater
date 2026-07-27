import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Store, Mail, Lock, User as UserIcon, Loader2, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const { theme, toggle } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/sales';

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await signIn(email.trim(), password);
        if (error) {
          toast(error, 'error');
        } else {
          toast('مرحباً بك في شاطر', 'success');
          navigate(from, { replace: true });
        }
      } else {
        if (password.length < 6) {
          toast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
          return;
        }
        const { error } = await signUp(email.trim(), password, fullName.trim() || 'مستخدم جديد');
        if (error) {
          toast(error, 'error');
        } else {
          toast('تم إنشاء الحساب بنجاح', 'success');
          navigate(from, { replace: true });
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-950">
      {/* Brand panel */}
      <div className="lg:w-1/2 bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-700 text-white p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-20 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-extrabold">شاطر</div>
            <div className="text-sm text-indigo-100">نظام إدارة المتجر</div>
          </div>
        </div>
        <div className="relative z-10 my-12 lg:my-0">
          <h1 className="text-3xl lg:text-4xl font-extrabold leading-tight mb-4">
            أدِر متجرك بذكاء<br />وسهولة
          </h1>
          <p className="text-indigo-100 text-lg leading-relaxed max-w-md">
            نظام متكامل لإدارة المخزون والمشتريات والمبيعات والفواتير — بالعربية ومصمم للأعمال.
          </p>
        </div>
        <div className="relative z-10 grid grid-cols-3 gap-4 text-center">
          {[
            ['المخزون', 'تتبع لحظي'],
            ['الفواتير', 'تلقائية'],
            ['التقارير', 'فورية'],
          ].map(([t, s]) => (
            <div key={t} className="bg-white/10 backdrop-blur rounded-xl p-3">
              <div className="font-bold">{t}</div>
              <div className="text-xs text-indigo-100 mt-0.5">{s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Form panel */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-12 relative">
        <button
          onClick={toggle}
          className="absolute top-4 left-4 btn-ghost p-2"
          aria-label="تبديل الوضع"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white mb-1">
              {mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              {mode === 'login' ? 'أدخل بياناتك للوصول إلى لوحة التحكم' : 'أنشئ حسابك للبدء في إدارة متجرك'}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-6">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                mode === 'login'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              تسجيل الدخول
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                mode === 'register'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              حساب جديد
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="label">الاسم الكامل</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className="input pr-10"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="اسمك الكامل"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="label">البريد الإلكتروني</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  className="input pr-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  dir="ltr"
                />
              </div>
            </div>
            <div>
              <label className="label">كلمة المرور</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  className="input pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {mode === 'login' ? 'دخول' : 'إنشاء الحساب'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {mode === 'login' ? (
              <>
                ليس لديك حساب؟{' '}
                <button onClick={() => setMode('register')} className="text-indigo-600 dark:text-indigo-400 font-semibold">
                  أنشئ حساباً
                </button>
              </>
            ) : (
              <>
                لديك حساب؟{' '}
                <button onClick={() => setMode('login')} className="text-indigo-600 dark:text-indigo-400 font-semibold">
                  سجل الدخول
                </button>
              </>
            )}
          </div>

          <div className="mt-6 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
            لتجربة حساب المدير: سجّل بالبريد <span dir="ltr" className="font-mono font-bold">admin@shatir.com</span> (يُمنح صلاحية المدير تلقائياً).
          </div>
        </div>
      </div>
    </div>
  );
}
