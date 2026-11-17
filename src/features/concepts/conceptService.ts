import type {
  ActiveConceptRow,
  ConceptBatchItem,
  ConceptRow,
} from '../../lib/database.types';
import { supabase } from '../../lib/supabase';
import {
  DomainServiceError,
  mapSupabaseError,
  unauthenticatedError,
  unauthorizedError,
} from '../shared/supabaseErrors';
import {
  type BatchReview,
  validateConceptFields,
} from './conceptParser';

const conceptSelection = [
  'id',
  'list_id',
  'title',
  'description',
  'state',
  'position',
  'created_at',
  'updated_at',
  'deleted_at',
].join(', ');

export const conceptQueryKey = (userId: string, listId: string) =>
  ['concepts', userId, listId] as const;

export type ConceptInput = {
  userId: string;
  listId: string;
  title: string;
  description: string;
};

export type ConceptUpdateInput = ConceptInput & {
  conceptId: string;
  expectedUpdatedAt: string;
};

export type ConceptDeleteInput = {
  userId: string;
  listId: string;
  conceptId: string;
  expectedUpdatedAt: string;
};

export type ConceptBatchOperationResult = {
  status: 'created' | 'reconciled';
  concepts: ActiveConceptRow[];
  review: BatchReview;
};

export type ConceptRejectedResult = {
  status: 'rejected';
  error: DomainServiceError;
};

export type ConceptUnresolvedResult = {
  status: 'unresolved';
  error: DomainServiceError;
  reconciliation: 'not_found' | 'unchanged' | 'ambiguous' | 'failed';
};

export type CreateConceptResult =
  | {
      status: 'created' | 'reconciled';
      concept: ActiveConceptRow;
    }
  | ConceptRejectedResult
  | ConceptUnresolvedResult;

export type CreateConceptBatchResult =
  | ConceptBatchOperationResult
  | ConceptRejectedResult
  | ConceptUnresolvedResult;

export type UpdateConceptResult =
  | {
      status: 'updated' | 'reconciled';
      concept: ActiveConceptRow;
    }
  | ConceptRejectedResult
  | ConceptUnresolvedResult;

export type DeleteConceptResult =
  | {
      status: 'deleted' | 'reconciled';
      concept: null;
    }
  | ConceptRejectedResult
  | ConceptUnresolvedResult;

function unresolvedError(): DomainServiceError {
  return new DomainServiceError('unresolved', 'unresolved');
}

function validationError(
  code: 'title_invalid' | 'description_invalid',
): DomainServiceError {
  return new DomainServiceError(
    code === 'title_invalid'
      ? 'concept_title_invalid'
      : 'concept_description_invalid',
    code === 'title_invalid'
      ? 'concept_title_invalid'
      : 'concept_description_invalid',
  );
}

function validateInput(
  title: string,
  description: string,
):
  | { valid: true; title: string; description: string }
  | { valid: false; error: DomainServiceError; title: string; description: string } {
  const validation = validateConceptFields(title, description);

  if (!validation.valid) {
    return {
      valid: false,
      error: validationError(validation.error),
      title: validation.title,
      description: validation.description,
    };
  }

  return validation;
}

function toActiveConcept(row: ConceptRow): ActiveConceptRow {
  if (
    row.deleted_at !== null
    || row.title === null
    || row.description === null
  ) {
    throw unresolvedError();
  }

  return {
    ...row,
    title: row.title,
    description: row.description,
    deleted_at: null,
  };
}

function isConceptRow(value: unknown): value is ConceptRow {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    typeof row.id === 'string'
    && typeof row.list_id === 'string'
    && (typeof row.title === 'string' || row.title === null)
    && (typeof row.description === 'string' || row.description === null)
    && (row.state === 'pending' || row.state === 'seen')
    && typeof row.position === 'number'
    && typeof row.created_at === 'string'
    && typeof row.updated_at === 'string'
    && (typeof row.deleted_at === 'string' || row.deleted_at === null)
  );
}

function readConceptRows(data: unknown): ConceptRow[] {
  if (!Array.isArray(data) || !data.every(isConceptRow)) {
    throw unresolvedError();
  }

  return data;
}

