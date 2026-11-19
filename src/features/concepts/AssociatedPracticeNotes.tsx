import { Alert, Button, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listPracticeHistory, type HistoryCursor } from '../history/historyService';
import { PracticeNoteEditor } from '../practice/PracticeNoteEditor';
import styles from './concepts.module.css';

type Props = { userId: string; listId: string; activeConceptIds?: string[]; conceptId?: string; deletedConcepts?: boolean; readOnly?: boolean };

export function AssociatedPracticeNotes({ userId, listId, activeConceptIds = [], conceptId, deletedConcepts = false, readOnly = false }: Props) {
  const { t, i18n } = useTranslation();
  const [cursor, setCursor] = useState<HistoryCursor | null>(null);
  const [selectedPracticeId, setSelectedPracticeId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['practice-history', userId, 'associated-notes', listId, conceptId ?? (deletedConcepts ? 'deleted' : 'all'), cursor],
    queryFn: () => listPracticeHistory({ listId, conceptId, kind: 'associated', cursor, pageSize: 50 }),
  });

  if (query.isPending) return <section className={styles.associatedNotes} aria-busy="true"><Text role="status">{t('practiceNote.listLoading')}</Text></section>;
  if (query.isError) return <section className={styles.associatedNotes}><Alert role="alert" color="red">{t('practiceNote.listError')}</Alert><Button onClick={() => void query.refetch()}>{t('practiceNote.retry')}</Button></section>;

  const entries = query.data.items.filter((item) => item.hasNote
    && (conceptId ? item.conceptId === conceptId : deletedConcepts
      ? item.conceptId === null || !activeConceptIds.includes(item.conceptId)
      : true));
  return (
    <section aria-labelledby="associated-practice-notes-title" className={styles.associatedNotes}>
      <h2 id="associated-practice-notes-title">{t(deletedConcepts ? 'practiceNote.deletedConceptsTitle' : 'practiceNote.listTitle')}</h2>
      {deletedConcepts && <Text>{t('practiceNote.deletedConceptsDescription')}</Text>}
      {entries.length === 0 ? <Text>{t(deletedConcepts ? 'practiceNote.deletedConceptsEmpty' : conceptId ? 'practiceNote.conceptEmpty' : 'practiceNote.listEmpty')}</Text> : <ul>
        {entries.map((item) => {
          return <li key={item.id}>
            <div className={styles.associatedNoteInfo}>
              <Text fw={700}>{item.titleSnapshot ?? t('history.deletedTitle')}</Text>
              {deletedConcepts && <Text className={styles.associatedNoteDeleted}>{t('history.conceptDeleted')}</Text>}
              <Text>{new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(item.completedAt))}</Text>
            </div>
            {!readOnly && <Button className={styles.manageNoteButton} onClick={() => setSelectedPracticeId(item.id)}>{t('practiceNote.manage')}</Button>}
          </li>;
        })}
      </ul>}
      {query.data.hasMore && <Button variant="default" onClick={() => setCursor(query.data.nextCursor)}>{t('history.more')}</Button>}
      {!readOnly && selectedPracticeId && <PracticeNoteEditor userId={userId} practiceId={selectedPracticeId} onClose={() => setSelectedPracticeId(null)} />}
    </section>
  );
}
