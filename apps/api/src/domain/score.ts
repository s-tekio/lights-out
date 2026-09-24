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

/** Penalty for every move above the heuristic par. */
export const MOVE_PENALTY_PER_EXCESS_MOVE = 25;

/** Penalty for every full second of elapsed time. */
export const TIME_PENALTY_PER_SECOND = 5;

/**
 * Heuristic par for a board size.
 * The true minimum number of presses is not a fixed value, so the contract
 * uses a documented heuristic instead.
 */
export function parMoves(boardSize: number): number {
  return boardSize * 2;
}

type ComputePointsInput = {
  boardSize: number;
  moves: number;
  elapsedMs: number;
};

/**
 * Computes points from the reported game outcome.
 *
 *   base  = boardSize * boardSize * 100
 *   movePenalty  = max(0, moves - parMoves(boardSize)) * 25
 *   timePenalty  = floor(elapsedMs / 1000) * 5
 *   points = max(0, round(base - movePenalty - timePenalty))
 */
export function computePoints({ boardSize, moves, elapsedMs }: ComputePointsInput): number {
  const base = boardSize * boardSize * BASE_POINTS_PER_CELL;
  const excessMoves = Math.max(0, moves - parMoves(boardSize));
  const movePenalty = excessMoves * MOVE_PENALTY_PER_EXCESS_MOVE;
  const timePenalty = Math.floor(elapsedMs / 1000) * TIME_PENALTY_PER_SECOND;
  return Math.max(0, Math.round(base - movePenalty - timePenalty));
}
