import { describe, expect, it } from 'vitest';
import {
  BASE_POINTS_PER_CELL,
  computePoints,
  MOVE_PENALTY_PER_EXCESS_MOVE,
  parMoves,
  TIME_PENALTY_PER_SECOND,
} from '../../src/domain/score.js';

describe('parMoves', () => {
  it('returns boardSize times two', () => {
    expect(parMoves(3)).toBe(6);
    expect(parMoves(5)).toBe(10);
    expect(parMoves(7)).toBe(14);
    expect(parMoves(8)).toBe(16);
    expect(parMoves(9)).toBe(18);
  });
});

describe('computePoints', () => {
  it('awards the full base value when moves and time are zero', () => {
    expect(computePoints({ boardSize: 5, moves: 0, elapsedMs: 0 })).toBe(
      5 * 5 * BASE_POINTS_PER_CELL,
    );
  });

  it('applies no move penalty at exactly parMoves', () => {
    const boardSize = 5;
    const moves = parMoves(boardSize);
    expect(computePoints({ boardSize, moves, elapsedMs: 0 })).toBe(
      boardSize * boardSize * BASE_POINTS_PER_CELL,
    );
  });

  it('applies a move penalty for every move above par', () => {
    const boardSize = 5;
    const excess = 3;
    expect(computePoints({ boardSize, moves: parMoves(boardSize) + excess, elapsedMs: 0 })).toBe(
      boardSize * boardSize * BASE_POINTS_PER_CELL - excess * MOVE_PENALTY_PER_EXCESS_MOVE,
    );
  });

  it('applies a time penalty per full second', () => {
    const boardSize = 5;
    const elapsedMs = 4_500;
    const seconds = Math.floor(elapsedMs / 1_000);
    expect(computePoints({ boardSize, moves: 0, elapsedMs })).toBe(
      boardSize * boardSize * BASE_POINTS_PER_CELL - seconds * TIME_PENALTY_PER_SECOND,
    );
  });

  it('floors the result at zero', () => {
    expect(computePoints({ boardSize: 3, moves: 1_000, elapsedMs: 86_400_000 })).toBe(0);
  });

  it('rounds the final value', () => {
    // All inputs are integers, so rounding should be a no-op, but the
    // contract still specifies round().
    expect(computePoints({ boardSize: 4, moves: 0, elapsedMs: 0 })).toBe(
      4 * 4 * BASE_POINTS_PER_CELL,
    );
  });

  it('computes correctly for several board sizes', () => {
    expect(computePoints({ boardSize: 3, moves: 0, elapsedMs: 0 })).toBe(900);
    expect(computePoints({ boardSize: 4, moves: 0, elapsedMs: 0 })).toBe(1_600);
    expect(computePoints({ boardSize: 5, moves: 0, elapsedMs: 0 })).toBe(2_500);
    expect(computePoints({ boardSize: 6, moves: 0, elapsedMs: 0 })).toBe(3_600);
    expect(computePoints({ boardSize: 7, moves: 0, elapsedMs: 0 })).toBe(4_900);
    expect(computePoints({ boardSize: 8, moves: 0, elapsedMs: 0 })).toBe(6_400);
    expect(computePoints({ boardSize: 9, moves: 0, elapsedMs: 0 })).toBe(8_100);
  });
});
