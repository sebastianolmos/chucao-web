import type {
  ListCollection,
  ListRow,
  ListSort,
} from '../../lib/database.types';
import { supabase } from '../../lib/supabase';
import {
  DomainServiceError,
  mapSupabaseError,
  unauthenticatedError,
  unauthorizedError,
} from '../shared/supabaseErrors';

export const listQueryKey = (userId: string) => ['lists', userId] as const;

export type ListPageCursor = Pick<
  ListRow,
  'id' | 'name_normalized' | 'created_at' | 'updated_at'
>;

export type ListCollectionPageOptions = {
  collection?: ListCollection;
  search?: string;
  sort?: ListSort;
  pageSize?: number;
  cursor?: ListPageCursor | null;
};

export type ListCollectionPage = {
  items: ListRow[];
  hasMore: boolean;
  nextCursor: ListPageCursor | null;
};

export type ListNameValidation =
  | {
      valid: true;
      trimmedName: string;
      normalizedName: string;
    }
  | {
      valid: false;
      error: DomainServiceError;
      trimmedName: string;
      normalizedName: string;
    };

export type ListReconciliationResult =
  | {
      status: 'matched';
      list: ListRow;
    }
  | {
      status: 'not_found';
    }
  | {
      status: 'ambiguous';
      count: number;
    };

export type CreatePrivateListResult =
  | {
      status: 'created' | 'reconciled';
      list: ListRow;
      rawName: string;
      trimmedName: string;
    }
  | {
      status: 'rejected';
      error: DomainServiceError;
      rawName: string;
      trimmedName: string;
    }
  | {
      status: 'unresolved';
      error: DomainServiceError;
      rawName: string;
      trimmedName: string;
      reconciliation: 'not_found' | 'ambiguous' | 'failed';
    };

function normalizeListName(value: string): string {
  return value.toLowerCase();
}

export function validateListName(rawName: string): ListNameValidation {
  const trimmedName = rawName.trim();
  const normalizedName = normalizeListName(trimmedName);
  const length = Array.from(trimmedName).length;

  if (length === 0 || length > 80) {
    return {
      valid: false,
      error: new DomainServiceError('invalid_name', 'invalid_name'),
      trimmedName,
      normalizedName,
    };
  }

  return {
    valid: true,
    trimmedName,
    normalizedName,
  };
}

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw mapSupabaseError(error);
  }

  if (!data.user) {
    throw unauthenticatedError();
  }

  return data.user.id;
}

async function assertCurrentUser(userId: string): Promise<void> {
  const currentUserId = await getCurrentUserId();

  if (currentUserId !== userId) {
    throw unauthorizedError();
  }
}

export async function getOwnedLists(userId: string): Promise<ListRow[]> {
  const lists: ListRow[] = [];
  let cursor: ListPageCursor | null = null;
  let hasMore = true;

  while (hasMore) {
    const page = await getListCollectionPage(userId, {
      collection: 'active',
      sort: 'created_oldest',
      pageSize: 100,
      cursor,
    });
    lists.push(...page.items);
    hasMore = page.hasMore;
    cursor = page.nextCursor;
  }

  return lists;
}

export async function getListCollectionPage(
  userId: string,
  options: ListCollectionPageOptions = {},
): Promise<ListCollectionPage> {
  await assertCurrentUser(userId);

  const collection = options.collection ?? 'active';
  const search = options.search?.trim() || null;
  const sort = options.sort ?? 'name_asc';
  const requestedPageSize = Number.isFinite(options.pageSize)
    ? Math.floor(options.pageSize ?? 50)
    : 50;
  const pageSize = Math.min(100, Math.max(1, requestedPageSize));
  const cursor = options.cursor ?? null;

  const { data, error } = await supabase.rpc('list_owned_lists', {
    p_collection: collection,
    p_search: search,
    p_sort: sort,
    p_cursor_name: cursor?.name_normalized ?? null,
    p_cursor_created_at: cursor?.created_at ?? null,
    p_cursor_updated_at: cursor?.updated_at ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_page_size: pageSize + 1,
  });

  if (error) {
    throw mapSupabaseError(error);
  }

  const rows = data ?? [];
  const hasMore = rows.length > pageSize;
  const items = rows.slice(0, pageSize);
  const lastItem = items.at(-1);

  return {
    items,
    hasMore,
    nextCursor: hasMore && lastItem
      ? {
          id: lastItem.id,
          name_normalized: lastItem.name_normalized,
          created_at: lastItem.created_at,
          updated_at: lastItem.updated_at,
        }
      : null,
  };
}

