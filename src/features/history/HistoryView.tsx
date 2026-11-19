import { useState } from 'react';
import { Button, Tabs } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listPracticeHistory, listRoundHistory, type PracticeHistoryFilters, type PracticeHistoryItem } from './historyService';
import styles from './history.module.css';
import { getOwnedLists } from '../lists/listService';
import { getOwnedConcepts } from '../concepts/conceptService';
import { PracticeDetailView } from './PracticeDetailView';

export function HistoryView({ userId }: { userId: string }) {
  return <HistoryContent key={userId} userId={userId} />;
}

function HistoryContent({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<string | null>('practices');
  const [filters, setFilters] = useState<PracticeHistoryFilters>({});
  const [selectedPractice, setSelectedPractice] = useState<PracticeHistoryItem | null>(null);
  const listsQuery = useQuery({ queryKey: ['lists', userId], queryFn: () => getOwnedLists(userId) });
  const conceptsQuery = useQuery({ queryKey: ['concepts', userId, filters.listId], queryFn: () => getOwnedConcepts(userId, filters.listId!), enabled: Boolean(filters.listId) });
  const practiceQuery = useQuery({ queryKey: ['practice-history', userId, filters, i18n.language], queryFn: () => listPracticeHistory(filters) });
  const roundsQuery = useQuery({ queryKey: ['round-history', userId, 'all'], queryFn: () => listRoundHistory() });
  const change = (key: keyof PracticeHistoryFilters, value: string) => setFilters((current) => ({ ...current, [key]: value || null, cursor: null }));

  if (selectedPractice) {
    return <PracticeDetailView userId={userId} practice={selectedPractice} onBack={() => setSelectedPractice(null)} />;
  }

  return <section className={styles.history} aria-labelledby="history-title">
    <h1 id="history-title">{t('history.title')}</h1>
    <Tabs value={tab} onChange={setTab} aria-label={t('history.tabs')}>
      <Tabs.List><Tabs.Tab value="practices">{t('history.practices')}</Tabs.Tab><Tabs.Tab value="rounds">{t('history.rounds')}</Tabs.Tab></Tabs.List>
      <Tabs.Panel value="practices" pt="md">
        <div className={styles.filters}>
          <label>{t('history.from')}<input type="date" value={filters.startDate ?? ''} onChange={(e) => change('startDate', e.target.value)} /></label>
          <label>{t('history.to')}<input type="date" value={filters.endDate ?? ''} onChange={(e) => change('endDate', e.target.value)} /></label>
          <label>{t('history.labelFilter')}<input value={filters.independentLabel ?? ''} onChange={(e) => change('independentLabel', e.target.value)} /></label>
          <label>{t('history.list')}<select value={filters.listId ?? ''} onChange={(e) => { change('listId', e.target.value); setFilters((current) => ({ ...current, conceptId: null })); }}><option value="">{t('history.all')}</option>{listsQuery.data?.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select></label>
          <label>{t('history.concept')}<select disabled={!filters.listId} value={filters.conceptId ?? ''} onChange={(e) => change('conceptId', e.target.value)}><option value="">{t('history.all')}</option>{conceptsQuery.data?.map((concept) => <option key={concept.id} value={concept.id}>{concept.title}</option>)}</select></label>
          <label>{t('history.type')}<select value={filters.kind ?? ''} onChange={(e) => change('kind', e.target.value)}><option value="">{t('history.all')}</option><option value="associated">{t('history.associated')}</option><option value="independent">{t('history.independent')}</option></select></label>
          <label>{t('history.rating')}<select value={filters.ratingState ?? ''} onChange={(e) => change('ratingState', e.target.value)}><option value="">{t('history.all')}</option><option value="rated">{t('history.rated')}</option><option value="unrated">{t('history.unrated')}</option></select></label>
          <Button onClick={() => setFilters({})}>{t('history.reset')}</Button>
        </div>
        {practiceQuery.isPending ? <p role="status">{t('history.loading')}</p> : practiceQuery.isError ? <p role="alert">{t('history.error')} <button onClick={() => void practiceQuery.refetch()}>{t('history.retry')}</button></p> : practiceQuery.data.items.length === 0 ? <p>{t('history.empty')}</p> : <>
          <ul className={styles.entries}>{practiceQuery.data.items.map((item) => <li key={item.id}>
            <h2>{item.kind === 'independent' ? item.independentLabel : item.titleSnapshot ?? t('history.deletedTitle')}</h2>
            <p>{item.listName && <>{item.listName} · </>}{new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.completedAt))}</p>
            <p>{t('history.completed')} · {t('history.duration', { count: item.durationMinutes })} · {item.rating === null ? t('history.unrated') : t('history.ratingValue', { value: item.rating })} · {item.hasNote ? t('history.hasNote') : t('history.noNote')}</p>
            {item.kind === 'independent' && item.hasNote && <Button className={styles.openNoteButton} onClick={() => setSelectedPractice(item)}>{t('history.openNote', { label: item.independentLabel })}</Button>}
          </li>)}</ul>
          {practiceQuery.data.hasMore && <Button onClick={() => setFilters((current) => ({ ...current, cursor: practiceQuery.data.nextCursor }))}>{t('history.more')}</Button>}
        </>}
      </Tabs.Panel>
      <Tabs.Panel value="rounds" pt="md">
        {roundsQuery.isPending ? <p role="status">{t('history.loading')}</p> : roundsQuery.isError ? <p role="alert">{t('history.error')} <button onClick={() => void roundsQuery.refetch()}>{t('history.retry')}</button></p> : roundsQuery.data.items.length === 0 ? <p>{t('history.empty')}</p> : <ul className={styles.entries}>{roundsQuery.data.items.map((round) => <li key={round.id}><h2>{round.listName}</h2><p>{t(round.status === 'open' ? 'history.open' : 'history.closed')} · {new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(round.openedAt))}</p><ol>{round.appearances.map((appearance) => <li key={appearance.id}>{appearance.titleSnapshot ?? t('history.deletedTitle')} {appearance.conceptDeleted && <strong>{t('history.conceptDeleted')}</strong>} · {t(appearance.origin === 'draw' ? 'history.drawn' : 'history.manual')}</li>)}</ol></li>)}</ul>}
      </Tabs.Panel>
    </Tabs>
  </section>;
}
