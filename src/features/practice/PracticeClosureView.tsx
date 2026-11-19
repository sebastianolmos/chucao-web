import { useEffect, useRef, useState } from 'react';
import { Alert, Button, TextInput, Textarea, Title } from '@mantine/core';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { PracticeSaveResult } from './practiceService';
import { saveCompletedPractice } from './practiceService';
import { trimmedCodePointLength, type CompletedPracticeInput } from './practiceValidation';
import styles from './practice.module.css';

export type PracticeCompletion = Pick<CompletedPracticeInput, 'id' | 'durationMinutes' | 'completedAt'>;
export type AssociatedPracticeContext = Pick<CompletedPracticeInput,
  'listId' | 'conceptId' | 'roundId' | 'appearanceId'> & {
    ownerId: string;
    kind: 'associated';
    listId: string;
    conceptId: string;
    roundId: string | null;
    appearanceId: string | null;
    conceptTitle: string;
  };
export type IndependentPracticeContext = {
  ownerId: string;
  kind: 'independent';
  listId: null;
  conceptId: null;
  roundId: null;
  appearanceId: null;
};
export type PracticeClosureContext = AssociatedPracticeContext | IndependentPracticeContext;
export type PracticeRoundAction = 'draw' | 'new_round';
export type PracticePostSaveActions =
  | { status: 'loading' | 'error' }
  | { status: 'ready'; repeatAvailable: boolean; roundAction: PracticeRoundAction | null };

type Props = {
  completion: PracticeCompletion;
  context: PracticeClosureContext;
  onReturn: () => void;
  onSaveLockChange: (locked: boolean) => void;
  postSaveActions?: PracticePostSaveActions;
  onSaveConfirmed?: () => void;
  onRetryPostSaveActions?: () => void;
  onRepeat?: () => void;
  onRoundAction?: (action: PracticeRoundAction) => void;
};

