import type { Json, PracticeRow } from '../../lib/database.types';
import { queryClient } from '../../lib/queryClient';
import { supabase } from '../../lib/supabase';
import { DomainServiceError } from '../shared/supabaseErrors';
import {
  type CompletedPracticeInput,
  trimmedCodePointLength,
  validateCompletedPractice,
} from './practiceValidation';

export type PracticeSaveResult =
  | { status: 'confirmed'; practice: PracticeRow; note: string | null; replayed: boolean }
  | { status: 'rejected'; error: DomainServiceError }
  | { status: 'unresolved'; error: DomainServiceError; id: string };

export type PracticeNoteMutationResult =
  | { status: 'confirmed'; outcome: 'updated' | 'deleted'; note: string | null; revision: number | null }
  | { status: 'rejected'; reason: 'invalid' | 'stale' | 'not_found' | 'conflict' | 'unauthorized'; note?: string | null; revision?: number | null; error?: DomainServiceError }
  | { status: 'unresolved'; operationId: string; error: DomainServiceError };

type PracticeNoteMutationInput = { practiceId: string; operationId: string; expectedRevision: number };
type PracticeNoteUpdateInput = PracticeNoteMutationInput & { body: string };

type SaveResponse = { practice?: PracticeRow; note?: string | null; noteRevision?: number | null; replayed?: boolean };

export const practiceQueryKey = (userId: string, practiceId: string) =>
  ['practice', userId, practiceId] as const;
export const practiceHistoryQueryKey = (userId: string) => ['practice-history', userId] as const;

function mapPracticeFailure(error: unknown): DomainServiceError {
  const message = typeof error === 'object' && error !== null && 'message' in error
    ? String(error.message) : '';
  if (message.includes('practice_not_authenticated')) return new DomainServiceError('unauthenticated', 'Inicia sesión para guardar la práctica.');
  if (message.includes('practice_identity_conflict')) return new DomainServiceError('concept_conflict', 'La identidad de guardado ya está asociada a otros datos.');
  if (message.includes('practice_context_unavailable')) return new DomainServiceError('unavailable', 'El contexto de práctica ya no está disponible.');
  if (message.includes('practice_') && (message.includes('invalid') || message.includes('required'))) return new DomainServiceError('unknown', 'Revisa los datos de la práctica.');
  return new DomainServiceError('unresolved', 'No se pudo confirmar el guardado. Puedes reintentar con la misma práctica.', error);
}

function asSaveResponse(value: Json): SaveResponse | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, Json | undefined>;
  if (typeof record.practice !== 'object' || record.practice === null || Array.isArray(record.practice)) return null;
  const practice = record.practice as Record<string, Json | undefined>;
  if (typeof practice.id !== 'string' || typeof practice.owner_id !== 'string') return null;
  return {
    practice: practice as unknown as PracticeRow,
    note: typeof record.note === 'string' ? record.note : null,
    noteRevision: typeof record.note_revision === 'number' ? record.note_revision : null,
    replayed: record.replayed === true,
  };
}

export async function saveCompletedPractice(input: CompletedPracticeInput): Promise<PracticeSaveResult> {
  const validation = validateCompletedPractice(input);
  if (!validation.ok) {
    return { status: 'rejected', error: new DomainServiceError('unknown', 'Revisa los datos de la práctica.') };
  }
  const { value } = validation;
  try {
    const { data, error } = await supabase.rpc('save_completed_practice', {
      p_id: value.id,
      p_kind: value.kind,
      p_list_id: value.listId,
      p_concept_id: value.conceptId,
      p_round_id: value.roundId,
      p_appearance_id: value.appearanceId,
      p_duration_minutes: value.durationMinutes,
      p_completed_at: value.completedAt,
      p_label: value.label,
      p_note: value.note,
      p_rating: value.rating,
    });
    if (error) {
      const mapped = mapPracticeFailure(error);
      return mapped.code === 'unresolved'
        ? { status: 'unresolved', error: mapped, id: value.id }
        : { status: 'rejected', error: mapped };
    }
    const result = asSaveResponse(data);
    if (!result?.practice || result.practice.id !== value.id) {
      return { status: 'unresolved', id: value.id, error: new DomainServiceError('unresolved', 'La respuesta del guardado no se pudo confirmar.') };
    }
    const user = await supabase.auth.getUser();
    if (user.data.user?.id !== result.practice.owner_id) {
      return { status: 'rejected', error: new DomainServiceError('unauthorized', 'La práctica no está disponible para esta cuenta.') };
    }
    await queryClient.invalidateQueries({ queryKey: practiceHistoryQueryKey(result.practice.owner_id) });
    await queryClient.invalidateQueries({ queryKey: practiceQueryKey(result.practice.owner_id, value.id) });
    return { status: 'confirmed', practice: result.practice, note: result.note ?? null, replayed: result.replayed === true };
  } catch (error) {
    const mapped = mapPracticeFailure(error);
    return { status: 'unresolved', error: mapped, id: value.id };
  }
}

