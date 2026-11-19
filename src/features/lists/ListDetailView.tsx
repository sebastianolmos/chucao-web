import type { ListRow } from '../../lib/database.types';
import { Alert, Button, Text } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { queryClient } from '../../lib/queryClient';
import { listQueryKey, restorePrivateList } from './listService';
import { DomainServiceError } from '../shared/supabaseErrors';
import { ConceptManagementView } from '../concepts/ConceptManagementView';
import styles from './lists.module.css';

export type RoundActionRequest = {
  id: number;
  listId: string;
  action: 'draw' | 'new_round';
};

type ListDetailViewProps = {
  userId: string;
  list: ListRow;
  onBack: () => void;
  onStartPractice: (conceptId: string, roundId?: string | null, appearanceId?: string | null) => void;
  pendingRoundAction?: RoundActionRequest | null;
  onRoundActionRequestHandled?: (requestId: number) => void;
};

export function ListDetailView({ userId, list, onBack, onStartPractice, pendingRoundAction, onRoundActionRequestHandled }: ListDetailViewProps) {
  const { t } = useTranslation();
  const [archived, setArchived] = useState(Boolean(list.archived_at));
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  async function restore() {
    setRestoring(true);
    setRestoreError(null);
    try {
      await restorePrivateList(list.id);
      await queryClient.invalidateQueries({ queryKey: listQueryKey(userId) });
      setArchived(false);
    } catch (error) {
      setRestoreError(error instanceof DomainServiceError && error.code === 'list_limit' ? 'lists.freeSlot' : 'lists.unavailable');
    } finally {
      setRestoring(false);
    }
  }
  const displayedList = archived ? list : { ...list, archived_at: null };
  return (
    <>
    {archived && <div className={styles.detailRestore}>
      <Text role="status">{t('lists.archivedStatus')}</Text>
      {restoreError && <Alert color="red" role="alert">{t(restoreError)}</Alert>}
      <Button loading={restoring} disabled={restoring} onClick={() => void restore()}>{t('lists.restore')}</Button>
    </div>}
    <ConceptManagementView
      userId={userId}
      list={displayedList}
      onBack={onBack}
      onStartPractice={onStartPractice}
      pendingRoundAction={pendingRoundAction}
      onRoundActionRequestHandled={onRoundActionRequestHandled}
      archived={archived}
    />
    </>
  );
}
