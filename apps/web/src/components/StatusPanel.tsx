import type { DifficultyId } from '../game/difficulty';
import { DIFFICULTIES, isDifficultyId } from '../game/difficulty';

type StatusPanelProps = {
  readonly moves: number;
  readonly elapsedMs: number;
  readonly isSolved: boolean;
  readonly currentDifficultyId: DifficultyId;
  readonly onDifficultyChange: (id: DifficultyId) => void;
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
  currentDifficultyId,
  onDifficultyChange,
  onNewGame,
}: StatusPanelProps) {
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
          <p className="status__placeholder">Score submission will be added here.</p>
        </div>
      )}
    </section>
  );
}
