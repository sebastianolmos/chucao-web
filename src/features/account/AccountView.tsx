import { useState } from 'react';
import { Button, Modal } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import styles from './account.module.css';

export type AccountViewProps = {
  user: { email?: string; user_metadata?: Record<string, unknown> };
  deletionPending: boolean;
  unconfirmed?: boolean;
  busy?: boolean;
  onBack?: () => void;
  onDelete: () => Promise<'pending' | 'completed'>;
  onSignOut: () => void;
};

function displayName(user: AccountViewProps['user']): string | null {
  const name = user.user_metadata?.full_name ?? user.user_metadata?.name;
  return typeof name === 'string' && name.trim() ? name : null;
}

export default function AccountView({
  user,
  deletionPending,
  unconfirmed: initialUnconfirmed = false,
  busy = false,
  onBack,
  onDelete,
  onSignOut,
}: AccountViewProps) {
  const { t } = useTranslation();
  const [pendingAfterRequest, setPendingAfterRequest] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [requestBusy, setRequestBusy] = useState(false);
  const [localUnconfirmed, setLocalUnconfirmed] = useState(false);
  const [completed, setCompleted] = useState(false);
  const pending = deletionPending || pendingAfterRequest;
  const unconfirmed = initialUnconfirmed || localUnconfirmed;
  const isBusy = busy || requestBusy;

  async function submitDeletion() {
    setRequestBusy(true);
    setLocalUnconfirmed(false);
    try {
      const result = await onDelete();
      setConfirmOpen(false);
      if (result === 'completed') {
        setPendingAfterRequest(false);
        setCompleted(true);
      } else {
        setPendingAfterRequest(true);
      }
    } catch {
      setConfirmOpen(false);
      setPendingAfterRequest(deletionPending);
      setLocalUnconfirmed(true);
    } finally {
      setRequestBusy(false);
    }
  }

  return (
    <article aria-labelledby="account-title" className={styles.accountView}>
      <h1 id="account-title">
        {pending ? t('account.pendingTitle') : t('account.title')}
      </h1>
      {unconfirmed && <p className={styles.error} role="alert">{t('account.unconfirmed')}</p>}

      {completed ? (
        <p className={styles.status} role="status">{t('account.completed')}</p>
      ) : pending ? (
        <>
          <p className={styles.status} role="status">{t('account.pending')}</p>
          <Button
            disabled={isBusy}
            onClick={() => void submitDeletion()}
            styles={{ root: { backgroundColor: 'var(--chucao-lilac)', border: '2px solid var(--chucao-brown)', boxShadow: '3px 4px 0 var(--chucao-brown)', color: 'var(--chucao-brown)' } }}
            type="button"
          >
            {isBusy ? t('account.working') : t('account.retry')}
          </Button>
        </>
      ) : (
        <>
          <p>{t('account.intro')}</p>
          <section aria-label={t('account.identity')} className={styles.identity}>
            {displayName(user) && <p className={styles.name}>{displayName(user)}</p>}
            {user.email && <p>{user.email}</p>}
            <p>{t('account.googleIdentity')}</p>
          </section>
          <p>{t('account.dataEffects')}</p>
          <p className={styles.providerNote} role="note">{t('account.googleBoundary')}</p>
          <div className={styles.actions}>
            {unconfirmed && (
              <Button
                disabled={isBusy}
                onClick={() => void submitDeletion()}
                styles={{ root: { backgroundColor: 'var(--chucao-lilac)', border: '2px solid var(--chucao-brown)', boxShadow: '3px 4px 0 var(--chucao-brown)', color: 'var(--chucao-brown)' } }}
                type="button"
              >
                {isBusy ? t('account.working') : t('account.retry')}
              </Button>
            )}
            {onBack && (
              <Button
                disabled={isBusy}
                onClick={onBack}
                styles={{ root: { backgroundColor: 'var(--chucao-cream)', border: '2px solid var(--chucao-brown)', boxShadow: '3px 4px 0 var(--chucao-brown)', color: 'var(--chucao-brown)' } }}
                type="button"
              >
                {t('account.backToPreferences')}
              </Button>
            )}
            <Button
              disabled={isBusy}
              onClick={() => setConfirmOpen(true)}
              styles={{ root: { backgroundColor: 'var(--chucao-pink)', border: '2px solid var(--chucao-brown)', boxShadow: '3px 4px 0 var(--chucao-brown)', color: 'var(--chucao-brown)' } }}
              type="button"
            >
              {t('account.delete')}
            </Button>
            <Button
              className={styles.signOutButton}
              disabled={isBusy}
              onClick={onSignOut}
              type="button"
            >
              {t('auth.signOut')}
            </Button>
          </div>
        </>
      )}

      {pending && (
        <Button className={styles.signOutButton} disabled={isBusy} onClick={onSignOut} type="button">
          {t('auth.signOut')}
        </Button>
      )}

      {!pending && !completed && (
        <Modal
          centered
          closeOnClickOutside={false}
          onClose={() => setConfirmOpen(false)}
          opened={confirmOpen}
          transitionProps={{ duration: 0 }}
          title={t('account.confirmTitle')}
          styles={{
            close: { backgroundColor: 'var(--chucao-cyan)', color: 'var(--chucao-brown)' },
            header: { backgroundColor: 'var(--chucao-navbar)', color: 'var(--chucao-brown)' },
            body: { backgroundColor: 'var(--chucao-cream)', color: 'var(--chucao-brown)' },
            content: { border: '2px solid var(--chucao-brown)', borderRadius: '1rem', backgroundColor: 'var(--chucao-cream)', boxShadow: '4px 5px 0 var(--chucao-brown)' },
            title: { color: 'var(--chucao-brown)', fontWeight: 700 },
          }}
        >
          <div className={styles.confirmation}>
            <p>{t('account.confirmDescription')}</p>
            <p role="note">{t('account.googleBoundary')}</p>
            <div className={styles.actions}>
              <Button
                disabled={isBusy}
                onClick={() => setConfirmOpen(false)}
                styles={{ root: { backgroundColor: 'var(--chucao-cream)', border: '2px solid var(--chucao-brown)', boxShadow: '3px 4px 0 var(--chucao-brown)', color: 'var(--chucao-brown)' } }}
                type="button"
              >
                {t('account.cancel')}
              </Button>
              <Button
                disabled={isBusy}
                onClick={() => void submitDeletion()}
                styles={{ root: { backgroundColor: 'var(--chucao-pink)', border: '2px solid var(--chucao-brown)', boxShadow: '3px 4px 0 var(--chucao-brown)', color: 'var(--chucao-brown)' } }}
                type="button"
              >
                {isBusy ? t('account.working') : t('account.confirmDelete')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

    </article>
  );
}
