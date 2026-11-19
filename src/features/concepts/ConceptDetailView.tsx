import {
  Alert,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActiveConceptRow } from '../../lib/database.types';
import { queryClient } from '../../lib/queryClient';
import { listQueryKey } from '../lists/listService';
import { DomainServiceError } from '../shared/supabaseErrors';
import {
  conceptQueryKey,
  deleteConcept,
  updateConcept,
} from './conceptService';
import { validateConceptFields } from './conceptParser';
import styles from './concepts.module.css';
import { AssociatedPracticeNotes } from './AssociatedPracticeNotes';
import { useToast } from '../../app/toasts/useToast';

type Props = {
  userId: string;
  listId: string;
  concept: ActiveConceptRow;
  onClose: () => void;
  onReload: () => Promise<ActiveConceptRow | null>;
  onDeleted: () => void;
};

function errorKey(error: unknown): string {
  if (!(error instanceof DomainServiceError)) return 'concepts.unavailable';
  switch (error.code) {
    case 'concept_title_invalid': return 'concepts.titleInvalid';
    case 'concept_description_invalid': return 'concepts.descriptionInvalid';
    case 'concept_duplicate': return 'concepts.duplicate';
    case 'concept_conflict': return 'conceptDetail.conflict';
    case 'concept_not_found': return 'conceptDetail.notFound';
    case 'unauthenticated': return 'concepts.sessionExpired';
    case 'unauthorized': return 'concepts.unauthorized';
    case 'unresolved': return 'concepts.unresolved';
    default: return 'concepts.unavailable';
  }
}

