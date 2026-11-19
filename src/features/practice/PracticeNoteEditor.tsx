import { Alert, Button, Group, Modal, Stack, Text, Textarea, Title } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSavedPractice, practiceQueryKey, updatePracticeNote, deletePracticeNote } from './practiceService';
import { trimmedCodePointLength } from './practiceValidation';
import styles from './practiceNote.module.css';

type Props = { userId: string; practiceId: string; onClose: () => void };
type NoteState = { note: string | null; revision: number | null };
type UpdateRequest = { practiceId: string; operationId: string; expectedRevision: number; body: string };
type DeleteRequest = { practiceId: string; operationId: string; expectedRevision: number };
type SavedPractice = Awaited<ReturnType<typeof getSavedPractice>>;

export function PracticeNoteEditor({ userId, practiceId, onClose }: Props) {
  const { t } = useTranslation();
  const practiceQuery = useQuery({ queryKey: practiceQueryKey(userId, practiceId), queryFn: () => getSavedPractice(practiceId) });
  if (practiceQuery.isPending) return <Modal opened onClose={onClose} title={t('practiceNote.title')} centered><Text role="status">{t('practiceNote.loading')}</Text></Modal>;
  if (practiceQuery.isError) return <Modal opened onClose={onClose} title={t('practiceNote.title')} centered><Stack><Alert role="alert" color="red">{t('practiceNote.loadError')}</Alert><Button onClick={() => void practiceQuery.refetch()}>{t('practiceNote.retry')}</Button><Button onClick={onClose}>{t('practiceNote.close')}</Button></Stack></Modal>;
  return <PracticeNoteEditorContent userId={userId} practiceId={practiceId} onClose={onClose} savedPractice={practiceQuery.data} />;
}

