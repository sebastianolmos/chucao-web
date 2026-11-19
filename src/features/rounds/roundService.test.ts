import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoundOperationResult } from '../../lib/database.types';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    rpc: vi.fn(),
  },
}));

vi.mock('../../lib/queryClient', () => ({
  queryClient: { invalidateQueries: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../concepts/conceptService', () => ({
  conceptQueryKey: (userId: string, listId: string) => [
    'concepts', userId, listId,
  ],
}));

vi.mock('../lists/listService', () => ({
  listQueryKey: (userId: string) => ['lists', userId],
}));

import { supabase } from '../../lib/supabase';
import { queryClient } from '../../lib/queryClient';
import {
  drawPendingConcept,
  getRoundRecoveryStorageKey,
  loadCurrentRoundReadOnly,
  retryUnresolvedRoundOperation,
} from './roundService';

const USER_ID = 'user-a';
const LIST_ID = 'list-a';
const OPERATION_ID = 'operation-a';

function drawResult(
  outcome: RoundOperationResult['outcome'] = 'applied',
): RoundOperationResult {
  return {
    action: 'draw',
    outcome,
    round_id: 'round-a',
    appearance_id: outcome === 'applied' ? 'appearance-a' : null,
    appearance_order: outcome === 'applied' ? 1 : null,
    concept_id: outcome === 'applied' ? 'concept-a' : null,
    title: outcome === 'applied' ? 'Synthetic title' : null,
    result_state: outcome === 'applied' ? 'seen' : null,
    pending_count: outcome === 'applied' ? 0 : 1,
    seen_count: outcome === 'applied' ? 1 : 0,
  };
}

describe('roundService recovery envelope', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    } as never);
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => OPERATION_ID) });
  });

  it('reads the current round without creating one when the list has no open round', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);

    await expect(loadCurrentRoundReadOnly(LIST_ID)).resolves.toBeNull();

    expect(supabase.rpc).toHaveBeenCalledWith('get_current_round_readonly', {
      p_list_id: LIST_ID,
    });
  });

  it('returns the existing open round from the read-only RPC', async () => {
    const currentRound = {
      id: 'round-a', list_id: LIST_ID, status: 'open' as const,
      opened_at: '2026-01-01T12:00:00.000Z', closed_at: null,
      anonymous_appearance_total: null, created_at: '2026-01-01T12:00:00.000Z',
    };
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [currentRound], error: null } as never);

    await expect(loadCurrentRoundReadOnly(LIST_ID)).resolves.toEqual(currentRound);
  });

  it('retries a timed out draw with the same UUID and clears the envelope after confirmation', async () => {
    const committedResults = new Map<string, RoundOperationResult>();
    let loseFirstResponse = true;
    vi.mocked(supabase.rpc).mockImplementation((async (
      _name: string,
      args: { p_operation_id: string },
    ) => {
      let committed = committedResults.get(args.p_operation_id);
      if (!committed) {
        committed = drawResult();
        committedResults.set(args.p_operation_id, committed);
      }
      if (loseFirstResponse) {
        loseFirstResponse = false;
        return {
          data: null,
          error: { code: 'FETCH_ERROR', message: 'Network timeout after commit' },
        };
      }
      return { data: [committed], error: null };
    }) as never);

    const first = await drawPendingConcept(LIST_ID);

    expect(first.status).toBe('unresolved');
    const key = getRoundRecoveryStorageKey(USER_ID, LIST_ID);
    const envelope = window.sessionStorage.getItem(key);
    expect(envelope).not.toBeNull();
    expect(JSON.parse(envelope!)).toEqual({
      operationId: OPERATION_ID,
      action: 'draw',
    });
    expect(envelope).not.toContain('Synthetic title');

    const retry = await retryUnresolvedRoundOperation(LIST_ID);

    expect(retry.status).toBe('confirmed');
    expect(supabase.rpc).toHaveBeenNthCalledWith(1, 'draw_pending_concept', {
      p_list_id: LIST_ID,
      p_operation_id: OPERATION_ID,
    });
    expect(supabase.rpc).toHaveBeenNthCalledWith(2, 'draw_pending_concept', {
      p_list_id: LIST_ID,
      p_operation_id: OPERATION_ID,
    });
    expect(window.sessionStorage.getItem(key)).toBeNull();
    expect(queryClient.invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ['round', USER_ID, LIST_ID],
    });
    expect(queryClient.invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ['concepts', USER_ID, LIST_ID],
    });
    expect(queryClient.invalidateQueries).toHaveBeenNthCalledWith(3, {
      queryKey: ['lists', USER_ID],
    });
  });

  it('keeps exhausted as a confirmed no-effect result and clears its envelope', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [drawResult('exhausted')],
      error: null,
    } as never);

    const result = await drawPendingConcept(LIST_ID);

    expect(result).toMatchObject({
      status: 'confirmed',
      result: { outcome: 'exhausted' },
    });
    expect(window.sessionStorage.getItem(
      getRoundRecoveryStorageKey(USER_ID, LIST_ID),
    )).toBeNull();
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  it('maps a persisted rejection separately and clears the resolved envelope', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [drawResult('rejected')],
      error: null,
    } as never);

    const result = await drawPendingConcept(LIST_ID);

    expect(result).toMatchObject({
      status: 'rejected',
      error: { code: 'round_action_rejected' },
      result: { outcome: 'rejected' },
    });
    expect(window.sessionStorage.getItem(
      getRoundRecoveryStorageKey(USER_ID, LIST_ID),
    )).toBeNull();
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  it('rejects calls when there is no authenticated user and does not call an RPC', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: null,
    } as never);

    const result = await drawPendingConcept(LIST_ID);

    expect(result.status).toBe('rejected');
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(window.sessionStorage.length).toBe(0);
  });
});
