import {
  Alert,
  Button,
  Card,
  Modal,
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
} from './listService';
import { DomainServiceError } from '../shared/supabaseErrors';
import { ListNameForm } from './ListNameForm';
import styles from './lists.module.css';
import { queryClient } from '../../lib/queryClient';
import { useToast } from '../../app/toasts/useToast';

type MyListsViewProps = {
  userId: string;
  onOpenList: (list: ListRow) => void;
};

type Feedback =
  | {
      key:
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
      return { key: 'lists.duplicate' };
    case 'list_limit':
      return { key: 'lists.limit' };
    case 'unauthorized':
      return { key: 'lists.unauthorized' };
    case 'unauthenticated':
      return { key: 'lists.sessionExpired' };
    default:
      return { key: 'lists.unavailable' };
  }
}

export function MyListsView({ userId, onOpenList }: MyListsViewProps) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const listsQuery = useQuery({
    queryKey: listQueryKey(userId),
    queryFn: () => getOwnedLists(userId),
  });
  const listIds = listsQuery.data?.map((list) => list.id) ?? [];
  const conceptCountsQuery = useQuery({
    queryKey: [...listQueryKey(userId), 'concept-counts', listIds],
    queryFn: () => getOwnedConceptCounts(userId, listIds),
    enabled: listsQuery.isSuccess,
  });
  const createMutation = useMutation({
    mutationFn: createPrivateList,
    onSuccess: async (result) => {
      if (result.status === 'created' || result.status === 'reconciled') {
        notify(t('lists.created'));
        await queryClient.invalidateQueries({
          queryKey: listQueryKey(userId),
        });
      } else {
        setFeedback(result.status === 'rejected'
          ? feedbackForError(result.error)
          : { key: 'lists.unresolved' });
      }
    },
    onError: (error) => {
      setFeedback(
        error instanceof DomainServiceError
          ? feedbackForError(error)
          : { key: 'lists.unavailable' },
      );
    },
  });

  async function submitListName(rawName: string): Promise<boolean> {
    setFeedback(null);
    const result = await createMutation.mutateAsync(rawName);
    const created = result.status === 'created' || result.status === 'reconciled';
    if (created) setCreateOpen(false);
    return created;
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
      : { key: 'lists.unavailable' as const };

    return (
      <section className={styles.view}>
        <Alert color="red" role="alert">{t(queryFeedback.key)}</Alert>
        <Button onClick={() => void listsQuery.refetch()}>
          {t('lists.retry')}
        </Button>
      </section>
    );
  }

  const lists = listsQuery.data;

  return (
    <section aria-labelledby="my-lists-title" className={styles.view}>
      <div className={styles.panel}>
        <header className={styles.header}>
          <Title order={1} id="my-lists-title">
            {t('lists.title')}
          </Title>
          <Text>{t('lists.privateContext')}</Text>
        </header>

        <div
          aria-label={t('lists.region')}
          className={styles.listScroller}
          role="region"
          tabIndex={0}
        >
          {lists.length === 0 ? (
            <div className={styles.empty}><Text>{t('lists.empty')}</Text></div>
          ) : (
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
                  <span className={styles.cardProgress}>
                    {t('lists.practiceProgress', {
                      practiced: conceptCountsQuery.data?.[list.id]?.practiced ?? 0,
                      total: conceptCountsQuery.data?.[list.id]?.total ?? 0,
                    })}
                  </span>
                </Card>
              ))}
            </div>
          )}
        </div>

        {lists.length >= 100 && <Text c="dimmed">{t('lists.limit')}</Text>}

        <Button
          className={styles.addListButton}
          onClick={() => {
            setFeedback(null);
            setCreateOpen(true);
          }}
          type="button"
        >
          {t('lists.addButton')}
        </Button>
      </div>

      <Modal
        centered
        opened={createOpen}
        onClose={() => {
          if (!createMutation.isPending) {
            setFeedback(null);
            setCreateOpen(false);
          }
        }}
        title={t('lists.addButton')}
        classNames={{
          content: styles.createModalContent,
          header: styles.createModalHeader,
          title: styles.createModalTitle,
          body: styles.createModalBody,
        }}
        overlayProps={{ className: styles.createModalOverlay }}
      >
        {feedback && <Alert color="red" role="alert">{t(feedback.key)}</Alert>}
        <ListNameForm
          disabled={createMutation.isPending}
          onCancel={() => {
            setFeedback(null);
            setCreateOpen(false);
          }}
          onSubmit={submitListName}
        />
      </Modal>
    </section>
  );
}
