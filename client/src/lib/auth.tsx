import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import type { AuthUser } from './types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<AuthUser | null>;
  login: (payload: {
    mode: 'admin' | 'voter' | 'auditor';
    identifier: string;
    secondary?: string;
    password: string;
    remember?: boolean;
  }) => Promise<{ user: AuthUser; redirect: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<{ user: AuthUser }>('/api/auth/me');
      setUser(data.user);
      return data.user;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (payload: {
      mode: 'admin' | 'voter' | 'auditor';
      identifier: string;
      secondary?: string;
      password: string;
      remember?: boolean;
    }) => {
      const result = await api.post<{ user: AuthUser; redirect: string }>('/api/auth/login', payload);
      setUser(result.user);
      return result;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, loading, refresh, login, logout }), [user, loading, refresh, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
