import type { Board } from '../game/board';

type BoardDiagramProps = {
  readonly size: number;
  readonly board: Board;
  readonly caption: string;
  readonly pressedIndex?: number;
};

export function BoardDiagram({ size, board, caption, pressedIndex }: BoardDiagramProps) {
  return (
    <figure className="board-diagram">
      <div
        className="board"
        style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
        aria-hidden="true"
      >
        {board.map((lit, index) => (
          <div
            key={index}
            className={`cell ${lit ? 'cell--lit' : 'cell--unlit'}${
              index === pressedIndex ? ' cell--pressed' : ''
            }`}
          />
        ))}
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
