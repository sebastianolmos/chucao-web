import type { Locale, ProfileRow } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';
import {
  mapSupabaseError,
  invalidTimerPreferenceError,
  unauthorizedError,
} from '../shared/supabaseErrors';

export const profileQueryKey = (userId: string) => ['profile', userId] as const;

export type TimerPreferences = {
  defaultDurationMinutes: number;
  completionSoundEnabled: boolean;
  soundVolume: number;
  reducedMotion: boolean | null;
};

export type TimerPreferenceKey = keyof TimerPreferences;

export const DEFAULT_TIMER_PREFERENCES: TimerPreferences = {
  defaultDurationMinutes: 1,
  completionSoundEnabled: true,
  soundVolume: 50,
  reducedMotion: null,
};

const timerPreferenceColumns =
  'default_timer_minutes, completion_sound_enabled, sound_volume, reduced_motion';

type TimerPreferenceFields = Pick<
  ProfileRow,
  | 'default_timer_minutes'
  | 'completion_sound_enabled'
  | 'sound_volume'
  | 'reduced_motion'
>;

function toTimerPreferences(
  profile: TimerPreferenceFields | null,
): TimerPreferences {
  return {
    defaultDurationMinutes:
      profile?.default_timer_minutes ?? DEFAULT_TIMER_PREFERENCES.defaultDurationMinutes,
    completionSoundEnabled:
      profile?.completion_sound_enabled ?? DEFAULT_TIMER_PREFERENCES.completionSoundEnabled,
    soundVolume: profile?.sound_volume ?? DEFAULT_TIMER_PREFERENCES.soundVolume,
    reducedMotion: profile?.reduced_motion ?? null,
  };
}

function preferenceUpdate(
  key: TimerPreferenceKey,
  value: unknown,
): Partial<TimerPreferenceFields> {
  switch (key) {
    case 'defaultDurationMinutes':
      if (
        typeof value !== 'number'
        || !Number.isInteger(value)
        || value < 1
        || value > 59
      ) {
        throw invalidTimerPreferenceError();
      }
      return { default_timer_minutes: value };
    case 'completionSoundEnabled':
      if (typeof value !== 'boolean') {
        throw invalidTimerPreferenceError();
      }
      return { completion_sound_enabled: value };
    case 'soundVolume':
      if (
        typeof value !== 'number'
        || !Number.isInteger(value)
        || value < 0
        || value > 100
      ) {
        throw invalidTimerPreferenceError();
      }
      return { sound_volume: value };
    case 'reducedMotion':
      if (value !== null && typeof value !== 'boolean') {
        throw invalidTimerPreferenceError();
      }
      return { reduced_motion: value };
    default:
      throw invalidTimerPreferenceError();
  }
}

async function assertCurrentUser(userId: string): Promise<void> {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw mapSupabaseError(error);
  }

  if (!data.user) {
    throw mapSupabaseError({ code: '28000', message: 'unauthenticated' });
  }

  if (data.user.id !== userId) {
    throw unauthorizedError();
  }
}

export async function ensureProfile(): Promise<ProfileRow> {
  const { data, error } = await supabase.rpc('ensure_profile');

  if (error) {
    throw mapSupabaseError(error);
  }

  return data;
}

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  await assertCurrentUser(userId);

  const { data, error } = await supabase
    .from('profiles')
    .select('id, locale, default_timer_minutes, completion_sound_enabled, sound_volume, reduced_motion, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw mapSupabaseError(error);
  }

  return data;
}

export async function getTimerPreferences(
  userId: string,
): Promise<TimerPreferences> {
  await assertCurrentUser(userId);

  const { data, error } = await supabase
    .from('profiles')
    .select(timerPreferenceColumns)
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw mapSupabaseError(error);
  }

  return toTimerPreferences(data);
}

export async function setTimerPreference<K extends TimerPreferenceKey>(
  userId: string,
  key: K,
  value: TimerPreferences[K],
): Promise<TimerPreferences> {
  const update = preferenceUpdate(key, value);
  const [column] = Object.keys(update);

  if (!column) {
    throw invalidTimerPreferenceError();
  }

  await assertCurrentUser(userId);

  const { data, error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', userId)
    .select(timerPreferenceColumns)
    .single();

  if (error) {
    throw mapSupabaseError(error);
  }

  return toTimerPreferences(data);
}

export async function getLocale(userId: string): Promise<Locale | null> {
  const profile = await getProfile(userId);
  return profile?.locale ?? null;
}

export async function setLocale(
  userId: string,
  locale: Locale,
): Promise<ProfileRow> {
  await assertCurrentUser(userId);

  const { data, error } = await supabase
    .from('profiles')
    .update({ locale })
    .eq('id', userId)
    .select('id, locale, default_timer_minutes, completion_sound_enabled, sound_volume, reduced_motion, created_at, updated_at')
    .single();

  if (error) {
    throw mapSupabaseError(error);
  }

  return data;
}
