import { ActionIcon, Alert, Button, Card, Group, Menu, Modal, NativeSelect, Stack, Text, TextInput, Title } from '@mantine/core';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ListCollection, ListRow, ListSort } from '../../lib/database.types';
import { archivePrivateList, createPrivateList, deletePrivateList, duplicatePrivateList, getListCollectionPage, getOwnedConceptCounts, listQueryKey, renamePrivateList, restorePrivateList } from './listService';
import { DomainServiceError } from '../shared/supabaseErrors';
import { ListNameForm } from './ListNameForm';
import styles from './lists.module.css';
import { queryClient } from '../../lib/queryClient';
import { useToast } from '../../app/toasts/useToast';

type MyListsViewProps = { userId: string; onOpenList: (list: ListRow) => void; onStartIndependentTimer: () => void };
type Feedback = { key: 'lists.duplicate' | 'lists.invalidName' | 'lists.limit' | 'lists.unavailable' | 'lists.unauthorized' | 'lists.sessionExpired' | 'lists.unresolved' } | null;
type Action = 'create' | 'rename' | 'duplicate' | 'archive' | 'delete' | null;
type MutationKind = Exclude<Action, 'create' | null> | 'restore';

function feedbackForError(error: DomainServiceError): NonNullable<Feedback> {
  switch (error.code) {
    case 'duplicate_name': return { key: 'lists.duplicate' };
    case 'invalid_name': return { key: 'lists.invalidName' };
    case 'list_limit': return { key: 'lists.limit' };
    case 'unauthorized': return { key: 'lists.unauthorized' };
    case 'unauthenticated': return { key: 'lists.sessionExpired' };
    default: return { key: 'lists.unavailable' };
  }
}

function newOperationId() {
  return globalThis.crypto.randomUUID();
}

