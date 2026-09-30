import type { OptimalSolution } from '../game/optimal';
import { SolutionReveal } from './SolutionReveal';

type StatusPanelProps = {
  readonly moves: number;
  readonly elapsedMs: number;
  readonly isSolved: boolean;
  readonly boardSize: number;
  readonly optimalSolution?: OptimalSolution | null;
  readonly showSolution?: boolean;
  readonly onToggleSolution?: () => void;
  readonly onNewGame: () => void;
};

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function StatusPanel({
  moves,
  elapsedMs,
  isSolved,
  boardSize,
  optimalSolution = null,
  showSolution = false,
  onToggleSolution,
  onNewGame,
}: StatusPanelProps) {
  return (
    <section className="status" aria-label="Game status">
      <div className="status__row">
        <p className="status__metric">Moves: {moves}</p>
        <p className="status__metric">Time: {formatElapsed(elapsedMs)}</p>
        <button type="button" className="status__new-game" onClick={onNewGame}>
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
        </div>
      )}
    </section>
  );
}
