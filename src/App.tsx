import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ensureProfile } from './features/preferences/preferencesService';
import { useLocale } from './app/localeContext';
import { MyListsView } from './features/lists/MyListsView';
import { queryClient } from './lib/queryClient';
import { supabase } from './lib/supabase';
import { useTranslation } from 'react-i18next';
import type { ListRow } from './lib/database.types';
import { ListDetailView } from './features/lists/ListDetailView';
import stand from './assets/stand.png';
import styles from './app/app.module.css';

type AuthStatus =
  | 'checking_session'
  | 'session_error'
  | 'access'
  | 'initializing_profile'
  | 'profile_error'
  | 'authenticated';

type MessageKey =
  | 'auth.oauthError'
  | 'auth.signInError'
  | 'auth.signOutError'
  | 'auth.sessionError'
  | 'auth.profileError';

function readOAuthError() {
  const url = new URL(window.location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  return url.searchParams.has('error') || fragment.has('error')
    ? true
    : false;
}

function clearPrivateState() {
  queryClient.removeQueries({ queryKey: ['lists'] });
  queryClient.removeQueries({ queryKey: ['profile'] });
}

export default function App() {
  const { t } = useTranslation();
  const {
    locale,
    preferenceSyncStatus,
    selectLocale,
    syncAccountLocale,
    clearAccountLocale,
    retryAccountLocale,
  } = useLocale();
  const [session, setSession] = useState<Session | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking_session');
  const [busy, setBusy] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [selectedList, setSelectedList] = useState<ListRow | null>(null);
  const [messageKey, setMessageKey] = useState<MessageKey | null>(() =>
    readOAuthError() ? 'auth.oauthError' : null,
  );
  const currentUserIdRef = useRef<string | null>(null);
  const syncRequestRef = useRef(0);
  const mountedRef = useRef(true);
  const oauthReconciliationRef = useRef(false);

  useEffect(() => {
    document.title = t(
      authStatus !== 'authenticated'
        ? 'app.title'
        : selectedList
          ? 'app.listTitle'
          : 'app.authenticatedTitle',
    );
  }, [authStatus, selectedList, t]);

  const synchronizeSession = useCallback(async (nextSession: Session | null) => {
    const requestId = syncRequestRef.current + 1;
    syncRequestRef.current = requestId;
    const nextUserId = nextSession?.user.id ?? null;
    const previousUserId = currentUserIdRef.current;

    if (previousUserId !== null && previousUserId !== nextUserId) {
      clearPrivateState();
      setSelectedList(null);
    }

    currentUserIdRef.current = nextUserId;
    setBusy(false);
    setSession(nextSession);
    setMessageKey(null);

    if (!nextSession) {
      clearAccountLocale();
      setAuthStatus('access');
      return;
    }

    setAuthStatus('initializing_profile');

    try {
      await ensureProfile();
      await syncAccountLocale(nextSession.user.id);

      if (!mountedRef.current || syncRequestRef.current !== requestId) {
        return;
      }

      setAuthStatus('authenticated');
    } catch {
      if (!mountedRef.current || syncRequestRef.current !== requestId) {
        return;
      }

      setAuthStatus('profile_error');
      setMessageKey('auth.profileError');
    }
  }, [clearAccountLocale, syncAccountLocale]);

  const refreshSession = useCallback(async () => {
    setAuthStatus('checking_session');
    setMessageKey(null);

    const { data, error } = await supabase.auth.getSession();

    if (error) {
      setSession(null);
      setAuthStatus('session_error');
      setMessageKey('auth.sessionError');
      return;
    }

    await synchronizeSession(data.session);
  }, [synchronizeSession]);

  const reconcileOAuthReturn = useCallback(async () => {
    if (!busy || oauthReconciliationRef.current) {
      return;
    }

    oauthReconciliationRef.current = true;

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setBusy(false);
        setAuthStatus('access');
        setMessageKey('auth.sessionError');
        return;
      }

      if (data.session) {
        await synchronizeSession(data.session);
        return;
      }

      setBusy(false);
      setAuthStatus('access');
      setMessageKey('auth.oauthError');
    } finally {
      oauthReconciliationRef.current = false;
    }
  }, [busy, synchronizeSession]);

  useEffect(() => {
    mountedRef.current = true;
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void synchronizeSession(nextSession);
    });

    void Promise.resolve().then(() => refreshSession());

    return () => {
      mountedRef.current = false;
      data.subscription.unsubscribe();
    };
  }, [refreshSession, synchronizeSession]);

  useEffect(() => {
    const handleProviderReturn = () => {
      void reconcileOAuthReturn();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleProviderReturn();
      }
    };

    window.addEventListener('pageshow', handleProviderReturn);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pageshow', handleProviderReturn);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [reconcileOAuthReturn]);

  async function signIn() {
    if (busy) {
      return;
    }

    setBusy(true);
    setMessageKey(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/` },
      });

      if (error) throw error;
    } catch {
      setMessageKey('auth.signInError');
      setBusy(false);
    }
  }

  async function signOut() {
    if (busy) {
      return;
    }

    setBusy(true);
    setMessageKey(null);

    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;

      clearPrivateState();
      currentUserIdRef.current = null;
      setSelectedList(null);
      setSession(null);
      setAuthStatus('access');
    } catch {
      setMessageKey('auth.signOutError');
    } finally {
      setBusy(false);
    }
  }

  if (authStatus === 'checking_session') {
    return (
      <main className={styles.shell}>
        <p role="status">{t('auth.checkingSession')}</p>
      </main>
    );
  }

  if (authStatus === 'session_error') {
    return (
      <main className={styles.shell}>
        <h1>{t('access.title')}</h1>
        <p role="alert">{t(messageKey ?? 'auth.sessionError')}</p>
        <button disabled={busy} onClick={() => void refreshSession()}>
          {t('auth.retry')}
        </button>
      </main>
    );
  }

  if (authStatus === 'initializing_profile') {
    return (
      <main className={styles.shell}>
        <p role="status">{t('auth.preparingPrivateSpace')}</p>
      </main>
    );
  }

  if (authStatus === 'profile_error' && session) {
    return (
      <main className={styles.shell}>
        <h1>{t('access.title')}</h1>
        <p role="alert">{t(messageKey ?? 'auth.profileError')}</p>
        <button disabled={busy} onClick={() => void refreshSession()}>
          {t('auth.retry')}
        </button>
        <button disabled={busy} onClick={signOut}>
          {t('auth.signOut')}
        </button>
      </main>
    );
  }

  if (
    privacyOpen
    && (authStatus === 'access' || authStatus === 'authenticated')
  ) {
    return (
      <main className={`${styles.shell} ${styles.privacy}`}>
        <article aria-labelledby="privacy-title">
          <h1 id="privacy-title">{t('privacy.title')}</h1>
          <p>{t('privacy.version')}</p>
          <p>{t('privacy.intro')}</p>
          <h2>{t('privacy.dataTitle')}</h2>
          <p>{t('privacy.data')}</p>
          <h2>{t('privacy.purposesTitle')}</h2>
          <p>{t('privacy.purposes')}</p>
          <h2>{t('privacy.providersTitle')}</h2>
          <p>{t('privacy.providers')}</p>
          <h2>{t('privacy.retentionTitle')}</h2>
          <p>{t('privacy.retention')}</p>
          <h2>{t('privacy.rightsTitle')}</h2>
          <p>{t('privacy.rights')}</p>
          <h2>{t('privacy.securityTitle')}</h2>
          <p>{t('privacy.security')}</p>
          <p role="note">{t('privacy.pending')}</p>
          <button type="button" onClick={() => setPrivacyOpen(false)}>
            {t('privacy.back')}
          </button>
        </article>
      </main>
    );
  }

  if (authStatus === 'access') {
    return (
      <main className={`${styles.shell} ${styles.accessShell}`}>
        <section className={styles.accessHero} aria-labelledby="access-title">
          <img
            alt=""
            aria-hidden="true"
            className={styles.bird}
            src={stand}
          />
          <h1 className={styles.brandTitle} id="access-title">
            {t('access.title')}
          </h1>
          <p className={styles.subtitle}>{t('access.subtitle')}</p>
        </section>
        {messageKey && <p role="alert">{t(messageKey)}</p>}
        <section className={styles.accessPanel}>
          <div
            aria-label={t('access.language')}
            className={styles.languageGroup}
            role="group"
          >
            <button
              aria-pressed={locale === 'es'}
              onClick={() => selectLocale('es')}
            >
              {t('access.spanish')}
            </button>
            <button
              aria-pressed={locale === 'en'}
              onClick={() => selectLocale('en')}
            >
              {t('access.english')}
            </button>
          </div>
          <button disabled={busy} onClick={signIn}>
            {busy ? t('access.connecting') : t('access.continueWithGoogle')}
          </button>
          <p>
            <a
              href="#privacy"
              onClick={(event) => {
                event.preventDefault();
                setPrivacyOpen(true);
              }}
            >
              {t('access.privacy')}
            </a>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className={`${styles.shell} ${styles.authenticatedShell}`}>
      <header className={styles.topBar}>
        <div className={styles.brandMark}>
          <img alt="" aria-hidden="true" className={styles.birdSmall} src={stand} />
          <span>Chucao</span>
        </div>
        <div className={styles.languageGroup}>
          <button
            aria-pressed={locale === 'es'}
            onClick={() => selectLocale('es')}
          >
            {t('access.spanish')}
          </button>
          <button
            aria-pressed={locale === 'en'}
            onClick={() => selectLocale('en')}
          >
            {t('access.english')}
          </button>
        </div>
      </header>
      <div className={styles.authenticatedContent}>
        {messageKey && <p role="alert">{t(messageKey)}</p>}
        <p>{t('auth.signedInAs', { email: session?.user.email ?? '' })}</p>
        {preferenceSyncStatus === 'read_error' && (
          <p role="alert">
            {t('preference.readError')}{' '}
            <button onClick={() => void retryAccountLocale()}>
              {t('preference.retry')}
            </button>
          </p>
        )}
        {preferenceSyncStatus === 'write_error' && (
          <p role="alert">
            {t('preference.writeError')}{' '}
            <button onClick={() => void retryAccountLocale()}>
              {t('preference.retry')}
            </button>
          </p>
        )}
        {selectedList ? (
          <ListDetailView
            list={selectedList}
            onBack={() => setSelectedList(null)}
          />
        ) : (
          <MyListsView
            onOpenList={setSelectedList}
            userId={session!.user.id}
          />
        )}
      </div>
      <div className={styles.accountActions}>
        <a
          href="#privacy"
          onClick={(event) => {
            event.preventDefault();
            setPrivacyOpen(true);
          }}
        >
          {t('access.privacy')}
        </a>
        <button disabled={busy} onClick={signOut}>
          {t('auth.signOut')}
        </button>
      </div>
    </main>
  );
}
