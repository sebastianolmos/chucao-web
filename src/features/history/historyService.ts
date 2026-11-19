import type { Json, PracticeKind, RoundAppearanceOrigin, RoundStatus } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';
import { DomainServiceError, unauthenticatedError } from '../shared/supabaseErrors';
import { localDateRangeToInstants } from './historyDates';

export type HistoryDirection = 'newest' | 'oldest';
export type HistoryCursor = { timestamp: string; id: string };
export type PracticeHistoryFilters = {
  startDate?: string | null;
  endDate?: string | null;
  listId?: string | null;
  conceptId?: string | null;
  independentLabel?: string | null;
  kind?: PracticeKind | null;
  ratingState?: 'rated' | 'unrated' | null;
  cursor?: HistoryCursor | null;
  pageSize?: number;
};

export type PracticeHistoryItem = {
  id: string;
  kind: PracticeKind;
  listId: string | null;
  listName: string | null;
  conceptId: string | null;
  titleSnapshot: string | null;
  independentLabel: string | null;
  completedAt: string;
  durationMinutes: number;
  rating: number | null;
  hasNote: boolean;
};
export type RoundHistoryAppearance = {
  id: string;
  appearanceOrder: number;
  origin: RoundAppearanceOrigin;
  titleSnapshot: string | null;
  conceptDeleted: boolean;
  createdAt: string;
};
export type RoundHistoryItem = {
  id: string;
  listId: string;
  listName: string;
  status: RoundStatus;
  openedAt: string;
  closedAt: string | null;
  appearances: RoundHistoryAppearance[];
};
export type HistoryPage<T> = {
  items: T[];
  nextCursor: HistoryCursor | null;
  hasMore: boolean;
  queryKey: readonly unknown[];
};

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

export const practiceHistoryQueryKey = (
  userId: string,
  filters: PracticeHistoryFilters,
  direction: HistoryDirection,
) => ['practice-history', userId, filters, direction] as const;
export const roundHistoryQueryKey = (
  userId: string,
  listId: string | null,
  cursor: HistoryCursor | null,
  direction: HistoryDirection,
  pageSize: number,
) => ['round-history', userId, listId, cursor, direction, pageSize] as const;

function objectValue(value: Json, label: string): Record<string, Json | undefined> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DomainServiceError('unresolved', `${label}_invalid`);
  }
  return value as Record<string, Json | undefined>;
}

function pageEnvelope<T>(value: Json, label: string, parseItem: (value: Json) => T): Omit<HistoryPage<T>, 'queryKey'> {
  const envelope = objectValue(value, label);
  if (!Array.isArray(envelope.items) || typeof envelope.has_more !== 'boolean') {
    throw new DomainServiceError('unresolved', `${label}_invalid`);
  }
  const cursor = envelope.next_cursor === null ? null : objectValue(envelope.next_cursor as Json, `${label}_cursor`);
  if ((envelope.has_more && cursor === null)
    || (cursor !== null && (typeof cursor.timestamp !== 'string' || typeof cursor.id !== 'string'))) {
    throw new DomainServiceError('unresolved', `${label}_cursor_invalid`);
  }
  return {
    items: envelope.items.map((item) => parseItem(item as Json)),
    nextCursor: cursor ? { timestamp: cursor.timestamp as string, id: cursor.id as string } : null,
    hasMore: envelope.has_more,
  };
}

function parsePractice(value: Json): PracticeHistoryItem {
  const row = objectValue(value, 'practice_history');
  if (typeof row.id !== 'string' || (row.kind !== 'associated' && row.kind !== 'independent')
    || typeof row.completed_at !== 'string' || typeof row.duration_minutes !== 'number'
    || typeof row.has_note !== 'boolean') throw new DomainServiceError('unresolved', 'practice_history_invalid');
  return {
    id: row.id,
    kind: row.kind,
    listId: typeof row.list_id === 'string' ? row.list_id : null,
    listName: typeof row.list_name === 'string' ? row.list_name : null,
    conceptId: typeof row.concept_id === 'string' ? row.concept_id : null,
    titleSnapshot: typeof row.title_snapshot === 'string' ? row.title_snapshot : null,
    independentLabel: typeof row.independent_label === 'string' ? row.independent_label : null,
    completedAt: row.completed_at,
    durationMinutes: row.duration_minutes,
    rating: typeof row.rating === 'number' ? row.rating : null,
    hasNote: row.has_note,
  };
}

