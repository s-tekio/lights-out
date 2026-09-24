import { describe, expect, it } from 'vitest';
import { parseScoreQuery, parseScoreSubmission } from './validation.js';

describe('parseScoreSubmission', () => {
  it('accepts a valid submission', () => {
    const result = parseScoreSubmission({
      playerName: 'Tekio',
      boardSize: 5,
      moves: 7,
      elapsedMs: 42_310,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toEqual({
      playerName: 'Tekio',
      boardSize: 5,
      moves: 7,
      elapsedMs: 42_310,
    });
  });

  it('trims the player name', () => {
    const result = parseScoreSubmission({
      playerName: '  Tekio  ',
      boardSize: 5,
      moves: 7,
      elapsedMs: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.playerName).toBe('Tekio');
  });

  it('rejects a missing playerName', () => {
    const result = parseScoreSubmission({
      boardSize: 5,
      moves: 7,
      elapsedMs: 0,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({ field: 'playerName', message: 'is required' });
  });

  it('rejects a non-string playerName', () => {
    const result = parseScoreSubmission({
      playerName: 123,
      boardSize: 5,
      moves: 7,
      elapsedMs: 0,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({ field: 'playerName', message: 'must be a string' });
  });

  it('rejects an empty playerName after trimming', () => {
    const result = parseScoreSubmission({
      playerName: '   ',
      boardSize: 5,
      moves: 7,
      elapsedMs: 0,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({ field: 'playerName', message: 'cannot be empty' });
  });

  it('accepts a one-character name', () => {
    const result = parseScoreSubmission({
      playerName: 'A',
      boardSize: 5,
      moves: 7,
      elapsedMs: 0,
    });
    expect(result.ok).toBe(true);
  });

  it('accepts a 24-character name', () => {
    const result = parseScoreSubmission({
      playerName: 'A'.repeat(24),
      boardSize: 5,
      moves: 7,
      elapsedMs: 0,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a 25-character name', () => {
    const result = parseScoreSubmission({
      playerName: 'A'.repeat(25),
      boardSize: 5,
      moves: 7,
      elapsedMs: 0,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      field: 'playerName',
      message: 'must be at most 24 characters',
    });
  });

  it('rejects a name with disallowed characters', () => {
    const result = parseScoreSubmission({
      playerName: '<script>',
      boardSize: 5,
      moves: 7,
      elapsedMs: 0,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      field: 'playerName',
      message: 'can only contain letters, digits, spaces, _, -, and .',
    });
  });

  it('rejects a missing boardSize', () => {
    const result = parseScoreSubmission({
      playerName: 'Tekio',
      moves: 7,
      elapsedMs: 0,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      field: 'boardSize',
      message: 'is required',
    });
  });

  it('rejects boardSize 2', () => {
    const result = parseScoreSubmission({
      playerName: 'Tekio',
      boardSize: 2,
      moves: 7,
      elapsedMs: 0,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      field: 'boardSize',
      message: 'must be an integer between 3 and 7',
    });
  });

  it('accepts boardSize 3', () => {
    const result = parseScoreSubmission({
      playerName: 'Tekio',
      boardSize: 3,
      moves: 7,
      elapsedMs: 0,
    });
    expect(result.ok).toBe(true);
  });

  it('accepts boardSize 7', () => {
    const result = parseScoreSubmission({
      playerName: 'Tekio',
      boardSize: 7,
      moves: 7,
      elapsedMs: 0,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects boardSize 8', () => {
    const result = parseScoreSubmission({
      playerName: 'Tekio',
      boardSize: 8,
      moves: 7,
      elapsedMs: 0,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      field: 'boardSize',
      message: 'must be an integer between 3 and 7',
    });
  });

  it('rejects a non-integer boardSize', () => {
    const result = parseScoreSubmission({
      playerName: 'Tekio',
      boardSize: 5.5,
      moves: 7,
      elapsedMs: 0,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      field: 'boardSize',
      message: 'must be an integer between 3 and 7',
    });
  });

  it('rejects a negative moves value', () => {
    const result = parseScoreSubmission({
      playerName: 'Tekio',
      boardSize: 5,
      moves: -1,
      elapsedMs: 0,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      field: 'moves',
      message: 'must be an integer between 0 and 1000',
    });
  });

  it('rejects a non-integer moves value', () => {
    const result = parseScoreSubmission({
      playerName: 'Tekio',
      boardSize: 5,
      moves: 7.5,
      elapsedMs: 0,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      field: 'moves',
      message: 'must be an integer between 0 and 1000',
    });
  });

  it('accepts moves at the upper bound', () => {
    const result = parseScoreSubmission({
      playerName: 'Tekio',
      boardSize: 5,
      moves: 1_000,
      elapsedMs: 0,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects moves above the upper bound', () => {
    const result = parseScoreSubmission({
      playerName: 'Tekio',
      boardSize: 5,
      moves: 1_001,
      elapsedMs: 0,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      field: 'moves',
      message: 'must be an integer between 0 and 1000',
    });
  });

  it('rejects a negative elapsedMs', () => {
    const result = parseScoreSubmission({
      playerName: 'Tekio',
      boardSize: 5,
      moves: 7,
      elapsedMs: -1,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      field: 'elapsedMs',
      message: 'must be an integer between 0 and 86400000',
    });
  });

  it('accepts elapsedMs at the upper bound', () => {
    const result = parseScoreSubmission({
      playerName: 'Tekio',
      boardSize: 5,
      moves: 7,
      elapsedMs: 86_400_000,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects elapsedMs above the upper bound', () => {
    const result = parseScoreSubmission({
      playerName: 'Tekio',
      boardSize: 5,
      moves: 7,
      elapsedMs: 86_400_001,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      field: 'elapsedMs',
      message: 'must be an integer between 0 and 86400000',
    });
  });

  it('rejects null body', () => {
    const result = parseScoreSubmission(null);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({ field: 'body', message: 'must be a JSON object' });
  });

  it('rejects undefined body', () => {
    const result = parseScoreSubmission(undefined);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({ field: 'body', message: 'must be a JSON object' });
  });

  it('rejects array body', () => {
    const result = parseScoreSubmission([]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({ field: 'body', message: 'must be a JSON object' });
  });

  it('reports multiple field errors at once', () => {
    const result = parseScoreSubmission({
      playerName: '',
      boardSize: 10,
      moves: -5,
      elapsedMs: -1,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('parseScoreQuery', () => {
  it('uses defaults when no query is provided', () => {
    const result = parseScoreQuery({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ limit: 10, boardSize: null });
  });

  it('parses limit from a string', () => {
    const result = parseScoreQuery({ limit: '5' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.limit).toBe(5);
  });

  it('rejects limit below 1', () => {
    const result = parseScoreQuery({ limit: '0' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      field: 'limit',
      message: 'must be an integer between 1 and 100',
    });
  });

  it('rejects limit above 100', () => {
    const result = parseScoreQuery({ limit: '101' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      field: 'limit',
      message: 'must be an integer between 1 and 100',
    });
  });

  it('parses boardSize from a string', () => {
    const result = parseScoreQuery({ boardSize: '5' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.boardSize).toBe(5);
  });

  it('rejects boardSize 2', () => {
    const result = parseScoreQuery({ boardSize: '2' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      field: 'boardSize',
      message: 'must be an integer between 3 and 7',
    });
  });

  it('rejects boardSize 8', () => {
    const result = parseScoreQuery({ boardSize: '8' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      field: 'boardSize',
      message: 'must be an integer between 3 and 7',
    });
  });

  it('ignores unknown query values', () => {
    const result = parseScoreQuery({ foo: 'bar', limit: '10' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ limit: 10, boardSize: null });
  });
});
