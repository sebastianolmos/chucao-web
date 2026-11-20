import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Modal } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { volumeToGain } from './volumeScale';
import {
  createTimerSnapshot,
  isValidDurationMinutes,
  pauseTimer,
  restartTimer,
  resumeTimer,
  startTimer,
  syncTimer,
  type TimerSnapshot,
} from './timerModel';
import { ForestTimerScene } from './ForestTimerScene';
import chucaoAudio from '../../assets/chucao.wav';
import styles from './practice.module.css';

export type PracticeConcept = { title: string; description: string };

export type PracticeViewProps = {
  initialDurationMinutes: number;
  reducedMotion: boolean | null;
  soundEnabled: boolean;
  soundVolume: number;
  concept?: PracticeConcept;
  onReturn: () => void;
  onStatusChange?: (status: TimerSnapshot['status']) => void;
  onCompleted?: (completion: { id: string; durationMinutes: number; completedAt: string }) => void;
  onContinueToClosure?: () => void;
  returnLabel?: string;
  showTitle?: boolean;
};

function readSystemReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function formatRemaining(milliseconds: number) {
  const seconds = Math.ceil(milliseconds / 1_000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function PracticeView({
  initialDurationMinutes,
  reducedMotion,
  soundEnabled,
  soundVolume,
  concept,
  onReturn,
  onStatusChange,
  onCompleted,
  onContinueToClosure,
  returnLabel,
  showTitle = true,
}: PracticeViewProps) {
  const { t } = useTranslation();
  const [snapshotPreferences] = useState(() => ({
    reducedMotion: reducedMotion ?? readSystemReducedMotion(),
    soundEnabled,
    soundVolume,
  }));
  const [snapshot, setSnapshot] = useState<TimerSnapshot>(() => createTimerSnapshot(initialDurationMinutes));
  const [durationText, setDurationText] = useState(String(initialDurationMinutes));
  const [invalidDuration, setInvalidDuration] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [descriptionVisible, setDescriptionVisible] = useState(false);
  const [durationEditing, setDurationEditing] = useState(false);
  const [singing, setSinging] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const completedSoundAttempted = useRef(false);
  const saveIdentity = useRef(crypto.randomUUID());
  const completedIdentity = useRef<string | null>(null);
  const completedAt = useRef<string | null>(null);
  const singingTimeout = useRef<number | null>(null);
  const syncedSnapshot = useMemo(() => syncTimer(snapshot, nowMs), [nowMs, snapshot]);
  const remainingMs = syncedSnapshot.status === 'running'
    ? Math.max(0, syncedSnapshot.remainingMs - Math.max(0, nowMs - syncedSnapshot.startedAtMs))
    : syncedSnapshot.remainingMs;
  const elapsedMs = syncedSnapshot.durationMinutes * 60_000 - remainingMs;
  const completionAtMs = syncedSnapshot.status === 'running'
    ? syncedSnapshot.startedAtMs + syncedSnapshot.remainingMs
    : null;

  useEffect(() => {
    onStatusChange?.(syncedSnapshot.status);
  }, [onStatusChange, syncedSnapshot.status]);

  useEffect(() => {
    if (syncedSnapshot.status !== 'completed' || completedIdentity.current === saveIdentity.current) return;
    completedIdentity.current = saveIdentity.current;
    onCompleted?.({
      id: saveIdentity.current,
      durationMinutes: syncedSnapshot.durationMinutes,
      completedAt: completedAt.current ?? new Date().toISOString(),
    });
  }, [completionAtMs, onCompleted, syncedSnapshot.durationMinutes, syncedSnapshot.status]);

  useEffect(() => {
    if (completionAtMs === null) return undefined;
    const interval = window.setInterval(() => {
      const tick = Date.now();
      if (tick >= completionAtMs && singingTimeout.current === null) {
        completedAt.current = new Date(tick).toISOString();
        setSinging(true);
        singingTimeout.current = window.setTimeout(() => {
          setSinging(false);
          singingTimeout.current = null;
        }, 1_500);
      }
      setNowMs(tick);
      setSnapshot((current) => syncTimer(current, tick));
    }, 100);
    return () => window.clearInterval(interval);
  }, [completionAtMs]);

  useEffect(() => {
    if (syncedSnapshot.status !== 'completed' || completedSoundAttempted.current) return;
    completedSoundAttempted.current = true;
    if (!snapshotPreferences.soundEnabled || snapshotPreferences.soundVolume === 0) return;
    try {
      const audio = new Audio(chucaoAudio);
      audio.volume = volumeToGain(snapshotPreferences.soundVolume);
      void audio.play()?.catch(() => undefined);
    } catch {
      // Sound is optional; timer completion has already been committed in memory.
    }
  }, [snapshotPreferences, syncedSnapshot.status]);

  function updateDuration(value: string) {
    setDurationText(value);
    const parsed = value.trim() === '' ? Number.NaN : Number(value);
    if (!isValidDurationMinutes(parsed)) {
      setInvalidDuration(true);
      return;
    }
    setInvalidDuration(false);
    if (snapshot.status === 'prepared') {
      setSnapshot(createTimerSnapshot(parsed));
    }
  }

  function start() {
    if (invalidDuration || snapshot.status !== 'prepared') return;
    setNowMs(Date.now());
    setSnapshot((current) => startTimer(current, Date.now()));
  }

  function pause() {
    const tick = Date.now();
    setNowMs(tick);
    setSnapshot((current) => pauseTimer(current, tick));
  }

  function resume() {
    const tick = Date.now();
    setNowMs(tick);
    setSnapshot((current) => resumeTimer(current, tick));
  }

  function confirmRestart() {
    setSnapshot((current) => restartTimer(current, true));
    saveIdentity.current = crypto.randomUUID();
    completedIdentity.current = null;
    completedAt.current = null;
    setDurationText(String(snapshot.durationMinutes));
    setInvalidDuration(false);
    setDescriptionVisible(false);
    setRestartOpen(false);
    setSinging(false);
    if (singingTimeout.current !== null) window.clearTimeout(singingTimeout.current);
    singingTimeout.current = null;
    setDurationEditing(false);
    completedSoundAttempted.current = false;
    setNowMs(Date.now());
  }

  const stateLabel = {
    prepared: t('practice.statePrepared'),
    running: t('practice.stateRunning'),
    paused: t('practice.statePaused'),
    completed: t('practice.stateCompleted'),
  }[syncedSnapshot.status];

  return (
    <section className={styles.practice} aria-labelledby={showTitle ? 'practice-title' : undefined}>
      <header className={styles.practiceHeader}>
        <Button
          className={styles.backButton}
          onClick={onReturn}
          type="button"
          variant="default"
        >
          {returnLabel ?? (concept ? t('rounds.returnToList') : t('practice.returnToLists'))}
        </Button>
        {showTitle && <h1 id="practice-title">{concept?.title ?? t('practice.title')}</h1>}
      </header>
      <ForestTimerScene
        completed={syncedSnapshot.status === 'completed'}
        durationMinutes={syncedSnapshot.durationMinutes}
        elapsedMs={elapsedMs}
        label={t('practice.scene')}
        paused={syncedSnapshot.status === 'paused'}
        reducedMotion={snapshotPreferences.reducedMotion}
        running={syncedSnapshot.status === 'running'}
        singing={singing}
      />
      <div className={styles.timerPanel}>
        <p aria-label={stateLabel} className={styles.state} role="status">
          {stateLabel}
        </p>
        {syncedSnapshot.status === 'prepared' && durationEditing ? (
          <label className={styles.durationEditor}>
            <span>{t('practice.duration')}</span>
            <input
              autoFocus
              aria-describedby={invalidDuration ? 'practice-duration-error' : undefined}
              aria-invalid={invalidDuration}
              className={styles.clockInput}
              max={59}
              min={1}
              onBlur={() => { if (!invalidDuration) setDurationEditing(false); }}
              onChange={(event) => updateDuration(event.currentTarget.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && !invalidDuration) setDurationEditing(false); }}
              type="number"
              value={durationText}
            />
          </label>
        ) : syncedSnapshot.status === 'prepared' ? (
          <button
            aria-label={`${t('practice.editDuration')}: ${formatRemaining(remainingMs)}`}
            className={styles.clockEditButton}
            onClick={() => setDurationEditing(true)}
            type="button"
          >
            {formatRemaining(remainingMs)}
          </button>
        ) : (
          <p aria-label={t('practice.remainingTime')} className={styles.clock}>
            {formatRemaining(remainingMs)}
          </p>
        )}
      </div>

      <div aria-label={t('practice.controls')} className={styles.controls} role="group">
        {syncedSnapshot.status === 'prepared' && (
          <Button className={styles.timerActionButton} disabled={invalidDuration} onClick={start} type="button" variant="filled">{t('practice.start')}</Button>
        )}
        {syncedSnapshot.status === 'running' && (
          <Button className={styles.timerActionButton} onClick={pause} type="button" variant="filled">{t('practice.pause')}</Button>
        )}
        {syncedSnapshot.status === 'paused' && (
          <Button className={styles.timerActionButton} onClick={resume} type="button" variant="filled">{t('practice.resume')}</Button>
        )}
        {syncedSnapshot.status === 'completed' && (
          <>
            {onContinueToClosure && (
              <Button className={styles.timerActionButton} onClick={onContinueToClosure} type="button" variant="filled">
                {t('practice.openClosure')}
              </Button>
            )}
            <Button
              className={onContinueToClosure ? styles.cancelButton : styles.timerActionButton}
              onClick={onReturn}
              type="button"
              variant="filled"
            >{t('practice.return')}</Button>
          </>
        )}
        {invalidDuration && <p className={styles.error} id="practice-duration-error" role="alert">{t('practice.invalidDuration')}</p>}
        <Button
          className={styles.restartButton}
          onClick={() => setRestartOpen(true)}
          type="button"
          variant="filled"
        >
          {t('practice.restart')}
        </Button>
      </div>

      {concept && (
        <section aria-label={concept.title} className={styles.concept}>
          <Button
            onClick={() => setDescriptionVisible((visible) => !visible)}
            styles={{ root: { backgroundColor: 'var(--chucao-lilac)', border: '2px solid var(--chucao-brown)', boxShadow: '3px 4px 0 var(--chucao-brown)', color: 'var(--chucao-brown)' } }}
            type="button"
            variant="default"
          >
            {descriptionVisible ? t('practice.hideDescription') : t('practice.showDescription')}
          </Button>
          {descriptionVisible && <p className={styles.description}>{concept.description}</p>}
        </section>
      )}

      <Modal
        centered
        closeButtonProps={{ 'aria-label': t('practice.closeRestartDialog') }}
        onClose={() => setRestartOpen(false)}
        opened={restartOpen}
        classNames={{ close: styles.restartModalClose }}
        styles={{
          content: { border: '2px solid var(--chucao-brown)', borderRadius: '1rem', backgroundColor: 'var(--chucao-panel)', boxShadow: '4px 5px 0 var(--chucao-brown)', color: 'var(--chucao-brown)' },
          header: { backgroundColor: 'var(--chucao-cream)', color: 'var(--chucao-brown)' },
          title: { color: 'var(--chucao-brown)', fontSize: '1.4rem', fontWeight: 800 },
          body: { backgroundColor: 'var(--chucao-panel)', color: 'var(--chucao-brown)' },
          close: { backgroundColor: 'var(--chucao-cyan)', color: 'var(--chucao-brown)', border: '1px solid var(--chucao-brown)' },
        }}
        transitionProps={{ duration: 0 }}
        title={t('practice.restartTitle')}
      >
        <p>{t('practice.restartMessage')}</p>
        <div className={styles.dialogActions}>
          <Button className={styles.cancelButton} onClick={() => setRestartOpen(false)} type="button" variant="filled">{t('practice.cancel')}</Button>
          <Button className={styles.timerActionButton} onClick={confirmRestart} type="button" variant="filled">{t('practice.confirmRestart')}</Button>
        </div>
      </Modal>
    </section>
  );
}
