import { Alert, Button, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './rounds.module.css';

type Props = {
  pendingCount: number;
  seenCount: number;
  isLoading: boolean;
  loadingError: string | null;
  actionError: string | null;
  actionStatus: string | null;
  busy: boolean;
  unresolved: boolean;
  onRetryLoad: () => void;
  onRetryAction: () => void;
  children?: ReactNode;
};

export function RoundProgressPanel({
  pendingCount,
  seenCount,
  isLoading,
  loadingError,
  actionError,
  actionStatus,
  busy,
  unresolved,
  onRetryLoad,
  onRetryAction,
  children,
}: Props) {
  const { t } = useTranslation();
  const total = pendingCount + seenCount;
  const progressLabel = t('rounds.progressLabel', {
    seen: seenCount,
    pending: pendingCount,
  });

  return (
    <section
      aria-busy={isLoading || busy}
      aria-labelledby="round-progress-title"
      className={styles.roundPanel}
    >
      <Title className={styles.roundTitle} id="round-progress-title" order={2}>
        {t('rounds.title')}
      </Title>

      {isLoading ? (
        <Text role="status">{t('rounds.loading')}</Text>
      ) : loadingError ? (
        <Alert color="red" role="alert">
          <Text>{loadingError}</Text>
          <Button className={styles.roundRetryButton} onClick={onRetryLoad} type="button">
            {t('rounds.retryLoad')}
          </Button>
        </Alert>
      ) : (
        <>
          <progress
            aria-label={progressLabel}
            className={styles.roundProgress}
            max={total || 1}
            value={seenCount}
          />
          <Text aria-live="polite" className={styles.roundCounts}>
            {progressLabel}
          </Text>
          {total === 0 ? (
            <Text className={styles.roundNotice}>{t('rounds.empty')}</Text>
          ) : pendingCount === 0 ? (
            <Text className={styles.roundNotice}>{t('rounds.exhausted')}</Text>
          ) : null}
        </>
      )}

      {children}
      {busy && <Text role="status">{t('rounds.processing')}</Text>}
      {actionStatus && <Text role="status">{actionStatus}</Text>}
      {actionError && (
        <Alert color="red" role="alert">
          <Text>{actionError}</Text>
          {unresolved && (
            <Button
              className={styles.roundRetryButton}
              disabled={busy}
              onClick={onRetryAction}
              type="button"
            >
              {t('rounds.retryAction')}
            </Button>
          )}
        </Alert>
      )}
    </section>
  );
}
