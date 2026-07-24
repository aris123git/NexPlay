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
import { dictionaries, translate, type LocaleCode } from './dictionaries';

type I18nCtx = {
  locale: LocaleCode;
  dir: 'ltr' | 'rtl';
  setLocale: (l: LocaleCode) => void;
  t: (key: string) => string;
};

const Ctx = createContext<I18nCtx | null>(null);
const KEY = 'nexplay.locale';

function dirFor(locale: LocaleCode): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>('fr');

  useEffect(() => {
    const saved = localStorage.getItem(KEY) as LocaleCode | null;
    if (saved && dictionaries[saved]) setLocaleState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dirFor(locale);
  }, [locale]);

  const setLocale = useCallback((l: LocaleCode) => {
    setLocaleState(l);
    localStorage.setItem(KEY, l);
  }, []);

  const t = useCallback((key: string) => translate(locale, key), [locale]);

  const value = useMemo(
    () => ({ locale, dir: dirFor(locale), setLocale, t }),
    [locale, setLocale, t],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useI18n outside provider');
  return ctx;
}