export function ConceptDetailView({ userId, listId, concept, onClose, onReload, onDeleted }: Props) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(concept.title);
  const [description, setDescription] = useState(concept.description);
  const [fieldError, setFieldError] = useState<'title' | 'description' | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const { notify } = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const conflictPending = editError === 'conceptDetail.conflict' || editError === 'conceptDetail.reloadFailed';

  function beginEdit() {
    setTitle(concept.title);
    setDescription(concept.description);
    setFieldError(null);
    setEditError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setTitle(concept.title);
    setDescription(concept.description);
    setFieldError(null);
    setEditError(null);
    setEditing(false);
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateConceptFields(title, description);
    if (!validation.valid) {
      setFieldError(validation.error === 'title_invalid' ? 'title' : 'description');
      return;
    }

    setSaving(true);
    setEditError(null);
    try {
      const result = await updateConcept({
        userId,
        listId,
        conceptId: concept.id,
        title: validation.title,
        description: validation.description,
        expectedUpdatedAt: concept.updated_at,
      });

      if (result.status === 'updated' || result.status === 'reconciled') {
        setTitle(result.concept.title);
        setDescription(result.concept.description);
        setEditing(false);
        notify(t('conceptDetail.editSaved'));
        setFieldError(null);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: conceptQueryKey(userId, listId) }),
          queryClient.invalidateQueries({ queryKey: listQueryKey(userId) }),
        ]);
      } else if (result.status === 'rejected' || result.status === 'unresolved') {
        setEditError(errorKey(result.error));
      }
    } catch (error) {
      setEditError(errorKey(error));
    } finally {
      setSaving(false);
    }
  }

  async function reloadCurrentVersion() {
    try {
      const current = await onReload();
      if (!current) {
        setEditError('conceptDetail.reloadFailed');
        return;
      }
      setTitle(current.title);
      setDescription(current.description);
      setFieldError(null);
      setEditError(null);
    } catch {
      setEditError('conceptDetail.reloadFailed');
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const result = await deleteConcept({
        userId,
        listId,
        conceptId: concept.id,
        expectedUpdatedAt: concept.updated_at,
      });
      if (result.status === 'deleted' || result.status === 'reconciled') {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: conceptQueryKey(userId, listId) }),
          queryClient.invalidateQueries({ queryKey: listQueryKey(userId) }),
        ]);
        setDeleteOpen(false);
        onDeleted();
      } else if (result.status === 'rejected' || result.status === 'unresolved') {
        setDeleteError(result.status === 'unresolved' ? 'conceptDetail.deleteUnresolved' : errorKey(result.error));
      }
    } catch (error) {
      setDeleteError(errorKey(error));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section aria-labelledby="concept-detail-title" aria-busy={saving || deleting} className={styles.detail}>
      <header className={styles.detailHeader}>
        <Button className={styles.detailBackButton} variant="default" disabled={saving || deleting || conflictPending} onClick={onClose}>
          {t('conceptDetail.back')}
        </Button>
        <Title className={styles.detailTitle} order={1} id="concept-detail-title">{title}</Title>
      </header>

      {editing ? (
        <form onSubmit={(event) => void saveEdit(event)}>
          <Stack gap="sm">
            {editError && <Alert color="red" role="alert">{t(editError)}</Alert>}
            {conflictPending && <Button type="button" variant="default" onClick={() => void reloadCurrentVersion()}>{t('conceptDetail.reloadCurrentVersion')}</Button>}
            <TextInput label={t('concepts.titleLabel')} required maxLength={50} value={title}
              disabled={saving || conflictPending}
              onChange={(event) => { setTitle(event.currentTarget.value); setFieldError(null); }}
              error={fieldError === 'title' ? t('concepts.titleInvalid') : undefined}
              description={t('concepts.titleGuidance', { count: Array.from(title.trim()).length })} />
            <Textarea label={t('conceptDetail.descriptionLabel')} maxLength={2000} value={description}
              disabled={saving || conflictPending}
              onChange={(event) => { setDescription(event.currentTarget.value); setFieldError(null); }}
              error={fieldError === 'description' ? t('concepts.descriptionInvalid') : undefined}
              description={t('concepts.descriptionGuidance', { count: Array.from(description.trim()).length })} autosize minRows={2} maxRows={8} />
            <Group justify="center">
              <Button className={styles.editSaveButton} type="submit" loading={saving} disabled={saving || conflictPending}>{t('conceptDetail.saveChanges')}</Button>
              <Button className={styles.modalSecondaryButton} type="button" disabled={saving || conflictPending} onClick={cancelEdit}>{t('conceptDetail.cancelEdit')}</Button>
            </Group>
          </Stack>
        </form>
      ) : (
        <Stack gap="md">
          <div className={styles.detailText}>
            <Text fw={700}>{t('conceptDetail.descriptionLabel')}</Text>
            <Text>{description || t('conceptDetail.noDescription')}</Text>
          </div>
          <Stack className={styles.detailActions} align="center" gap="sm">
            <Button className={styles.editConceptButton} onClick={beginEdit}>{t('conceptDetail.editConcept')}</Button>
            <Button className={styles.deleteConceptButton} disabled={saving || deleting} onClick={() => { setDeleteError(null); setDeleteOpen(true); }}>
              {t('conceptDetail.deleteConcept')}
            </Button>
          </Stack>
        </Stack>
      )}

      <AssociatedPracticeNotes userId={userId} listId={listId} conceptId={concept.id} />

      <Modal
        opened={deleteOpen}
        onClose={() => { if (!deleting) { setDeleteOpen(false); setDeleteError(null); } }}
        title={t('conceptDetail.deleteConfirmTitle')}
        centered
        classNames={{
          content: styles.deleteModalContent,
          header: styles.deleteModalHeader,
          title: styles.deleteModalTitle,
          body: styles.deleteModalBody,
        }}
        overlayProps={{ className: styles.deleteModalOverlay }}
      >
        <Stack gap="md">
          <Text>{t('conceptDetail.deleteConfirmDescription')}</Text>
          {deleteError && <Alert color="red" role="alert">{t(deleteError)}</Alert>}
          {deleting && <Text role="status">{t('conceptDetail.processingDelete')}</Text>}
          <Group className={styles.modalActions} justify="center">
            <Button className={styles.modalSecondaryButton} disabled={deleting} onClick={() => { setDeleteOpen(false); setDeleteError(null); }}>{t('conceptDetail.cancelDelete')}</Button>
            <Button className={styles.deleteConfirmButton} loading={deleting} disabled={deleting} onClick={() => void confirmDelete()}>{t('conceptDetail.confirmDelete')}</Button>
          </Group>
        </Stack>
      </Modal>
    </section>
  );
}