export function PracticeClosureView({
  completion,
  context,
  onReturn,
  onSaveLockChange,
  postSaveActions,
  onSaveConfirmed,
  onRetryPostSaveActions,
  onRepeat,
  onRoundAction,
}: Props) {
  const { t, i18n } = useTranslation();
  const form = useForm<{ label: string; note: string }>({ defaultValues: { label: '', note: '' } });
  const [labelError, setLabelError] = useState<'required' | 'tooLong' | null>(null);
  const [noteError, setNoteError] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [result, setResult] = useState<PracticeSaveResult | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const frozenPayload = useRef<CompletedPracticeInput | null>(null);
  const uncertain = result?.status === 'unresolved';
  const saved = result?.status === 'confirmed';
  const associated = context.kind === 'associated';

  useEffect(() => {
    onSaveLockChange(saving || uncertain);
  }, [onSaveLockChange, saving, uncertain]);

  async function save() {
    if (savingRef.current || saved) return;
    const label = form.getValues('label');
    const labelLength = trimmedCodePointLength(label);
    if (!frozenPayload.current && !associated && labelLength === 0) {
      setLabelError('required');
      return;
    }
    if (!frozenPayload.current && !associated && labelLength > 50) {
      setLabelError('tooLong');
      return;
    }
    if (!frozenPayload.current && trimmedCodePointLength(form.getValues('note')) > 2000) {
      setNoteError(true);
      return;
    }
    const payload = frozenPayload.current ?? {
      id: completion.id,
      kind: context.kind,
      listId: context.listId,
      conceptId: context.conceptId,
      roundId: context.roundId,
      appearanceId: context.appearanceId,
      durationMinutes: completion.durationMinutes,
      completedAt: completion.completedAt,
      ...(!associated ? { label } : {}),
      note: form.getValues('note'),
      rating,
    };
    savingRef.current = true;
    setSaving(true);
    setResult(null);
    try {
      const outcome = await saveCompletedPractice(payload);
      if (outcome.status === 'unresolved') frozenPayload.current = payload;
      else frozenPayload.current = null;
      setResult(outcome);
      if (outcome.status === 'confirmed') onSaveConfirmed?.();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="practice-closure-title" className={styles.closure}>
      <header className={styles.practiceHeader}>
        <Button className={styles.backButton} disabled={saving || uncertain} onClick={onReturn} type="button" variant="default">
          {t('practice.return')}
        </Button>
        <Title id="practice-closure-title" order={1}>{t('practice.closureTitle')}</Title>
      </header>
      {associated && <p className={styles.closureConcept}>{context.conceptTitle}</p>}
      <p className={styles.closureSummary}>
        {t('practice.closureDuration', { count: completion.durationMinutes })}
        {' · '}
        {t('practice.closureCompleted', { date: new Intl.DateTimeFormat(i18n.language, {
          dateStyle: 'medium', timeStyle: 'short',
        }).format(new Date(completion.completedAt)) })}
      </p>
      {result?.status === 'confirmed' ? (
        <>
          <p className={styles.closureSuccess} role="status">{t('practice.saveSuccess')}</p>
          <div className={styles.closureActions}>
            {associated && postSaveActions?.status === 'loading' && <p role="status">{t('practice.postSaveLoading')}</p>}
            {associated && postSaveActions?.status === 'error' && (
              <Alert color="red" role="alert">
                {t('practice.postSaveUnavailable')}
                <Button className={styles.cancelButton} onClick={onRetryPostSaveActions} type="button">
                  {t('practice.retryPostSaveActions')}
                </Button>
              </Alert>
            )}
            {associated && postSaveActions?.status === 'ready' && postSaveActions.repeatAvailable && (
              <Button className={styles.timerActionButton} onClick={onRepeat} type="button" variant="filled">
                {t('practice.repeatPractice')}
              </Button>
            )}
            {associated && postSaveActions?.status === 'ready' && postSaveActions.roundAction && (
              <Button className={styles.restartButton} onClick={() => onRoundAction?.(postSaveActions.roundAction!)} type="button" variant="filled">
                {t(postSaveActions.roundAction === 'draw' ? 'practice.drawAnother' : 'practice.startNewRound')}
              </Button>
            )}
            {!associated && (
              <Button className={styles.timerActionButton} onClick={onRepeat} type="button" variant="filled">
                {t('practice.practiceAgain')}
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          {result?.status === 'rejected' && <Alert color="red" role="alert">{t('practice.saveFailure')}</Alert>}
          {result?.status === 'unresolved' && <Alert color="yellow" role="alert">{t('practice.saveUnresolved')}</Alert>}
          {!associated && (
            <label className={styles.closureField}>
              <span>{t('practice.independentLabel')}</span>
              <Controller
                control={form.control}
                name="label"
                render={({ field }) => (
                  <TextInput
                    {...field}
                    aria-label={t('practice.independentLabel')}
                    aria-invalid={labelError !== null}
                    aria-describedby={labelError ? 'practice-label-error' : undefined}
                    disabled={saving || uncertain}
                    onChange={(event) => {
                      field.onChange(event);
                      setLabelError(null);
                    }}
                  />
                )}
              />
              {labelError && <span className={styles.error} id="practice-label-error" role="alert">{t(labelError === 'required' ? 'practice.labelRequired' : 'practice.labelTooLong')}</span>}
            </label>
          )}
          <label className={styles.closureField}>
            <span>{t('practice.noteOptional')}</span>
            <Controller
              control={form.control}
              name="note"
              render={({ field }) => (
                <Textarea
                  {...field}
                  aria-label={t('practice.noteOptional')}
                  aria-invalid={noteError}
                  aria-describedby={noteError ? 'practice-note-error' : undefined}
                  disabled={saving || uncertain}
                  onChange={(event) => {
                    field.onChange(event);
                    setNoteError(false);
                  }}
                  autosize
                  minRows={4}
                  maxRows={10}
                />
              )}
            />
            {noteError && <span className={styles.error} id="practice-note-error" role="alert">{t('practice.noteTooLong')}</span>}
          </label>
          <fieldset className={styles.ratingField} disabled={saving || uncertain}>
            <legend>{t('practice.ratingOptional')}</legend>
            <div className={styles.ratingOptions}>
              <Button aria-pressed={rating === null} onClick={() => setRating(null)} type="button" variant="default">
                {t('practice.unrated')}
              </Button>
              {[0, 1, 2, 3, 4, 5].map((value) => (
                <Button
                  aria-pressed={rating === value}
                  key={value}
                  onClick={() => setRating(value)}
                  type="button"
                  variant="default"
                >{value}</Button>
              ))}
            </div>
          </fieldset>
          <div className={styles.closureActions}>
            <Button className={styles.timerActionButton} disabled={saving} onClick={() => void save()} type="button">
              {uncertain ? t('practice.retrySave') : saving ? t('practice.saving') : t('practice.savePractice')}
            </Button>
          </div>
          {saving && <p role="status">{t('practice.saving')}</p>}
        </>
      )}
    </section>
  );
}