export async function getSavedPractice(id: string): Promise<SaveResponse> {
  const { data, error } = await supabase.rpc('get_saved_practice', { p_id: id });
  if (error) throw mapPracticeFailure(error);
  const result = asSaveResponse(data);
  if (!result?.practice || result.practice.id !== id) {
    throw new DomainServiceError('unavailable', 'La práctica no está disponible.');
  }
  return result;
}

export async function reconcilePracticeSave(id: string): Promise<SaveResponse> {
  return getSavedPractice(id);
}

const validUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseNoteMutation(value: Json): { outcome: string; note: string | null; revision: number | null } | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const row = value as Record<string, Json | undefined>;
  if (typeof row.outcome !== 'string'
    || (row.note !== null && typeof row.note !== 'string')
    || (row.revision !== null && typeof row.revision !== 'number')) return null;
  return { outcome: row.outcome, note: typeof row.note === 'string' ? row.note : null, revision: typeof row.revision === 'number' ? row.revision : null };
}

function mutationError(error: unknown): DomainServiceError {
  const message = typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : '';
  if (message.includes('note_not_authenticated')) return new DomainServiceError('unauthenticated', 'Inicia sesión para cambiar la nota.');
  if (message.includes('note_unavailable')) return new DomainServiceError('unavailable', 'La práctica no está disponible.');
  if (message.includes('note_operation_conflict')) return new DomainServiceError('concept_conflict', 'La operación de nota ya fue usada con otros datos.');
  if (message.includes('note_input_invalid')) return new DomainServiceError('unknown', 'Revisa los datos de la nota.');
  return new DomainServiceError('unresolved', 'No se pudo confirmar el cambio de la nota.', error);
}

async function mutatePracticeNote(operation: 'update' | 'delete', input: PracticeNoteMutationInput, body?: string): Promise<PracticeNoteMutationResult> {
  if (!validUuid.test(input.practiceId) || !validUuid.test(input.operationId)
    || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1
    || (operation === 'update' && (body === undefined || trimmedCodePointLength(body) < 1 || trimmedCodePointLength(body) > 2000))) {
    return { status: 'rejected', reason: 'invalid' };
  }
  try {
    const { data, error } = await supabase.rpc(operation === 'update' ? 'update_practice_note' : 'delete_practice_note', {
      p_practice_id: input.practiceId,
      p_operation_id: input.operationId,
      p_expected_revision: input.expectedRevision,
      ...(operation === 'update' ? { p_body: body } : {}),
    });
    if (error) {
      const mapped = mutationError(error);
      if (mapped.code === 'unauthenticated') return { status: 'rejected', reason: 'unauthorized', error: mapped };
      if (mapped.code === 'unavailable') return { status: 'rejected', reason: 'not_found', error: mapped };
      if (mapped.code === 'concept_conflict') return { status: 'rejected', reason: 'conflict', error: mapped };
      if (mapped.code === 'unknown') return { status: 'rejected', reason: 'invalid', error: mapped };
      return { status: 'unresolved', operationId: input.operationId, error: mapped };
    }
    const result = parseNoteMutation(data);
    if (!result || !['updated', 'deleted', 'stale', 'not_found'].includes(result.outcome)) {
      return { status: 'unresolved', operationId: input.operationId, error: new DomainServiceError('unresolved', 'La respuesta del cambio de nota no se pudo confirmar.') };
    }
    if (result.outcome === 'stale' || result.outcome === 'not_found') {
      return { status: 'rejected', reason: result.outcome, note: result.note, revision: result.revision };
    }
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { status: 'rejected', reason: 'unauthorized', error: new DomainServiceError('unauthenticated', 'Inicia sesión para cambiar la nota.') };
    await queryClient.invalidateQueries({ queryKey: practiceHistoryQueryKey(userData.user.id) });
    await queryClient.invalidateQueries({ queryKey: practiceQueryKey(userData.user.id, input.practiceId) });
    return { status: 'confirmed', outcome: result.outcome as 'updated' | 'deleted', note: result.note, revision: result.revision };
  } catch (error) {
    return { status: 'unresolved', operationId: input.operationId, error: mutationError(error) };
  }
}

export function updatePracticeNote(input: PracticeNoteUpdateInput): Promise<PracticeNoteMutationResult> {
  return mutatePracticeNote('update', input, input.body);
}

export function deletePracticeNote(input: PracticeNoteMutationInput): Promise<PracticeNoteMutationResult> {
  return mutatePracticeNote('delete', input);
}
