import type { FieldError } from './errors.js';
import type { ScoreInput } from './score.js';

const PLAYER_NAME_MAX_LENGTH = 24;
const PLAYER_NAME_PATTERN = /^[A-Za-z0-9 _\-.]+$/;

const BOARD_SIZE_MIN = 3;
const BOARD_SIZE_MAX = 7;

const MOVES_MIN = 0;
const MOVES_MAX = 1000;

const ELAPSED_MS_MIN = 0;
const ELAPSED_MS_MAX = 86_400_000;

const DEFAULT_LIMIT = 10;
const LIMIT_MIN = 1;
const LIMIT_MAX = 100;

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: FieldError[] };

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
}

function addError(errors: FieldError[], field: string, message: string): void {
  errors.push({ field, message });
}

export function parseScoreSubmission(raw: unknown): ValidationResult<ScoreInput> {
  const errors: FieldError[] = [];

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ok: false,
      errors: [{ field: 'body', message: 'must be a JSON object' }],
    };
  }

  const body = raw as Record<string, unknown>;

  let playerName: string | undefined;
  if (!('playerName' in body)) {
    addError(errors, 'playerName', 'is required');
  } else if (typeof body.playerName !== 'string') {
    addError(errors, 'playerName', 'must be a string');
  } else {
    const trimmed = body.playerName.trim();
    if (trimmed.length === 0) {
      addError(errors, 'playerName', 'cannot be empty');
    } else if (trimmed.length > PLAYER_NAME_MAX_LENGTH) {
      addError(errors, 'playerName', 'must be at most 24 characters');
    } else if (!PLAYER_NAME_PATTERN.test(trimmed)) {
      addError(errors, 'playerName', 'can only contain letters, digits, spaces, _, -, and .');
    } else {
      playerName = trimmed;
    }
  }

  let boardSize: number | undefined;
  if (!('boardSize' in body)) {
    addError(errors, 'boardSize', 'is required');
  } else if (!isInteger(body.boardSize)) {
    addError(errors, 'boardSize', 'must be an integer between 3 and 7');
  } else if (body.boardSize < BOARD_SIZE_MIN || body.boardSize > BOARD_SIZE_MAX) {
    addError(errors, 'boardSize', 'must be an integer between 3 and 7');
  } else {
    boardSize = body.boardSize;
  }

  let moves: number | undefined;
  if (!('moves' in body)) {
    addError(errors, 'moves', 'is required');
  } else if (!isInteger(body.moves)) {
    addError(errors, 'moves', 'must be an integer between 0 and 1000');
  } else if (body.moves < MOVES_MIN || body.moves > MOVES_MAX) {
    addError(errors, 'moves', 'must be an integer between 0 and 1000');
  } else {
    moves = body.moves;
  }

  let elapsedMs: number | undefined;
  if (!('elapsedMs' in body)) {
    addError(errors, 'elapsedMs', 'is required');
  } else if (!isInteger(body.elapsedMs)) {
    addError(errors, 'elapsedMs', 'must be an integer between 0 and 86400000');
  } else if (body.elapsedMs < ELAPSED_MS_MIN || body.elapsedMs > ELAPSED_MS_MAX) {
    addError(errors, 'elapsedMs', 'must be an integer between 0 and 86400000');
  } else {
    elapsedMs = body.elapsedMs;
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      playerName: playerName as string,
      boardSize: boardSize as number,
      moves: moves as number,
      elapsedMs: elapsedMs as number,
    },
  };
}

export type ScoreQuery = {
  limit: number;
  boardSize: number | null;
};

function parseQueryInt(
  raw: unknown,
  field: string,
  min: number,
  max: number,
  errors: FieldError[],
): number | undefined {
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed)) {
      addError(errors, field, `must be an integer between ${min} and ${max}`);
      return undefined;
    }
    if (parsed < min || parsed > max) {
      addError(errors, field, `must be an integer between ${min} and ${max}`);
      return undefined;
    }
    return parsed;
  }

  if (typeof raw === 'number') {
    if (!isInteger(raw)) {
      addError(errors, field, `must be an integer between ${min} and ${max}`);
      return undefined;
    }
    if (raw < min || raw > max) {
      addError(errors, field, `must be an integer between ${min} and ${max}`);
      return undefined;
    }
    return raw;
  }

  if (raw !== undefined) {
    addError(errors, field, `must be an integer between ${min} and ${max}`);
  }
  return undefined;
}

export function parseScoreQuery(raw: unknown): ValidationResult<ScoreQuery> {
  const query =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const errors: FieldError[] = [];

  const limit = parseQueryInt(query.limit, 'limit', LIMIT_MIN, LIMIT_MAX, errors) ?? DEFAULT_LIMIT;

  const boardSizeRaw = query.boardSize;
  const boardSize: number | null =
    boardSizeRaw === undefined || boardSizeRaw === ''
      ? null
      : (parseQueryInt(boardSizeRaw, 'boardSize', BOARD_SIZE_MIN, BOARD_SIZE_MAX, errors) ?? null);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: { limit, boardSize } };
}