function PracticeNoteEditorContent({ userId, practiceId, onClose, savedPractice }: Props & { savedPractice: SavedPractice }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(savedPractice.note ?? '');
  const [baseRevision, setBaseRevision] = useState<number | null>(savedPractice.noteRevision ?? null);
  const [currentOverride, setCurrentOverride] = useState<NoteState | null>(null);
  const [conflict, setConflict] = useState<NoteState | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<UpdateRequest | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DeleteRequest | null>(null);
  const savedState: NoteState = currentOverride ?? {
    note: savedPractice.note ?? null,
    revision: savedPractice.noteRevision ?? null,
  };
  const effectiveRevision = conflict?.revision ?? baseRevision ?? savedState.revision;
  const unresolved = pendingUpdate !== null || pendingDelete !== null;

  function beginEdit() {
    setDraft(savedState.note ?? '');
    setBaseRevision(savedState.revision);
    setConflict(null);
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(conflict?.note ?? savedState.note ?? '');
    setBaseRevision(conflict?.revision ?? savedState.revision);
    setConflict(null);
    setError(null);
    setEditing(false);
  }

  async function performUpdate(request: UpdateRequest) {
    setBusy(true);
    setError(null);
    setPendingUpdate(request);
    const result = await updatePracticeNote(request);
    if (result.status === 'confirmed') {
      const next = { note: result.note, revision: result.revision };
      setCurrentOverride(next);
      setDraft(result.note ?? '');
      setBaseRevision(result.revision);
      setEditing(false);
      setConflict(null);
      setPendingUpdate(null);
    } else if (result.status === 'rejected' && (result.reason === 'stale' || result.reason === 'not_found')) {
      const latest = { note: result.note ?? null, revision: result.revision ?? null };
      setCurrentOverride(latest);
      setConflict(latest);
      setPendingUpdate(null);
      setError(result.reason === 'stale' ? 'practiceNote.conflict' : 'practiceNote.missing');
    } else if (result.status === 'rejected') {
      setPendingUpdate(null);
      setError('practiceNote.saveError');
    } else {
      setError('practiceNote.unresolvedUpdate');
    }
    setBusy(false);
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (unresolved) {
      if (pendingUpdate) await performUpdate(pendingUpdate);
      return;
    }
    const length = trimmedCodePointLength(draft);
    if (length === 0 || length > 2000 || effectiveRevision === null) {
      setError(length === 0 ? 'practiceNote.emptyEdit' : 'practiceNote.saveError');
      return;
    }
    await performUpdate({ practiceId, operationId: crypto.randomUUID(), expectedRevision: effectiveRevision, body: draft });
  }

  async function confirmDelete() {
    if (pendingDelete) {
      setBusy(true);
      setError(null);
      const result = await deletePracticeNote(pendingDelete);
      setBusy(false);
      if (result.status === 'confirmed') {
        setCurrentOverride({ note: null, revision: null });
        setDraft('');
        setBaseRevision(null);
        setPendingDelete(null);
        setDeleteOpen(false);
        setError(null);
        await queryClient.invalidateQueries({ queryKey: ['practice-history', userId] });
        return;
      }
      if (result.status === 'unresolved') {
        setError('practiceNote.unresolvedDelete');
        return;
      }
      if (result.reason === 'stale' || result.reason === 'not_found') {
        const latest = { note: result.note ?? null, revision: result.revision ?? null };
        setCurrentOverride(latest);
        setBaseRevision(latest.revision);
        setPendingDelete(null);
        setDeleteOpen(false);
        setError('practiceNote.conflict');
      } else {
        setError('practiceNote.deleteError');
      }
      return;
    }
    if (effectiveRevision === null) {
      setError('practiceNote.missing');
      return;
    }
    const request = { practiceId, operationId: crypto.randomUUID(), expectedRevision: effectiveRevision };
    setPendingDelete(request);
    await confirmDeleteWith(request);
  }

  async function confirmDeleteWith(request: DeleteRequest) {
    setBusy(true);
    setError(null);
    const result = await deletePracticeNote(request);
    setBusy(false);
    if (result.status === 'confirmed') {
      setCurrentOverride({ note: null, revision: null });
      setDraft('');
      setBaseRevision(null);
      setPendingDelete(null);
      setDeleteOpen(false);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['practice-history', userId] });
    } else if (result.status === 'unresolved') {
      setPendingDelete(request);
      setError('practiceNote.unresolvedDelete');
    } else if (result.reason === 'stale' || result.reason === 'not_found') {
      const latest = { note: result.note ?? null, revision: result.revision ?? null };
      setCurrentOverride(latest);
      setBaseRevision(latest.revision);
      setPendingDelete(null);
      setDeleteOpen(false);
      setError('practiceNote.conflict');
    } else {
      setPendingDelete(null);
      setError('practiceNote.deleteError');
    }
  }

  function closeEditor() {
    if (busy || unresolved) return;
    onClose();
  }

  return (
    <>
      <Modal opened onClose={closeEditor} closeOnClickOutside={!unresolved} closeOnEscape={!unresolved} title={t('practiceNote.title')} centered classNames={{ content: styles.noteModal, header: styles.noteHeader, title: styles.noteTitle, body: styles.noteBody }}>
        <Stack gap="md">
          <Title order={3}>{savedPractice.practice?.title_snapshot ?? savedPractice.practice?.independent_label}</Title>
          {error && <Alert color="red" role="alert">{t(error)}</Alert>}
          {conflict && <div className={styles.savedConflict}><Text fw={700}>{t('practiceNote.latestSaved')}</Text><Text>{conflict.note ?? t('practiceNote.noSavedNote')}</Text></div>}
          {savedState.note === null && !editing ? <Text>{t('practiceNote.noSavedNote')}</Text> : editing ? (
            <form onSubmit={(event) => void saveEdit(event)}>
              <Stack gap="sm">
                <Textarea aria-label={t('practiceNote.textLabel')} label={t('practiceNote.textLabel')} value={draft} onChange={(event) => setDraft(event.currentTarget.value)} autosize minRows={3} maxRows={10} disabled={busy || unresolved || (conflict !== null && pendingUpdate !== null)} />
                <Group justify="center">
                  <Button className={styles.notePrimaryButton} type="submit" loading={busy} disabled={busy || (conflict !== null && pendingUpdate === null)}>{unresolved ? t('practiceNote.retrySave') : t('practiceNote.save')}</Button>
                  <Button type="button" variant="default" disabled={busy || unresolved} onClick={cancelEdit}>{t('practiceNote.cancel')}</Button>
                </Group>
                {pendingUpdate && <Button className={styles.notePrimaryButton} type="button" disabled={busy} onClick={() => void performUpdate(pendingUpdate)}>{t('practiceNote.retryUpdate')}</Button>}
                {conflict && <Button className={styles.notePrimaryButton} type="button" onClick={() => { setBaseRevision(conflict.revision); setConflict(null); setError(null); }}>{t('practiceNote.reapplyDraft')}</Button>}
              </Stack>
            </form>
          ) : savedState.note !== null ? (
            <>
              <div className={styles.savedNote}><Text>{savedState.note}</Text></div>
              <Group justify="center"><Button className={styles.notePrimaryButton} onClick={beginEdit}>{t('practiceNote.edit')}</Button><Button className={styles.deleteButton} onClick={() => { setError(null); setDeleteOpen(true); }}>{t('practiceNote.delete')}</Button></Group>
            </>
          ) : null}
          <Button variant="default" disabled={busy || unresolved} onClick={closeEditor}>{t('practiceNote.close')}</Button>
        </Stack>
      </Modal>
      <Modal opened={deleteOpen} onClose={() => { if (!busy && !pendingDelete) setDeleteOpen(false); }} title={t('practiceNote.confirmTitle')} centered closeOnClickOutside={false} closeOnEscape={false} classNames={{ content: styles.noteModal, header: styles.noteHeader, title: styles.noteTitle, body: styles.noteBody }}>
        <Stack gap="md">
          <Text>{t('practiceNote.confirmDescription')}</Text>
          <Group justify="center"><Button variant="default" disabled={busy || pendingDelete !== null} onClick={() => setDeleteOpen(false)}>{t('practice.cancel')}</Button><Button className={styles.deleteButton} loading={busy} disabled={busy} onClick={() => void confirmDelete()}>{pendingDelete ? t('practiceNote.retryDelete') : t('practiceNote.confirmDelete')}</Button></Group>
        </Stack>
      </Modal>
    </>
  );
}
