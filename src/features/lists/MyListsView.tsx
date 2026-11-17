import {
  Alert,
  Button,
  Card,
  Group,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ListRow } from '../../lib/database.types';
import {
  createPrivateList,
  getOwnedConceptCounts,
  getOwnedLists,
  listQueryKey,
  type CreatePrivateListResult,
} from './listService';
import { DomainServiceError } from '../shared/supabaseErrors';
import { ListNameForm } from './ListNameForm';
import styles from './lists.module.css';
import { queryClient } from '../../lib/queryClient';

type MyListsViewProps = {
  userId: string;
  onOpenList: (list: ListRow) => void;
};

type Feedback =
  | {
      kind: 'success' | 'error';
      key:
        | 'lists.created'
        | 'lists.duplicate'
        | 'lists.limit'
        | 'lists.unavailable'
        | 'lists.unauthorized'
        | 'lists.sessionExpired'
        | 'lists.unresolved';
    }
  | null;

type FeedbackMessage = Exclude<Feedback, null>;

function feedbackForError(error: DomainServiceError): FeedbackMessage {
  switch (error.code) {
    case 'duplicate_name':
      return { kind: 'error', key: 'lists.duplicate' };
    case 'list_limit':
      return { kind: 'error', key: 'lists.limit' };
    case 'unauthorized':
      return { kind: 'error', key: 'lists.unauthorized' };
    case 'unauthenticated':
      return { kind: 'error', key: 'lists.sessionExpired' };
    default:
      return { kind: 'error', key: 'lists.unavailable' };
  }
}

function feedbackForResult(result: CreatePrivateListResult): Feedback {
  if (result.status === 'created' || result.status === 'reconciled') {
    return { kind: 'success', key: 'lists.created' };
  }

  if (result.status === 'rejected') {
    return feedbackForError(result.error);
  }

  return { kind: 'error', key: 'lists.unresolved' };
}

export function MyListsView({ userId, onOpenList }: MyListsViewProps) {
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const listsQuery = useQuery({
    queryKey: listQueryKey(userId),
    queryFn: async () => {
      const lists = await getOwnedLists(userId);
      const conceptCounts = await getOwnedConceptCounts(userId, lists.map((list) => list.id));
      return { lists, conceptCounts };
    },
  });
  const createMutation = useMutation({
    mutationFn: createPrivateList,
    onSuccess: async (result) => {
      setFeedback(feedbackForResult(result));

      if (result.status === 'created' || result.status === 'reconciled') {
        await queryClient.invalidateQueries({
          queryKey: listQueryKey(userId),
        });
      }
    },
    onError: (error) => {
      setFeedback(
        error instanceof DomainServiceError
          ? feedbackForError(error)
          : { kind: 'error', key: 'lists.unavailable' },
      );
    },
  });

  async function submitListName(rawName: string): Promise<boolean> {
    setFeedback(null);
    const result = await createMutation.mutateAsync(rawName);
    return result.status === 'created' || result.status === 'reconciled';
  }

  if (listsQuery.isPending) {
    return (
      <section aria-busy="true" className={styles.view}>
        <Text role="status">{t('lists.loading')}</Text>
      </section>
    );
  }

  if (listsQuery.isError) {
    const queryFeedback = listsQuery.error instanceof DomainServiceError
      ? feedbackForError(listsQuery.error)
      : { kind: 'error' as const, key: 'lists.unavailable' as const };

    return (
      <section className={styles.view}>
        <Alert color="red" role="alert">{t(queryFeedback.key)}</Alert>
        <Button onClick={() => void listsQuery.refetch()}>
          {t('lists.retry')}
        </Button>
      </section>
    );
  }

  const { lists, conceptCounts } = listsQuery.data;

  return (
    <section aria-labelledby="my-lists-title" className={styles.view}>
      <header className={styles.header}>
        <Title order={1} id="my-lists-title">
          {t('lists.title')}
        </Title>
        <Text>{t('lists.privateContext')}</Text>
      </header>

      {feedback && (
        <Alert
          color={feedback.kind === 'success' ? 'green' : 'red'}
          role={feedback.kind === 'success' ? 'status' : 'alert'}
        >
          {t(feedback.key)}
        </Alert>
      )}

      <ListNameForm
        disabled={createMutation.isPending}
        onSubmit={submitListName}
      />

      {lists.length === 0 ? (
        <div className={styles.empty}>
          <Text>{t('lists.empty')}</Text>
        </div>
      ) : (
        <Stack gap="sm">
          <Group justify="space-between">
            <Text>{t('lists.count', { count: lists.length })}</Text>
            {lists.length >= 100 && (
              <Text c="dimmed">{t('lists.limit')}</Text>
            )}
          </Group>
          <div className={styles.listGrid}>
            {lists.map((list) => (
              <Card
                className={styles.listCard}
                component="button"
                key={list.id}
                onClick={() => onOpenList(list)}
                shadow="sm"
                type="button"
                withBorder
              >
                <span className={styles.cardName}>{list.name}</span>
                <span className={styles.cardDetail}>
                  {conceptCounts[list.id]
                    ? t('lists.practiceProgress', { practiced: 0, total: conceptCounts[list.id] })
                    : t('lists.emptyDetail')}
                </span>
              </Card>
            ))}
          </div>
        </Stack>
      )}
    </section>
  );
}
