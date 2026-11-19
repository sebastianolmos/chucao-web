import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '../../lib/supabase';
import { archivePrivateList, deletePrivateList, duplicatePrivateList, getListCollectionPage, getOwnedLists, renamePrivateList, restorePrivateList } from './listService';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    rpc: vi.fn(),
  },
}));

const firstList = {
  id: 'list-a',
  owner_id: 'owner-a',
  name: 'Biología',
  name_normalized: 'biología',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  archived_at: null,
};

describe('list collection service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'owner-a' } },
      error: null,
    } as never);
  });

  it('reads the active collection through the database page RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [firstList], error: null } as never);

    await expect(getOwnedLists('owner-a')).resolves.toEqual([firstList]);

    expect(supabase.rpc).toHaveBeenCalledWith('list_owned_lists', {
      p_collection: 'active',
      p_search: null,
      p_sort: 'created_oldest',
      p_cursor_name: null,
      p_cursor_created_at: null,
      p_cursor_updated_at: null,
      p_cursor_id: null,
      p_page_size: 101,
    });
  });

  it('rejects a caller requesting another owner before any collection query', async () => {
    await expect(getOwnedLists('owner-b')).rejects.toMatchObject({ code: 'unauthorized' });

    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('trims search and returns a bounded next cursor without exposing the lookahead row', async () => {
    const secondList = { ...firstList, id: 'list-b', name: 'Biología B', name_normalized: 'biología b' };
    const lookaheadList = { ...firstList, id: 'list-c', name: 'Biología C', name_normalized: 'biología c' };
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [firstList, secondList, lookaheadList],
      error: null,
    } as never);

    const page = await getListCollectionPage('owner-a', {
      collection: 'archived',
      search: '  BIOLO  ',
      sort: 'modified_newest',
      pageSize: 2,
      cursor: {
        id: 'cursor-id',
        name_normalized: 'previous name',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
    });

    expect(page).toEqual({
      items: [firstList, secondList],
      hasMore: true,
      nextCursor: {
        id: secondList.id,
        name_normalized: secondList.name_normalized,
        created_at: secondList.created_at,
        updated_at: secondList.updated_at,
      },
    });
    expect(supabase.rpc).toHaveBeenCalledWith('list_owned_lists', {
      p_collection: 'archived',
      p_search: 'BIOLO',
      p_sort: 'modified_newest',
      p_cursor_name: 'previous name',
      p_cursor_created_at: '2026-01-01T00:00:00.000Z',
      p_cursor_updated_at: '2026-01-02T00:00:00.000Z',
      p_cursor_id: 'cursor-id',
      p_page_size: 3,
    });
  });

  it('caps page size to the database RPC boundary', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [firstList], error: null } as never);

    await getListCollectionPage('owner-a', { pageSize: 500 });

    expect(supabase.rpc).toHaveBeenCalledWith('list_owned_lists', expect.objectContaining({
      p_page_size: 101,
    }));
  });

  it('routes list actions through their trusted RPCs with the same duplicate operation identity', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: firstList, error: null } as never);
    await renamePrivateList('list-a', '  Renamed  ');
    expect(supabase.rpc).toHaveBeenLastCalledWith('rename_private_list', { p_list_id: 'list-a', p_name: 'Renamed' });
    await duplicatePrivateList('list-a', 'Copy', 'stable-operation-id');
    expect(supabase.rpc).toHaveBeenLastCalledWith('duplicate_private_list', { p_source_list_id: 'list-a', p_operation_id: 'stable-operation-id', p_name: 'Copy' });
    await archivePrivateList('list-a');
    expect(supabase.rpc).toHaveBeenLastCalledWith('archive_private_list', { p_list_id: 'list-a' });
    await restorePrivateList('list-a');
    expect(supabase.rpc).toHaveBeenLastCalledWith('restore_private_list', { p_list_id: 'list-a' });
    vi.mocked(supabase.rpc).mockResolvedValue({ data: 'list-a', error: null } as never);
    await deletePrivateList('list-a');
    expect(supabase.rpc).toHaveBeenLastCalledWith('delete_private_list', { p_list_id: 'list-a' });
  });

  it('rejects malformed list names before calling a mutation RPC', async () => {
    await expect(renamePrivateList('list-a', '   ')).rejects.toMatchObject({ code: 'invalid_name' });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
