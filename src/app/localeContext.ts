import { createContext, useContext } from 'react';
import type { Locale } from '../lib/database.types';

export type PreferenceSyncStatus =
  | 'idle'
  | 'reading'
  | 'saving'
  | 'synced'
  | 'read_error'
  | 'write_error';

export type LocaleContextValue = {
  locale: Locale;
  preferenceSyncStatus: PreferenceSyncStatus;
  accountUserId: string | null;
  selectLocale: (nextLocale: Locale) => void;
  syncAccountLocale: (userId: string) => Promise<void>;
  clearAccountLocale: () => void;
  retryAccountLocale: () => Promise<void>;
};

export const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider');
  }

  return context;
}
