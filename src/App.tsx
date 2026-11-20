import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Button, Modal } from '@mantine/core';
import {
  DEFAULT_TIMER_PREFERENCES,
  ensureProfile,
  getTimerPreferences,
  type TimerPreferences,
} from './features/preferences/preferencesService';
import { TimerPreferencesPanel } from './features/preferences/TimerPreferencesPanel';
import { useLocale } from './app/localeContext';
import { MyListsView } from './features/lists/MyListsView';
import { queryClient } from './lib/queryClient';
import { supabase } from './lib/supabase';
import { useTranslation } from 'react-i18next';
import type { ActiveConceptRow, ListRow } from './lib/database.types';
import { ListDetailView, type RoundActionRequest } from './features/lists/ListDetailView';
import { getOwnedLists } from './features/lists/listService';
import { getOwnedConcepts } from './features/concepts/conceptService';
import { DomainServiceError } from './features/shared/supabaseErrors';
import { PracticeView } from './features/practice/PracticeView';
import { PracticeClosureView, type PracticeCompletion } from './features/practice/PracticeClosureView';
import type { PracticePostSaveActions, PracticeRoundAction } from './features/practice/PracticeClosureView';
import { loadCurrentRound } from './features/rounds/roundService';
import { HistoryView } from './features/history/HistoryView';
import { AboutView } from './features/about/AboutView';
import { getAccountDeletionStatus, retryAccountDeletion } from './features/account/accountService';
import AccountView from './features/account/AccountView';
import type { TimerSnapshot } from './features/practice/timerModel';
import stand from './assets/stand.png';
import styles from './app/app.module.css';

type AuthStatus =
  | 'checking_session'
  | 'session_error'
  | 'access'
  | 'initializing_profile'
  | 'profile_error'
  | 'deletion_pending'
  | 'authenticated';

type MessageKey =
  | 'auth.oauthError'
  | 'auth.signInError'
  | 'auth.signOutError'
  | 'auth.sessionError'
  | 'auth.profileError'
  | 'auth.deletionStatusError'
  | 'auth.deletionRetryError';

type PracticeSession = {
  returnDestination: 'lists' | 'detail';
  preferences: TimerPreferences;
  listId: string | null;
  conceptId: string | null;
  roundId: string | null;
  appearanceId: string | null;
  concept?: Pick<ActiveConceptRow, 'title' | 'description'>;
};

type AppDestination = 'lists' | 'detail' | 'history' | 'about' | 'privacy' | 'credits' | 'account' | 'signOut';

