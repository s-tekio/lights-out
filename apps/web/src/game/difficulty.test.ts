import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DIFFICULTY_ID,
  DIFFICULTIES,
  findDifficultyById,
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
