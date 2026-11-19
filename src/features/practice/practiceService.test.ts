import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, getUser } = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock('../../lib/supabase', () => ({
  supabase: { rpc, auth: { getUser } },
}));

import { getSavedPractice, saveCompletedPractice } from './practiceService';

const input = {
  id: '10000000-0000-4000-8000-000000000001',
  kind: 'associated' as const,
  listId: '20000000-0000-4000-8000-000000000002',
  conceptId: '30000000-0000-4000-8000-000000000003',
  durationMinutes: 5,
  completedAt: '2026-11-18T12:00:00.000Z',
  rating: 0,
  note: 'note',
};

describe('practiceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: 'owner-1' } } });
  });

  it('returns confirmed only for the matching persisted identity', async () => {
    rpc.mockResolvedValue({ data: { practice: { id: input.id, owner_id: 'owner-1' }, note: 'note', replayed: true }, error: null });
    await expect(saveCompletedPractice(input)).resolves.toMatchObject({ status: 'confirmed', replayed: true });
    expect(rpc).toHaveBeenCalledWith('save_completed_practice', expect.objectContaining({ p_id: input.id, p_rating: 0, p_note: 'note' }));
  });

  it('keeps the same ID unresolved after a lost response so retry can reconcile', async () => {
    rpc.mockRejectedValueOnce(new Error('network response lost'));
    await expect(saveCompletedPractice(input)).resolves.toMatchObject({ status: 'unresolved', id: input.id });
    rpc.mockResolvedValueOnce({ data: { practice: { id: input.id, owner_id: 'owner-1' }, note: 'note', replayed: true }, error: null });
    await expect(saveCompletedPractice(input)).resolves.toMatchObject({ status: 'confirmed', replayed: true });
    expect(rpc).toHaveBeenNthCalledWith(2, 'save_completed_practice', expect.objectContaining({ p_id: input.id }));
  });

  it('reads only the requested saved identity for reconciliation', async () => {
    rpc.mockResolvedValue({ data: { practice: { id: input.id, owner_id: 'owner-1' }, note: 'note', note_revision: 3 }, error: null });
    await expect(getSavedPractice(input.id)).resolves.toMatchObject({ practice: { id: input.id }, note: 'note', noteRevision: 3 });
    expect(rpc).toHaveBeenCalledWith('get_saved_practice', { p_id: input.id });
  });
});
