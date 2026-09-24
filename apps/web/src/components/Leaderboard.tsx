import { useCallback, useEffect, useState } from 'react';
import {
  fetchLeaderboard,
  getScoresErrorMessage,
  type Score,
  type SortColumn,
  type SortOrder,
} from '../api/scores';
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

const SORT_DEFAULTS: Record<SortColumn, SortOrder> = {
  points: 'desc',
  elapsedMs: 'asc',
  playerName: 'asc',
};

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

type SortState = {
  readonly sort: SortColumn;
  readonly order: SortOrder;
};

function nextSortState(current: SortState, column: SortColumn): SortState {
  if (current.sort === column) {
    return { sort: column, order: current.order === 'asc' ? 'desc' : 'asc' };
  }

  return { sort: column, order: SORT_DEFAULTS[column] };
}

function ariaSortValue(order: SortOrder): 'ascending' | 'descending' {
  return order === 'asc' ? 'ascending' : 'descending';
}

export function Leaderboard({ refreshKey = 0 }: LeaderboardProps) {
  const [state, setState] = useState<LeaderboardState>({ kind: 'loading' });
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyId | null>(null);
  const [sortState, setSortState] = useState<SortState>({
    sort: 'points',
    order: SORT_DEFAULTS.points,
  });

  const boardSizeFilter = resolveBoardSizeFilter(difficultyFilter);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });

    try {
      const response = await fetchLeaderboard({
        limit: DEFAULT_LIMIT,
        boardSize: boardSizeFilter,
        sort: sortState.sort,
        order: sortState.order,
      });

      if (response.items.length === 0) {
        setState({ kind: 'empty' });
      } else {
        setState({ kind: 'ready', items: response.items });
      }
    } catch (error) {
      setState({ kind: 'error', message: getScoresErrorMessage(error) });
    }
  }, [boardSizeFilter, sortState]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const handleFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setDifficultyFilter(isDifficultyId(value) ? value : null);
  };

  const handleSort = (column: SortColumn) => {
    setSortState((current) => nextSortState(current, column));
  };

  const sortableHeader = (column: SortColumn, label: string) => {
    const isActive = sortState.sort === column;
    const order = sortState.order;
    const accessibleLabel = isActive
      ? `${label}, sorted ${order === 'asc' ? 'ascending' : 'descending'}`
      : `${label}, sortable`;

    return (
      <th
        scope="col"
        aria-sort={isActive ? ariaSortValue(order) : 'none'}
        className={isActive ? 'leaderboard__th--sorted' : undefined}
      >
        <button
          type="button"
          className="leaderboard__sort"
          aria-label={accessibleLabel}
          onClick={() => {
            handleSort(column);
          }}
        >
          {/* The arrow shapes carry the state without relying on colour, and the
              neutral icon marks a column as sortable before it is activated.
              aria-hidden because aria-sort and the button label already say it. */}
          <span className="leaderboard__sort-icon" aria-hidden="true">
            {isActive ? (order === 'asc' ? '▲' : '▼') : '↕'}
          </span>
          {label}
        </button>
      </th>
    );
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
              {sortableHeader('playerName', 'Player')}
              <th scope="col">Level</th>
              <th scope="col">Moves</th>
              {sortableHeader('elapsedMs', 'Time')}
              {sortableHeader('points', 'Points')}
            </tr>
          </thead>
          <tbody>
            {state.items.map((score) => (
              <tr key={score.id}>
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
