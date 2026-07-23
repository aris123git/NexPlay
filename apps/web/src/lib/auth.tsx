'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import {
  api,
  clearSession,
  loadSession,
  saveSession,
  type Session,
} from './api';

type AuthCtx = {
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    username: string;
    countryCode?: string;
  }) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = loadSession();
    setSession(s);
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<Session>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    saveSession(data);
    setSession(data);
  }, []);

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      username: string;
      countryCode?: string;
    }) => {
      const data = await api<Session>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      saveSession(data);
      setSession(data);
    },
    [],
  );

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const refreshMe = useCallback(async () => {
    if (!session) return;
    const data = await api<{ user: Session['user'] }>('/auth/me', {
      token: session.accessToken,
    });
    const next = { ...session, user: { ...session.user, ...data.user } };
    saveSession(next);
    setSession(next);
  }, [session]);

  const value = useMemo(
    () => ({ session, loading, login, register, logout, refreshMe }),
    [session, loading, login, register, logout, refreshMe],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}
