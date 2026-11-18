import { Alert, Button, Modal, Text, Title } from '@mantine/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ListRow } from '../../lib/database.types';
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
import { createConcept, createConceptBatch, conceptQueryKey, getOwnedConcepts } from './conceptService';
import { parseConceptBatch, type BatchReview } from './conceptParser';
import { ConceptEntryForm, type EntryMode } from './ConceptEntryForm';
import { ConceptBatchReview } from './ConceptBatchReview';
import { ConceptDetailView } from './ConceptDetailView';
import styles from './concepts.module.css';
import { useToast } from '../../app/toasts/useToast';

type Props = { userId: string; list: ListRow; onBack: () => void; onStartPractice: (conceptId: string) => void };

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

export function ConceptManagementView({ userId, list, onBack, onStartPractice }: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<EntryMode>('individual');
  const [review, setReview] = useState<BatchReview | null>(null);
  const [rawInput, setRawInput] = useState('');
  const [batchError, setBatchError] = useState<string | null>(null);
  const [summary, setSummary] = useState<number | null>(null);
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const { notify } = useToast();
  const key = conceptQueryKey(userId, list.id);
  const conceptsQuery = useQuery({ queryKey: key, queryFn: () => getOwnedConcepts(userId, list.id) });
  const roundKey = roundQueryKey(userId, list.id);
  const roundQuery = useQuery({
    queryKey: roundKey,
    queryFn: () => loadCurrentRound(list.id),
  });
  const [roundActionError, setRoundActionError] = useState<string | null>(null);
  const [roundActionStatus, setRoundActionStatus] = useState<string | null>(null);
  const [roundOperationUnresolved, setRoundOperationUnresolved] = useState(false);
  const [newRoundOpen, setNewRoundOpen] = useState(false);
  const [drawResult, setDrawResult] = useState<{ conceptId: string; title: string; appearanceOrder: number } | null>(null);
  const roundFlowBusyRef = useRef(false);

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
        });
      } else if (result.result.outcome === 'exhausted') {
        setRoundActionStatus('rounds.exhausted');
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

  function runRoundFlowAction(action: 'draw' | 'new_round') {
    if (roundFlowBusyRef.current || roundOperationUnresolved) return;
    roundFlowBusyRef.current = true;
    roundFlowMutation.mutate(action);
  }

  function retryRoundFlowAction() {
    if (roundFlowBusyRef.current) return;
    roundFlowBusyRef.current = true;
    roundRetryMutation.mutate();
  }
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
  async function reloadSelectedConcept() {
    const result = await conceptsQuery.refetch();
    return result.isError ? null : result.data?.find((concept) => concept.id === selectedConceptId) ?? null;
  }

  return (
    <section aria-busy={busy} className={styles.view}>
      {selectedConcept ? (
        <ConceptDetailView userId={userId} listId={list.id} concept={selectedConcept}
          onClose={() => setSelectedConceptId(null)} onReload={reloadSelectedConcept}
          onDeleted={() => { setSelectedConceptId(null); notify(t('conceptDetail.deleteSuccess')); }} />
      ) : (
        <>
          <header className={styles.listHeader}>
            <Button className={styles.backButton} variant="default" onClick={onBack}>
              {t('detail.backShort')}
            </Button>
            <Title className={styles.listTitle} order={1} id="concept-list-title">{list.name}</Title>
          </header>
          <RoundProgressPanel
            pendingCount={conceptsQuery.data.filter((concept) => concept.state === 'pending').length}
            seenCount={conceptsQuery.data.filter((concept) => concept.state === 'seen').length}
            isLoading={roundQuery.isPending || roundQuery.isFetching}
            loadingError={roundQuery.isError ? t(roundErrorKey(roundQuery.error, 'load')) : null}
            actionError={roundActionError ? t(roundActionError) : null}
            actionStatus={roundActionStatus ? t(roundActionStatus) : null}
            busy={roundActionsBusy}
            unresolved={roundOperationUnresolved}
            onRetryLoad={() => { void roundQuery.refetch(); }}
            onRetryAction={retryRoundFlowAction}
          >
            <div className={roundStyles.roundActions}>
              <Button
                className={roundStyles.drawButton}
                disabled={!roundQuery.data || roundQuery.isFetching || roundActionsBusy || roundOperationUnresolved
                  || conceptsQuery.data.every((concept) => concept.state !== 'pending')}
                onClick={() => runRoundFlowAction('draw')}
                type="button"
              >
                {t('rounds.drawConcept')}
              </Button>
              <Button
                className={roundStyles.newRoundButton}
                disabled={!roundQuery.data || roundQuery.isFetching || roundActionsBusy || roundOperationUnresolved
                  || conceptsQuery.data.length === 0}
                onClick={() => setNewRoundOpen(true)}
                type="button"
              >
                {t('rounds.newRound')}
              </Button>
            </div>
          </RoundProgressPanel>
          <DrawResultModal
            appearanceOrder={drawResult?.appearanceOrder ?? 0}
            onReturn={() => setDrawResult(null)}
            onPractice={() => {
              if (!drawResult) return;
              setDrawResult(null);
              onStartPractice(drawResult.conceptId);
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
                  disabled={roundFlowMutation.isPending || roundOperationUnresolved}
                  onClick={() => setNewRoundOpen(false)}
                  type="button"
                >
                  {t('rounds.cancelNewRound')}
                </Button>
                <Button
                  className={roundStyles.newRoundConfirmButton}
                  disabled={roundFlowMutation.isPending || roundOperationUnresolved}
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
            ) : (
              <ul className={styles.conceptList}>
                {conceptsQuery.data.map((concept) => (
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
                        onClick={() => setSelectedConceptId(concept.id)}
                        type="button"
                      >
                        {t('concepts.viewOne')}
                      </Button>
                      {concept.state === 'pending' ? (
                        <Button
                          aria-label={t('rounds.markSeenForConcept', { title: concept.title })}
                          className={styles.markSeenButton}
                          disabled={!roundQuery.data || roundActionsBusy || roundOperationUnresolved}
                          onClick={() => roundActionMutation.mutate({ action: 'mark_seen', conceptId: concept.id })}
                          type="button"
                        >
                          {t('rounds.markSeen')}
                        </Button>
                      ) : (
                        <Button
                          aria-label={t('rounds.returnToPendingForConcept', { title: concept.title })}
                          className={styles.returnPendingButton}
                          disabled={!roundQuery.data || roundActionsBusy || roundOperationUnresolved}
                          onClick={() => roundActionMutation.mutate({ action: 'return_pending', conceptId: concept.id })}
                          type="button"
                        >
                          {t('rounds.returnToPending')}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button className={styles.addConceptsButton} onClick={openAddDialog} type="button">
            {t('concepts.addTitle')}
          </Button>

          <Modal
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
          </Modal>
        </>
      )}
      {busy && <Text role="status">{t('concepts.processing')}</Text>}
    </section>
  );
}
