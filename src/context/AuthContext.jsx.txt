import { createContext, useContext, useEffect, useState } from 'react';
import { loginUser } from '@/services/neonClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // تحميل الجلسة وحفظها عند بدء التطبيق
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem('shatir_token');
      const savedUser = localStorage.getItem('shatir_user');

      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      }
    } catch (e) {
      console.error('فشل تحميل الجلسة:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // فحص صلاحية الأدمن
  const checkIsAdmin = (u) => {
    return u?.role === 'admin' || u?.email === 'admin@shatir.com';
  };

  const value = {
    user,
    token,
    loading,
    isAdmin: checkIsAdmin(user),

    // 1. تسجيل الدخول
    async signIn(email, password) {
      try {
        const response = await loginUser({ email, password });

        if (response.token && response.user) {
          setUser(response.user);
          setToken(response.token);
          
          // حفظ بيانات الجلسة في الـ LocalStorage
          localStorage.setItem('shatir_token', response.token);
          localStorage.setItem('shatir_user', JSON.stringify(response.user));

          return { user: response.user, token: response.token };
        } else {
          return { error: response.message || 'بيانات الدخول غير صحيحة' };
        }
      } catch (err) {
        return { error: err.message || 'فشل الاتصال بالخادم، تحقق من الاتصال بالشبكة' };
      }
    },

    // 2. إنشاء حساب جديد
    async signUp(data) {
      try {
        const response = await loginUser({ 
          email: data.email, 
          password: data.password, 
          full_name: data.full_name,
          action: 'register' 
        });

        if (response.error) {
          return { error: response.error };
        }
        return response;
      } catch (err) {
        return { error: err.message || 'حدث خطأ أثناء إنشاء الحساب' };
      }
    },

    // 3. تسجيل الخروج
    async signOut() {
      setUser(null);
      setToken(null);
      localStorage.removeItem('shatir_token');
      localStorage.removeItem('shatir_user');
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
