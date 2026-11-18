import { describe, expect, it } from 'vitest';
import {
  createForestTimeline,
  getForestTimelineFrame,
} from './forestTimeline';

describe('forest timer timeline', () => {
  it('fits four 4/3/2/1-second flights and four equal waits into one minute', () => {
    const timeline = createForestTimeline(1);
    const waits = timeline.filter((segment) => segment.kind === 'wait');
    const flights = timeline.filter((segment) => segment.kind === 'flight');

    expect(timeline.map((segment) => segment.kind)).toEqual([
      'wait', 'flight', 'wait', 'flight', 'wait', 'flight', 'wait', 'flight',
    ]);
    expect(waits.map((segment) => segment.endMs - segment.startMs)).toEqual([
      12_500, 12_500, 12_500, 12_500,
    ]);
    expect(flights.map((segment) => segment.endMs - segment.startMs)).toEqual([
      4_000, 3_000, 2_000, 1_000,
    ]);
    expect(timeline.at(-1)?.endMs).toBe(60_000);
  });

  it('stretches only the resting intervals for the 59-minute limit', () => {
    const timeline = createForestTimeline(59);
    const waits = timeline.filter((segment) => segment.kind === 'wait');
    const flights = timeline.filter((segment) => segment.kind === 'flight');

    expect(waits.map((segment) => segment.endMs - segment.startMs)).toEqual([
      882_500, 882_500, 882_500, 882_500,
    ]);
    expect(flights.map((segment) => segment.endMs - segment.startMs)).toEqual([
      4_000, 3_000, 2_000, 1_000,
    ]);
    expect(timeline.at(-1)?.endMs).toBe(59 * 60_000);
  });

  it('reports rest, flight interpolation, successive supports, and final arrival at boundaries', () => {
    const timeline = createForestTimeline(1);
    const firstWait = timeline[0];
    const firstFlight = timeline[1];
    const secondWait = timeline[2];
    const finalFlight = timeline[7];

    expect(getForestTimelineFrame(timeline, 0)).toMatchObject({
      phase: 'waiting',
      supportIndex: 0,
      journeyProgress: 0,
    });
    expect(getForestTimelineFrame(timeline, firstWait.endMs)).toMatchObject({
      phase: 'flying',
      fromSupportIndex: 0,
      toSupportIndex: 1,
      progress: 0,
      journeyProgress: 0,
    });
    expect(getForestTimelineFrame(timeline, firstFlight.startMs + 2_000)).toMatchObject({
      phase: 'flying',
      progress: 0.5,
      journeyProgress: 0.125,
    });
    expect(getForestTimelineFrame(timeline, secondWait.startMs)).toMatchObject({
      phase: 'waiting',
      supportIndex: 1,
      journeyProgress: 0.25,
    });
    expect(getForestTimelineFrame(timeline, finalFlight.endMs)).toEqual({
      phase: 'complete',
      supportIndex: 4,
      journeyProgress: 1,
    });
  });

  it('keeps overall journey progress monotonic through waits and flights', () => {
    const timeline = createForestTimeline(1);
    const checkpoints = [
      0,
      timeline[0].endMs,
      timeline[1].startMs + 2_000,
      timeline[2].startMs,
      timeline[3].startMs + 1_500,
      timeline.at(-1)!.endMs,
    ];
    const progress = checkpoints.map((time) =>
      getForestTimelineFrame(timeline, time).journeyProgress,
    );

    expect(progress).toEqual([...progress].sort((left, right) => left - right));
    expect(getForestTimelineFrame(timeline, -10).journeyProgress).toBe(0);
    expect(getForestTimelineFrame(timeline, 70_000)).toMatchObject({
      phase: 'complete',
      supportIndex: 4,
    });
  });

  it('rejects durations outside the supported timer range', () => {
    expect(() => createForestTimeline(0)).toThrow(RangeError);
    expect(() => createForestTimeline(60)).toThrow(RangeError);
  });
});
