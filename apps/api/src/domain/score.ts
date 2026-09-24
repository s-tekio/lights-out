/**
 * Immutable score stored by the ranking service.
 * Timestamps are ISO 8601 UTC strings.
 */
export type Score = {
  id: string;
  playerName: string;
  boardSize: number;
  moves: number;
  elapsedMs: number;
  points: number;
  createdAt: string;
};

/**
 * Raw input reported by a finished game.
 * The server computes points from these fields.
 */
export type ScoreInput = {
  playerName: string;
  boardSize: number;
  moves: number;
  elapsedMs: number;
};

/** Points awarded per board cell. */
export const BASE_POINTS_PER_CELL = 100;

/**
 * Reference duration per board cell, in milliseconds.
 * The reference time for a level is boardSize² × this value.
 */
export const REFERENCE_MS_PER_CELL = 2_000;

/**
 * Heuristic par for a board size.
 * The true minimum number of presses is not a fixed value, so the contract
 * uses a documented heuristic instead. Once the server issues puzzles, this
 * can be replaced by the board's real minimum and the move factor becomes a
 * true efficiency ratio.
 */
export function parMoves(boardSize: number): number {
  return boardSize * 2;
}

/**
 * Reference duration for a board size, in milliseconds.
 * A run finished at or below this duration keeps the full time factor.
 */
export function referenceMs(boardSize: number): number {
  return boardSize * boardSize * REFERENCE_MS_PER_CELL;
}

type ComputePointsInput = {
  boardSize: number;
  moves: number;
  elapsedMs: number;
};

/**
 * Computes points from the reported game outcome.
 *
 * The score is a product of two bounded factors in (0, 1] instead of a fixed
 * base minus unbounded penalties. A subtraction collapses every result past
 * its break-even point into the same zero; a product keeps differentiating
 * scores no matter how long or how many moves the game took.
 *
 *   base       = boardSize² × BASE_POINTS_PER_CELL
 *   par        = parMoves(boardSize)
 *   referenceMs= referenceMs(boardSize)
 *   moveFactor = min(1, par / max(1, moves))
 *   timeFactor = min(1, referenceMs / max(1, elapsedMs))
 *   points     = max(0, round(base × moveFactor × timeFactor))
 *
 * The maximum score for a level is therefore its base: 900 / 2500 / 4900.
 */
export function computePoints({ boardSize, moves, elapsedMs }: ComputePointsInput): number {
  const base = boardSize * boardSize * BASE_POINTS_PER_CELL;
  const par = parMoves(boardSize);
  const reference = referenceMs(boardSize);
  const moveFactor = Math.min(1, par / Math.max(1, moves));
  const timeFactor = Math.min(1, reference / Math.max(1, elapsedMs));
  return Math.max(0, Math.round(base * moveFactor * timeFactor));
}
