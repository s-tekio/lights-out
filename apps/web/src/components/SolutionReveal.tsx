import { useId } from 'react';
import type { OptimalSolution } from '../game/optimal';

type SolutionRevealProps = {
  readonly moves: number;
  readonly boardSize: number;
  readonly solution: OptimalSolution;
  readonly showSolution: boolean;
  readonly onToggleSolution: () => void;
};

function formatCoordinate(index: number, size: number): string {
  const row = Math.floor(index / size) + 1;
  const col = (index % size) + 1;

  return `Row ${row}, Column ${col}`;
}

export function SolutionReveal({
  moves,
  boardSize,
  solution,
  showSolution,
  onToggleSolution,
}: SolutionRevealProps) {
  // useId rather than a literal: a hardcoded id collides if the component is
  // ever rendered twice, and a duplicate id silently breaks aria-controls.
  const listId = useId();

  return (
    <div className="solution-reveal">
      <p className="solution-reveal__summary">
        Optimal: {solution.presses} presses (your moves: {moves})
      </p>

      <button
        type="button"
        className="solution-reveal__toggle"
        aria-expanded={showSolution}
        aria-controls={listId}
        onClick={onToggleSolution}
      >
        {showSolution ? 'Hide optimal sequence' : 'Show optimal sequence'}
      </button>

      {showSolution && (
        <ol id={listId} className="solution-reveal__list">
          {solution.cells.map((index) => (
            <li key={index}>{formatCoordinate(index, boardSize)}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
