import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, getUser } = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: { rpc, auth: { getUser } } }));

import { listPracticeHistory, listRoundHistory } from './historyService';

describe('historyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: 'owner-1' } }, error: null });
  });

  it('converts local date bounds, clamps page size and scopes cache keys by owner', async () => {
    rpc.mockResolvedValue({ data: { items: [], next_cursor: null, has_more: false }, error: null });
    const page = await listPracticeHistory({ startDate: '2026-11-18', endDate: '2026-11-18', pageSize: 500 }, 'newest');
    expect(page).toMatchObject({ items: [], hasMore: false });
    expect(page.queryKey[1]).toBe('owner-1');
    expect(rpc).toHaveBeenCalledWith('list_practice_history', expect.objectContaining({
      p_page_size: 100,
      p_direction: 'newest',
      p_from: expect.any(String),
      p_to_exclusive: expect.any(String),
    }));
  });

  it('defaults to 50 rows and rejects an incomplete server cursor', async () => {
    rpc.mockResolvedValueOnce({ data: { items: [], next_cursor: null, has_more: false }, error: null });
    await listPracticeHistory();
    expect(rpc).toHaveBeenCalledWith('list_practice_history', expect.objectContaining({ p_page_size: 50 }));
    rpc.mockResolvedValueOnce({ data: { items: [], next_cursor: null, has_more: true }, error: null });
    await expect(listPracticeHistory()).rejects.toMatchObject({ code: 'unresolved' });
  });

  it('rejects inverted dates before any request and prevents language affecting filters', async () => {
    await expect(listPracticeHistory({ startDate: '2026-11-19', endDate: '2026-11-18' })).rejects.toMatchObject({ code: 'unknown' });
    expect(rpc).not.toHaveBeenCalled();
    await listPracticeHistory({ independentLabel: "x' OR true --" });
    expect(rpc).toHaveBeenCalledWith('list_practice_history', expect.objectContaining({ p_independent_label: "x' OR true --" }));
  });

  it('sends cursor and sort direction without changing record identity', async () => {
    rpc.mockResolvedValue({ data: { items: [], next_cursor: null, has_more: false }, error: null });
    await listPracticeHistory({ listId: 'list-1', cursor: { timestamp: '2026-01-01T00:00:00Z', id: 'p-1' } }, 'oldest');
    expect(rpc).toHaveBeenCalledWith('list_practice_history', expect.objectContaining({
      p_list_id: 'list-1', p_cursor_completed_at: '2026-01-01T00:00:00Z', p_cursor_id: 'p-1', p_direction: 'oldest',
    }));
  });

  it('reads round history through its non-mutating RPC and returns appearance metadata', async () => {
    rpc.mockResolvedValueOnce({ data: { items: [{ id: 'r-1', list_id: 'list-1', list_name: 'List', status: 'closed', opened_at: '2026-01-01T00:00:00Z', closed_at: '2026-01-02T00:00:00Z' }], next_cursor: null, has_more: false }, error: null });
    rpc.mockResolvedValueOnce({ data: [{ round_id: 'r-1', appearances: [{ id: 'a-1', appearance_order: 1, origin: 'manual', title_snapshot: 'Old title', concept_deleted: true, created_at: '2026-01-01T00:00:00Z' }] }], error: null });
    await expect(listRoundHistory({ listId: 'list-1' })).resolves.toMatchObject({
      items: [{ id: 'r-1', appearances: [{ id: 'a-1', conceptDeleted: true }] }],
    });
    expect(rpc).toHaveBeenCalledWith('list_round_history', expect.objectContaining({ p_list_id: 'list-1' }));
    expect(rpc).toHaveBeenCalledWith('list_round_appearances', { p_round_ids: ['r-1'] });
    expect(rpc).not.toHaveBeenCalledWith('get_or_create_current_round', expect.anything());
  });
});
