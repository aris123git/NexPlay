'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ConnectionMode = 'auto' | 'full' | 'low';

type ConnCtx = {
  mode: ConnectionMode;
  /** Mode effectif (auto → low si saveData / 2g) */
  effectiveLow: boolean;
  setMode: (m: ConnectionMode) => void;
  /** Intervalle de poll recommandé (ms) */
  pollIntervalMs: number;
  /** Transports Socket.IO */
  socketTransports: ('websocket' | 'polling')[];
};

const KEY = 'nexplay.connectionMode';
const Ctx = createContext<ConnCtx | null>(null);

function detectSaveData(): boolean {
  if (typeof navigator === 'undefined') return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection;
  if (conn?.saveData) return true;
  if (conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g') return true;
  return false;
}

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ConnectionMode>('auto');

  useEffect(() => {
    const saved = localStorage.getItem(KEY) as ConnectionMode | null;
    if (saved === 'auto' || saved === 'full' || saved === 'low') setModeState(saved);
  }, []);

  useEffect(() => {
    const low = mode === 'low' || (mode === 'auto' && detectSaveData());
    document.body.classList.toggle('low-bandwidth', low);
  }, [mode]);

  const setMode = useCallback((m: ConnectionMode) => {
    setModeState(m);
    localStorage.setItem(KEY, m);
  }, []);

  const effectiveLow = mode === 'low' || (mode === 'auto' && detectSaveData());

  const value = useMemo<ConnCtx>(
    () => ({
      mode,
      effectiveLow,
      setMode,
      pollIntervalMs: effectiveLow ? 8000 : 3000,
      socketTransports: effectiveLow ? ['polling'] : ['websocket', 'polling'],
    }),
    [mode, effectiveLow, setMode],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useConnection() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useConnection outside provider');
  return ctx;
}
