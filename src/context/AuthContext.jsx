import { createContext, useContext, useEffect, useState } from 'react';
import { loginUser, registerUser, signOut, loadSession, isAdmin } from '@/services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const session = await loadSession();
      setUser(session);
      setLoading(false);
    })();
  }, []);

  const value = {
    user,
    loading,
    isAdmin: isAdmin(user),
    async signIn(email, password) {
      const res = await loginUser(email, password);
      if (res.user) setUser(res.user);
      return res;
    },
    async signUp(data) {
      return registerUser(data);
    },
    async signOut() {
      await signOut();
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
