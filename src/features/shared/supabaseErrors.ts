export type DomainErrorCode =
  | 'unauthenticated'
  | 'unauthorized'
  | 'invalid_name'
  | 'duplicate_name'
  | 'list_limit'
  | 'profile_not_initialized'
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
