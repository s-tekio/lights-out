import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DIFFICULTY_ID,
  DIFFICULTIES,
  findDifficultyByBoardSize,
  findDifficultyById,
  formatBoardSizeLabel,
  formatDifficultyLabel,
  isDifficultyId,
} from '../../src/game/difficulty';

describe('isDifficultyId', () => {
  it('returns true for every known difficulty id', () => {
    for (const difficulty of DIFFICULTIES) {
      expect(isDifficultyId(difficulty.id)).toBe(true);
    }
  });

  it('returns false for an unknown string', () => {
    expect(isDifficultyId('impossible')).toBe(false);
  });

  it('returns false for values that are not valid ids', () => {
    expect(isDifficultyId('')).toBe(false);
    expect(isDifficultyId('easy ')).toBe(false);
    expect(isDifficultyId(' EASY')).toBe(false);
  });
});

describe('findDifficultyById', () => {
  it('returns the difficulty matching the id', () => {
    const difficulty = findDifficultyById(DEFAULT_DIFFICULTY_ID);
    expect(difficulty.id).toBe(DEFAULT_DIFFICULTY_ID);
  });

  it('throws for an unknown difficulty id', () => {
    expect(() => findDifficultyById('unknown' as never)).toThrow('Unknown difficulty: unknown');
  });
});

describe('findDifficultyByBoardSize', () => {
  it('returns the difficulty matching a known board size', () => {
    for (const difficulty of DIFFICULTIES) {
      expect(findDifficultyByBoardSize(difficulty.boardSize)).toBe(difficulty);
    }
  });

  it('returns undefined for an unmapped board size', () => {
    expect(findDifficultyByBoardSize(4)).toBeUndefined();
    expect(findDifficultyByBoardSize(99)).toBeUndefined();
  });
});

describe('formatDifficultyLabel', () => {
  it('combines the difficulty label with its board size', () => {
    // Derive the expected value from the difficulty data instead of hardcoding
    // the sizes: the label format is the behaviour under test, the numbers are
    // tuning values that get retuned.
    for (const difficulty of DIFFICULTIES) {
      const { boardSize } = difficulty;
      expect(formatDifficultyLabel(difficulty)).toBe(
        `${difficulty.label} (${boardSize}×${boardSize})`,
      );
    }
  });
});

describe('formatBoardSizeLabel', () => {
  it('returns the difficulty label for a known board size', () => {
    for (const difficulty of DIFFICULTIES) {
      expect(formatBoardSizeLabel(difficulty.boardSize)).toBe(formatDifficultyLabel(difficulty));
    }
  });

  it('falls back to the raw size when no difficulty matches', () => {
    // 4 sits inside the accepted range but no level uses it. Asserting that
    // explicitly means this test fails loudly, rather than silently changing
    // meaning, if a level is ever retuned to 4.
    const unmappedSize = 4;
    expect(findDifficultyByBoardSize(unmappedSize)).toBeUndefined();
    expect(formatBoardSizeLabel(unmappedSize)).toBe('4×4');

    expect(formatBoardSizeLabel(99)).toBe('99×99');
  });
});
