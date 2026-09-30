const PLAYER_NAME_MAX_LENGTH = 24;
const PLAYER_NAME_PATTERN = /^[A-Za-z0-9 _\-.]+$/;

export type Score = {
  readonly id: string;
  readonly playerName: string;
  readonly boardSize: number;
  readonly moves: number;
  readonly elapsedMs: number;
  readonly points: number;
  readonly createdAt: string;
};

export type ScoreSubmission = {
  readonly playerName: string;
  readonly boardSize: number;
  readonly moves: number;
  readonly elapsedMs: number;
};

export type SubmitScoreResponse = {
  readonly score: Score;
  readonly rank: number;
};

export type SortColumn = 'points' | 'elapsedMs' | 'playerName';
export type SortOrder = 'asc' | 'desc';

export type LeaderboardQuery = {
  readonly limit?: number;
  readonly boardSize?: number | null;
  readonly sort?: SortColumn;
  readonly order?: SortOrder;
};

export type LeaderboardResponse = {
  readonly items: readonly Score[];
  readonly limit: number;
  readonly boardSize: number | null;
  readonly sort: SortColumn;
  readonly order: SortOrder;
};

export type PurgeResponse = {
  readonly deleted: number;
};

type FieldError = {
  readonly field: string;
  readonly message: string;
};

type ApiErrorBody = {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details: readonly FieldError[];
  };
};

export class NetworkError extends Error {
  constructor(
    override message: string,
    override readonly cause: unknown,
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class UnparseableResponseError extends Error {
  readonly status: number;
  readonly bodyText: string;

  constructor(status: number, bodyText: string) {
    super(`Server returned status ${status} with an unparseable body.`);
    this.name = 'UnparseableResponseError';
    this.status = status;
    this.bodyText = bodyText;
  }
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: readonly FieldError[];

  constructor(status: number, code: string, message: string, details: readonly FieldError[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class MalformedResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MalformedResponseError';
  }
}

export type FetchLike = typeof fetch;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
}

function isFieldError(value: unknown): value is FieldError {
  return isObject(value) && isString(value.field) && isString(value.message);
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (!isObject(value)) {
    return false;
  }

  const error = value.error;
  if (!isObject(error)) {
    return false;
  }

  const details = error.details;
  return (
    isString(error.code) &&
    isString(error.message) &&
    Array.isArray(details) &&
    details.every(isFieldError)
  );
}

function isScore(value: unknown): value is Score {
  return (
    isObject(value) &&
    isString(value.id) &&
    isString(value.playerName) &&
    isInteger(value.boardSize) &&
    isInteger(value.moves) &&
    isInteger(value.elapsedMs) &&
    isInteger(value.points) &&
    isString(value.createdAt)
  );
}

function isSubmitScoreResponse(value: unknown): value is SubmitScoreResponse {
  return isObject(value) && isScore(value.score) && isInteger(value.rank);
}

const SORT_COLUMNS: readonly string[] = ['points', 'elapsedMs', 'playerName'];
const SORT_ORDERS: readonly string[] = ['asc', 'desc'];

function isSortColumn(value: unknown): value is SortColumn {
  return isString(value) && SORT_COLUMNS.includes(value);
}

function isSortOrder(value: unknown): value is SortOrder {
  return isString(value) && SORT_ORDERS.includes(value);
}

function isPurgeResponse(value: unknown): value is PurgeResponse {
  return isObject(value) && isInteger(value.deleted);
}

function isLeaderboardResponse(value: unknown): value is LeaderboardResponse {
  if (!isObject(value)) {
    return false;
  }

  const items = value.items;
  const boardSize = value.boardSize;
  return (
    Array.isArray(items) &&
    items.every(isScore) &&
    isInteger(value.limit) &&
    (boardSize === null || isInteger(boardSize)) &&
    isSortColumn(value.sort) &&
    isSortOrder(value.order)
  );
}

function safeJsonParse(text: string): unknown {
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch {
    return undefined;
  }
}

async function readErrorBody(response: Response): Promise<ApiError | UnparseableResponseError> {
  const text = await response.text();
  const parsed = safeJsonParse(text);

  if (isApiErrorBody(parsed)) {
    return new ApiError(
      response.status,
      parsed.error.code,
      parsed.error.message,
      parsed.error.details,
    );
  }

  return new UnparseableResponseError(response.status, text);
}

export function getScoresErrorMessage(error: unknown): string {
  if (error instanceof NetworkError) {
    return 'Could not connect to the ranking server. Please check your network and try again.';
  }

  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof UnparseableResponseError) {
    return 'The server returned an unexpected response. Please try again later.';
  }

  if (error instanceof MalformedResponseError) {
    return 'The server returned a malformed response. Please try again later.';
  }

  return 'Something went wrong. Please try again.';
}

export function validatePlayerName(name: string): string | null {
  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return 'Player name is required.';
  }

  if (trimmed.length > PLAYER_NAME_MAX_LENGTH) {
    return 'Player name must be at most 24 characters.';
  }

  if (!PLAYER_NAME_PATTERN.test(trimmed)) {
    return 'Player name can only contain letters, digits, spaces, _, -, and .';
  }

  return null;
}

export async function submitScore(
  input: ScoreSubmission,
  fetchImpl: FetchLike = fetch,
): Promise<SubmitScoreResponse> {
  let response: Response;
  try {
    response = await fetchImpl('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(input),
    });
  } catch (cause) {
    throw new NetworkError('The score submission could not reach the server.', cause);
  }

  if (!response.ok) {
    throw await readErrorBody(response);
  }

  const body: unknown = await response.json();
  if (!isSubmitScoreResponse(body)) {
    throw new MalformedResponseError(
      'The server returned a score response in an unexpected shape.',
    );
  }

  return body;
}

export async function purgeScores(
  confirm: string,
  fetchImpl: FetchLike = fetch,
): Promise<PurgeResponse> {
  const params = new URLSearchParams();
  params.set('confirm', confirm);
  const url = `/api/scores?${params.toString()}`;

  let response: Response;
  try {
    response = await fetchImpl(url, { method: 'DELETE' });
  } catch (cause) {
    throw new NetworkError('The purge request could not reach the server.', cause);
  }

  if (!response.ok) {
    throw await readErrorBody(response);
  }

  const body: unknown = await response.json();
  if (!isPurgeResponse(body)) {
    throw new MalformedResponseError(
      'The server returned a purge response in an unexpected shape.',
    );
  }

  return body;
}

export async function fetchLeaderboard(
  query: LeaderboardQuery,
  fetchImpl: FetchLike = fetch,
): Promise<LeaderboardResponse> {
  const params = new URLSearchParams();

  if (query.limit !== undefined) {
    params.set('limit', String(query.limit));
  }

  if (query.boardSize !== undefined && query.boardSize !== null) {
    params.set('boardSize', String(query.boardSize));
  }

  if (query.sort !== undefined) {
    params.set('sort', query.sort);
  }

  if (query.order !== undefined) {
    params.set('order', query.order);
  }

  const url = params.toString().length > 0 ? `/api/scores?${params.toString()}` : '/api/scores';

  let response: Response;
  try {
    response = await fetchImpl(url);
  } catch (cause) {
    throw new NetworkError('The leaderboard could not be loaded.', cause);
  }

  if (!response.ok) {
    throw await readErrorBody(response);
  }

  const body: unknown = await response.json();
  if (!isLeaderboardResponse(body)) {
    throw new MalformedResponseError(
      'The server returned a leaderboard response in an unexpected shape.',
    );
  }

  return body;
}