export async function getOwnedConceptCounts(
  userId: string,
  listIds: string[],
): Promise<Record<string, { practiced: number; total: number }>> {
  await assertCurrentUser(userId);

  if (listIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from('concepts')
    .select('list_id, state')
    .in('list_id', listIds)
    .is('deleted_at', null);

  if (error) {
    throw mapSupabaseError(error);
  }

  return data.reduce<Record<string, { practiced: number; total: number }>>((counts, concept) => {
    const progress = counts[concept.list_id] ?? { practiced: 0, total: 0 };
    progress.total += 1;
    if (concept.state === 'seen') progress.practiced += 1;
    counts[concept.list_id] = progress;
    return counts;
  }, {});
}

export async function reconcilePrivateList(
  userId: string,
  rawName: string,
): Promise<ListReconciliationResult> {
  await assertCurrentUser(userId);

  const validation = validateListName(rawName);

  if (!validation.valid) {
    return { status: 'not_found' };
  }

  const { data, error } = await supabase
    .from('lists')
    .select('id, owner_id, name, name_normalized, created_at, updated_at, archived_at')
    .eq('owner_id', userId)
    .eq('name_normalized', validation.normalizedName)
    .is('archived_at', null);

  if (error) {
    throw mapSupabaseError(error);
  }

  if (data.length === 1) {
    return { status: 'matched', list: data[0] };
  }

  if (data.length > 1) {
    return { status: 'ambiguous', count: data.length };
  }

  return { status: 'not_found' };
}

export async function createPrivateList(
  rawName: string,
): Promise<CreatePrivateListResult> {
  const validation = validateListName(rawName);

  if (!validation.valid) {
    return {
      status: 'rejected',
      error: validation.error,
      rawName,
      trimmedName: validation.trimmedName,
    };
  }

  try {
    await getCurrentUserId();

    const { data, error } = await supabase.rpc('create_private_list', {
      p_name: rawName,
    });

    if (error) {
      throw error;
    }

    return {
      status: 'created',
      list: data,
      rawName,
      trimmedName: validation.trimmedName,
    };
  } catch (error) {
    const mappedError = mapSupabaseError(error);

    if (
      mappedError.code !== 'unavailable'
      && mappedError.code !== 'unknown'
    ) {
      return {
        status: 'rejected',
        error: mappedError,
        rawName,
        trimmedName: validation.trimmedName,
      };
    }

    try {
      const userId = await getCurrentUserId();
      const reconciliation = await reconcilePrivateList(userId, rawName);

      if (reconciliation.status === 'matched') {
        return {
          status: 'reconciled',
          list: reconciliation.list,
          rawName,
          trimmedName: validation.trimmedName,
        };
      }

      return {
        status: 'unresolved',
        error: mappedError,
        rawName,
        trimmedName: validation.trimmedName,
        reconciliation: reconciliation.status,
      };
    } catch {
      return {
        status: 'unresolved',
        error: mappedError,
        rawName,
        trimmedName: validation.trimmedName,
        reconciliation: 'failed',
      };
    }
  }
}

async function mutateList<T>(rpc: string, args: Record<string, string>): Promise<T> {
  await getCurrentUserId();
  const { data, error: rpcError } = await supabase.rpc(rpc as never, args as never);
  if (rpcError) throw mapSupabaseError(rpcError);
  return data as T;
}

export function renamePrivateList(listId: string, name: string): Promise<ListRow> {
  const validation = validateListName(name);
  if (!validation.valid) return Promise.reject(validation.error);
  return mutateList('rename_private_list', { p_list_id: listId, p_name: validation.trimmedName });
}

export function archivePrivateList(listId: string): Promise<ListRow> {
  return mutateList('archive_private_list', { p_list_id: listId });
}

export function restorePrivateList(listId: string): Promise<ListRow> {
  return mutateList('restore_private_list', { p_list_id: listId });
}

export function duplicatePrivateList(listId: string, name: string, operationId: string): Promise<ListRow> {
  const validation = validateListName(name);
  if (!validation.valid) return Promise.reject(validation.error);
  return mutateList('duplicate_private_list', {
    p_source_list_id: listId,
    p_operation_id: operationId,
    p_name: validation.trimmedName,
  });
}

export async function deletePrivateList(listId: string): Promise<void> {
  await mutateList<string>('delete_private_list', { p_list_id: listId });
}
