import type {
  RoundAction,
  RoundOperationResult,
  RoundRow,
} from '../../lib/database.types';
import { queryClient } from '../../lib/queryClient';
import { supabase } from '../../lib/supabase';
import { conceptQueryKey } from '../concepts/conceptService';
import { listQueryKey } from '../lists/listService';
import {
  DomainServiceError,
  mapSupabaseError,
  unauthenticatedError,
} from '../shared/supabaseErrors';

export type RoundCommand =
  | { action: 'mark_seen'; conceptId: string }
  | { action: 'draw' }
  | { action: 'return_pending'; conceptId: string }
  | { action: 'new_round' };

type RecoveryEnvelope = {
  operationId: string;
  action: RoundAction;
  conceptId?: string;
};

export type RoundCommandResult =
  | { status: 'confirmed'; result: RoundOperationResult }
  | {
      status: 'rejected';
      error: DomainServiceError;
      result?: RoundOperationResult;
    }
  | { status: 'unresolved'; error: DomainServiceError };

export const roundQueryKey = (userId: string, listId: string) =>
  ['round', userId, listId] as const;

const recoveryStoragePrefix = 'chucao.round-operation.v1';

export function getRoundRecoveryStorageKey(
  userId: string,
  listId: string,
): string {
  return `${recoveryStoragePrefix}:${userId}:${listId}`;
}

function isRoundAction(value: unknown): value is RoundAction {
  return value === 'mark_seen'
    || value === 'draw'
    || value === 'return_pending'
    || value === 'new_round';
}

function isRecoveryEnvelope(value: unknown): value is RecoveryEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const envelope = value as Record<string, unknown>;
  return typeof envelope.operationId === 'string'
    && isRoundAction(envelope.action)
    && (envelope.conceptId === undefined || typeof envelope.conceptId === 'string');
}

function readRecoveryEnvelope(key: string): RecoveryEnvelope | null {
  const raw = window.sessionStorage.getItem(key);
  if (raw === null) return null;
  const parsed: unknown = JSON.parse(raw);
  if (!isRecoveryEnvelope(parsed)) throw new Error('round_recovery_invalid');
  return parsed;
}

function sameCommand(envelope: RecoveryEnvelope, command: RoundCommand): boolean {
  return envelope.action === command.action
    && envelope.conceptId === ('conceptId' in command ? command.conceptId : undefined);
}

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw mapSupabaseError(error);
  if (!data.user) throw unauthenticatedError();
  return data.user.id;
}

function isRoundRow(value: unknown, listId: string): value is RoundRow {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string'
    && row.list_id === listId
    && row.status === 'open'
    && typeof row.opened_at === 'string';
}

export async function loadCurrentRound(listId: string): Promise<RoundRow> {
  await getCurrentUserId();
  const { data, error } = await supabase.rpc('get_or_create_current_round', {
    p_list_id: listId,
  });
  if (error) throw mapSupabaseError(error);
  if (!isRoundRow(data, listId)) {
    throw new DomainServiceError('unresolved', 'unresolved');
  }
  return data;
}

function recoveryError(error: unknown): DomainServiceError {
  return error instanceof DomainServiceError
    ? error
    : new DomainServiceError('unresolved', 'unresolved', error);
}

function isUnresolvedError(error: DomainServiceError): boolean {
  return error.code === 'unavailable'
    || error.code === 'unknown'
    || error.code === 'unresolved';
}

function isRoundOperationResult(value: unknown): value is RoundOperationResult {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return isRoundAction(row.action)
    && (row.outcome === 'applied' || row.outcome === 'rejected' || row.outcome === 'exhausted')
    && typeof row.round_id === 'string'
    && (typeof row.appearance_id === 'string' || row.appearance_id === null)
    && (typeof row.appearance_order === 'number' || row.appearance_order === null)
    && (typeof row.concept_id === 'string' || row.concept_id === null)
    && (typeof row.title === 'string' || row.title === null)
    && (row.result_state === 'pending' || row.result_state === 'seen'
      || row.result_state === 'closed' || row.result_state === null)
    && typeof row.pending_count === 'number'
    && typeof row.seen_count === 'number';
}

async function invalidateConfirmedRound(
  userId: string,
  listId: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: roundQueryKey(userId, listId) }),
    queryClient.invalidateQueries({ queryKey: conceptQueryKey(userId, listId) }),
    queryClient.invalidateQueries({ queryKey: listQueryKey(userId) }),
  ]);
}

