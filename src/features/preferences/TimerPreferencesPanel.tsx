import { useEffect, useRef, useState } from 'react';
import { Button, NativeSelect, Slider, Switch } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../app/toasts/useToast';
import chucaoAudio from '../../assets/chucao.wav';
import { volumeToGain } from '../practice/volumeScale';
import {
  DEFAULT_TIMER_PREFERENCES,
  getTimerPreferences,
  setTimerPreference,
  type TimerPreferenceKey,
  type TimerPreferences,
} from './preferencesService';
import styles from './timerPreferences.module.css';

type SaveState = 'idle' | 'pending' | 'failed';
type SaveStates = Record<TimerPreferenceKey, SaveState>;

const idleSaveStates: SaveStates = {
  defaultDurationMinutes: 'idle',
  completionSoundEnabled: 'idle',
  soundVolume: 'idle',
  reducedMotion: 'idle',
};

function effectiveMotionValue(value: boolean | null): string {
  return value === null ? 'system' : value ? 'reduce' : 'full';
}

export function TimerPreferencesPanel({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [preferences, setPreferences] = useState<TimerPreferences>(
    DEFAULT_TIMER_PREFERENCES,
  );
  const [saveStates, setSaveStates] = useState<SaveStates>(idleSaveStates);
  const [reading, setReading] = useState(true);
  const [readError, setReadError] = useState(false);
  const [readAttempt, setReadAttempt] = useState(0);
  const [previewState, setPreviewState] = useState<'idle' | 'playing' | 'failed' | 'silent'>('idle');
  const editedFieldsRef = useRef(new Set<TimerPreferenceKey>());
  const requestIdsRef = useRef<Record<TimerPreferenceKey, number>>({
    defaultDurationMinutes: 0,
    completionSoundEnabled: 0,
    soundVolume: 0,
    reducedMotion: 0,
  });
  const saveQueuesRef = useRef<Record<TimerPreferenceKey, Promise<void>>>({
    defaultDurationMinutes: Promise.resolve(),
    completionSoundEnabled: Promise.resolve(),
    soundVolume: Promise.resolve(),
    reducedMotion: Promise.resolve(),
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const userIdRef = useRef(userId);

  useEffect(() => {
    let active = true;
    userIdRef.current = userId;
    editedFieldsRef.current.clear();

    const load = async () => {
      try {
        const result = await getTimerPreferences(userId);
        if (!active || userIdRef.current !== userId) return;
        setReadError(false);
        setPreferences((current) => {
          const next = { ...current };
          for (const key of Object.keys(result) as TimerPreferenceKey[]) {
            if (!editedFieldsRef.current.has(key)) next[key] = result[key] as never;
          }
          return next;
        });
      } catch {
        if (active && userIdRef.current === userId) setReadError(true);
      } finally {
        if (active && userIdRef.current === userId) setReading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, [readAttempt, userId]);

  useEffect(() => () => {
    audioRef.current?.pause();
    audioRef.current = null;
  }, []);

  function save<K extends TimerPreferenceKey>(
    key: K,
    value: TimerPreferences[K],
  ) {
    const requestId = requestIdsRef.current[key] + 1;
    requestIdsRef.current[key] = requestId;
    setSaveStates((current) => ({ ...current, [key]: 'pending' }));
    const queuedSave = saveQueuesRef.current[key].catch(() => undefined).then(async () => {
      try {
        await setTimerPreference(userId, key, value);
        if (userIdRef.current === userId && requestIdsRef.current[key] === requestId) {
          setSaveStates((current) => ({ ...current, [key]: 'idle' }));
          const preferenceLabel = {
            defaultDurationMinutes: t('timerPreferences.duration'),
            completionSoundEnabled: t('timerPreferences.soundEnabled'),
            soundVolume: t('timerPreferences.volume'),
            reducedMotion: t('timerPreferences.motion'),
          }[key];
          notify(t('timerPreferences.savedPreference', { preference: preferenceLabel }), 'success');
        }
      } catch {
        if (userIdRef.current === userId && requestIdsRef.current[key] === requestId) {
          setSaveStates((current) => ({ ...current, [key]: 'failed' }));
        }
      }
    });
    saveQueuesRef.current[key] = queuedSave;
    return queuedSave;
  }

  function update<K extends TimerPreferenceKey>(key: K, value: TimerPreferences[K]) {
    editedFieldsRef.current.add(key);
    setPreferences((current) => ({ ...current, [key]: value }));
    void save(key, value);
  }

  function retry(key: TimerPreferenceKey) {
    void save(key, preferences[key] as never);
  }

  function saveStatus(key: TimerPreferenceKey) {
    const state = saveStates[key];
    if (state === 'pending') return <span role="status">{t('timerPreferences.saving')}</span>;
    if (state === 'failed') {
      return (
        <span className={styles.error} role="alert">
          {t('timerPreferences.saveError')}{' '}
          <Button
            onClick={() => retry(key)}
            size="compact-sm"
            styles={{ root: { backgroundColor: 'var(--chucao-yellow)', border: '2px solid var(--chucao-brown)', boxShadow: '2px 3px 0 var(--chucao-brown)', color: 'var(--chucao-brown)' } }}
            type="button"
            variant="subtle"
          >
            {t('timerPreferences.retry')}
          </Button>
        </span>
      );
    }
    return null;
  }

  function previewSound() {
    audioRef.current?.pause();
    audioRef.current = null;
    if (preferences.soundVolume === 0) {
      setPreviewState('silent');
      return;
    }

    const audio = new Audio(chucaoAudio);
    audio.volume = volumeToGain(preferences.soundVolume);
    audioRef.current = audio;
    setPreviewState('playing');
    void audio.play().then(() => {
      if (audioRef.current === audio) setPreviewState('playing');
    }).catch(() => {
      if (audioRef.current === audio) setPreviewState('failed');
    });
  }

  return (
    <section aria-labelledby="timer-preferences-title" className={styles.panel}>
      <h2 id="timer-preferences-title">{t('timerPreferences.title')}</h2>
      {reading && <p role="status">{t('timerPreferences.loading')}</p>}
      {readError && (
        <p className={styles.error} role="alert">
          {t('timerPreferences.readError')}{' '}
          <Button onClick={() => {
            setReadError(false);
            setReading(true);
            setReadAttempt((current) => current + 1);
          }} size="compact-sm" styles={{ root: { backgroundColor: 'var(--chucao-yellow)', border: '2px solid var(--chucao-brown)', boxShadow: '2px 3px 0 var(--chucao-brown)', color: 'var(--chucao-brown)' } }} type="button" variant="subtle">
            {t('timerPreferences.retry')}
          </Button>
        </p>
      )}

      <div className={styles.field}>
        <NativeSelect
          data={Array.from({ length: 59 }, (_, index) => ({
            value: String(index + 1),
            label: t('timerPreferences.durationOption', { count: index + 1 }),
          }))}
          label={t('timerPreferences.duration')}
          onChange={(value) => {
            update('defaultDurationMinutes', Number(value.currentTarget.value));
          }}
          styles={{
            input: { backgroundColor: 'var(--chucao-cream)', borderColor: 'var(--chucao-brown)', color: 'var(--chucao-brown)' },
            label: { color: 'var(--chucao-brown)', fontWeight: 700 },
          }}
          value={String(preferences.defaultDurationMinutes)}
        />
        {saveStatus('defaultDurationMinutes')}
      </div>

      <div className={styles.field}>
        <Switch
          checked={preferences.completionSoundEnabled}
          label={t('timerPreferences.soundEnabled')}
          onChange={(event) => update('completionSoundEnabled', event.currentTarget.checked)}
          styles={{ label: { color: 'var(--chucao-brown)', fontWeight: 700 } }}
        />
        {saveStatus('completionSoundEnabled')}
      </div>

      <div className={styles.field}>
        <label className={styles.sliderLabel} htmlFor="timer-sound-volume">
          <span>{t('timerPreferences.volume')}</span>
          <output>{preferences.soundVolume}</output>
        </label>
        <Slider
          id="timer-sound-volume"
          max={100}
          min={0}
          onChange={(value) => {
            editedFieldsRef.current.add('soundVolume');
            setPreferences((current) => ({ ...current, soundVolume: value }));
          }}
          onChangeEnd={(value) => void save('soundVolume', value)}
          styles={{
            track: { backgroundColor: 'var(--chucao-cream)' },
            bar: { backgroundColor: 'var(--chucao-lilac)' },
            thumb: { backgroundColor: 'var(--chucao-lilac)', borderColor: 'var(--chucao-brown)' },
          }}
          thumbLabel={t('timerPreferences.volume')}
          value={preferences.soundVolume}
        />
        <p className={styles.hint}>{t('timerPreferences.volumeHint')}</p>
        {saveStatus('soundVolume')}
        <Button
          onClick={previewSound}
          styles={{ root: { backgroundColor: 'var(--chucao-cyan)', border: '2px solid var(--chucao-brown)', boxShadow: '3px 4px 0 var(--chucao-brown)', color: 'var(--chucao-brown)' } }}
          type="button"
          variant="default"
        >
          {t('timerPreferences.preview')}
        </Button>
        {previewState === 'failed' && <p role="status">{t('timerPreferences.previewFailed')}</p>}
        {previewState === 'silent' && <p role="status">{t('timerPreferences.previewSilent')}</p>}
      </div>

      <div className={styles.field}>
        <NativeSelect
          data={[
            { value: 'system', label: t('timerPreferences.motionSystem') },
            { value: 'reduce', label: t('timerPreferences.motionReduced') },
            { value: 'full', label: t('timerPreferences.motionFull') },
          ]}
          label={t('timerPreferences.motion')}
          onChange={(value) => {
            const selectedValue = value.currentTarget.value;
            update('reducedMotion', selectedValue === 'system' ? null : selectedValue === 'reduce');
          }}
          styles={{
            input: { backgroundColor: 'var(--chucao-cream)', borderColor: 'var(--chucao-brown)', color: 'var(--chucao-brown)' },
            label: { color: 'var(--chucao-brown)', fontWeight: 700 },
          }}
          value={effectiveMotionValue(preferences.reducedMotion)}
        />
        {saveStatus('reducedMotion')}
      </div>

      <p className={styles.hint}>{t('timerPreferences.futureSessions')}</p>
    </section>
  );
}
