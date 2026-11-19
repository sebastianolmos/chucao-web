import { Alert, Button, Checkbox, Modal, Text, Title } from '@mantine/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActiveConceptRow, ListRow } from '../../lib/database.types';
import type { RoundActionRequest } from '../lists/ListDetailView';
import type { RoundCommandResult } from '../rounds/roundService';
import {
  drawPendingConcept,
  loadCurrentRound,
  markConceptSeen,
  returnConceptToPending,
  retryUnresolvedRoundOperation,
  roundQueryKey,
  startNewRound,
} from '../rounds/roundService';
import { RoundProgressPanel } from '../rounds/RoundProgressPanel';
import { DrawResultModal } from '../rounds/DrawResultModal';
import roundStyles from '../rounds/rounds.module.css';
import { queryClient } from '../../lib/queryClient';
import { listQueryKey } from '../lists/listService';
import { DomainServiceError } from '../shared/supabaseErrors';
import { createConcept, createConceptBatch, conceptQueryKey, deleteConcept, getOwnedConcepts } from './conceptService';
import { parseConceptBatch, type BatchReview } from './conceptParser';
import { ConceptEntryForm, type EntryMode } from './ConceptEntryForm';
import { ConceptBatchReview } from './ConceptBatchReview';
import { ConceptDetailView } from './ConceptDetailView';
import styles from './concepts.module.css';
import { useToast } from '../../app/toasts/useToast';
import { AssociatedPracticeNotes } from './AssociatedPracticeNotes';

type Props = {
  userId: string;
  list: ListRow;
  onBack: () => void;
  onStartPractice: (conceptId: string, roundId?: string | null, appearanceId?: string | null) => void;
  pendingRoundAction?: RoundActionRequest | null;
  onRoundActionRequestHandled?: (requestId: number) => void;
  archived?: boolean;
};

type StudyFilter = 'all' | 'pending' | 'practiced';
type BulkAction = 'delete' | 'mark_seen' | 'return_pending';
type BulkOutcome = 'completed' | 'failed' | 'changed';
type BulkItemResult = { id: string; title: string; outcome: BulkOutcome };
const BULK_TOAST_DURATION_MS = 10_000;

function matchesStudyFilter(concept: ActiveConceptRow, filter: StudyFilter): boolean {
  return filter === 'all'
    || (filter === 'pending' ? concept.state === 'pending' : concept.state === 'seen');
}

function errorKey(error: unknown): string {
  if (!(error instanceof DomainServiceError)) return 'concepts.unavailable';
  switch (error.code) {
    case 'concept_title_invalid': return 'concepts.titleInvalid';
    case 'concept_description_invalid': return 'concepts.descriptionInvalid';
    case 'concept_duplicate': return 'concepts.duplicate';
    case 'batch_limit_exceeded': return 'concepts.batchTooLarge';
    case 'unauthenticated': return 'concepts.sessionExpired';
    case 'unauthorized': return 'concepts.unauthorized';
    case 'unresolved': return 'concepts.unresolved';
    default: return 'concepts.unavailable';
  }
}

function roundErrorKey(error: unknown, context: 'load' | 'action' = 'action'): string {
  if (!(error instanceof DomainServiceError)) return 'rounds.unavailable';
  switch (error.code) {
    case 'unauthenticated': return 'rounds.sessionExpired';
    case 'unauthorized': return 'rounds.unauthorized';
    case 'unresolved': return 'rounds.unresolved';
    case 'round_action_rejected': return 'rounds.actionRejected';
    case 'unavailable':
    case 'unknown': return context === 'load' ? 'rounds.unavailable' : 'rounds.actionUnavailable';
    default: return context === 'load' ? 'rounds.unavailable' : 'rounds.actionUnavailable';
  }
}

