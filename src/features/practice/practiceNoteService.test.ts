import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, getUser } = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: { rpc, auth: { getUser } } }));

import { deletePracticeNote, updatePracticeNote } from './practiceService';
import { queryClient } from '../../lib/queryClient';

describe('practice note service contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: 'owner-1' } }, error: null });
  });

  it('submits an update with stable operation identity and returns confirmed revision', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    rpc.mockResolvedValue({ data: { outcome: 'updated', note: '  nueva nota  ', revision: 2 }, error: null });
    await expect(updatePracticeNote({ practiceId: '10000000-0000-4000-8000-000000000001', operationId: '20000000-0000-4000-8000-000000000001', expectedRevision: 1, body: '  nueva nota  ' }))
      .resolves.toMatchObject({ status: 'confirmed', note: '  nueva nota  ', revision: 2, outcome: 'updated' });
    expect(rpc).toHaveBeenCalledWith('update_practice_note', {
      p_practice_id: '10000000-0000-4000-8000-000000000001', p_operation_id: '20000000-0000-4000-8000-000000000001', p_expected_revision: 1, p_body: '  nueva nota  ',
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['practice-history', 'owner-1'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['practice', 'owner-1', '10000000-0000-4000-8000-000000000001'] });
  });

  it('returns stale as a rejected result and does not claim an update', async () => {
    rpc.mockResolvedValue({ data: { outcome: 'stale', note: 'newer note', revision: 2 }, error: null });
    await expect(updatePracticeNote({ practiceId: '10000000-0000-4000-8000-000000000001', operationId: '20000000-0000-4000-8000-000000000002', expectedRevision: 1, body: 'draft' }))
      .resolves.toMatchObject({ status: 'rejected', reason: 'stale', note: 'newer note', revision: 2 });
  });

  it('preserves delete operation identity and returns no deleted note content', async () => {
    rpc.mockResolvedValue({ data: { outcome: 'deleted', note: null, revision: null }, error: null });
    await expect(deletePracticeNote({ practiceId: '10000000-0000-4000-8000-000000000001', operationId: '20000000-0000-4000-8000-000000000003', expectedRevision: 1 }))
      .resolves.toMatchObject({ status: 'confirmed', outcome: 'deleted', note: null });
    expect(rpc).toHaveBeenCalledWith('delete_practice_note', {
      p_practice_id: '10000000-0000-4000-8000-000000000001', p_operation_id: '20000000-0000-4000-8000-000000000003', p_expected_revision: 1,
    });
  });

  it('rejects empty updates before sending a request', async () => {
    await expect(updatePracticeNote({ practiceId: '10000000-0000-4000-8000-000000000001', operationId: '20000000-0000-4000-8000-000000000004', expectedRevision: 1, body: ' \n ' }))
      .resolves.toMatchObject({ status: 'rejected', reason: 'invalid' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('keeps transport failures unresolved with the same operation identity available for retry', async () => {
    rpc.mockRejectedValueOnce(new Error('lost response'));
    await expect(deletePracticeNote({ practiceId: '10000000-0000-4000-8000-000000000001', operationId: '20000000-0000-4000-8000-000000000005', expectedRevision: 1 }))
      .resolves.toMatchObject({ status: 'unresolved', operationId: '20000000-0000-4000-8000-000000000005' });
    rpc.mockResolvedValueOnce({ data: { outcome: 'deleted', note: null, revision: null }, error: null });
    await deletePracticeNote({ practiceId: '10000000-0000-4000-8000-000000000001', operationId: '20000000-0000-4000-8000-000000000005', expectedRevision: 1 });
    expect(rpc).toHaveBeenNthCalledWith(2, 'delete_practice_note', expect.objectContaining({ p_operation_id: '20000000-0000-4000-8000-000000000005' }));
  });
});

