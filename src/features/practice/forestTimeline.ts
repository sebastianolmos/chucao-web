import {
  isValidDurationMinutes,
} from './timerModel';

export type ForestTimelineSegment = {
  kind: 'wait' | 'flight';
  flightIndex: number;
  startMs: number;
  endMs: number;
};

export type ForestTimelineFrame =
  | {
      phase: 'waiting';
      supportIndex: number;
      journeyProgress: number;
    }
  | {
      phase: 'flying';
      fromSupportIndex: number;
      toSupportIndex: number;
      progress: number;
      journeyProgress: number;
    }
  | {
      phase: 'complete';
      supportIndex: 4;
      journeyProgress: 1;
    };

const FLIGHT_DURATIONS_MS = [4_000, 3_000, 2_000, 1_000] as const;
const FLIGHT_COUNT = FLIGHT_DURATIONS_MS.length;

export function createForestTimeline(
  durationMinutes: number,
): ForestTimelineSegment[] {
  if (!isValidDurationMinutes(durationMinutes)) {
    throw new RangeError('Timer duration must be a whole number from 1 to 59 minutes.');
  }

  const durationMs = durationMinutes * 60_000;
  const flightTimeMs = FLIGHT_DURATIONS_MS.reduce((sum, value) => sum + value, 0);
  const waitDurationMs = (durationMs - flightTimeMs) / FLIGHT_COUNT;
  const segments: ForestTimelineSegment[] = [];
  let cursorMs = 0;

  FLIGHT_DURATIONS_MS.forEach((flightDurationMs, flightIndex) => {
    const waitEndMs = cursorMs + waitDurationMs;
    segments.push({
      kind: 'wait',
      flightIndex,
      startMs: cursorMs,
      endMs: waitEndMs,
    });

    const flightEndMs = waitEndMs + flightDurationMs;
    segments.push({
      kind: 'flight',
      flightIndex,
      startMs: waitEndMs,
      endMs: flightEndMs,
    });
    cursorMs = flightEndMs;
  });

  return segments;
}

export function getForestTimelineFrame(
  timeline: readonly ForestTimelineSegment[],
  elapsedMs: number,
): ForestTimelineFrame {
  const finalSegment = timeline[timeline.length - 1];
  if (!finalSegment) {
    throw new RangeError('Forest timeline must contain at least one segment.');
  }

  if (elapsedMs >= finalSegment.endMs) {
    return {
      phase: 'complete',
      supportIndex: FLIGHT_COUNT,
      journeyProgress: 1,
    };
  }

  const positionMs = Math.max(0, elapsedMs);
  const activeSegment = timeline.find(
    (segment) => positionMs >= segment.startMs && positionMs < segment.endMs,
  );

  if (!activeSegment) {
    throw new RangeError('Elapsed time does not map to a forest timeline segment.');
  }

  if (activeSegment.kind === 'wait') {
    return {
      phase: 'waiting',
      supportIndex: activeSegment.flightIndex,
      journeyProgress: activeSegment.flightIndex / FLIGHT_COUNT,
    };
  }

  const progress =
    (positionMs - activeSegment.startMs)
    / (activeSegment.endMs - activeSegment.startMs);

  return {
    phase: 'flying',
    fromSupportIndex: activeSegment.flightIndex,
    toSupportIndex: activeSegment.flightIndex + 1,
    progress,
    journeyProgress: (activeSegment.flightIndex + progress) / FLIGHT_COUNT,
  };
}
