import { Button } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PracticeNoteEditor } from '../practice/PracticeNoteEditor';
import type { PracticeHistoryItem } from './historyService';
import styles from './history.module.css';

type Props = {
  userId: string;
  practice: PracticeHistoryItem;
  onBack: () => void;
};

export function PracticeDetailView({ userId, practice, onBack }: Props) {
  const { t, i18n } = useTranslation();
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);

  return (
    <section aria-labelledby="practice-detail-title" className={styles.history}>
      <Button className={styles.detailBackButton} onClick={onBack} type="button" variant="default">
        {t('history.backToHistory')}
      </Button>
      <article className={styles.practiceDetail}>
        <h1 id="practice-detail-title">{t('history.practiceDetail')}</h1>
        <h2>{practice.independentLabel}</h2>
        <dl className={styles.practiceMetadata}>
          <div><dt>{t('history.date')}</dt><dd>{new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(practice.completedAt))}</dd></div>
          <div><dt>{t('history.durationLabel')}</dt><dd>{t('history.duration', { count: practice.durationMinutes })}</dd></div>
          <div><dt>{t('history.stateLabel')}</dt><dd>{t('history.completed')}</dd></div>
          <div><dt>{t('history.rating')}</dt><dd>{practice.rating === null ? t('history.unrated') : t('history.ratingValue', { value: practice.rating })}</dd></div>
        </dl>
        <p>{practice.hasNote ? t('history.hasNote') : t('history.noNote')}</p>
        {practice.hasNote && <Button className={styles.openNoteButton} onClick={() => setNoteEditorOpen(true)} type="button">{t('history.manageNote')}</Button>}
      </article>
      {noteEditorOpen && <PracticeNoteEditor userId={userId} practiceId={practice.id} onClose={() => setNoteEditorOpen(false)} />}
    </section>
  );
}
