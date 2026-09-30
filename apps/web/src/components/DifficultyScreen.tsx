import { DIFFICULTIES, formatDifficultyLabel } from '../game/difficulty';
import type { DifficultyId } from '../game/difficulty';

type DifficultyScreenProps = {
  readonly onSelect: (id: DifficultyId) => void;
};

export function DifficultyScreen({ onSelect }: DifficultyScreenProps) {
  return (
    <div className="difficulty-screen">
      <h2 className="screen-heading">Choose difficulty</h2>
      <nav aria-label="Difficulty" className="menu">
        {DIFFICULTIES.map((difficulty) => (
          <button
            key={difficulty.id}
            type="button"
            className="menu__entry"
            onClick={() => onSelect(difficulty.id)}
          >
            {formatDifficultyLabel(difficulty)}
          </button>
        ))}
      </nav>
    </div>
  );
}
