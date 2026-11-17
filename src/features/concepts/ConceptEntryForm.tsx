import { Alert, Button, Group, SegmentedControl, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { validateConceptFields } from './conceptParser';
import styles from './concepts.module.css';

export type EntryMode = 'individual' | 'batch';

type ConceptEntryFormProps = {
  busy: boolean;
  mode: EntryMode;
  onModeChange: (mode: EntryMode) => void;
  onIndividualSubmit: (title: string, description: string) => Promise<boolean>;
  onBatchReview: (rawInput: string) => void;
  rawInput: string;
  onRawInputChange: (value: string) => void;
  onCancel: () => void;
};

export function ConceptEntryForm({ busy, mode, onModeChange, onIndividualSubmit, onBatchReview, rawInput, onRawInputChange, onCancel }: ConceptEntryFormProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fieldError, setFieldError] = useState<'title' | 'description' | null>(null);

  function discard() {
    if ((title || description || rawInput) && !window.confirm(t('concepts.discardConfirm'))) return;
    setTitle(''); setDescription(''); onRawInputChange(''); setFieldError(null); onCancel();
  }

  async function submitIndividual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateConceptFields(title, description);
    if (!validation.valid) {
      setFieldError(validation.error === 'title_invalid' ? 'title' : 'description');
      return;
    }
    setFieldError(null);
    if (await onIndividualSubmit(title, description)) { setTitle(''); setDescription(''); }
  }

  return (
    <section aria-labelledby="concept-entry-title" className={styles.panel}>
      <Stack gap="md">
        <Text fw={700} id="concept-entry-title">{t('concepts.addTitle')}</Text>
        <SegmentedControl aria-label={t('concepts.entryMode')} data={[
          { label: t('concepts.individualMode'), value: 'individual' },
          { label: t('concepts.batchMode'), value: 'batch' },
        ]} value={mode} onChange={(value) => onModeChange(value as EntryMode)} />
        {mode === 'individual' ? (
          <form onSubmit={(event) => void submitIndividual(event)}>
            <Stack gap="sm">
              <TextInput label={t('concepts.titleLabel')} required maxLength={50} value={title}
                onChange={(event) => setTitle(event.currentTarget.value)} error={fieldError === 'title' ? t('concepts.titleInvalid') : undefined}
                description={t('concepts.titleGuidance', { count: Array.from(title.trim()).length })} />
              <Textarea label={t('concepts.descriptionLabel')} maxLength={2000} value={description}
                onChange={(event) => setDescription(event.currentTarget.value)} error={fieldError === 'description' ? t('concepts.descriptionInvalid') : undefined}
                description={t('concepts.descriptionGuidance', { count: Array.from(description.trim()).length })} autosize minRows={2} maxRows={6} />
              <Group>
                <Button type="submit" loading={busy} disabled={busy}>{t('concepts.save')}</Button>
                <Button type="button" variant="default" disabled={busy} onClick={discard}>{t('concepts.cancel')}</Button>
              </Group>
            </Stack>
          </form>
        ) : (
          <Stack gap="sm">
            <Textarea label={t('concepts.batchInputLabel')} value={rawInput} onChange={(event) => onRawInputChange(event.currentTarget.value)}
              description={t('concepts.batchGuidance')} autosize minRows={5} maxRows={12} />
            <Text size="sm">{t('concepts.batchCounter', { lines: rawInput ? rawInput.split(/\r\n|\n|\r/).length : 0, characters: Array.from(rawInput).length })}</Text>
            {Array.from(rawInput).length > 20000 && <Alert color="yellow" role="status">{t('concepts.batchCharacterLimit')}</Alert>}
            <Group>
              <Button disabled={busy || !rawInput} onClick={() => onBatchReview(rawInput)}>{t('concepts.review')}</Button>
              <Button variant="default" disabled={busy} onClick={discard}>{t('concepts.cancel')}</Button>
            </Group>
          </Stack>
        )}
      </Stack>
    </section>
  );
}
