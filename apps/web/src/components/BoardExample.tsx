import type { HelpExample } from '../game/helpExamples';
import { BoardDiagram } from './BoardDiagram';

type BoardExampleProps = {
  readonly example: HelpExample;
};

export function BoardExample({ example }: BoardExampleProps) {
  const firstPress = example.presses[0];

  return (
    <figure className="board-example">
      <figcaption className="board-example__caption">{example.caption}</figcaption>
      <div className="board-example__pair">
        <BoardDiagram
          size={example.size}
          board={example.before}
          pressedIndex={firstPress}
          caption="Before"
        />
        <BoardDiagram size={example.size} board={example.after} caption="After" />
      </div>
    </figure>
  );
}