export function ConceptManagementView({ userId, list, onBack, onStartPractice, pendingRoundAction, onRoundActionRequestHandled, archived = false }: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<EntryMode>('individual');
  const [review, setReview] = useState<BatchReview | null>(null);
  const [rawInput, setRawInput] = useState('');
  const [batchError, setBatchError] = useState<string | null>(null);
  const [summary, setSummary] = useState<number | null>(null);
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [showDeletedConceptNotes, setShowDeletedConceptNotes] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [studyFilter, setStudyFilter] = useState<StudyFilter>('all');
  const [selectedConceptIds, setSelectedConceptIds] = useState<string[]>([]);
  const [selectionCleared, setSelectionCleared] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [deleteSelection, setDeleteSelection] = useState<string[] | null>(null);
  const { notify } = useToast();
  const key = conceptQueryKey(userId, list.id);
  const conceptsQuery = useQuery({ queryKey: key, queryFn: () => getOwnedConcepts(userId, list.id) });
  const roundKey = roundQueryKey(userId, list.id);
  const roundQuery = useQuery({
    queryKey: roundKey,
    queryFn: () => loadCurrentRound(list.id),
    enabled: !archived,
  });
  const [roundActionError, setRoundActionError] = useState<string | null>(null);
  const [roundActionStatus, setRoundActionStatus] = useState<string | null>(null);
  const [roundOperationUnresolved, setRoundOperationUnresolved] = useState(false);
  const [newRoundOpen, setNewRoundOpen] = useState(false);
  const [drawResult, setDrawResult] = useState<{ conceptId: string; title: string; appearanceOrder: number; roundId: string; appearanceId: string | null } | null>(null);
  const roundFlowBusyRef = useRef(false);
  const handledPostSaveActionRef = useRef<number | null>(null);

  function handleRoundResult(result: RoundCommandResult) {
    if (result.status === 'confirmed') {
      setRoundOperationUnresolved(false);
      setRoundActionError(null);
      setRoundActionStatus('rounds.actionSaved');
    } else if (result.status === 'rejected') {
      setRoundOperationUnresolved(false);
      setRoundActionStatus(null);
      setRoundActionError(roundErrorKey(result.error));
    } else {
      setRoundOperationUnresolved(true);
      setRoundActionStatus(null);
      setRoundActionError('rounds.unresolved');
    }
  }

  const roundActionMutation = useMutation({
    mutationFn: ({ action, conceptId }: { action: 'mark_seen' | 'return_pending'; conceptId: string }) =>
      action === 'mark_seen'
        ? markConceptSeen(list.id, conceptId)
        : returnConceptToPending(list.id, conceptId),
    onMutate: () => {
      setRoundActionError(null);
      setRoundActionStatus(null);
    },
    onSuccess: handleRoundResult,
    onError: (error) => {
      setRoundOperationUnresolved(true);
      setRoundActionStatus(null);
      setRoundActionError(roundErrorKey(error));
    },
  });
  const roundRetryMutation = useMutation({
    mutationFn: () => retryUnresolvedRoundOperation(list.id),
    onSuccess: handleRoundFlowResult,
    onError: (error) => {
      setRoundOperationUnresolved(true);
      setRoundActionStatus(null);
      setRoundActionError(roundErrorKey(error));
    },
    onSettled: () => { roundFlowBusyRef.current = false; },
  });
  const roundFlowMutation = useMutation({
    mutationFn: (action: 'draw' | 'new_round') => action === 'draw'
      ? drawPendingConcept(list.id)
      : startNewRound(list.id),
    onMutate: () => {
      setRoundActionError(null);
      setRoundActionStatus(null);
    },
    onSuccess: handleRoundFlowResult,
    onError: (error) => {
      setRoundOperationUnresolved(true);
      setRoundActionStatus(null);
      setRoundActionError(roundErrorKey(error));
    },
    onSettled: () => { roundFlowBusyRef.current = false; },
  });
  const roundActionsBusy = roundActionMutation.isPending
    || roundRetryMutation.isPending
    || roundFlowMutation.isPending;

  function handleRoundFlowResult(result: RoundCommandResult) {
    handleRoundResult(result);
    if (result.status !== 'confirmed') return;

    if (result.result.action === 'draw') {
      if (result.result.outcome === 'applied'
        && result.result.concept_id !== null
        && result.result.title !== null
        && result.result.appearance_order !== null) {
        setDrawResult({
          conceptId: result.result.concept_id,
          title: result.result.title,
          appearanceOrder: result.result.appearance_order,
          roundId: result.result.round_id,
          appearanceId: result.result.appearance_id,
        });
      } else if (result.result.outcome === 'exhausted') {
        setRoundActionStatus('rounds.exhausted');
        void Promise.all([conceptsQuery.refetch(), roundQuery.refetch()]);
      } else if (result.result.outcome === 'applied') {
        setRoundActionStatus(null);
        setRoundActionError('rounds.resultUnavailable');
      }
      return;
    }

    if (result.result.action === 'new_round' && result.result.outcome === 'applied') {
      setNewRoundOpen(false);
      setRoundActionStatus('rounds.newRoundSaved');
    }
  }

  const runRoundFlowAction = useCallback((action: 'draw' | 'new_round') => {
    if (roundFlowBusyRef.current || roundOperationUnresolved) return;
    roundFlowBusyRef.current = true;
    roundFlowMutation.mutate(action);
  }, [roundFlowMutation, roundOperationUnresolved]);

  function retryRoundFlowAction() {
    if (roundFlowBusyRef.current) return;
    roundFlowBusyRef.current = true;
    roundRetryMutation.mutate();
  }

  useEffect(() => {
    if (archived || !pendingRoundAction || pendingRoundAction.listId !== list.id
      || handledPostSaveActionRef.current === pendingRoundAction.id
      || conceptsQuery.isPending || conceptsQuery.isFetching
      || roundQuery.isPending || roundQuery.isFetching) return;

    handledPostSaveActionRef.current = pendingRoundAction.id;
    onRoundActionRequestHandled?.(pendingRoundAction.id);
    if (conceptsQuery.isError || roundQuery.isError || !roundQuery.data) return;

    if (pendingRoundAction.action === 'new_round') {
      if (conceptsQuery.data.length > 0) setNewRoundOpen(true);
      return;
    }

    const hasPending = conceptsQuery.data.some((concept) => concept.state === 'pending');
    if (hasPending) runRoundFlowAction('draw');
    else if (conceptsQuery.data.length > 0) setNewRoundOpen(true);
    else setRoundActionStatus('rounds.empty');
  }, [
    conceptsQuery.data,
    archived,
    conceptsQuery.isError,
    conceptsQuery.isFetching,
    conceptsQuery.isPending,
    list.id,
    onRoundActionRequestHandled,
    pendingRoundAction,
    runRoundFlowAction,
    roundQuery.data,
    roundQuery.isError,
    roundQuery.isFetching,
    roundQuery.isPending,
  ]);
  const createMutation = useMutation({
    mutationFn: createConcept,
    onSuccess: async (result) => {
      if (result.status === 'created' || result.status === 'reconciled') {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: key }),
          queryClient.invalidateQueries({ queryKey: listQueryKey(userId) }),
        ]);
      }
    },
  });
  const batchMutation = useMutation({
    mutationFn: () => createConceptBatch(userId, list.id, review!),
    onSuccess: async (result) => {
      if (result.status === 'created' || result.status === 'reconciled') {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: key }),
          queryClient.invalidateQueries({ queryKey: listQueryKey(userId) }),
        ]);
        setSummary(result.concepts.length); setBatchError(null); setRawInput('');
        notify(t('concepts.batchSaved', { count: result.concepts.length }));
      } else if (result.status === 'rejected' || result.status === 'unresolved') { setBatchError(errorKey(result.error)); }
    },
    onError: (error) => setBatchError(errorKey(error)),
  });
  const busy = createMutation.isPending || batchMutation.isPending;

  function notifyBulkResults(results: BulkItemResult[]) {
    for (const result of results) {
      const outcomeKey = `concepts.bulkOutcome${result.outcome[0].toUpperCase()}${result.outcome.slice(1)}`;
      const kind = result.outcome === 'failed' ? 'error' : result.outcome === 'changed' ? 'info' : 'success';
      notify(`${result.title}: ${t(outcomeKey)}`, kind, BULK_TOAST_DURATION_MS);
    }
  }

  async function runBulkAction(action: BulkAction, requestedIds?: string[]) {
    const targetIds = requestedIds ?? (conceptsQuery.data ?? [])
      .filter((concept) => matchesStudyFilter(concept, studyFilter) && selectedConceptIds.includes(concept.id))
      .map((concept) => concept.id);
    if (bulkBusy || targetIds.length === 0) return;
    setBulkBusy(true);
    const results: BulkItemResult[] = [];
    const failedIds: string[] = [];
    let changed = false;
    let concepts: ActiveConceptRow[];
    try {
      // Refresh from the owner-checked service before each action/retry.
      concepts = await getOwnedConcepts(userId, list.id);
    } catch {
      const failures = targetIds.map((id) => ({ id, title: conceptsQuery.data?.find((item) => item.id === id)?.title ?? '', outcome: 'failed' as const }));
      notifyBulkResults(failures);
      setSelectedConceptIds(targetIds);
      setBulkBusy(false);
      return;
    }
    const current = new Map(concepts.map((concept) => [concept.id, concept]));
    for (let index = 0; index < targetIds.length; index += 1) {
      const id = targetIds[index];
      const concept = current.get(id);
      const title = concept?.title ?? conceptsQuery.data?.find((item) => item.id === id)?.title ?? '';
      if (!concept) {
        results.push({ id, title, outcome: 'changed' });
        continue;
      }
      if ((action === 'mark_seen' && concept.state === 'seen')
        || (action === 'return_pending' && concept.state === 'pending')) {
        results.push({ id, title, outcome: 'changed' });
        continue;
      }
      if (action === 'delete') {
        changed = true;
        try {
          const result = await deleteConcept({ userId, listId: list.id, conceptId: id, expectedUpdatedAt: concept.updated_at });
          if (result.status === 'deleted' || result.status === 'reconciled') results.push({ id, title, outcome: 'completed' });
          else if (result.status === 'unresolved') {
            const reconciled = await getOwnedConcepts(userId, list.id).catch(() => null);
            if (reconciled && !reconciled.some((item) => item.id === id)) results.push({ id, title, outcome: 'completed' });
            else {
              results.push({ id, title, outcome: 'failed' }); failedIds.push(id);
              if (!reconciled) {
                for (const remainingId of targetIds.slice(index + 1)) {
                  failedIds.push(remainingId);
                  results.push({ id: remainingId, title: current.get(remainingId)?.title ?? '', outcome: 'failed' });
                }
                break;
              }
            }
          } else { results.push({ id, title, outcome: 'failed' }); failedIds.push(id); }
        } catch {
          results.push({ id, title, outcome: 'failed' }); failedIds.push(id);
        }
        continue;
      }
      changed = true;
      const command = action === 'mark_seen' ? markConceptSeen : returnConceptToPending;
      let result: RoundCommandResult;
      try {
        result = await command(list.id, id);
        if (result.status === 'unresolved') result = await retryUnresolvedRoundOperation(list.id);
      } catch {
        result = { status: 'unresolved', error: new DomainServiceError('unresolved', 'unresolved') };
      }
      if (result.status === 'confirmed' && result.result.outcome === 'applied') {
        results.push({ id, title, outcome: 'completed' });
        current.set(id, { ...concept, state: action === 'mark_seen' ? 'seen' : 'pending' });
      } else {
        results.push({ id, title, outcome: 'failed' });
        failedIds.push(id);
        if (result.status === 'unresolved') {
          // Do not submit later items until this operation has been reconciled.
          for (const remainingId of targetIds.slice(index + 1)) {
            failedIds.push(remainingId);
            results.push({ id: remainingId, title: current.get(remainingId)?.title ?? '', outcome: 'failed' });
          }
          break;
        }
      }
    }
    notifyBulkResults(results);
    setSelectedConceptIds(failedIds);
    setSelectionCleared(false);
    if (changed) await Promise.all([
      conceptsQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: listQueryKey(userId) }),
    ]);
    setBulkBusy(false);
  }

  function openAddDialog() {
    setReview(null);
    setRawInput('');
    setBatchError(null);
    setSummary(null);
    setMode('individual');
    setAddOpen(true);
  }

  function closeAddDialog() {
    if (busy) return;
    setAddOpen(false);
    setReview(null);
    setRawInput('');
    setBatchError(null);
    setSummary(null);
  }

  async function saveIndividual(title: string, description: string): Promise<boolean> {
    setSummary(null);
    setBatchError(null);
    const result = await createMutation.mutateAsync({ userId, listId: list.id, title, description });
    if (result.status === 'created' || result.status === 'reconciled') {
      notify(t('concepts.saved'));
      setAddOpen(false);
      return true;
    }
    if (result.status === 'rejected' || result.status === 'unresolved') setBatchError(errorKey(result.error));
    return false;
  }

  function startReview(rawInput: string) {
    setBatchError(null); setSummary(null);
    const existing = new Set((conceptsQuery.data ?? []).map((concept) => concept.title));
    setReview(parseConceptBatch(rawInput, existing));
  }

  if (conceptsQuery.isPending) return <section aria-busy="true" className={styles.view}><Text role="status">{t('concepts.loading')}</Text></section>;
  if (conceptsQuery.isError) return <section className={styles.view}><Alert color="red" role="alert">{t(errorKey(conceptsQuery.error))}</Alert><Button onClick={() => void conceptsQuery.refetch()}>{t('concepts.retry')}</Button></section>;

  const selectedConcept = conceptsQuery.data.find((concept) => concept.id === selectedConceptId) ?? null;
  const visibleConcepts = conceptsQuery.data.filter((concept) => matchesStudyFilter(concept, studyFilter));
  const visibleSelectedCount = visibleConcepts.filter((concept) => selectedConceptIds.includes(concept.id)).length;
  async function reloadSelectedConcept() {
    const result = await conceptsQuery.refetch();
    return result.isError ? null : result.data?.find((concept) => concept.id === selectedConceptId) ?? null;
  }

  return (
    <section aria-busy={busy || bulkBusy} className={styles.view}>
      {selectedConcept ? (
        <ConceptDetailView userId={userId} listId={list.id} concept={selectedConcept} readOnly={archived}
          onClose={() => setSelectedConceptId(null)} onReload={reloadSelectedConcept}
          onDeleted={() => { setSelectedConceptId(null); notify(t('conceptDetail.deleteSuccess')); }} />
      ) : (
        <>
          <header className={styles.listHeader}>
            <Button className={styles.backButton} variant="default" disabled={bulkBusy} onClick={onBack}>
              {t('detail.backShort')}
            </Button>
            <Button className={styles.deletedNotesButton} variant="default" disabled={bulkBusy} onClick={() => setShowDeletedConceptNotes((value) => !value)}>
              {t(showDeletedConceptNotes ? 'practiceNote.backToList' : 'practiceNote.deletedConceptsShort')}
            </Button>
            <Title className={styles.listTitle} order={1} id="concept-list-title">{list.name}</Title>
          </header>
          {showDeletedConceptNotes ? (
            <AssociatedPracticeNotes userId={userId} listId={list.id} activeConceptIds={conceptsQuery.data.map((concept) => concept.id)} deletedConcepts readOnly={archived} />
          ) : <>
          {!archived && <RoundProgressPanel
            pendingCount={conceptsQuery.data.filter((concept) => concept.state === 'pending').length}
            seenCount={conceptsQuery.data.filter((concept) => concept.state === 'seen').length}
            isLoading={roundQuery.isPending || roundQuery.isFetching}
            loadingError={roundQuery.isError ? t(roundErrorKey(roundQuery.error, 'load')) : null}
            actionError={!archived && roundActionError ? t(roundActionError) : null}
            actionStatus={!archived && roundActionStatus ? t(roundActionStatus) : null}
            busy={roundActionsBusy}
            unresolved={!archived && roundOperationUnresolved}
            onRetryLoad={() => { void roundQuery.refetch(); }}
            onRetryAction={retryRoundFlowAction}
          >
            <div className={roundStyles.roundActions}>
              {!archived && <Button
                className={roundStyles.drawButton}
                disabled={!roundQuery.data || roundQuery.isFetching || roundActionsBusy || roundOperationUnresolved || bulkBusy
                  || conceptsQuery.data.every((concept) => concept.state !== 'pending')}
                onClick={() => runRoundFlowAction('draw')}
                type="button"
              >
                {t('rounds.drawConcept')}
              </Button>}
              {!archived && <Button
                className={roundStyles.newRoundButton}
                disabled={!roundQuery.data || roundQuery.isFetching || roundActionsBusy || roundOperationUnresolved || bulkBusy
                  || conceptsQuery.data.length === 0}
                onClick={() => setNewRoundOpen(true)}
                type="button"
              >
                {t('rounds.newRound')}
              </Button>}
            </div>
          </RoundProgressPanel>}
          {!archived && <>
            <div aria-label={t('concepts.studyFilters')} className={styles.studyFilters} role="group">
              {(['all', 'pending', 'practiced'] as const).map((filter) => (
                <Button key={filter} aria-pressed={studyFilter === filter} disabled={bulkBusy} variant="default"
                  onClick={() => {
                    if (filter !== studyFilter) {
                      setStudyFilter(filter);
                      if (selectedConceptIds.length > 0) setSelectionCleared(true);
                      setSelectedConceptIds([]);
                    }
                  }}
                >{t(`concepts.filter${filter[0].toUpperCase()}${filter.slice(1)}`)}</Button>
              ))}
            </div>
            {visibleSelectedCount > 0 && <div aria-label={t('concepts.bulkActions')} className={styles.bulkActions} role="group">
              <Text>{t('concepts.selectedCount', { count: visibleSelectedCount })}</Text>
              <Button className={styles.markSeenButton} disabled={bulkBusy} onClick={() => void runBulkAction('mark_seen')}>{t('concepts.bulkMarkSeen')}</Button>
              <Button className={styles.returnPendingButton} disabled={bulkBusy} onClick={() => void runBulkAction('return_pending')}>{t('concepts.bulkReturnPending')}</Button>
              <Button className={styles.deleteConceptButton} disabled={bulkBusy} onClick={() => setDeleteSelection(visibleConcepts.filter((concept) => selectedConceptIds.includes(concept.id)).map((concept) => concept.id))}>{t('concepts.bulkDelete')}</Button>
            </div>}
            {selectionCleared && <Text aria-live="polite" role="status">{t('concepts.selectionCleared')}</Text>}
            {bulkBusy && <Text role="status">{t('concepts.bulkProcessing')}</Text>}
          </>}
          <DrawResultModal
            appearanceOrder={drawResult?.appearanceOrder ?? 0}
            onReturn={() => setDrawResult(null)}
            onPractice={() => {
              if (!drawResult) return;
              setDrawResult(null);
              onStartPractice(drawResult.conceptId, drawResult.roundId, drawResult.appearanceId);
            }}
            opened={drawResult !== null}
            title={drawResult?.title ?? ''}
          />
          <Modal
            centered
            closeOnClickOutside={false}
            closeOnEscape={false}
            onClose={() => setNewRoundOpen(false)}
            opened={newRoundOpen}
            withCloseButton={false}
            title={t('rounds.newRoundTitle')}
            classNames={{
              content: roundStyles.roundModalContent,
              header: roundStyles.roundModalHeader,
              title: roundStyles.roundModalTitle,
              body: roundStyles.roundModalBody,
            }}
            overlayProps={{ className: roundStyles.roundModalOverlay }}
          >
            <div className={roundStyles.newRoundConfirmation}>
              <Text className={roundStyles.newRoundDescription}>
                {t('rounds.newRoundDescription')}
              </Text>
              <div className={roundStyles.newRoundActions}>
                <Button
                  className={roundStyles.newRoundCancelButton}
                  disabled={roundFlowMutation.isPending || roundOperationUnresolved || bulkBusy}
                  onClick={() => setNewRoundOpen(false)}
                  type="button"
                >
                  {t('rounds.cancelNewRound')}
                </Button>
                <Button
                  className={roundStyles.newRoundConfirmButton}
                  disabled={roundFlowMutation.isPending || roundOperationUnresolved || bulkBusy}
                  onClick={() => runRoundFlowAction('new_round')}
                  type="button"
                >
                  {t('rounds.confirmNewRound')}
                </Button>
              </div>
            </div>
          </Modal>
          <div
            aria-label={t('concepts.list')}
            className={styles.conceptScroller}
            role="region"
            tabIndex={0}
          >
            {conceptsQuery.data.length === 0 ? (
              <div className={styles.empty}><Text>{t('concepts.empty')}</Text></div>
            ) : visibleConcepts.length === 0 ? (
              <div className={styles.empty}><Text role="status">{t('concepts.filterEmpty', { filter: t(`concepts.filter${studyFilter[0].toUpperCase()}${studyFilter.slice(1)}`) })}</Text></div>
            ) : (
              <ul className={styles.conceptList}>
                {visibleConcepts.map((concept) => (
                  <li className={styles.conceptRow} key={concept.id}>
                    <div className={styles.conceptInfo}>
                      <span className={styles.conceptName}>{concept.title}</span>
                      <Text
                        className={`${styles.conceptState} ${concept.state === 'seen' ? styles.conceptSeen : ''}`}
                        data-round-state
                      >
                        {concept.state === 'pending' ? t('rounds.pending') : t('rounds.seen')}
                      </Text>
                    </div>
                    <div className={styles.conceptActions}>
                      <Button
                        aria-label={t('conceptDetail.viewConcept', { title: concept.title })}
                        className={styles.viewConceptButton}
                        disabled={bulkBusy}
                        onClick={() => setSelectedConceptId(concept.id)}
                        type="button"
                      >
                        {t('concepts.viewOne')}
                      </Button>
                      {!archived && (concept.state === 'pending' ? (
                        <Button
                          aria-label={t('rounds.markSeenForConcept', { title: concept.title })}
                          className={styles.markSeenButton}
                          disabled={!roundQuery.data || roundActionsBusy || roundOperationUnresolved || bulkBusy}
                          onClick={() => roundActionMutation.mutate({ action: 'mark_seen', conceptId: concept.id })}
                          type="button"
                        >
                          {t('rounds.markSeen')}
                        </Button>
                      ) : (
                        <Button
                          aria-label={t('rounds.returnToPendingForConcept', { title: concept.title })}
                          className={styles.returnPendingButton}
                          disabled={!roundQuery.data || roundActionsBusy || roundOperationUnresolved || bulkBusy}
                          onClick={() => roundActionMutation.mutate({ action: 'return_pending', conceptId: concept.id })}
                          type="button"
                        >
                          {t('rounds.returnToPending')}
                        </Button>
                      ))}
                      {!archived && <Checkbox aria-label={t('concepts.selectConcept', { title: concept.title })}
                        checked={selectedConceptIds.includes(concept.id)} disabled={bulkBusy}
                        onChange={(event) => {
                          const checked = event.currentTarget.checked;
                          setSelectedConceptIds((ids) => checked ? [...ids, concept.id] : ids.filter((id) => id !== concept.id));
                          setSelectionCleared(false);
                        }} />}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {!archived && <Button className={styles.addConceptsButton} disabled={bulkBusy} onClick={openAddDialog} type="button">
            {t('concepts.addTitle')}
          </Button>}
          </>}

          {!archived && <Modal
            centered
            closeOnClickOutside={false}
            closeOnEscape={false}
            transitionProps={{ duration: 0 }}
            onClose={closeAddDialog}
            opened={addOpen}
            classNames={{
              content: styles.addModalContent,
              header: styles.addModalHeader,
              title: styles.addModalTitle,
              body: styles.addModalBody,
            }}
            overlayProps={{ className: styles.conceptModalOverlay }}
            title={t('concepts.addTitle')}
            withCloseButton={false}
          >
            {review ? (
              <ConceptBatchReview
                review={review}
                busy={batchMutation.isPending}
                error={batchError}
                summary={summary}
                onConfirm={() => {
                  if (summary === null) {
                    setBatchError(null);
                    batchMutation.mutate();
                  }
                }}
                onCancel={() => {
                  if (busy) return;
                  if (summary !== null) closeAddDialog();
                  else {
                    setReview(null);
                    setBatchError(null);
                  }
                }}
              />
            ) : (
              <ConceptEntryForm
                busy={busy}
                error={batchError}
                mode={mode}
                onModeChange={setMode}
                onIndividualSubmit={saveIndividual}
                onBatchReview={startReview}
                rawInput={rawInput}
                onRawInputChange={setRawInput}
                onCancel={closeAddDialog}
              />
            )}
          </Modal>}
          {!archived && <Modal centered closeOnClickOutside={!bulkBusy} closeOnEscape={!bulkBusy}
            onClose={() => { if (!bulkBusy) setDeleteSelection(null); }} opened={deleteSelection !== null}
            classNames={{ content: styles.deleteModalContent, header: styles.deleteModalHeader, title: styles.deleteModalTitle, body: styles.deleteModalBody }}
            overlayProps={{ className: styles.conceptModalOverlay }} title={t('concepts.confirmBulkDeleteTitle')}>
            <Text>{t('concepts.confirmBulkDeleteDescription', { count: deleteSelection?.length ?? 0 })}</Text>
            <div className={styles.modalActions}>
              <Button className={styles.modalSecondaryButton} variant="default" disabled={bulkBusy} onClick={() => setDeleteSelection(null)}>{t('concepts.cancelBulkDelete')}</Button>
              <Button className={styles.deleteConfirmButton} disabled={bulkBusy} onClick={() => {
                const targets = deleteSelection ?? [];
                setDeleteSelection(null);
                void runBulkAction('delete', targets);
              }}>{t('concepts.confirmBulkDelete')}</Button>
            </div>
          </Modal>}
        </>
      )}
      {busy && <Text role="status">{t('concepts.processing')}</Text>}
    </section>
  );
}
