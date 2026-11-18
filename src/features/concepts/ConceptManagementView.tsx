import { Alert, Button, Modal, Text, Title } from '@mantine/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ListRow } from '../../lib/database.types';
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

type Props = { userId: string; list: ListRow; onBack: () => void };

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

export function ConceptManagementView({ userId, list, onBack }: Props) {
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
                    <span className={styles.conceptName}>{concept.title}</span>
                    <Button
                      className={styles.viewConceptButton}
                      onClick={() => setSelectedConceptId(concept.id)}
                      type="button"
                    >
                      {t('concepts.viewOne')}
                    </Button>
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