function readOAuthError() {
  const url = new URL(window.location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  return url.searchParams.has('error') || fragment.has('error')
    ? true
    : false;
}

function clearPrivateState() {
  queryClient.removeQueries({ queryKey: ['lists'] });
  queryClient.removeQueries({ queryKey: ['concepts'] });
  queryClient.removeQueries({ queryKey: ['profile'] });
  queryClient.removeQueries({ queryKey: ['practice'] });
  queryClient.removeQueries({ queryKey: ['practice-history'] });
  queryClient.removeQueries({ queryKey: ['round-history'] });
}

function PrivacyContent({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();

  return (
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
      <p>
        {t('privacy.rightsIntro')}{' '}
        <a href={`mailto:${t('privacy.contactEmail')}`}>{t('privacy.contactEmail')}</a>
        {t('privacy.rightsOutro')}
      </p>
      <h2>{t('privacy.securityTitle')}</h2>
      <p>{t('privacy.security')}</p>
      <p role="note">{t('privacy.pending')}</p>
      <button type="button" onClick={onBack}>{t('privacy.back')}</button>
    </article>
  );
}

function CreditsContent({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();

  return (
    <article aria-labelledby="credits-title">
      <h1 id="credits-title">{t('timerPreferences.creditsTitle')}</h1>
      <p>{t('timerPreferences.projectCredit')}</p>
      <p>
        {t('timerPreferences.fontCredit')}{' '}
        <a href="https://openfontlicense.org/open-font-license-official-text/" rel="noreferrer" target="_blank">
          {t('timerPreferences.fontLicenseLink')}
        </a>.
      </p>
      <p>
        {t('timerPreferences.soundCredit')}{' '}
        <a href="https://xeno-canto.org/870902" rel="noreferrer" target="_blank">XC870902, xeno-canto</a>{' '}
        {t('timerPreferences.underLicense')}{' '}
        <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" rel="noreferrer" target="_blank">CC BY-NC-SA 4.0</a>.
      </p>
      <p>{t('timerPreferences.audioModifications')}</p>
      <p>{t('timerPreferences.audioLicense')}</p>
      <button type="button" onClick={onBack}>{t('privacy.back')}</button>
    </article>
  );
}

function AppFooter() {
  const { t } = useTranslation();
  return <footer className={styles.footer}>{t('app.developedBy', { name: 'Sebastian Olmos' })}</footer>;
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
  const [aboutOpen, setAboutOpen] = useState(false);
  const [guestTimerOpen, setGuestTimerOpen] = useState(false);
  const [accessAboutOpen, setAccessAboutOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [selectedList, setSelectedList] = useState<ListRow | null>(null);
  const [practiceSession, setPracticeSession] = useState<PracticeSession | null>(null);
  const [practiceCompletion, setPracticeCompletion] = useState<PracticeCompletion | null>(null);
  const [closureOpen, setClosureOpen] = useState(false);
  const [practiceSaveLocked, setPracticeSaveLocked] = useState(false);
  const [postSaveActions, setPostSaveActions] = useState<PracticePostSaveActions | null>(null);
  const [pendingRoundAction, setPendingRoundAction] = useState<RoundActionRequest | null>(null);
  const [practiceStatus, setPracticeStatus] = useState<TimerSnapshot['status']>('prepared');
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceEntryError, setPracticeEntryError] = useState(false);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [pendingDestination, setPendingDestination] = useState<AppDestination | null>(null);
  const [messageKey, setMessageKey] = useState<MessageKey | null>(() =>
    readOAuthError() ? 'auth.oauthError' : null,
  );
  const currentUserIdRef = useRef<string | null>(null);
  const syncRequestRef = useRef(0);
  const mountedRef = useRef(true);
  const oauthReconciliationRef = useRef(false);
  const practiceEntryRequestRef = useRef(0);
  const postSaveRequestRef = useRef(0);
  const roundActionRequestRef = useRef(0);

  const clearSessionPrivateState = useCallback(() => {
    practiceEntryRequestRef.current += 1;
    postSaveRequestRef.current += 1;
    setPracticeSession(null);
    setPracticeCompletion(null);
    setClosureOpen(false);
    setPracticeSaveLocked(false);
    setPostSaveActions(null);
    setPendingRoundAction(null);
    setPracticeStatus('prepared');
    setPracticeLoading(false);
    setPracticeEntryError(false);
    setAbandonOpen(false);
    setPendingDestination(null);
    setSelectedList(null);
    setAccountOpen(false);
    clearPrivateState();
  }, []);

  useEffect(() => {
    document.title = t(
      authStatus !== 'authenticated'
        ? accessAboutOpen ? 'app.aboutTitle' : guestTimerOpen ? 'app.practiceTitle' : 'app.title'
          : accountOpen
            ? 'app.accountTitle'
            : aboutOpen
          ? 'app.aboutTitle'
          : selectedList
            ? practiceSession
              ? 'app.practiceTitle'
              : 'app.listTitle'
            : practiceSession
            ? 'app.practiceTitle'
            : 'app.authenticatedTitle',
    );
  }, [aboutOpen, accessAboutOpen, accountOpen, authStatus, guestTimerOpen, practiceSession, selectedList, t]);

  const synchronizeSession = useCallback(async (nextSession: Session | null) => {
    const requestId = syncRequestRef.current + 1;
    syncRequestRef.current = requestId;
    const nextUserId = nextSession?.user.id ?? null;
    const previousUserId = currentUserIdRef.current;

    if (previousUserId !== nextUserId) {
      setGuestTimerOpen(false);
      setAccessAboutOpen(false);
      setAboutOpen(false);
      setAccountOpen(false);
      practiceEntryRequestRef.current += 1;
      setPracticeSession(null);
      setPracticeCompletion(null);
      setClosureOpen(false);
      setPracticeSaveLocked(false);
      setPostSaveActions(null);
      setPendingRoundAction(null);
      postSaveRequestRef.current += 1;
      setPracticeStatus('prepared');
      setPracticeLoading(false);
      setPracticeEntryError(false);
      setAbandonOpen(false);
      clearPrivateState();
      setSelectedList(null);
    }

    currentUserIdRef.current = nextUserId;
    setBusy(false);
    setSession(nextSession);
    setMessageKey(null);

    if (!nextSession) {
      clearSessionPrivateState();
      clearAccountLocale();
      setAuthStatus('access');
      return;
    }

    setAuthStatus('initializing_profile');

    let deletionStatus: Awaited<ReturnType<typeof getAccountDeletionStatus>>;
    try {
      deletionStatus = await getAccountDeletionStatus();
    } catch {
      if (!mountedRef.current || syncRequestRef.current !== requestId) return;
      clearSessionPrivateState();
      setAuthStatus('profile_error');
      setMessageKey('auth.deletionStatusError');
      return;
    }

    if (!mountedRef.current || syncRequestRef.current !== requestId) return;

    if (deletionStatus === 'deletion_pending') {
      clearSessionPrivateState();
      setAuthStatus('deletion_pending');
      return;
    }

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
  }, [clearAccountLocale, clearSessionPrivateState, syncAccountLocale]);

  const refreshSession = useCallback(async () => {
    setAuthStatus('checking_session');
    setMessageKey(null);

    const { data, error } = await supabase.auth.getSession();

    if (error) {
      practiceEntryRequestRef.current += 1;
      setPracticeSession(null);
      setPracticeStatus('prepared');
      setSession(null);
      setAuthStatus('session_error');
      setMessageKey('auth.sessionError');
      return;
    }

    await synchronizeSession(data.session);
  }, [synchronizeSession]);

  const onPracticeStatusChange = useCallback((status: TimerSnapshot['status']) => {
    setPracticeStatus(status);
  }, []);

  async function startPractice(
    listId?: string,
    conceptId?: string,
    roundId: string | null = null,
    appearanceId: string | null = null,
    preferencesSnapshot?: TimerPreferences,
  ) {
    const userId = currentUserIdRef.current;
    if (!userId || practiceLoading) return;
    const requestId = practiceEntryRequestRef.current + 1;
    practiceEntryRequestRef.current = requestId;
    setPracticeEntryError(false);
    setPracticeLoading(true);

    try {
      let associatedConcept: PracticeSession['concept'];
      let freshList: ListRow | undefined;
      if (listId && conceptId) {
        const ownedLists = await getOwnedLists(userId);
        freshList = ownedLists.find((item) => item.id === listId && item.owner_id === userId);
        if (!freshList) throw new Error('practice_context_unavailable');
        const concepts = await getOwnedConcepts(userId, listId);
        const freshConcept = concepts.find((item) => item.id === conceptId);
        if (!freshConcept) throw new Error('practice_context_unavailable');
        associatedConcept = {
          title: freshConcept.title,
          description: freshConcept.description,
        };
      }

      let preferences = preferencesSnapshot ?? DEFAULT_TIMER_PREFERENCES;
      if (!preferencesSnapshot) {
        try {
          preferences = await getTimerPreferences(userId);
        } catch (error) {
          if (error instanceof DomainServiceError
            && (error.code === 'unauthenticated' || error.code === 'unauthorized')) {
            throw error;
          }
          // The timer remains usable with the effective defaults when preferences cannot load.
        }
      }

      if (practiceEntryRequestRef.current !== requestId || currentUserIdRef.current !== userId) return;
      if (freshList) setSelectedList(freshList);
      setPracticeStatus('prepared');
      setPracticeSession({
        returnDestination: associatedConcept ? 'detail' : 'lists',
        preferences,
        listId: associatedConcept ? listId! : null,
        conceptId: associatedConcept ? conceptId! : null,
        roundId: associatedConcept ? roundId : null,
        appearanceId: associatedConcept ? appearanceId : null,
        ...(associatedConcept ? { concept: associatedConcept } : {}),
      });
      setPracticeCompletion(null);
      setClosureOpen(false);
      setPostSaveActions(null);
    } catch (error) {
      if (practiceEntryRequestRef.current !== requestId || currentUserIdRef.current !== userId) return;
      if (error instanceof DomainServiceError && error.code === 'unauthenticated') {
        await refreshSession();
        if (practiceEntryRequestRef.current === requestId && currentUserIdRef.current === userId) {
          setPracticeEntryError(true);
        }
        return;
      }
      setPracticeEntryError(true);
    } finally {
      if (practiceEntryRequestRef.current === requestId) setPracticeLoading(false);
    }
  }

  function executeDestination(destination: AppDestination) {
    practiceEntryRequestRef.current += 1;
    setPracticeSession(null);
    setPracticeCompletion(null);
    setClosureOpen(false);
    setPracticeSaveLocked(false);
    setPostSaveActions(null);
    setPendingRoundAction(null);
    postSaveRequestRef.current += 1;
    setPracticeStatus('prepared');
    setPracticeLoading(false);
    setPracticeEntryError(false);
    setAbandonOpen(false);
    setPendingDestination(null);
    setPreferencesOpen(false);
    setPrivacyOpen(destination === 'privacy');
    setAboutOpen(destination === 'about');
    setAccountOpen(destination === 'account');
    setCreditsOpen(destination === 'credits');
    setHistoryOpen(destination === 'history');
    if (destination === 'lists') setSelectedList(null);
    if (destination === 'signOut') {
      setSelectedList(null);
      void signOut();
    }
  }

  function requestDestination(destination: AppDestination) {
    if (practiceSaveLocked) return;
    if (practiceSession && (practiceStatus === 'running' || practiceStatus === 'paused')) {
      setPendingDestination(destination);
      setAbandonOpen(true);
      return;
    }
    executeDestination(destination);
  }

  function requestPracticeReturn() {
    requestDestination(practiceSession?.returnDestination ?? 'lists');
  }

  async function refreshPostSaveActions() {
    const savedSession = practiceSession;
    const userId = currentUserIdRef.current;
    if (!userId || !savedSession?.listId || !savedSession.conceptId) return;
    const requestId = postSaveRequestRef.current + 1;
    postSaveRequestRef.current = requestId;
    setPostSaveActions({ status: 'loading' });
    try {
      const [lists, concepts, round] = await Promise.all([
        getOwnedLists(userId),
        getOwnedConcepts(userId, savedSession.listId),
        loadCurrentRound(savedSession.listId),
      ]);
      if (postSaveRequestRef.current !== requestId || currentUserIdRef.current !== userId) return;
      const freshList = lists.find((list) => list.id === savedSession.listId && list.owner_id === userId);
      if (!freshList || round.list_id !== freshList.id) throw new Error('practice_context_unavailable');
      setSelectedList(freshList);
      const pendingCount = concepts.filter((concept) => concept.state === 'pending').length;
      setPostSaveActions({
        status: 'ready',
        repeatAvailable: concepts.some((concept) => concept.id === savedSession.conceptId),
        roundAction: pendingCount > 0 ? 'draw' : concepts.length > 0 ? 'new_round' : null,
      });
    } catch {
      if (postSaveRequestRef.current === requestId && currentUserIdRef.current === userId) {
        setPostSaveActions({ status: 'error' });
      }
    }
  }

  function repeatPracticeFromClosure() {
    const current = practiceSession;
    if (!current) return;
    void startPractice(
      current.listId ?? undefined,
      current.conceptId ?? undefined,
      current.roundId,
      current.appearanceId,
      current.preferences,
    );
  }

  function activatePostSaveRoundAction(action: PracticeRoundAction) {
    const listId = practiceSession?.listId;
    if (!listId) return;
    const request: RoundActionRequest = {
      id: roundActionRequestRef.current + 1,
      listId,
      action,
    };
    roundActionRequestRef.current = request.id;
    executeDestination('detail');
    setPendingRoundAction(request);
  }

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

      clearSessionPrivateState();
      currentUserIdRef.current = null;
      setCreditsOpen(false);
      setPreferencesOpen(false);
      setPrivacyOpen(false);
      setSession(null);
      setAuthStatus('access');
    } catch {
      setMessageKey('auth.signOutError');
    } finally {
      setBusy(false);
    }
  }

  async function handleAccountDeletion(): Promise<'pending' | 'completed'> {
    if (busy) throw new Error('account_deletion_busy');
    setBusy(true);
    setMessageKey(null);
    clearSessionPrivateState();
    setAuthStatus('deletion_pending');

    try {
      const result = await retryAccountDeletion();
      if (result.status === 'pending') {
        setAuthStatus('deletion_pending');
        return 'pending';
      }

      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;

      currentUserIdRef.current = null;
      clearAccountLocale();
      setCreditsOpen(false);
      setPreferencesOpen(false);
      setPrivacyOpen(false);
      setSession(null);
      setAuthStatus('access');
      return 'completed';
    } catch (error) {
      const deletionStatus = await getAccountDeletionStatus().catch(() => null);
      if (deletionStatus === 'active') {
        setAuthStatus('authenticated');
        setAccountOpen(true);
        setMessageKey('auth.deletionRetryError');
      } else if (deletionStatus === 'deletion_pending') {
        clearSessionPrivateState();
        setAuthStatus('deletion_pending');
        setMessageKey('auth.deletionRetryError');
      } else {
        clearSessionPrivateState();
        setAuthStatus('profile_error');
        setMessageKey('auth.deletionStatusError');
      }
      throw error;
    } finally {
      setBusy(false);
    }
  }

  if (authStatus === 'deletion_pending') {
    return (
      <main className={styles.shell}>
        {session && <AccountView
          busy={busy}
          deletionPending
          unconfirmed={messageKey === 'auth.deletionRetryError'}
          onDelete={handleAccountDeletion}
          onSignOut={() => void signOut()}
          user={session.user}
        />}
        <AppFooter />
      </main>
    );
  }

  if (authStatus === 'checking_session') {
    return (
      <main className={styles.shell}>
        <p role="status">{t('auth.checkingSession')}</p>
        <AppFooter />
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
        <AppFooter />
      </main>
    );
  }

  if (authStatus === 'initializing_profile') {
    return (
      <main className={styles.shell}>
        <p role="status">{t('auth.preparingPrivateSpace')}</p>
        <AppFooter />
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
        <AppFooter />
      </main>
    );
  }

  if (privacyOpen && authStatus === 'access') {
    return (
      <main className={`${styles.shell} ${styles.privacy}`}>
        <PrivacyContent onBack={() => setPrivacyOpen(false)} />
        <AppFooter />
      </main>
    );
  }

  if (accessAboutOpen && authStatus === 'access') {
    return (
      <main className={`${styles.shell} ${styles.privacy}`}>
        <AboutView onBack={() => setAccessAboutOpen(false)} showSignInStep />
        <AppFooter />
      </main>
    );
  }

  if (guestTimerOpen && authStatus === 'access') {
    return (
      <main className={`${styles.shell} ${styles.privacy}`}>
        <div className={styles.authenticatedContent}>
          <p>{t('practice.guestPreview')}</p>
          <PracticeView
            initialDurationMinutes={DEFAULT_TIMER_PREFERENCES.defaultDurationMinutes}
            onReturn={() => setGuestTimerOpen(false)}
            returnLabel={t('access.backToAccess')}
            showTitle={false}
            reducedMotion={DEFAULT_TIMER_PREFERENCES.reducedMotion}
            soundEnabled={DEFAULT_TIMER_PREFERENCES.completionSoundEnabled}
            soundVolume={DEFAULT_TIMER_PREFERENCES.soundVolume}
          />
        </div>
        <AppFooter />
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
          <button className={styles.accessGoogleButton} disabled={busy} onClick={signIn}>
            {busy ? t('access.connecting') : t('access.continueWithGoogle')}
          </button>
          <div className={styles.accessSecondaryActions}>
            <button onClick={() => setAccessAboutOpen(true)} type="button">{t('access.aboutButton')}</button>
            <button onClick={() => setGuestTimerOpen(true)} type="button">{t('access.timerPreview')}</button>
          </div>
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
        <AppFooter />
      </main>
    );
  }

  return (
    <main className={`${styles.shell} ${styles.authenticatedShell}`}>
      <header className={styles.topBar}>
        <button
          aria-label={t('navigation.goToLists')}
          className={styles.brandLink}
          disabled={practiceSaveLocked}
          onClick={() => {
            requestDestination('lists');
          }}
          type="button"
        >
          <img alt="" aria-hidden="true" className={styles.birdSmall} src={stand} />
          <span>Chucao</span>
        </button>
        <nav aria-label={t('navigation.label')} className={styles.navActions}>
          <button type="button" onClick={() => requestDestination(aboutOpen ? 'lists' : 'about')}>
            {aboutOpen ? t('navigation.goToLists') : t('about.navTitle')}
          </button>
          <button type="button" onClick={() => requestDestination(historyOpen ? 'lists' : 'history')}>{historyOpen ? t('navigation.goToLists') : t('navigation.history')}</button>
          <button
            aria-label={t('navigation.changeLanguage')}
            className={`${styles.localeToggle} ${locale === 'es' ? styles.localeEnglish : styles.localeSpanish}`}
            onClick={() => selectLocale(locale === 'es' ? 'en' : 'es')}
            type="button"
          >
            {locale === 'es' ? 'En' : 'Es'}
          </button>
          <button
            aria-label={t('preferences.open')}
            className={styles.preferencesButton}
            onClick={() => setPreferencesOpen(true)}
            type="button"
          >
            <span aria-hidden="true">⚙</span>
          </button>
        </nav>
      </header>
      <div className={styles.authenticatedContent}>
        {messageKey && !accountOpen && <p role="alert">{t(messageKey)}</p>}
        {practiceEntryError && (
          <div className={styles.practiceRecovery} role="alert">
            <p>{t('practice.contextUnavailable')}</p>
            <Button className={styles.practiceRecoveryButton} onClick={() => executeDestination('lists')} type="button">
              {t('practice.returnToLists')}
            </Button>
          </div>
        )}
        {practiceLoading && <p role="status">{t('practice.contextLoading')}</p>}
        {accountOpen ? (
          <AccountView
            busy={busy}
            deletionPending={false}
            unconfirmed={messageKey === 'auth.deletionRetryError'}
            onBack={() => {
              setAccountOpen(false);
              setPreferencesOpen(true);
            }}
            onDelete={handleAccountDeletion}
            onSignOut={() => void signOut()}
            user={session!.user}
          />
        ) : aboutOpen ? (
          <AboutView onBack={() => requestDestination('lists')} detailed />
        ) : practiceSession ? practiceCompletion && closureOpen ? (
          <PracticeClosureView
            completion={practiceCompletion}
            context={practiceSession.concept ? {
              ownerId: session!.user.id,
              kind: 'associated',
              listId: practiceSession.listId!,
              conceptId: practiceSession.conceptId!,
              roundId: practiceSession.roundId,
              appearanceId: practiceSession.appearanceId,
              conceptTitle: practiceSession.concept.title,
            } : {
              ownerId: session!.user.id,
              kind: 'independent',
              listId: null,
              conceptId: null,
              roundId: null,
              appearanceId: null,
            }}
            onReturn={requestPracticeReturn}
            onSaveLockChange={setPracticeSaveLocked}
            postSaveActions={postSaveActions ?? undefined}
            onSaveConfirmed={practiceSession.concept ? () => { void refreshPostSaveActions(); } : undefined}
            onRetryPostSaveActions={() => { void refreshPostSaveActions(); }}
            onRepeat={repeatPracticeFromClosure}
            onRoundAction={activatePostSaveRoundAction}
          />
        ) : (
          <PracticeView
            concept={practiceSession.concept}
            initialDurationMinutes={practiceSession.preferences.defaultDurationMinutes}
            onCompleted={(completion) => {
              if (currentUserIdRef.current === session?.user.id) setPracticeCompletion(completion);
            }}
            onContinueToClosure={() => setClosureOpen(true)}
            onReturn={requestPracticeReturn}
            onStatusChange={onPracticeStatusChange}
            reducedMotion={practiceSession.preferences.reducedMotion}
            soundEnabled={practiceSession.preferences.completionSoundEnabled}
            soundVolume={practiceSession.preferences.soundVolume}
          />
        ) : historyOpen ? (
          <HistoryView userId={session!.user.id} />
        ) : privacyOpen ? (
          <div className={styles.privacy}>
            <PrivacyContent onBack={() => {
              setPrivacyOpen(false);
              setPreferencesOpen(true);
            }} />
          </div>
        ) : creditsOpen ? (
          <div className={styles.privacy}>
            <CreditsContent onBack={() => {
              setCreditsOpen(false);
              setPreferencesOpen(true);
            }} />
          </div>
        ) : selectedList ? (
          <ListDetailView
            list={selectedList}
            userId={session!.user.id}
            pendingRoundAction={pendingRoundAction}
            onRoundActionRequestHandled={(requestId) => {
              setPendingRoundAction((current) => current?.id === requestId ? null : current);
            }}
            onBack={() => setSelectedList(null)}
            onStartPractice={(conceptId, roundId, appearanceId) => void startPractice(selectedList.id, conceptId, roundId, appearanceId)}
          />
        ) : (
          <MyListsView
            onOpenList={setSelectedList}
            onStartIndependentTimer={() => void startPractice()}
            userId={session!.user.id}
          />
        )}
      </div>
      <Modal
        centered
        closeOnClickOutside={false}
        closeOnEscape={false}
        onClose={() => {
          setAbandonOpen(false);
          setPendingDestination(null);
        }}
        opened={abandonOpen}
        transitionProps={{ duration: 0 }}
        title={t('practice.leaveTitle')}
        styles={{
          header: { backgroundColor: 'var(--chucao-navbar)', color: 'var(--chucao-brown)' },
          body: { backgroundColor: 'var(--chucao-cream)', color: 'var(--chucao-brown)' },
          content: { border: '2px solid var(--chucao-brown)', borderRadius: '1rem', backgroundColor: 'var(--chucao-cream)', boxShadow: '4px 5px 0 var(--chucao-brown)' },
          title: { color: 'var(--chucao-brown)', fontWeight: 700 },
        }}
      >
        <p>{t('practice.leaveMessage')}</p>
        <div className={styles.practiceDialogActions}>
          <Button onClick={() => {
            setAbandonOpen(false);
            setPendingDestination(null);
          }} className={styles.stayPracticeButton} type="button">
            {t('practice.stay')}
          </Button>
          <Button onClick={() => {
            if (pendingDestination) executeDestination(pendingDestination);
          }} className={styles.abandonPracticeButton} type="button">
            {t('practice.abandon')}
          </Button>
        </div>
      </Modal>
      <Modal
        aria-label={t('preferences.title')}
        centered
        onClose={() => setPreferencesOpen(false)}
        opened={preferencesOpen}
        styles={{
          close: {
            backgroundColor: 'var(--chucao-cyan)',
            color: 'var(--chucao-brown)',
          },
          header: {
            position: 'relative',
            flex: '0 0 auto',
            backgroundColor: 'var(--chucao-navbar)',
          },
          body: {
            flex: '1 1 auto',
            minHeight: 0,
            maxHeight: 'calc(100dvh - 7rem)',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            backgroundColor: 'var(--chucao-cream)',
            color: 'var(--chucao-brown)',
          },
          content: {
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 'calc(100dvh - 2rem)',
            overflow: 'hidden',
            border: '2px solid var(--chucao-brown)',
            borderRadius: '1rem',
            backgroundColor: 'var(--chucao-cream)',
            boxShadow: '5px 6px 0 var(--chucao-brown)',
          },
          title: {
            position: 'absolute',
            left: '50%',
            maxWidth: 'calc(100% - 5rem)',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            fontSize: '1.5rem',
            fontWeight: 700,
          },
        }}
        title={t('preferences.title')}
      >
        <div className={styles.preferencesContent}>
          <p>{t('auth.signedInAs', { email: session?.user.email ?? '' })}</p>
          {preferencesOpen && session && (
            <TimerPreferencesPanel key={session.user.id} userId={session.user.id} />
          )}
          {messageKey === 'auth.signOutError' && (
            <p role="alert">{t('auth.signOutError')}</p>
          )}
          {preferenceSyncStatus === 'read_error' && (
            <p role="alert">
              {t('preference.readError')}{' '}
              <button onClick={() => void retryAccountLocale()} type="button">
                {t('preference.retry')}
              </button>
            </p>
          )}
          {preferenceSyncStatus === 'write_error' && (
            <p role="alert">
              {t('preference.writeError')}{' '}
              <button onClick={() => void retryAccountLocale()} type="button">
                {t('preference.retry')}
              </button>
            </p>
          )}
          <div className={styles.preferencesLinks}>
            <Button
              disabled={busy}
              onClick={() => {
                requestDestination('account');
              }}
              styles={{ root: { backgroundColor: 'var(--chucao-orange)', border: '2px solid var(--chucao-brown)', boxShadow: '3px 4px 0 var(--chucao-brown)', color: 'var(--chucao-brown)' } }}
              variant="default"
            >
              {t('account.title')}
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                requestDestination('privacy');
              }}
              styles={{ root: { backgroundColor: 'var(--chucao-yellow)', border: '2px solid var(--chucao-brown)', boxShadow: '3px 4px 0 var(--chucao-brown)', color: 'var(--chucao-brown)' } }}
              variant="default"
            >
              {t('preferences.privacy')}
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                requestDestination('credits');
              }}
              styles={{ root: { backgroundColor: 'var(--chucao-lilac)', border: '2px solid var(--chucao-brown)', boxShadow: '3px 4px 0 var(--chucao-brown)', color: 'var(--chucao-brown)' } }}
              variant="default"
            >
              {t('timerPreferences.creditsTitle')}
            </Button>
          </div>
          <Button className={styles.signOutButton} color="red" disabled={busy} onClick={() => requestDestination('signOut')}>
            {t('auth.signOut')}
          </Button>
        </div>
      </Modal>
      <AppFooter />
    </main>
  );
}
