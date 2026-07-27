import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import { AppShell } from '@/components/AppShell';
import { ProtectedRoute, AdminRoute } from '@/components/ProtectedRoute';
import { AuthPage } from '@/pages/AuthPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { PurchasesPage } from '@/pages/PurchasesPage';
import { SalesPage } from '@/pages/SalesPage';
import { InventoryPage } from '@/pages/InventoryPage';
import { InvoicesPage } from '@/pages/InvoicesPage';

function RootRedirect() {
  const { session, isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  return <Navigate to={isAdmin ? '/admin' : '/sales'} replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<AuthPage />} />

              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AppShell>
                      <DashboardPage />
                    </AppShell>
                  </AdminRoute>
                }
              />
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
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
