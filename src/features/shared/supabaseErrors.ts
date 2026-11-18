export type DomainErrorCode =
  | 'unauthenticated'
  | 'unauthorized'
  | 'invalid_name'
  | 'duplicate_name'
  | 'list_limit'
  | 'profile_not_initialized'
  | 'concept_title_invalid'
  | 'concept_description_invalid'
  | 'concept_duplicate'
  | 'batch_limit_exceeded'
  | 'concept_batch_invalid'
  | 'concept_batch_empty'
  | 'concept_conflict'
  | 'concept_not_found'
  | 'round_action_rejected'
  | 'unresolved'
  | 'unavailable'
  | 'unknown';

export class DomainServiceError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'DomainServiceError';
    this.code = code;
  }
}

type ErrorRecord = Record<string, unknown>;

function isErrorRecord(error: unknown): error is ErrorRecord {
  return typeof error === 'object' && error !== null;
}

function hasMessage(error: unknown): error is ErrorRecord & { message: string } {
  return isErrorRecord(error) && typeof error.message === 'string';
}

function messageCode(message: string): DomainErrorCode | null {
  switch (message) {
    case 'profile_not_authenticated':
    case 'list_not_authenticated':
      return 'unauthenticated';
    case 'profile_not_initialized':
      return 'profile_not_initialized';
    case 'list_name_invalid':
      return 'invalid_name';
    case 'list_name_duplicate':
      return 'duplicate_name';
    case 'list_limit_reached':
      return 'list_limit';
    case 'concept_not_authenticated':
      return 'unauthenticated';
    case 'concept_unauthorized':
      return 'unauthorized';
    case 'concept_title_invalid':
      return 'concept_title_invalid';
    case 'concept_description_invalid':
      return 'concept_description_invalid';
    case 'concept_duplicate':
      return 'concept_duplicate';
    case 'batch_limit_exceeded':
      return 'batch_limit_exceeded';
    case 'concept_batch_invalid':
      return 'concept_batch_invalid';
    case 'concept_batch_empty':
      return 'concept_batch_empty';
    case 'concept_conflict':
      return 'concept_conflict';
    case 'concept_not_found':
      return 'concept_not_found';
    case 'unresolved':
      return 'unresolved';
    default:
      return null;
  }
}

export function mapSupabaseError(
  error: unknown,
  fallbackCode: DomainErrorCode = 'unavailable',
): DomainServiceError {
  const message = hasMessage(error) ? error.message : '';
  const code = isErrorRecord(error) && typeof error.code === 'string'
    ? error.code
    : '';
  const mappedMessageCode = messageCode(message);
  const normalizedMessage = message.toLowerCase();

  if (mappedMessageCode) {
    return new DomainServiceError(mappedMessageCode, mappedMessageCode, error);
  }

  if (code === '22023') {
    return new DomainServiceError('invalid_name', 'invalid_name', error);
  }

  if (code === '23505') {
    return new DomainServiceError('duplicate_name', 'duplicate_name', error);
  }

  if (code === '40001') {
    return new DomainServiceError('concept_conflict', 'concept_conflict', error);
  }

  if (code === '28000') {
    return new DomainServiceError('unauthenticated', 'unauthenticated', error);
  }

  if (
    normalizedMessage.includes('session missing')
    || normalizedMessage.includes('not authenticated')
  ) {
    return new DomainServiceError('unauthenticated', 'unauthenticated', error);
  }

  if (code === '42501') {
    return new DomainServiceError('unauthorized', 'unauthorized', error);
  }

  if (hasMessage(error) && /fetch|network|timeout|offline/i.test(message)) {
    return new DomainServiceError('unavailable', 'unavailable', error);
  }

  return new DomainServiceError(fallbackCode, fallbackCode, error);
}

export function unauthenticatedError(): DomainServiceError {
  return new DomainServiceError('unauthenticated', 'unauthenticated');
}

export function unauthorizedError(): DomainServiceError {
  return new DomainServiceError('unauthorized', 'unauthorized');
}