function parseRound(value: Json): RoundHistoryItem {
  const row = objectValue(value, 'round_history');
  if (typeof row.id !== 'string' || typeof row.list_id !== 'string' || typeof row.list_name !== 'string'
    || (row.status !== 'open' && row.status !== 'closed') || typeof row.opened_at !== 'string'
    ) throw new DomainServiceError('unresolved', 'round_history_invalid');
  return {
    id: row.id,
    listId: row.list_id,
    listName: row.list_name,
    status: row.status,
    openedAt: row.opened_at,
    closedAt: typeof row.closed_at === 'string' ? row.closed_at : null,
    appearances: [],
  };
}

function parseAppearances(value: Json): Map<string, RoundHistoryAppearance[]> {
  if (!Array.isArray(value)) throw new DomainServiceError('unresolved', 'round_appearances_invalid');
  const result = new Map<string, RoundHistoryAppearance[]>();
  for (const groupValue of value) {
    const group = objectValue(groupValue as Json, 'round_appearances');
    if (typeof group.round_id !== 'string' || !Array.isArray(group.appearances)) {
      throw new DomainServiceError('unresolved', 'round_appearances_invalid');
    }
    result.set(group.round_id, group.appearances.map((appearance) => {
      const item = objectValue(appearance as Json, 'round_appearance');
      if (typeof item.id !== 'string' || typeof item.appearance_order !== 'number'
        || (item.origin !== 'draw' && item.origin !== 'manual') || typeof item.concept_deleted !== 'boolean'
        || typeof item.created_at !== 'string') throw new DomainServiceError('unresolved', 'round_appearance_invalid');
      return {
        id: item.id,
        appearanceOrder: item.appearance_order,
        origin: item.origin,
        titleSnapshot: typeof item.title_snapshot === 'string' ? item.title_snapshot : null,
        conceptDeleted: item.concept_deleted,
        createdAt: item.created_at,
      };
    }));
  }
  return result;
}

async function currentOwnerId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw unauthenticatedError();
  return data.user.id;
}

function pageSize(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(value ?? DEFAULT_PAGE_SIZE)));
}

export async function listPracticeHistory(
  filters: PracticeHistoryFilters = {},
  direction: HistoryDirection = 'newest',
): Promise<HistoryPage<PracticeHistoryItem>> {
  const dateRange = localDateRangeToInstants(filters.startDate ?? null, filters.endDate ?? null);
  if (!dateRange) throw new DomainServiceError('unknown', 'history_date_range_invalid');
  if (direction !== 'newest' && direction !== 'oldest') throw new DomainServiceError('unknown', 'history_direction_invalid');
  const userId = await currentOwnerId();
  const size = pageSize(filters.pageSize);
  const { data, error } = await supabase.rpc('list_practice_history', {
    p_from: dateRange.from,
    p_to_exclusive: dateRange.toExclusive,
    p_list_id: filters.listId ?? null,
    p_concept_id: filters.conceptId ?? null,
    p_independent_label: filters.independentLabel?.trim() || null,
    p_kind: filters.kind ?? null,
    p_rating_state: filters.ratingState ?? null,
    p_cursor_completed_at: filters.cursor?.timestamp ?? null,
    p_cursor_id: filters.cursor?.id ?? null,
    p_page_size: size,
    p_direction: direction,
  });
  if (error) throw error;
  const parsed = pageEnvelope(data, 'practice_history', parsePractice);
  const queryKey = practiceHistoryQueryKey(userId, filters, direction);
  return { ...parsed, queryKey };
}

export async function listRoundHistory(options: {
  listId?: string | null;
  cursor?: HistoryCursor | null;
  pageSize?: number;
} = {}, direction: HistoryDirection = 'newest'): Promise<HistoryPage<RoundHistoryItem>> {
  if (direction !== 'newest' && direction !== 'oldest') throw new DomainServiceError('unknown', 'history_direction_invalid');
  const userId = await currentOwnerId();
  const size = pageSize(options.pageSize);
  const { data, error } = await supabase.rpc('list_round_history', {
    p_list_id: options.listId ?? null,
    p_cursor_opened_at: options.cursor?.timestamp ?? null,
    p_cursor_id: options.cursor?.id ?? null,
    p_page_size: size,
    p_direction: direction,
  });
  if (error) throw error;
  const parsed = pageEnvelope(data, 'round_history', parseRound);
  if (parsed.items.length > 0) {
    const { data: appearanceData, error: appearanceError } = await supabase.rpc('list_round_appearances', {
      p_round_ids: parsed.items.map((round) => round.id),
    });
    if (appearanceError) throw appearanceError;
    const appearances = parseAppearances(appearanceData);
    parsed.items = parsed.items.map((round) => ({ ...round, appearances: appearances.get(round.id) ?? [] }));
  }
  const queryKey = roundHistoryQueryKey(userId, options.listId ?? null, options.cursor ?? null, direction, size);
  return { ...parsed, queryKey };
}