export function MyListsView({ userId, onOpenList, onStartIndependentTimer }: MyListsViewProps) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [collection, setCollection] = useState<ListCollection>('active');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<ListSort>('name_asc');
  const [action, setAction] = useState<Action>(null);
  const [selected, setSelected] = useState<ListRow | null>(null);
  const [duplicateOperationId, setDuplicateOperationId] = useState(newOperationId);
  const listsQuery = useInfiniteQuery({
    queryKey: [...listQueryKey(userId), collection, search, sort],
    initialPageParam: null as import('./listService').ListPageCursor | null,
    queryFn: ({ pageParam }) => getListCollectionPage(userId, { collection, search, sort, pageSize: 50, cursor: pageParam }),
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
    placeholderData: (previousData) => previousData,
  });
  const lists = listsQuery.data?.pages.flatMap((page) => page.items).filter((list) => list.owner_id === userId) ?? [];
  const countsQuery = useListCounts(userId, lists.map((list) => list.id));
  const createMutation = useMutation({ mutationFn: createPrivateList });
  const actionMutation = useMutation({
    mutationFn: async ({ kind, list, name }: { kind: MutationKind; list: ListRow | null; name?: string }) => {
      if (!list) throw new Error('missing_list');
      if (kind === 'rename') return renamePrivateList(list.id, name ?? '');
      if (kind === 'duplicate') return duplicatePrivateList(list.id, name ?? '', duplicateOperationId);
      if (kind === 'archive') return archivePrivateList(list.id);
      if (kind === 'delete') return deletePrivateList(list.id);
      if (kind === 'restore') return restorePrivateList(list.id);
      return undefined;
    },
    onSuccess: async (_, variables) => {
      notify(t(variables.kind === 'archive' ? 'lists.archived' : variables.kind === 'restore' ? 'lists.restored' : variables.kind === 'duplicate' ? 'lists.duplicated' : variables.kind === 'rename' ? 'lists.renamed' : 'lists.deleted'));
      await queryClient.invalidateQueries({ queryKey: listQueryKey(userId) });
      setAction(null); setSelected(null); setFeedback(null); setDuplicateOperationId(newOperationId());
    },
    onError: (error) => {
      void queryClient.invalidateQueries({ queryKey: listQueryKey(userId) });
      setFeedback(error instanceof DomainServiceError ? feedbackForError(error) : { key: 'lists.unavailable' });
    },
  });
  const busy = createMutation.isPending || actionMutation.isPending;

  async function submitName(name: string) {
    setFeedback(null);
    try {
      if (action === 'create') {
        const result = await createMutation.mutateAsync(name);
        if (result.status === 'rejected') { setFeedback(feedbackForError(result.error)); return false; }
        if (result.status === 'unresolved') {
          void queryClient.invalidateQueries({ queryKey: listQueryKey(userId) });
          setFeedback({ key: 'lists.unresolved' });
          return false;
        }
        notify(t('lists.created')); await queryClient.invalidateQueries({ queryKey: listQueryKey(userId) }); setAction(null); return true;
      }
      if (!action) return false;
      await actionMutation.mutateAsync({ kind: action, list: selected, name });
      return true;
    } catch (error) {
      setFeedback(error instanceof DomainServiceError ? feedbackForError(error) : { key: 'lists.unavailable' });
      return false;
    }
  }

  async function runAction(kind: 'archive' | 'restore' | 'delete', list: ListRow) {
    setSelected(list); setFeedback(null);
    if (kind === 'restore') {
      try { await actionMutation.mutateAsync({ kind, list }); } catch (error) { setFeedback(error instanceof DomainServiceError ? feedbackForError(error) : { key: 'lists.unavailable' }); }
    } else setAction(kind);
  }

  if (listsQuery.isPending) return <section aria-busy="true" className={styles.view}><Text role="status">{t('lists.loading')}</Text></section>;
  if (listsQuery.isError) return <section className={styles.view}><Alert color="red" role="alert">{t('lists.unavailable')}</Alert><Button onClick={() => void listsQuery.refetch()}>{t('lists.retry')}</Button></section>;

  const isSearching = search.trim().length > 0;
  return (
    <section aria-labelledby="my-lists-title" className={styles.view}>
      <div className={styles.panel}>
        <header className={styles.header}><Title order={1} id="my-lists-title">{t('lists.title')}</Title><Text>{t('lists.privateContext')}</Text></header>
        <Group justify="center" role="group" aria-label={t('lists.collections')}>
          <Button className={styles.collectionButton} data-selected={collection === 'active'} variant="default" aria-pressed={collection === 'active'} onClick={() => setCollection('active')}>{t('lists.active')}</Button>
          <Button className={styles.collectionButton} data-selected={collection === 'archived'} variant="default" aria-pressed={collection === 'archived'} onClick={() => setCollection('archived')}>{t('lists.archivedCollection')}</Button>
        </Group>
        <div className={styles.collectionControls}>
          <TextInput type="search" label={t('lists.search')} aria-label={t('lists.search')} value={search} onChange={(event) => setSearch(event.currentTarget.value)} />
          <NativeSelect label={t('lists.order')} aria-label={t('lists.order')} value={sort} onChange={(event) => setSort(event.currentTarget.value as ListSort)} data={[
            { value: 'name_asc', label: t('lists.sortNameAsc') }, { value: 'name_desc', label: t('lists.sortNameDesc') },
            { value: 'created_newest', label: t('lists.sortCreatedNewest') }, { value: 'created_oldest', label: t('lists.sortCreatedOldest') }, { value: 'modified_newest', label: t('lists.sortModifiedNewest') },
          ]} />
        </div>
        <div aria-label={t('lists.region')} aria-busy={listsQuery.isFetchingNextPage} className={styles.listScroller} role="region" tabIndex={0}>
          {listsQuery.isFetching && !listsQuery.isFetchingNextPage && <Text role="status">{t('lists.updating')}</Text>}
          {lists.length === 0 ? <div className={styles.empty}><Text>{isSearching ? t('lists.noMatches') : collection === 'archived' ? t('lists.archivedEmpty') : t('lists.empty')}</Text></div> : (
            <div className={styles.listGrid}>{lists.map((list) => <div className={styles.listCardWrap} key={list.id}>
              <Card className={styles.listCard} component="button" onClick={() => onOpenList(list)} shadow="sm" type="button" withBorder>
                <span className={styles.cardName}>{list.name}</span>
                {list.archived_at && <span>{t('lists.archivedStatus')}</span>}
                <span className={styles.cardProgress}>{t('lists.practiceProgress', { practiced: countsQuery.data?.[list.id]?.practiced ?? 0, total: countsQuery.data?.[list.id]?.total ?? 0 })}</span>
              </Card>
              <div className={styles.listActionsOverlay}>
                <Menu withinPortal classNames={{ dropdown: styles.actionMenuDropdown }}><Menu.Target><ActionIcon className={styles.listActionsButton} variant="subtle" aria-label={t('lists.actionsFor', { name: list.name })} title={t('lists.actions')}>
                  <svg aria-hidden="true" viewBox="0 0 4 16" width="4" height="16" fill="currentColor"><circle cx="2" cy="2" r="1.5" /><circle cx="2" cy="8" r="1.5" /><circle cx="2" cy="14" r="1.5" /></svg>
                </ActionIcon></Menu.Target><Menu.Dropdown>
                  {collection === 'active' && <Menu.Item onClick={() => { setSelected(list); setAction('rename'); setFeedback(null); }}>{t('lists.rename')}</Menu.Item>}
                  <Menu.Item onClick={() => { setSelected(list); setAction('duplicate'); setDuplicateOperationId(newOperationId()); setFeedback(null); }}>{t('lists.duplicateAction')}</Menu.Item>
                  {collection === 'active' ? <Menu.Item onClick={() => void runAction('archive', list)}>{t('lists.archive')}</Menu.Item> : <Menu.Item onClick={() => void runAction('restore', list)}>{t('lists.restore')}</Menu.Item>}
                  <Menu.Item onClick={() => void runAction('delete', list)}>{t('lists.delete')}</Menu.Item>
                </Menu.Dropdown></Menu>
              </div>
            </div>)}</div>
          )}
        </div>
        {listsQuery.hasNextPage && <Button loading={listsQuery.isFetchingNextPage} onClick={() => void listsQuery.fetchNextPage()}>{t('lists.loadMore')}</Button>}
        {collection === 'active' && lists.length >= 100 && <Text c="dimmed">{t('lists.limit')}</Text>}
        {feedback && <Alert color="red" role="alert">{t(feedback.key)}{feedback.key === 'lists.limit' && <Text>{t('lists.freeSlot')}</Text>}</Alert>}
        {collection === 'active' && <Button className={styles.addListButton} onClick={() => { setSelected(null); setFeedback(null); setAction('create'); }} type="button">{t('lists.addButton')}</Button>}
        <Button className={styles.independentTimerButton} onClick={onStartIndependentTimer} type="button">{t('practice.independentEntry')}</Button>
      </div>

      <Modal centered opened={action !== null} onClose={() => { if (!busy) { setAction(null); setFeedback(null); } }} title={t(action === 'create' ? 'lists.addButton' : action === 'rename' ? 'lists.rename' : action === 'duplicate' ? 'lists.duplicateAction' : action === 'archive' ? 'lists.archiveConfirmTitle' : 'lists.deleteConfirmTitle')} classNames={{ content: styles.createModalContent, header: styles.createModalHeader, title: styles.createModalTitle, body: styles.createModalBody }} overlayProps={{ className: styles.createModalOverlay }}>
        {feedback && <Alert color="red" role="alert">{t(feedback.key)}</Alert>}
        {(action === 'create' || action === 'rename' || action === 'duplicate') && <ListNameForm key={`${action}:${selected?.id ?? ''}`} initialName={action === 'rename' ? selected?.name : ''} disabled={busy} onCancel={() => { setAction(null); setFeedback(null); }} onSubmit={submitName} />}
        {action === 'archive' && <Stack><Text>{t('lists.archiveDescription', { name: selected?.name })}</Text><Group className={styles.confirmActions} justify="center"><Button className={styles.dialogCancelButton} disabled={busy} onClick={() => setAction(null)}>{t('concepts.cancel')}</Button><Button className={styles.archiveConfirmButton} loading={busy} onClick={() => selected && void actionMutation.mutateAsync({ kind: 'archive', list: selected })}>{t('lists.archive')}</Button></Group></Stack>}
        {action === 'delete' && <Stack><Text>{t('lists.deleteDescription', { name: selected?.name })}</Text><Group className={styles.confirmActions} justify="center"><Button className={styles.dialogCancelButton} disabled={busy} onClick={() => setAction(null)}>{t('concepts.cancel')}</Button><Button className={styles.deleteConfirmButton} loading={busy} onClick={() => selected && void actionMutation.mutateAsync({ kind: 'delete', list: selected })}>{t('lists.confirmDelete')}</Button><Button className={styles.archiveInsteadButton} variant="default" onClick={() => selected && void runAction('archive', selected)}>{t('lists.archiveInstead')}</Button></Group></Stack>}
      </Modal>
    </section>
  );
}

function useListCounts(userId: string, listIds: string[]) {
  // Counts are fetched for the currently loaded bounded pages only.
  const query = useQuery({
    queryKey: [...listQueryKey(userId), 'concept-counts', listIds],
    queryFn: async () => getOwnedConceptCounts(userId, listIds),
    enabled: listIds.length > 0,
  });
  return { data: query.data ?? {} };
}
