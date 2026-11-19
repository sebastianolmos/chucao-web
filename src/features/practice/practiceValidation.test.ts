import { describe, expect, it } from 'vitest';
import { validateCompletedPractice } from './practiceValidation';

const associated = {
  id: '10000000-0000-4000-8000-000000000001',
  kind: 'associated' as const,
  listId: '20000000-0000-4000-8000-000000000002',
  conceptId: '30000000-0000-4000-8000-000000000003',
  durationMinutes: 5,
  completedAt: '2026-11-18T12:00:00.000Z',
  rating: 0,
  note: '  café 🐦\n ',
};

describe('validateCompletedPractice', () => {
  it('validates trimmed Unicode code-point lengths and preserves accepted text', () => {
    expect(validateCompletedPractice(associated)).toEqual({
      ok: true,
      value: expect.objectContaining({ rating: 0, note: '  café 🐦\n ' }),
    });
  });

  it('treats omitted and whitespace-only notes as absent', () => {
    expect(validateCompletedPractice({ ...associated, note: '\u00a0\u2003\n' })).toEqual({
      ok: true, value: expect.objectContaining({ note: null }),
    });
  });

  it('rejects an independent practice without a trimmed label', () => {
    expect(validateCompletedPractice({
      ...associated, kind: 'independent', listId: null, conceptId: null, label: ' \u00a0 ', note: '', rating: null,
    })).toEqual({ ok: false, field: 'label', reason: 'required' });
  });

  it('enforces label, note, duration and rating bounds', () => {
    expect(validateCompletedPractice({ ...associated, kind: 'independent', listId: null, conceptId: null, label: ` ${'x'.repeat(51)} ` })).toEqual({ ok: false, field: 'label', reason: 'too_long' });
    expect(validateCompletedPractice({ ...associated, note: 'x'.repeat(2001) })).toEqual({ ok: false, field: 'note', reason: 'too_long' });
    expect(validateCompletedPractice({ ...associated, durationMinutes: 60 })).toEqual({ ok: false, field: 'durationMinutes', reason: 'invalid' });
    expect(validateCompletedPractice({ ...associated, rating: 6 })).toEqual({ ok: false, field: 'rating', reason: 'invalid' });
  });
});
