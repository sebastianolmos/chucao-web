import { afterEach, describe, expect, it, vi } from 'vitest';
import { localDateRangeToInstants } from './historyDates';

describe('localDateRangeToInstants', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('includes the complete selected local dates using an exclusive next-day bound', () => {
    vi.stubEnv('TZ', 'America/Santiago');
    expect(localDateRangeToInstants('2026-11-18', '2026-11-18')).toEqual({
      from: new Date(2026, 10, 18).toISOString(),
      toExclusive: new Date(2026, 10, 19).toISOString(),
    });
  });

  it('uses calendar-day arithmetic across a daylight-saving transition', () => {
    vi.stubEnv('TZ', 'America/New_York');
    const range = localDateRangeToInstants('2026-11-01', '2026-11-01');
    expect(range?.from).toBe(new Date(2026, 10, 1).toISOString());
    expect(range?.toExclusive).toBe(new Date(2026, 10, 2).toISOString());
    expect(Date.parse(range?.toExclusive ?? '') - Date.parse(range?.from ?? '')).toBe(25 * 60 * 60 * 1000);
  });

  it('accepts either open bound and rejects malformed or inverted dates', () => {
    expect(localDateRangeToInstants('2026-02-01', null)).toMatchObject({ from: expect.any(String), toExclusive: null });
    expect(localDateRangeToInstants(null, '2026-02-01')).toMatchObject({ from: null, toExclusive: expect.any(String) });
    expect(localDateRangeToInstants('2026-02-30', null)).toBeNull();
    expect(localDateRangeToInstants('2026-02-02', '2026-02-01')).toBeNull();
  });
});
