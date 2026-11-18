import { describe, expect, it } from 'vitest';
import {
  createTimerSnapshot,
  getRemainingMilliseconds,
  isValidDurationMinutes,
  pauseTimer,
  restartTimer,
  resumeTimer,
  startTimer,
  syncTimer,
} from './timerModel';

describe('timer model', () => {
  it.each([1, 59])('accepts %i whole minutes', (minutes) => {
    expect(isValidDurationMinutes(minutes)).toBe(true);
    expect(createTimerSnapshot(minutes)).toMatchObject({
      status: 'prepared',
      durationMinutes: minutes,
      remainingMs: minutes * 60_000,
    });
  });

  it.each([0, 60, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '1', null])(
    'rejects invalid duration %s',
    (minutes) => {
      expect(isValidDurationMinutes(minutes)).toBe(false);
      expect(() => createTimerSnapshot(minutes as number)).toThrow(RangeError);
    },
  );

  it('derives remaining time from elapsed wall-clock time, not tick count', () => {
    const running = startTimer(createTimerSnapshot(1), 10_000);

    expect(getRemainingMilliseconds(running, 10_000)).toBe(60_000);
    expect(getRemainingMilliseconds(running, 13_750)).toBe(56_250);
    expect(getRemainingMilliseconds(running, 70_000)).toBe(0);
  });

  it('freezes at pause and resumes from the remaining duration', () => {
    const running = startTimer(createTimerSnapshot(1), 1_000);
    const paused = pauseTimer(running, 4_500);

    expect(paused).toMatchObject({ status: 'paused', remainingMs: 56_500 });
    expect(getRemainingMilliseconds(paused, 200_000)).toBe(56_500);

    const resumed = resumeTimer(paused, 50_000);
    expect(resumed).toMatchObject({ status: 'running', remainingMs: 56_500 });
    expect(getRemainingMilliseconds(resumed, 55_000)).toBe(51_500);
  });

  it('completes once at zero and clamps a delayed update after backgrounding', () => {
    const running = startTimer(createTimerSnapshot(1), 0);

    expect(syncTimer(running, 59_999).status).toBe('running');
    const completed = syncTimer(running, 60_000);
    expect(completed).toEqual({
      status: 'completed',
      durationMinutes: 1,
      remainingMs: 0,
    });
    expect(syncTimer(completed, 80_000)).toBe(completed);
    expect(syncTimer(running, 61_500)).toEqual(completed);
  });

  it('turns a pause at or after the deadline into completion', () => {
    const running = startTimer(createTimerSnapshot(1), 0);

    expect(pauseTimer(running, 60_000).status).toBe('completed');
  });

  it('leaves state unchanged when restart is cancelled and resets when confirmed', () => {
    const running = startTimer(createTimerSnapshot(1), 10_000);
    const paused = pauseTimer(running, 25_000);

    expect(restartTimer(paused, false)).toBe(paused);
    expect(restartTimer(syncTimer(running, 70_000), true)).toEqual({
      status: 'prepared',
      durationMinutes: 1,
      remainingMs: 60_000,
    });
  });

  it('restarts from each timer state at its full selected duration', () => {
    const prepared = createTimerSnapshot(2);
    const running = startTimer(prepared, 0);
    const paused = pauseTimer(running, 10_000);
    const completed = syncTimer(startTimer(createTimerSnapshot(1), 0), 60_000);

    for (const snapshot of [prepared, running, paused, completed]) {
      expect(restartTimer(snapshot, true)).toEqual({
        status: 'prepared',
        durationMinutes: snapshot.durationMinutes,
        remainingMs: snapshot.durationMinutes * 60_000,
      });
    }
  });

  it('does not apply start or pause transitions to an incompatible state', () => {
    const prepared = createTimerSnapshot(1);
    const running = startTimer(prepared, 100);

    expect(startTimer(running, 200)).toBe(running);
    expect(pauseTimer(prepared, 200)).toBe(prepared);
  });
});