function mapActiveConcepts(rows: ConceptRow[]): ActiveConceptRow[] {
  return rows.map(toActiveConcept);
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

async function readOwnedConcepts(
  userId: string,
  listId: string,
): Promise<ActiveConceptRow[]> {
  await assertCurrentUser(userId);

  const { data, error } = await supabase
    .from('concepts')
    .select(conceptSelection)
    .eq('list_id', listId)
    .is('deleted_at', null)
    .order('position', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    throw mapSupabaseError(error);
  }

  return mapActiveConcepts(readConceptRows(data));
}

async function reconcileSingleConcept(
  userId: string,
  listId: string,
  title: string,
  description: string,
): Promise<
  | { status: 'matched'; concept: ActiveConceptRow }
  | { status: 'not_found' }
  | { status: 'ambiguous' }
  | { status: 'failed' }
> {
  try {
    const concepts = await readOwnedConcepts(userId, listId);
    const matches = concepts.filter(
      (concept) =>
        concept.title === title && concept.description === description,
    );

    if (matches.length === 1) {
      return { status: 'matched', concept: matches[0] };
    }

    if (matches.length > 1) {
      return { status: 'ambiguous' };
    }

    return { status: 'not_found' };
  } catch {
    return { status: 'failed' };
  }
}

async function reconcileBatch(
  userId: string,
  listId: string,
  review: BatchReview,
): Promise<
  | { status: 'matched'; concepts: ActiveConceptRow[] }
  | { status: 'not_found' }
  | { status: 'ambiguous' }
  | { status: 'failed' }
> {
  try {
    const concepts = await readOwnedConcepts(userId, listId);
    const matches = review.accepted.map((candidate) =>
      concepts.filter(
        (concept) =>
          concept.title === candidate.title
          && concept.description === candidate.description,
      ),
    );

    if (matches.some((candidateMatches) => candidateMatches.length > 1)) {
      return { status: 'ambiguous' };
    }

    if (matches.some((candidateMatches) => candidateMatches.length === 0)) {
      return { status: 'not_found' };
    }

    return {
      status: 'matched',
      concepts: matches.map((candidateMatches) => candidateMatches[0]),
    };
  } catch {
    return { status: 'failed' };
  }
}

function unresolvedResult(
  error: DomainServiceError,
  reconciliation: 'not_found' | 'unchanged' | 'ambiguous' | 'failed',
): ConceptUnresolvedResult {
  return {
    status: 'unresolved',
    error,
    reconciliation,
  };
}

export async function getOwnedConcepts(
  userId: string,
  listId: string,
): Promise<ActiveConceptRow[]> {
  return readOwnedConcepts(userId, listId);
}

export async function createConcept(
  input: ConceptInput,
): Promise<CreateConceptResult> {
  const validation = validateInput(input.title, input.description);

  if (!validation.valid) {
    return {
      status: 'rejected',
      error: validation.error,
    };
  }

  try {
    await assertCurrentUser(input.userId);

    const { data, error } = await supabase.rpc('create_concept', {
      p_list_id: input.listId,
      p_title: validation.title,
      p_description: validation.description,
    });

    if (error) {
      throw error;
    }

    if (!data) {
      return unresolvedResult(unresolvedError(), 'not_found');
    }

    return {
      status: 'created',
      concept: toActiveConcept(data),
    };
  } catch (error) {
    const mappedError = mapSupabaseError(error);

    if (
      mappedError.code !== 'unavailable'
      && mappedError.code !== 'unknown'
      && mappedError.code !== 'unresolved'
    ) {
      return {
        status: 'rejected',
        error: mappedError,
      };
    }

    const reconciliation = await reconcileSingleConcept(
      input.userId,
      input.listId,
      validation.title,
      validation.description,
    );

    if (reconciliation.status === 'matched') {
      return {
        status: 'reconciled',
        concept: reconciliation.concept,
      };
    }

    return unresolvedResult(mappedError, reconciliation.status);
  }
}

export async function createConceptBatch(
  userId: string,
  listId: string,
  review: BatchReview,
): Promise<CreateConceptBatchResult> {
  if (review.status === 'rejected' || review.accepted.length === 0) {
    return {
      status: 'rejected',
      error: new DomainServiceError('concept_batch_empty', 'concept_batch_empty'),
    };
  }

  const items: ConceptBatchItem[] = review.accepted.map((candidate) => ({
    title: candidate.title,
    description: candidate.description,
  }));

  try {
    await assertCurrentUser(userId);

    const { data, error } = await supabase.rpc('create_concepts_batch', {
      p_list_id: listId,
      p_items: items,
    });

    if (error) {
      throw error;
    }

    if (!data || data.length !== items.length) {
      return unresolvedResult(unresolvedError(), 'not_found');
    }

    return {
      status: 'created',
      concepts: mapActiveConcepts(readConceptRows(data)),
      review,
    };
  } catch (error) {
    const mappedError = mapSupabaseError(error);

    if (
      mappedError.code !== 'unavailable'
      && mappedError.code !== 'unknown'
      && mappedError.code !== 'unresolved'
    ) {
      return {
        status: 'rejected',
        error: mappedError,
      };
    }

    const reconciliation = await reconcileBatch(userId, listId, review);

    if (reconciliation.status === 'matched') {
      return {
        status: 'reconciled',
        concepts: reconciliation.concepts,
        review,
      };
    }

    return unresolvedResult(mappedError, reconciliation.status);
  }
}

export async function updateConcept(
  input: ConceptUpdateInput,
): Promise<UpdateConceptResult> {
  const validation = validateInput(input.title, input.description);

  if (!validation.valid) {
    return {
      status: 'rejected',
      error: validation.error,
    };
  }

  try {
    await assertCurrentUser(input.userId);

    const { data, error } = await supabase.rpc('update_concept', {
      p_concept_id: input.conceptId,
      p_title: validation.title,
      p_description: validation.description,
      p_expected_updated_at: input.expectedUpdatedAt,
    });

    if (error) {
      throw error;
    }

    if (!data) {
      return unresolvedResult(unresolvedError(), 'not_found');
    }

    return {
      status: 'updated',
      concept: toActiveConcept(data),
    };
  } catch (error) {
    const mappedError = mapSupabaseError(error);

    if (
      mappedError.code !== 'unavailable'
      && mappedError.code !== 'unknown'
      && mappedError.code !== 'unresolved'
    ) {
      return {
        status: 'rejected',
        error: mappedError,
      };
    }

    const reconciliation = await reconcileSingleConcept(
      input.userId,
      input.listId,
      validation.title,
      validation.description,
    );

    if (reconciliation.status === 'matched') {
      return {
        status: 'reconciled',
        concept: reconciliation.concept,
      };
    }

    return unresolvedResult(mappedError, reconciliation.status);
  }
}

export async function deleteConcept(
  input: ConceptDeleteInput,
): Promise<DeleteConceptResult> {
  try {
    await assertCurrentUser(input.userId);

    const { data, error } = await supabase.rpc('delete_concept', {
      p_concept_id: input.conceptId,
      p_expected_updated_at: input.expectedUpdatedAt,
    });

    if (error) {
      throw error;
    }

    if (!data || data.deleted_at === null) {
      return unresolvedResult(unresolvedError(), 'not_found');
    }

    return {
      status: 'deleted',
      concept: null,
    };
  } catch (error) {
    const mappedError = mapSupabaseError(error);

    if (
      mappedError.code !== 'unavailable'
      && mappedError.code !== 'unknown'
      && mappedError.code !== 'unresolved'
    ) {
      return {
        status: 'rejected',
        error: mappedError,
      };
    }

    try {
      const concepts = await readOwnedConcepts(input.userId, input.listId);
      const stillActive = concepts.some(
        (concept) => concept.id === input.conceptId,
      );

      if (!stillActive) {
        return {
          status: 'reconciled',
          concept: null,
        };
      }

      return unresolvedResult(mappedError, 'unchanged');
    } catch {
      return unresolvedResult(mappedError, 'failed');
    }
  }
}
