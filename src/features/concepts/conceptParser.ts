export const CONCEPT_TITLE_MAX_LENGTH = 50;
export const CONCEPT_DESCRIPTION_MAX_LENGTH = 2000;
export const CONCEPT_BATCH_MAX_LINES = 100;
export const CONCEPT_BATCH_MAX_CHARACTERS = 20000;

export type ConceptValidationErrorCode =
  | 'title_invalid'
  | 'description_invalid';

export type ConceptFieldValidation =
  | {
      valid: true;
      title: string;
      description: string;
    }
  | {
      valid: false;
      error: ConceptValidationErrorCode;
      title: string;
      description: string;
    };

export type BatchOmissionReasonCode =
  | 'empty'
  | 'malformed'
  | 'title_invalid'
  | 'description_invalid'
  | 'duplicate';

export type BatchLimitViolation = 'line_limit' | 'character_limit';

export type BatchCandidate = {
  sourceIndex: number;
  title: string;
  description: string;
};

export type BatchOmission = {
  sourceIndex: number;
  rawLine: string;
  reasonCode: BatchOmissionReasonCode;
};

export type BatchReview =
  | {
      status: 'ready';
      rawInput: string;
      accepted: BatchCandidate[];
      omitted: BatchOmission[];
      limitViolations: [];
    }
  | {
      status: 'rejected';
      rawInput: string;
      accepted: [];
      omitted: [];
      limitViolations: BatchLimitViolation[];
    };

function characterLength(value: string): number {
  return Array.from(value).length;
}

export function validateConceptFields(
  rawTitle: string,
  rawDescription: string,
): ConceptFieldValidation {
  const title = rawTitle.trim();
  const description = rawDescription.trim();

  if (
    characterLength(title) === 0
    || characterLength(title) > CONCEPT_TITLE_MAX_LENGTH
  ) {
    return {
      valid: false,
      error: 'title_invalid',
      title,
      description,
    };
  }

  if (characterLength(description) > CONCEPT_DESCRIPTION_MAX_LENGTH) {
    return {
      valid: false,
      error: 'description_invalid',
      title,
      description,
    };
  }

  return {
    valid: true,
    title,
    description,
  };
}

function splitInputLines(rawInput: string): string[] {
  return rawInput.split(/\r\n|\n|\r/);
}

function parseLine(
  rawLine: string,
  sourceIndex: number,
): BatchCandidate | BatchOmission {
  const trimmedLine = rawLine.trim();

  if (trimmedLine.length === 0) {
    return {
      sourceIndex,
      rawLine,
      reasonCode: 'empty',
    };
  }

  if (!trimmedLine.startsWith('-')) {
    return {
      sourceIndex,
      rawLine,
      reasonCode: 'malformed',
    };
  }

  const content = trimmedLine.slice(1).trim();
  const delimiterIndex = content.indexOf(':');
  const rawTitle = delimiterIndex === -1
    ? content
    : content.slice(0, delimiterIndex);
  const rawDescription = delimiterIndex === -1
    ? ''
    : content.slice(delimiterIndex + 1);
  const validation = validateConceptFields(rawTitle, rawDescription);

  if (!validation.valid) {
    return {
      sourceIndex,
      rawLine,
      reasonCode: validation.error,
    };
  }

  return {
    sourceIndex,
    title: validation.title,
    description: validation.description,
  };
}

export function parseConceptBatch(
  rawInput: string,
  existingTitles: ReadonlySet<string> = new Set(),
): BatchReview {
  const lines = splitInputLines(rawInput);
  const limitViolations: BatchLimitViolation[] = [];

  if (lines.length > CONCEPT_BATCH_MAX_LINES) {
    limitViolations.push('line_limit');
  }

  if (characterLength(rawInput) > CONCEPT_BATCH_MAX_CHARACTERS) {
    limitViolations.push('character_limit');
  }

  if (limitViolations.length > 0) {
    return {
      status: 'rejected',
      rawInput,
      accepted: [],
      omitted: [],
      limitViolations,
    };
  }

  const accepted: BatchCandidate[] = [];
  const omitted: BatchOmission[] = [];
  const seenTitles = new Set(existingTitles);

  for (const [sourceIndex, rawLine] of lines.entries()) {
    const parsedLine = parseLine(rawLine, sourceIndex);

    if ('reasonCode' in parsedLine) {
      omitted.push(parsedLine);
      continue;
    }

    if (seenTitles.has(parsedLine.title)) {
      omitted.push({
        sourceIndex,
        rawLine,
        reasonCode: 'duplicate',
      });
      continue;
    }

    seenTitles.add(parsedLine.title);
    accepted.push(parsedLine);
  }

  return {
    status: 'ready',
    rawInput,
    accepted,
    omitted,
    limitViolations: [],
  };
}
