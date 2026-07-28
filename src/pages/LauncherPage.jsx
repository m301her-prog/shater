import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import { AppShell } from '@/components/AppShell';
import { ProtectedRoute, AdminRoute } from '@/components/ProtectedRoute';
import { AuthPage } from '@/pages/AuthPage';
import { AdminPanel } from '@/pages/AdminPanel';
import { PurchasesPage } from '@/pages/PurchasesPage';
import { SalesPage } from '@/pages/SalesPage';
import { InventoryPage } from '@/pages/InventoryPage';
import { InvoicesPage } from '@/pages/InvoicesPage';
import { LauncherPage } from '@/pages/LauncherPage';

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  // إذا لم يكن مسجلاً للدخول، يفتح على صفحة الدخول/إنشاء الحساب
  if (!user) return <Navigate to="/login" replace />;
  // بعد تسجيل الدخول مباشرة، يفتح على لوحة التحكم الرئيسية (LauncherPage)
  return <Navigate to="/home" replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* التوجيه الرئيسي عند فتح التطبيق */}
              <Route path="/" element={<RootRedirect />} />
              
              {/* صفحة تسجيل الدخول / إنشاء الحساب */}
              <Route path="/login" element={<AuthPage />} />

              {/* لوحة التحكم الرئيسية للتطبيق (LauncherPage) */}
              <Route
                path="/home"
                element={
                  <ProtectedRoute>
                    <LauncherPage />
                  </ProtectedRoute>
                }
              />

              {/* صفحة الأدمن (خاصة بالحسابات التي تملك صلاحية الأدمن فقط) */}
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AppShell>
                      <AdminPanel />
                    </AppShell>
                  </AdminRoute>
                }
              />

              {/* بقية الصفحات والموديلات */}
              <Route
                path="/purchases"
                element={
                  <ProtectedRoute>
                    <AppShell>
                      <PurchasesPage />
                    </AppShell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sales"
                element={
                  <ProtectedRoute>
                    <AppShell>
                      <SalesPage />
                    </AppShell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventory"
                element={
                  <ProtectedRoute>
                    <AppShell>
                      <InventoryPage />
                    </AppShell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/invoices"
                element={
                  <ProtectedRoute>
                    <AppShell>
                      <InvoicesPage />
                    </AppShell>
                  </ProtectedRoute>
                }
              />

              {/* إعادة توجيه أي مسار غير معروف إلى الصفحة الرئيسية */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
