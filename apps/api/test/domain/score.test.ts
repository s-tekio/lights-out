import { describe, expect, it } from 'vitest';
import {
  BASE_POINTS_PER_CELL,
  computePoints,
  parMoves,
  referenceMs,
  REFERENCE_MS_PER_CELL,
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

describe('referenceMs', () => {
  it('returns boardSize squared times REFERENCE_MS_PER_CELL', () => {
    expect(referenceMs(3)).toBe(3 * 3 * REFERENCE_MS_PER_CELL);
    expect(referenceMs(5)).toBe(5 * 5 * REFERENCE_MS_PER_CELL);
    expect(referenceMs(7)).toBe(7 * 7 * REFERENCE_MS_PER_CELL);
  });
});

describe('computePoints', () => {
  const BOARD_SIZES = [3, 4, 5, 6, 7, 8, 9];

  function levelBase(boardSize: number): number {
    return boardSize * boardSize * BASE_POINTS_PER_CELL;
  }

  it('caps the score at the level base and reaches it at or below par and reference time', () => {
    for (const boardSize of BOARD_SIZES) {
      const base = levelBase(boardSize);
      const par = parMoves(boardSize);
      const ref = referenceMs(boardSize);

      // At exactly par and reference time the score is the full base.
      expect(computePoints({ boardSize, moves: par, elapsedMs: ref })).toBe(base);

      // Better than par and faster than reference still gives the full base.
      expect(
        computePoints({ boardSize, moves: Math.max(0, par - 1), elapsedMs: Math.max(0, ref - 1) }),
      ).toBe(base);
      expect(computePoints({ boardSize, moves: 0, elapsedMs: 0 })).toBe(base);
    }
  });

  it('never returns a negative or non-integer score', () => {
    for (const boardSize of BOARD_SIZES) {
      for (const moves of [0, 1, parMoves(boardSize), parMoves(boardSize) + 1, 100, 1000]) {
        for (const elapsedMs of [
          0,
          1,
          1000,
          referenceMs(boardSize),
          referenceMs(boardSize) + 1,
          60_000,
          86_400_000,
        ]) {
          const points = computePoints({ boardSize, moves, elapsedMs });
          expect(Number.isInteger(points)).toBe(true);
          expect(points).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('does not increase when moves increase with time fixed', () => {
    for (const boardSize of BOARD_SIZES) {
      const elapsedMs = referenceMs(boardSize);
      let previous = computePoints({ boardSize, moves: 0, elapsedMs });
      for (let moves = 1; moves <= parMoves(boardSize) + 10; moves += 1) {
        const current = computePoints({ boardSize, moves, elapsedMs });
        expect(current).toBeLessThanOrEqual(previous);
        previous = current;
      }
    }
  });

  it('does not increase when time increases with moves fixed', () => {
    for (const boardSize of BOARD_SIZES) {
      const moves = parMoves(boardSize);
      let previous = computePoints({ boardSize, moves, elapsedMs: 0 });
      for (
        let elapsedMs = 1_000;
        elapsedMs <= referenceMs(boardSize) + 10_000;
        elapsedMs += 1_000
      ) {
        const current = computePoints({ boardSize, moves, elapsedMs });
        expect(current).toBeLessThanOrEqual(previous);
        previous = current;
      }
    }
  });

  it('treats zero moves and zero elapsed time as the maximum', () => {
    for (const boardSize of BOARD_SIZES) {
      expect(computePoints({ boardSize, moves: 0, elapsedMs: 0 })).toBe(levelBase(boardSize));
    }
  });

  it('keeps moveFactor at 1 at exactly par and drops it below 1 one move past par', () => {
    for (const boardSize of BOARD_SIZES) {
      const par = parMoves(boardSize);
      const ref = referenceMs(boardSize);
      const atPar = computePoints({ boardSize, moves: par, elapsedMs: ref });
      const oneOver = computePoints({ boardSize, moves: par + 1, elapsedMs: ref });
      expect(atPar).toBe(levelBase(boardSize));
      expect(oneOver).toBeLessThan(levelBase(boardSize));
    }
  });

  it('keeps timeFactor at 1 at exactly reference time and drops it below 1 once elapsed time passes it', () => {
    for (const boardSize of BOARD_SIZES) {
      const par = parMoves(boardSize);
      const ref = referenceMs(boardSize);
      const base = levelBase(boardSize);
      const atRef = computePoints({ boardSize, moves: par, elapsedMs: ref });
      const oneMsOver = computePoints({ boardSize, moves: par, elapsedMs: ref + 1 });
      expect(atRef).toBe(base);

      // referenceMs is 20× the base, so at referenceMs + 1 the drop is below
      // 0.5 points and rounds back to the base. The visible drop appears once
      // rounding changes.
      expect(oneMsOver).toBeLessThanOrEqual(base);
      expect(computePoints({ boardSize, moves: par, elapsedMs: ref * 2 })).toBeLessThan(base);
    }
  });

  it('computes correctly for several board sizes at zero moves and zero time', () => {
    expect(computePoints({ boardSize: 3, moves: 0, elapsedMs: 0 })).toBe(900);
    expect(computePoints({ boardSize: 4, moves: 0, elapsedMs: 0 })).toBe(1_600);
    expect(computePoints({ boardSize: 5, moves: 0, elapsedMs: 0 })).toBe(2_500);
    expect(computePoints({ boardSize: 6, moves: 0, elapsedMs: 0 })).toBe(3_600);
    expect(computePoints({ boardSize: 7, moves: 0, elapsedMs: 0 })).toBe(4_900);
    expect(computePoints({ boardSize: 8, moves: 0, elapsedMs: 0 })).toBe(6_400);
    expect(computePoints({ boardSize: 9, moves: 0, elapsedMs: 0 })).toBe(8_100);
  });

  describe('regression cases', () => {
    it('gives the user 21 points for a real Easy 3x3 game that used to score 0', () => {
      // Board size 3: base 900, par 6, referenceMs 18 000.
      // moveFactor = min(1, 6 / 71) = 6 / 71
      // timeFactor = min(1, 18 000 / 66 000) = 18 / 66 = 3 / 11
      // points = round(900 × (6 / 71) × (3 / 11))
      //        = round(900 × 18 / 781)
      //        = round(16 200 / 781)
      //        = round(20.74...) = 21
      expect(computePoints({ boardSize: 3, moves: 71, elapsedMs: 66_000 })).toBe(21);
    });

    it('gives 90 points to a perfect Easy game at three minutes, which used to score 0', () => {
      // Board size 3: base 900, par 6, referenceMs 18 000.
      // moveFactor = min(1, 6 / 3) = 1
      // timeFactor = min(1, 18 000 / 180 000) = 0.1
      // points = round(900 × 1 × 0.1) = round(90) = 90
      expect(computePoints({ boardSize: 3, moves: 3, elapsedMs: 180_000 })).toBe(90);
    });

    it('awards the full base for a perfect run within the reference time', () => {
      // Board size 3: base 900, par 6, referenceMs 18 000.
      // Both factors are capped at 1, so the score is the full base.
      expect(computePoints({ boardSize: 3, moves: 3, elapsedMs: 18_000 })).toBe(900);
    });

    it('floors absurd inputs to zero, but now only at an absurd threshold', () => {
      // Board size 3: base 900, par 6, referenceMs 18 000.
      // moveFactor ≈ 6 / 1000 = 0.006
      // timeFactor ≈ 18 000 / 86 400 000 = 0.0002083...
      // points = round(900 × 0.006 × 0.0002083...) = round(0.001125) = 0
      // On Easy, zero now needs roughly moves × seconds > 194 000, versus 43
      // moves under the old additive formula.
      expect(computePoints({ boardSize: 3, moves: 1_000, elapsedMs: 86_400_000 })).toBe(0);
    });
  });
});
