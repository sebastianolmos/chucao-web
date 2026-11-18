export const MIN_TIMER_DURATION_MINUTES = 1;
export const MAX_TIMER_DURATION_MINUTES = 59;

type TimerSnapshotBase = {
  durationMinutes: number;
};

export type TimerSnapshot =
  | (TimerSnapshotBase & {
      status: 'prepared';
      remainingMs: number;
    })
  | (TimerSnapshotBase & {
      status: 'running';
      remainingMs: number;
      startedAtMs: number;
    })
  | (TimerSnapshotBase & {
      status: 'paused';
      remainingMs: number;
    })
  | (TimerSnapshotBase & {
      status: 'completed';
      remainingMs: 0;
    });

export function isValidDurationMinutes(value: unknown): value is number {
  return (
    typeof value === 'number'
    && Number.isInteger(value)
    && value >= MIN_TIMER_DURATION_MINUTES
    && value <= MAX_TIMER_DURATION_MINUTES
  );
}

export function createTimerSnapshot(durationMinutes: number): TimerSnapshot {
  if (!isValidDurationMinutes(durationMinutes)) {
    throw new RangeError('Timer duration must be a whole number from 1 to 59 minutes.');
  }

  return {
    status: 'prepared',
    durationMinutes,
    remainingMs: durationMinutes * 60_000,
  };
}

export function getRemainingMilliseconds(
  snapshot: TimerSnapshot,
  nowMs: number,
): number {
  if (snapshot.status !== 'running') {
    return snapshot.remainingMs;
  }

  const elapsedMs = Math.max(0, nowMs - snapshot.startedAtMs);
  return Math.max(0, snapshot.remainingMs - elapsedMs);
}

export function syncTimer(snapshot: TimerSnapshot, nowMs: number): TimerSnapshot {
  if (
    snapshot.status === 'running'
    && getRemainingMilliseconds(snapshot, nowMs) === 0
  ) {
    return {
      status: 'completed',
      durationMinutes: snapshot.durationMinutes,
      remainingMs: 0,
    };
  }

  return snapshot;
}

export function startTimer(
  snapshot: TimerSnapshot,
  nowMs: number,
): TimerSnapshot {
  if (snapshot.status !== 'prepared') {
    return snapshot;
  }

  return {
    status: 'running',
    durationMinutes: snapshot.durationMinutes,
    remainingMs: snapshot.remainingMs,
    startedAtMs: nowMs,
  };
}

export function pauseTimer(
  snapshot: TimerSnapshot,
  nowMs: number,
): TimerSnapshot {
  if (snapshot.status !== 'running') {
    return snapshot;
  }

  const remainingMs = getRemainingMilliseconds(snapshot, nowMs);
  if (remainingMs === 0) {
    return {
      status: 'completed',
      durationMinutes: snapshot.durationMinutes,
      remainingMs: 0,
    };
  }

  return {
    status: 'paused',
    durationMinutes: snapshot.durationMinutes,
    remainingMs,
  };
}

export function resumeTimer(
  snapshot: TimerSnapshot,
  nowMs: number,
): TimerSnapshot {
  if (snapshot.status !== 'paused') {
    return snapshot;
  }

  return {
    status: 'running',
    durationMinutes: snapshot.durationMinutes,
    remainingMs: snapshot.remainingMs,
    startedAtMs: nowMs,
  };
}

export function restartTimer(
  snapshot: TimerSnapshot,
  confirmed: boolean,
): TimerSnapshot {
  if (!confirmed) {
    return snapshot;
  }

  return createTimerSnapshot(snapshot.durationMinutes);
}
