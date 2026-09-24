import type { Board as GameBoard } from '../game/board';

type BoardProps = {
  readonly size: number;
  readonly board: GameBoard;
  readonly disabled: boolean;
  readonly onPress: (index: number) => void;
};

export function Board({ size, board, disabled, onPress }: BoardProps) {
  return (
    <div
      className="board"
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
      role="group"
      aria-label="Lights Out board"
    >
      {board.map((lit, index) => {
        const row = Math.floor(index / size) + 1;
        const col = (index % size) + 1;

        return (
          <button
            key={index}
            type="button"
            className={`cell ${lit ? 'cell--lit' : 'cell--unlit'}`}
            aria-label={`Row ${row}, Column ${col}`}
            aria-pressed={lit}
            disabled={disabled}
            onClick={() => onPress(index)}
          >
            <span aria-hidden="true">{lit ? '●' : '○'}</span>
          </button>
        );
      })}
    </div>
  );
}