async function sendOperation(
  userId: string,
  listId: string,
  key: string,
  envelope: RecoveryEnvelope,
): Promise<RoundCommandResult> {
  let rpcName:
    | 'mark_concept_seen'
    | 'draw_pending_concept'
    | 'return_concept_to_pending'
    | 'start_new_round';
  let args:
    | { p_list_id: string; p_concept_id: string; p_operation_id: string }
    | { p_list_id: string; p_operation_id: string };

  switch (envelope.action) {
    case 'mark_seen':
      if (!envelope.conceptId) return {
        status: 'unresolved',
        error: new DomainServiceError('unresolved', 'unresolved'),
      };
      rpcName = 'mark_concept_seen';
      args = {
        p_list_id: listId,
        p_concept_id: envelope.conceptId,
        p_operation_id: envelope.operationId,
      };
      break;
    case 'return_pending':
      if (!envelope.conceptId) return {
        status: 'unresolved',
        error: new DomainServiceError('unresolved', 'unresolved'),
      };
      rpcName = 'return_concept_to_pending';
      args = {
        p_list_id: listId,
        p_concept_id: envelope.conceptId,
        p_operation_id: envelope.operationId,
      };
      break;
    case 'draw':
      rpcName = 'draw_pending_concept';
      args = { p_list_id: listId, p_operation_id: envelope.operationId };
      break;
    case 'new_round':
      rpcName = 'start_new_round';
      args = { p_list_id: listId, p_operation_id: envelope.operationId };
      break;
  }

  let response;
  try {
    response = await supabase.rpc(rpcName, args as never);
  } catch (error) {
    const mapped = mapSupabaseError(error);
    return { status: 'unresolved', error: mapped };
  }

  if (response.error) {
    const mapped = mapSupabaseError(response.error);
    if (isUnresolvedError(mapped)) {
      return { status: 'unresolved', error: mapped };
    }
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      return { status: 'unresolved', error: new DomainServiceError('unresolved', 'unresolved') };
    }
    return { status: 'rejected', error: mapped };
  }

  const rows: unknown = response.data;
  if (!Array.isArray(rows) || rows.length !== 1 || !isRoundOperationResult(rows[0])
    || rows[0].action !== envelope.action) {
    return { status: 'unresolved', error: new DomainServiceError('unresolved', 'unresolved') };
  }

  const result = rows[0];
  try {
    window.sessionStorage.removeItem(key);
  } catch (error) {
    return { status: 'unresolved', error: recoveryError(error) };
  }

  if (result.outcome === 'rejected') {
    return {
      status: 'rejected',
      error: new DomainServiceError('round_action_rejected', 'round_action_rejected'),
      result,
    };
  }

  if (result.outcome === 'applied') {
    try {
      await invalidateConfirmedRound(userId, listId);
    } catch {
      // Persistence is confirmed; stale query data will be refetched on next use.
    }
  }
  return { status: 'confirmed', result };
}

async function executeCommand(
  listId: string,
  command: RoundCommand,
): Promise<RoundCommandResult> {
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch (error) {
    const mapped = recoveryError(error);
    return { status: 'rejected', error: mapped };
  }

  const key = getRoundRecoveryStorageKey(userId, listId);
  let envelope: RecoveryEnvelope | null;
  try {
    envelope = readRecoveryEnvelope(key);
  } catch (error) {
    return { status: 'unresolved', error: recoveryError(error) };
  }

  if (envelope) {
    if (!sameCommand(envelope, command)) {
      return {
        status: 'unresolved',
        error: new DomainServiceError('unresolved', 'unresolved'),
      };
    }
  } else {
    try {
      envelope = {
        operationId: crypto.randomUUID(),
        action: command.action,
        ...('conceptId' in command ? { conceptId: command.conceptId } : {}),
      };
      window.sessionStorage.setItem(key, JSON.stringify(envelope));
    } catch (error) {
      return { status: 'unresolved', error: recoveryError(error) };
    }
  }
  return sendOperation(userId, listId, key, envelope);
}

export function markConceptSeen(
  listId: string,
  conceptId: string,
): Promise<RoundCommandResult> {
  return executeCommand(listId, { action: 'mark_seen', conceptId });
}

export function drawPendingConcept(listId: string): Promise<RoundCommandResult> {
  return executeCommand(listId, { action: 'draw' });
}

export function returnConceptToPending(
  listId: string,
  conceptId: string,
): Promise<RoundCommandResult> {
  return executeCommand(listId, { action: 'return_pending', conceptId });
}

export function startNewRound(listId: string): Promise<RoundCommandResult> {
  return executeCommand(listId, { action: 'new_round' });
}

export async function retryUnresolvedRoundOperation(
  listId: string,
): Promise<RoundCommandResult> {
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch (error) {
    return { status: 'rejected', error: recoveryError(error) };
  }
  const key = getRoundRecoveryStorageKey(userId, listId);
  let envelope: RecoveryEnvelope | null;
  try {
    envelope = readRecoveryEnvelope(key);
  } catch (error) {
    return { status: 'unresolved', error: recoveryError(error) };
  }
  if (!envelope) {
    return {
      status: 'rejected',
      error: new DomainServiceError('unresolved', 'unresolved'),
    };
  }
  return sendOperation(userId, listId, key, envelope);
}
