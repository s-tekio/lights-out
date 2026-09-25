import { describe, expect, it } from 'vitest';
import type { Score } from '../../src/domain/score.js';
import {
  buildScoreItem,
  encodePlayerKey,
  encodePointsKey,
  encodeTimeKey,
  NATURAL_SORT_DIRECTION,
  padNumber,
  scanIndexForward,
  scopeFor,
} from '../../src/adapters/dynamodb-score-repository.js';

function score(overrides: Partial<Score> & Pick<Score, 'id'>): Score {
  return {
    playerName: overrides.playerName ?? 'Tekio',
    boardSize: overrides.boardSize ?? 5,
    moves: overrides.moves ?? 7,
    elapsedMs: overrides.elapsedMs ?? 1_000,
    points: overrides.points ?? 2_000,
    createdAt: overrides.createdAt ?? '2026-09-24T12:00:00.000Z',
    id: overrides.id,
  };
}

describe('padNumber', () => {
  it('left-pads with zeros to the requested width', () => {
    expect(padNumber(42, 6)).toBe('000042');
    expect(padNumber(0, 9)).toBe('000000000');
    expect(padNumber(999_999, 6)).toBe('999999');
  });
});

describe('encodePointsKey', () => {
  it('orders higher points before lower points', () => {
    const high = score({ id: 'a', points: 3_000, elapsedMs: 5_000 });
    const low = score({ id: 'b', points: 2_000, elapsedMs: 5_000 });

    expect(encodePointsKey(high) < encodePointsKey(low)).toBe(true);
  });

  it('breaks ties by elapsedMs ascending', () => {
    const fast = score({ id: 'a', points: 2_000, elapsedMs: 1_000 });
    const slow = score({ id: 'b', points: 2_000, elapsedMs: 2_000 });

    expect(encodePointsKey(fast) < encodePointsKey(slow)).toBe(true);
  });

  it('breaks remaining ties by createdAt then id', () => {
    const earlier = score({
      id: 'a',
      points: 2_000,
      elapsedMs: 1_000,
      createdAt: '2026-09-24T12:00:00.000Z',
    });
    const later = score({
      id: 'b',
      points: 2_000,
      elapsedMs: 1_000,
      createdAt: '2026-09-24T12:00:01.000Z',
    });

    expect(encodePointsKey(earlier) < encodePointsKey(later)).toBe(true);
  });
});

describe('encodeTimeKey', () => {
  it('orders lower elapsedMs before higher elapsedMs', () => {
    const fast = score({ id: 'a', elapsedMs: 1_000 });
    const slow = score({ id: 'b', elapsedMs: 2_000 });

    expect(encodeTimeKey(fast) < encodeTimeKey(slow)).toBe(true);
  });

  it('breaks ties by createdAt then id', () => {
    const earlier = score({ id: 'a', createdAt: '2026-09-24T12:00:00.000Z' });
    const later = score({ id: 'b', createdAt: '2026-09-24T12:00:01.000Z' });

    expect(encodeTimeKey(earlier) < encodeTimeKey(later)).toBe(true);
  });
});

describe('encodePlayerKey', () => {
  it('orders normalized names ascending', () => {
    const ana = score({ id: 'a', playerName: 'Ana' });
    const zoe = score({ id: 'b', playerName: 'Zoe' });

    expect(encodePlayerKey(ana) < encodePlayerKey(zoe)).toBe(true);
  });

  it('breaks case-insensitive ties by original name code unit', () => {
    const uppercase = score({ id: 'a', playerName: 'Ana' });
    const lowercase = score({ id: 'b', playerName: 'ana' });

    expect(encodePlayerKey(uppercase) < encodePlayerKey(lowercase)).toBe(true);
  });

  it('breaks remaining ties by createdAt then id', () => {
    const earlier = score({
      id: 'a',
      playerName: 'Ana',
      createdAt: '2026-09-24T12:00:00.000Z',
    });
    const later = score({
      id: 'b',
      playerName: 'Ana',
      createdAt: '2026-09-24T12:00:01.000Z',
    });

    expect(encodePlayerKey(earlier) < encodePlayerKey(later)).toBe(true);
  });
});

describe('scanIndexForward', () => {
  it('returns true when order matches the natural direction', () => {
    expect(scanIndexForward('points', 'desc')).toBe(true);
    expect(scanIndexForward('elapsedMs', 'asc')).toBe(true);
    expect(scanIndexForward('playerName', 'asc')).toBe(true);
  });

  it('returns false for the mirror direction', () => {
    expect(scanIndexForward('points', 'asc')).toBe(false);
    expect(scanIndexForward('elapsedMs', 'desc')).toBe(false);
    expect(scanIndexForward('playerName', 'desc')).toBe(false);
  });
});

describe('NATURAL_SORT_DIRECTION', () => {
  it('matches the contract table', () => {
    expect(NATURAL_SORT_DIRECTION).toEqual({
      points: 'desc',
      elapsedMs: 'asc',
      playerName: 'asc',
    });
  });
});

describe('scopeFor', () => {
  it('returns "all" for an unfiltered query', () => {
    expect(scopeFor(null)).toBe('all');
  });

  it('returns a board-prefixed scope for a filtered query', () => {
    expect(scopeFor(5)).toBe('board#5');
  });
});

describe('buildScoreItem', () => {
  it('includes the score attributes and both scope attributes', () => {
    const item = buildScoreItem(
      score({ id: '00000000-0000-0000-0000-000000000001', playerName: 'Ana' }),
    );

    expect(item.id).toBe('00000000-0000-0000-0000-000000000001');
    expect(item.allScope).toBe('all');
    expect(item.boardScope).toBe('board#5');
    expect(item.scopeKey).toBeUndefined();
    expect(item.playerName).toBe('Ana');
    expect(item.playerNameLower).toBe('ana');
    expect(item.boardSize).toBe(5);
    expect(item.moves).toBe(7);
    expect(item.elapsedMs).toBe(1_000);
    expect(item.points).toBe(2_000);
    expect(item.createdAt).toBe('2026-09-24T12:00:00.000Z');
    expect(typeof item.pointsKey).toBe('string');
    expect(typeof item.timeKey).toBe('string');
    expect(typeof item.playerKey).toBe('string');
  });
});
