export type PracticeKind = 'associated' | 'independent';

export type CompletedPracticeInput = {
  id: string;
  kind: PracticeKind;
  listId: string | null;
  conceptId: string | null;
  roundId?: string | null;
  appearanceId?: string | null;
  durationMinutes: number;
  completedAt: string;
  label?: string;
  note?: string | null;
  rating: number | null;
};

export type ValidatedPractice = Omit<CompletedPracticeInput, 'label' | 'note' | 'roundId' | 'appearanceId'> & {
  label: string | null;
  note: string | null;
  roundId: string | null;
  appearanceId: string | null;
};

export type PracticeValidationResult =
  | { ok: true; value: ValidatedPractice }
  | { ok: false; field: 'id' | 'context' | 'durationMinutes' | 'completedAt' | 'label' | 'note' | 'rating'; reason: 'required' | 'too_long' | 'invalid' };

// Match PostgreSQL's explicit trim character set in the VS-05 storage contract.
const trimSet = '[\\u0009-\\u000d\\u0020\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]';
const leadingOrTrailingWhitespace = new RegExp(`^${trimSet}+|${trimSet}+$`, 'gu');
const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function trimmedCodePointLength(value: string): number {
  return [...value.replace(leadingOrTrailingWhitespace, '')].length;
}

export function validateCompletedPractice(input: CompletedPracticeInput): PracticeValidationResult {
  if (!isUuid.test(input.id)) return { ok: false, field: 'id', reason: 'invalid' };
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 1 || input.durationMinutes > 59) {
    return { ok: false, field: 'durationMinutes', reason: 'invalid' };
  }
  if (!Number.isInteger(Date.parse(input.completedAt))) return { ok: false, field: 'completedAt', reason: 'invalid' };
  if (input.rating !== null && (!Number.isInteger(input.rating) || input.rating < 0 || input.rating > 5)) {
    return { ok: false, field: 'rating', reason: 'invalid' };
  }
  if (input.kind === 'associated') {
    if (!input.listId || !isUuid.test(input.listId) || !input.conceptId || !isUuid.test(input.conceptId)) {
      return { ok: false, field: 'context', reason: 'invalid' };
    }
  } else if (input.listId !== null || input.conceptId !== null || input.roundId || input.appearanceId) {
    return { ok: false, field: 'context', reason: 'invalid' };
  }

  const labelLength = input.label === undefined ? 0 : trimmedCodePointLength(input.label);
  if (input.kind === 'independent' && labelLength === 0) return { ok: false, field: 'label', reason: 'required' };
  if (labelLength > 50) return { ok: false, field: 'label', reason: 'too_long' };
  const noteLength = input.note === undefined || input.note === null ? 0 : trimmedCodePointLength(input.note);
  if (noteLength > 2000) return { ok: false, field: 'note', reason: 'too_long' };

  return {
    ok: true,
    value: {
      ...input,
      label: input.kind === 'independent' ? input.label! : null,
      note: noteLength === 0 ? null : input.note!,
      roundId: input.kind === 'associated' ? input.roundId ?? null : null,
      appearanceId: input.kind === 'associated' ? input.appearanceId ?? null : null,
    },
  };
}
