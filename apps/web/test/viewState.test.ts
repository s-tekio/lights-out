import { describe, expect, it } from 'vitest';
import { type View, type ViewAction, viewReducer } from '../src/viewState';

describe('viewReducer', () => {
  it('starts from the title view', () => {
    const initial: View = { kind: 'title' };

    expect(initial.kind).toBe('title');
  });

  it('moves from title to difficulty', () => {
    const state = viewReducer({ kind: 'title' }, { type: 'goToDifficulty' });

    expect(state).toEqual({ kind: 'difficulty' });
  });

  it('moves from difficulty to game with the chosen difficulty', () => {
    const state = viewReducer(
      { kind: 'difficulty' },
      {
        type: 'startGame',
        difficultyId: 'hard',
      },
    );

    expect(state).toEqual({ kind: 'game', difficultyId: 'hard' });
  });

  it('moves from title to leaderboard', () => {
    const state = viewReducer({ kind: 'title' }, { type: 'goToLeaderboard' });

    expect(state).toEqual({ kind: 'leaderboard' });
  });

  it('moves from title to settings', () => {
    const state = viewReducer({ kind: 'title' }, { type: 'goToSettings' });

    expect(state).toEqual({ kind: 'settings' });
  });

  it('returns to the title from any screen', () => {
    expect(viewReducer({ kind: 'difficulty' }, { type: 'goToTitle' })).toEqual({ kind: 'title' });
    expect(viewReducer({ kind: 'leaderboard' }, { type: 'goToTitle' })).toEqual({ kind: 'title' });
    expect(viewReducer({ kind: 'settings' }, { type: 'goToTitle' })).toEqual({ kind: 'title' });
    expect(viewReducer({ kind: 'game', difficultyId: 'easy' }, { type: 'goToTitle' })).toEqual({
      kind: 'title',
    });
  });

  it('returns the current state for an unrecognised action', () => {
    const state: View = { kind: 'title' };
    const action = { type: 'unknown' } as unknown as ViewAction;

    expect(viewReducer(state, action)).toBe(state);
  });
});
