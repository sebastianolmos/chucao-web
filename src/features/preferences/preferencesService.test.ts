import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getUser, from, select, eq, maybeSingle, update, single } = vi.hoisted(() => {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    update: vi.fn(),
    single: vi.fn(),
  };
  builder.select.mockReturnThis();
  builder.eq.mockReturnThis();
  builder.update.mockReturnThis();

  return {
    getUser: vi.fn(),
    from: vi.fn(() => builder),
    select: builder.select,
    eq: builder.eq,
    maybeSingle: builder.maybeSingle,
    update: builder.update,
    single: builder.single,
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser },
    from,
  },
}));

import { DomainServiceError } from '../shared/supabaseErrors';
import {
  getTimerPreferences,
  setTimerPreference,
} from './preferencesService';

const USER_ID = 'user-a';
const TIMER_COLUMNS = 'default_timer_minutes, completion_sound_enabled, sound_volume, reduced_motion';

describe('timer preference service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    maybeSingle.mockResolvedValue({ data: null, error: null });
    single.mockResolvedValue({
      data: {
        default_timer_minutes: 25,
        completion_sound_enabled: false,
        sound_volume: 50,
        reduced_motion: null,
      },
      error: null,
    });
  });

  it('maps an empty profile to the product defaults and leaves motion unset', async () => {
    await expect(getTimerPreferences(USER_ID)).resolves.toEqual({
      defaultDurationMinutes: 1,
      completionSoundEnabled: true,
      soundVolume: 50,
      reducedMotion: null,
    });

    expect(getUser).toHaveBeenCalledOnce();
    expect(from).toHaveBeenCalledWith('profiles');
    expect(select).toHaveBeenCalledWith(TIMER_COLUMNS);
    expect(eq).toHaveBeenCalledWith('id', USER_ID);
    expect(maybeSingle).toHaveBeenCalledOnce();
  });

  it('returns saved values while preserving a null reduced-motion override', async () => {
    maybeSingle.mockResolvedValue({
      data: {
        default_timer_minutes: 23,
        completion_sound_enabled: false,
        sound_volume: 0,
        reduced_motion: null,
      },
      error: null,
    });

    await expect(getTimerPreferences(USER_ID)).resolves.toEqual({
      defaultDurationMinutes: 23,
      completionSoundEnabled: false,
      soundVolume: 0,
      reducedMotion: null,
    });
  });

  it('updates only the selected allowlisted preference for the current user', async () => {
    await expect(
      setTimerPreference(USER_ID, 'defaultDurationMinutes', 25),
    ).resolves.toEqual({
      defaultDurationMinutes: 25,
      completionSoundEnabled: false,
      soundVolume: 50,
      reducedMotion: null,
    });

    expect(update).toHaveBeenCalledWith({ default_timer_minutes: 25 });
    expect(eq).toHaveBeenCalledWith('id', USER_ID);
    expect(select).toHaveBeenCalledWith(TIMER_COLUMNS);
    expect(single).toHaveBeenCalledOnce();
  });

  it.each([
    ['completionSoundEnabled', false, { completion_sound_enabled: false }],
    ['soundVolume', 0, { sound_volume: 0 }],
    ['reducedMotion', true, { reduced_motion: true }],
    ['reducedMotion', null, { reduced_motion: null }],
  ])('writes only the selected %s column', async (key, value, patch) => {
    await setTimerPreference(USER_ID, key as never, value as never);

    expect(update).toHaveBeenCalledWith(patch);
    expect(update).toHaveBeenCalledOnce();
  });

  it.each([
    ['defaultDurationMinutes', 0],
    ['defaultDurationMinutes', 60],
    ['defaultDurationMinutes', 1.5],
    ['completionSoundEnabled', 'yes'],
    ['soundVolume', -1],
    ['soundVolume', 101],
    ['soundVolume', 50.5],
    ['reducedMotion', 'system'],
  ])('rejects invalid %s values before any profile write', async (key, value) => {
    await expect(
      setTimerPreference(USER_ID, key as never, value as never),
    ).rejects.toMatchObject<Partial<DomainServiceError>>({
      code: 'invalid_timer_preference',
    });

    expect(from).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects a request for another user before reading their profile', async () => {
    await expect(getTimerPreferences('user-b')).rejects.toMatchObject({
      code: 'unauthorized',
    });

    expect(from).not.toHaveBeenCalled();
  });

  it('surfaces a failed persistence request instead of returning saved values', async () => {
    single.mockResolvedValue({
      data: null,
      error: { code: 'FETCH_ERROR', message: 'Network timeout' },
    });

    await expect(
      setTimerPreference(USER_ID, 'soundVolume', 60),
    ).rejects.toMatchObject<Partial<DomainServiceError>>({
      code: 'unavailable',
    });
    expect(update).toHaveBeenCalledWith({ sound_volume: 60 });
    expect(single).toHaveBeenCalledOnce();
  });

  it('surfaces a failed read instead of returning product defaults', async () => {
    maybeSingle.mockResolvedValue({
      data: null,
      error: { code: 'FETCH_ERROR', message: 'Network timeout' },
    });

    await expect(getTimerPreferences(USER_ID)).rejects.toMatchObject({
      code: 'unavailable',
    });
  });
});
