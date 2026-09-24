import { useCallback, useEffect, useState } from 'react';
import { fetchLeaderboard, getScoresErrorMessage, type Score } from '../api/scores';
import {
  DIFFICULTIES,
  formatBoardSizeLabel,
  formatDifficultyLabel,
  isDifficultyId,
  type DifficultyId,
} from '../game/difficulty';

type LeaderboardProps = {
  readonly refreshKey?: number;
};

type LeaderboardState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'empty' }
  | { readonly kind: 'ready'; readonly items: readonly Score[] };

const DEFAULT_LIMIT = 10;

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function resolveBoardSizeFilter(difficultyId: DifficultyId | null): number | null {
  if (difficultyId === null) {
    return null;
  }

  const difficulty = DIFFICULTIES.find((candidate) => candidate.id === difficultyId);

  return difficulty?.boardSize ?? null;
}

export function Leaderboard({ refreshKey = 0 }: LeaderboardProps) {
  const [state, setState] = useState<LeaderboardState>({ kind: 'loading' });
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyId | null>(null);

  const boardSizeFilter = resolveBoardSizeFilter(difficultyFilter);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });

    try {
      const response = await fetchLeaderboard({
        limit: DEFAULT_LIMIT,
        boardSize: boardSizeFilter,
      });

      if (response.items.length === 0) {
        setState({ kind: 'empty' });
      } else {
        setState({ kind: 'ready', items: response.items });
      }
    } catch (error) {
      setState({ kind: 'error', message: getScoresErrorMessage(error) });
    }
  }, [boardSizeFilter]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const handleFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setDifficultyFilter(isDifficultyId(value) ? value : null);
  };

  return (
    <section className="leaderboard" aria-label="Leaderboard">
      <div className="leaderboard__header">
        <h2>Leaderboard</h2>
        <div className="leaderboard__controls">
          <label htmlFor="leaderboard-difficulty">Level</label>
          <select
            id="leaderboard-difficulty"
            value={difficultyFilter ?? ''}
            onChange={handleFilterChange}
          >
            <option value="">All levels</option>
            {DIFFICULTIES.map((difficulty) => (
              <option key={difficulty.id} value={difficulty.id}>
                {formatDifficultyLabel(difficulty)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              void load();
            }}
            disabled={state.kind === 'loading'}
          >
            Refresh
          </button>
        </div>
      </div>

      {state.kind === 'loading' && (
        <p className="leaderboard__loading" aria-live="polite">
          Loading leaderboard...
        </p>
      )}

      {state.kind === 'error' && (
        <p className="leaderboard__error" role="alert">
          {state.message}
        </p>
      )}

      {state.kind === 'empty' && <p className="leaderboard__empty">No scores yet.</p>}

      {state.kind === 'ready' && (
        <table className="leaderboard__table">
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Player</th>
              <th scope="col">Level</th>
              <th scope="col">Moves</th>
              <th scope="col">Time</th>
              <th scope="col">Points</th>
            </tr>
          </thead>
          <tbody>
            {state.items.map((score, index) => (
              <tr key={score.id}>
                <td>{index + 1}</td>
                <td>{score.playerName}</td>
                <td>{formatBoardSizeLabel(score.boardSize)}</td>
                <td>{score.moves}</td>
                <td>{formatElapsed(score.elapsedMs)}</td>
                <td>{score.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
