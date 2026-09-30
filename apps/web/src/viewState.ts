import type { DifficultyId } from './game/difficulty';

export type View =
  | { readonly kind: 'title' }
  | { readonly kind: 'difficulty' }
  | { readonly kind: 'game'; readonly difficultyId: DifficultyId }
  | { readonly kind: 'leaderboard' }
  | { readonly kind: 'settings' };

export type ViewAction =
  | { readonly type: 'goToDifficulty' }
  | { readonly type: 'startGame'; readonly difficultyId: DifficultyId }
  | { readonly type: 'goToLeaderboard' }
  | { readonly type: 'goToSettings' }
  | { readonly type: 'goToTitle' };

export function viewReducer(state: View, action: ViewAction): View {
  switch (action.type) {
    case 'goToDifficulty':
      return { kind: 'difficulty' };
    case 'startGame':
      return { kind: 'game', difficultyId: action.difficultyId };
    case 'goToLeaderboard':
      return { kind: 'leaderboard' };
    case 'goToSettings':
      return { kind: 'settings' };
    case 'goToTitle':
      return { kind: 'title' };
    default:
      return state;
  }
}
