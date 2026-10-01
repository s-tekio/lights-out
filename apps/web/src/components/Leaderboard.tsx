import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchLeaderboard,
  getScoresErrorMessage,
  purgeScores,
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
import { PurgeDialog } from './PurgeDialog';

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
  const [isPurgeOpen, setIsPurgeOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const purgeTriggerRef = useRef<HTMLButtonElement>(null);

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
    setSuccessMessage(null);
  };

  const handleSort = (column: SortColumn) => {
    setSortState((current) => nextSortState(current, column));
    setSuccessMessage(null);
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
          {/* The title attribute gives mouse users a tooltip, but it does not
              produce a tooltip on touch devices. The icon shapes therefore need
              to be the conventional refresh and trash-can symbols. */}
          <button
            type="button"
            className="leaderboard__icon-button"
            aria-label="Refresh"
            title="Refresh"
            onClick={() => {
              setSuccessMessage(null);
              void load();
            }}
            disabled={state.kind === 'loading'}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-2.8-6.5" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>
          <button
            ref={purgeTriggerRef}
            type="button"
            className="leaderboard__icon-button leaderboard__clear"
            aria-label="Clear leaderboard"
            title="Clear leaderboard"
            aria-haspopup="dialog"
            aria-expanded={isPurgeOpen}
            aria-controls={isPurgeOpen ? 'purge-dialog' : undefined}
            onClick={() => setIsPurgeOpen(true)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          </button>
        </div>
      </div>

      {successMessage && (
        <p className="leaderboard__success" aria-live="polite">
          {successMessage}
        </p>
      )}

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

      <PurgeDialog
        isOpen={isPurgeOpen}
        onClose={() => setIsPurgeOpen(false)}
        triggerRef={purgeTriggerRef}
        onPurge={() => purgeScores('DELETE')}
        onSuccess={(result) => {
          setSuccessMessage(
            `Cleared ${result.deleted} score${result.deleted === 1 ? '' : 's'} from the leaderboard.`,
          );
          void load();
        }}
      />

      {state.kind === 'ready' && (
        <div className="leaderboard__scroll">
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
                  <td className="leaderboard__cell--numeric">{score.moves}</td>
                  <td className="leaderboard__cell--numeric">{formatElapsed(score.elapsedMs)}</td>
                  <td className="leaderboard__cell--numeric">{score.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
