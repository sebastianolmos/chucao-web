import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { I18nextProvider } from 'react-i18next';
import type { Locale } from '../lib/database.types';
import {
  getLocale,
  setLocale as saveLocale,
} from '../features/preferences/preferencesService';
import i18n from '../i18n/i18n';
import {
  LocaleContext,
  type LocaleContextValue,
  type PreferenceSyncStatus,
} from './localeContext';

function detectBrowserLocale(): Locale {
  return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'es';
}

function readVisitLocale(): Locale {
  const storedLocale = sessionStorage.getItem('chucao.locale');
  return storedLocale === 'en' || storedLocale === 'es'
    ? storedLocale
    : detectBrowserLocale();
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readVisitLocale);
  const [preferenceSyncStatus, setPreferenceSyncStatus] =
    useState<PreferenceSyncStatus>('idle');
  const [accountUserId, setAccountUserId] = useState<string | null>(null);
  const accountUserIdRef = useRef<string | null>(null);
  const localeRef = useRef(locale);
  const syncRequestRef = useRef(0);

  const applyLocale = useCallback((nextLocale: Locale) => {
    localeRef.current = nextLocale;
    setLocaleState(nextLocale);
    sessionStorage.setItem('chucao.locale', nextLocale);
    void i18n.changeLanguage(nextLocale);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const syncAccountLocale = useCallback(async (userId: string) => {
    const requestId = syncRequestRef.current + 1;
    syncRequestRef.current = requestId;
    accountUserIdRef.current = userId;
    setAccountUserId(userId);
    setPreferenceSyncStatus('reading');

    let accountLocale: Locale | null;

    try {
      accountLocale = await getLocale(userId);

      if (
        syncRequestRef.current !== requestId
        || accountUserIdRef.current !== userId
      ) {
        return;
      }
    } catch {
      if (
        syncRequestRef.current !== requestId
        || accountUserIdRef.current !== userId
      ) {
        return;
      }

      setPreferenceSyncStatus('read_error');
      return;
    }

    if (accountLocale) {
      applyLocale(accountLocale);
      setPreferenceSyncStatus('synced');
      return;
    }

    setPreferenceSyncStatus('saving');

    try {
      await saveLocale(userId, localeRef.current);

      if (
        syncRequestRef.current !== requestId
        || accountUserIdRef.current !== userId
      ) {
        return;
      }

      setPreferenceSyncStatus('synced');
    } catch {
      if (
        syncRequestRef.current !== requestId
        || accountUserIdRef.current !== userId
      ) {
        return;
      }

      setPreferenceSyncStatus('write_error');
    }
  }, [applyLocale]);

  const persistSelectedLocale = useCallback(async (
    userId: string,
    nextLocale: Locale,
  ) => {
    setPreferenceSyncStatus('saving');

    try {
      await saveLocale(userId, nextLocale);
      if (accountUserIdRef.current === userId) {
        setPreferenceSyncStatus('synced');
      }
    } catch {
      if (accountUserIdRef.current === userId) {
        setPreferenceSyncStatus('write_error');
      }
    }
  }, []);

  const selectLocale = useCallback((nextLocale: Locale) => {
    applyLocale(nextLocale);

    const userId = accountUserIdRef.current;
    if (userId) {
      void persistSelectedLocale(userId, nextLocale);
    }
  }, [applyLocale, persistSelectedLocale]);

  const clearAccountLocale = useCallback(() => {
    syncRequestRef.current += 1;
    accountUserIdRef.current = null;
    setAccountUserId(null);
    setPreferenceSyncStatus('idle');
  }, []);

  const retryAccountLocale = useCallback(async () => {
    const userId = accountUserIdRef.current;
    if (!userId) {
      return;
    }

    if (preferenceSyncStatus === 'write_error') {
      await persistSelectedLocale(userId, localeRef.current);
      return;
    }

    await syncAccountLocale(userId);
  }, [persistSelectedLocale, preferenceSyncStatus, syncAccountLocale]);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    preferenceSyncStatus,
    accountUserId,
    selectLocale,
    syncAccountLocale,
    clearAccountLocale,
    retryAccountLocale,
  }), [
    accountUserId,
    clearAccountLocale,
    locale,
    preferenceSyncStatus,
    retryAccountLocale,
    selectLocale,
    syncAccountLocale,
  ]);

  return (
    <I18nextProvider i18n={i18n}>
      <LocaleContext.Provider value={value}>
        {children}
      </LocaleContext.Provider>
    </I18nextProvider>
  );
}

