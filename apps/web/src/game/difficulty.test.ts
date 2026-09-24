import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DIFFICULTY_ID,
  DIFFICULTIES,
  findDifficultyByBoardSize,
  findDifficultyById,
  formatBoardSizeLabel,
  formatDifficultyLabel,
  isDifficultyId,
} from './difficulty';

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
    const expectedLabels: Record<string, string> = {
      easy: 'Easy (5×5)',
      normal: 'Normal (7×7)',
      hard: 'Hard (9×9)',
    };

    for (const difficulty of DIFFICULTIES) {
      expect(formatDifficultyLabel(difficulty)).toBe(expectedLabels[difficulty.id]);
    }
  });
});

describe('formatBoardSizeLabel', () => {
  it('returns the difficulty label for a known board size', () => {
    expect(formatBoardSizeLabel(5)).toBe('Easy (5×5)');
    expect(formatBoardSizeLabel(7)).toBe('Normal (7×7)');
    expect(formatBoardSizeLabel(9)).toBe('Hard (9×9)');
  });

  it('falls back to the raw size when no difficulty matches', () => {
    expect(formatBoardSizeLabel(4)).toBe('4×4');
    expect(formatBoardSizeLabel(99)).toBe('99×99');
  });
});
