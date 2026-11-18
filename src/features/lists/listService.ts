import type { ListRow } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';
import {
  DomainServiceError,
  mapSupabaseError,
  unauthenticatedError,
  unauthorizedError,
} from '../shared/supabaseErrors';

export const listQueryKey = (userId: string) => ['lists', userId] as const;

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
  await assertCurrentUser(userId);

  const { data, error } = await supabase
    .from('lists')
    .select('id, owner_id, name, name_normalized, created_at, updated_at')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    throw mapSupabaseError(error);
  }

  return data;
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
    .select('id, owner_id, name, name_normalized, created_at, updated_at')
    .eq('name_normalized', validation.normalizedName);

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
