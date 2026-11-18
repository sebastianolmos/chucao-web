import { Alert, Button, Group, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { BatchReview } from './conceptParser';
import styles from './concepts.module.css';

type Props = { review: BatchReview; busy: boolean; error: string | null; summary: number | null; onConfirm: () => void; onCancel: () => void };

export function ConceptBatchReview({ review, busy, error, summary, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();
  const ready = review.status === 'ready';
  return (
    <section aria-labelledby="batch-review-title" aria-busy={busy} className={styles.modalContent}>
      <Stack gap="md">
        <Title order={2} id="batch-review-title">{t('concepts.reviewTitle')}</Title>
        {error && <Alert color="red" role="alert">{t(error)}</Alert>}
        {review.status === 'rejected' && <Alert color="yellow" role="alert">{review.limitViolations.map((violation) => t(`concepts.${violation === 'line_limit' ? 'batchLineLimit' : 'batchCharacterLimit'}`)).join(' ')}</Alert>}
        <div>
          <Text fw={700}>{t('concepts.accepted', { count: ready ? review.accepted.length : 0 })}</Text>
          {ready && review.accepted.length > 0 ? <ol className={styles.reviewList}>{review.accepted.map((item) => <li key={item.sourceIndex}><Text fw={600}>{item.title}</Text>{item.description && <Text>{item.description}</Text>}<Text size="xs" c="dimmed">{t('concepts.sourceLine', { line: item.sourceIndex + 1 })}</Text></li>)}</ol> : <Text>{t('concepts.noneAccepted')}</Text>}
        </div>
        <div>
          <Text fw={700}>{t('concepts.omitted', { count: ready ? review.omitted.length : 0 })}</Text>
          {ready && review.omitted.length > 0 ? <ol className={styles.reviewList}>{review.omitted.map((item) => <li key={item.sourceIndex}><Text>{item.rawLine || t('concepts.emptyLine')}</Text><Text size="sm">{t(`concepts.reason.${item.reasonCode}`)}</Text><Text size="xs" c="dimmed">{t('concepts.sourceLine', { line: item.sourceIndex + 1 })}</Text></li>)}</ol> : <Text>{t('concepts.noneOmitted')}</Text>}
        </div>
        <Group className={styles.modalActions} justify="center">
          <Button className={styles.modalPrimaryButton} onClick={onConfirm} loading={busy} disabled={busy || summary !== null || !ready || review.accepted.length === 0}>{summary !== null ? t('concepts.batchConfirmed') : t('concepts.confirmBatch')}</Button>
          <Button className={styles.modalSecondaryButton} disabled={busy} onClick={onCancel}>{summary !== null ? t('concepts.done') : t('concepts.editBatch')}</Button>
        </Group>
        {busy && <Text role="status">{t('concepts.processing')}</Text>}
      </Stack>
    </section>
  );
}
