import { useEffect, useState } from 'react';
import { getScoresErrorMessage, submitScore, validatePlayerName } from '../api/scores';
import type { DifficultyId } from '../game/difficulty';
import { DIFFICULTIES, isDifficultyId } from '../game/difficulty';
import type { OptimalSolution } from '../game/optimal';
import { SolutionReveal } from './SolutionReveal';

type StatusPanelProps = {
  readonly moves: number;
  readonly elapsedMs: number;
  readonly isSolved: boolean;
  readonly currentDifficultyId: DifficultyId;
  readonly boardSize: number;
  readonly optimalSolution?: OptimalSolution | null;
  readonly showSolution?: boolean;
  readonly onToggleSolution?: () => void;
  readonly onDifficultyChange: (id: DifficultyId) => void;
  readonly onNewGame: () => void;
  readonly onScoreSubmitted?: () => void;
};

const STORAGE_KEY = 'lights-out:playerName';

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function readStoredPlayerName(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    // Storage may be disabled; the game continues without persistence.
    return '';
  }
}

function writeStoredPlayerName(name: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // Storage may be disabled; the game continues without persistence.
  }
}

export function StatusPanel({
  moves,
  elapsedMs,
  isSolved,
  currentDifficultyId,
  boardSize,
  optimalSolution = null,
  showSolution = false,
  onToggleSolution,
  onDifficultyChange,
  onNewGame,
  onScoreSubmitted,
}: StatusPanelProps) {
  const [playerName, setPlayerName] = useState(readStoredPlayerName);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isSolved) {
      setRank(null);
      setSubmitError(null);
      setValidationError(null);
    }
  }, [isSolved]);

  const handleSubmit = async () => {
    if (submitting) {
      return;
    }

    const trimmed = playerName.trim();
    const validation = validatePlayerName(trimmed);

    if (validation !== null) {
      setValidationError(validation);
      setSubmitError(null);
      return;
    }

    setSubmitting(true);
    setValidationError(null);
    setSubmitError(null);

    try {
      const response = await submitScore({
        playerName: trimmed,
        boardSize,
        moves,
        elapsedMs,
      });

      setRank(response.rank);
      writeStoredPlayerName(trimmed);
      onScoreSubmitted?.();
    } catch (error) {
      setSubmitError(getScoresErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="status" aria-label="Game status">
      <div className="status__row">
        <p className="status__metric">Moves: {moves}</p>
        <p className="status__metric">Time: {formatElapsed(elapsedMs)}</p>
      </div>

      <div className="status__row">
        <label htmlFor="difficulty">Difficulty</label>
        <select
          id="difficulty"
          value={currentDifficultyId}
          onChange={(event) => {
            const value = event.target.value;
            if (isDifficultyId(value)) {
              onDifficultyChange(value);
            }
          }}
        >
          {DIFFICULTIES.map((difficulty) => (
            <option key={difficulty.id} value={difficulty.id}>
              {difficulty.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={onNewGame}>
          New game
        </button>
      </div>

      {isSolved && (
        <div className="status__result">
          <p>
            Solved in {moves} moves and {formatElapsed(elapsedMs)}.
          </p>

          {optimalSolution !== null && onToggleSolution !== undefined && (
            <SolutionReveal
              moves={moves}
              boardSize={boardSize}
              solution={optimalSolution}
              showSolution={showSolution}
              onToggleSolution={onToggleSolution}
            />
          )}

          {rank !== null ? (
            <p className="status__rank">Your rank: {rank}</p>
          ) : (
            <form
              className="status__form"
              aria-label="Score submission"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmit();
              }}
            >
              <label htmlFor="player-name">Player name</label>
              <input
                id="player-name"
                type="text"
                value={playerName}
                onChange={(event) => {
                  setPlayerName(event.target.value);
                  setValidationError(null);
                }}
                disabled={submitting}
                aria-invalid={validationError !== null}
                aria-describedby={validationError !== null ? 'player-name-error' : undefined}
              />
              {validationError !== null && (
                <p id="player-name-error" className="status__error" role="alert">
                  {validationError}
                </p>
              )}
              <button type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit score'}
              </button>
              {submitError !== null && (
                <p className="status__error" role="alert">
                  {submitError}
                </p>
              )}
            </form>
          )}
        </div>
      )}
    </section>
  );
}
