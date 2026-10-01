import { createBoard, isSolved, toggleAt, type Board } from './board';
import { isSolvableWithin } from './solver';

export type HelpExample = {
  readonly id: string;
  readonly caption: string;
  readonly size: number;
  readonly before: Board;
  readonly presses: readonly number[];
  readonly after: Board;
};

function applyPresses(board: Board, presses: readonly number[]): Board {
  return presses.reduce((current, index) => toggleAt(current, index), board);
}

function buildExample(options: {
  readonly id: string;
  readonly caption: string;
  readonly size: number;
  readonly presses: readonly number[];
}): HelpExample {
  const { id, caption, size, presses } = options;
  const solved = createBoard(size);
  const before = applyPresses(solved, presses);
  const after = applyPresses(before, presses);

  return { id, caption, size, before, presses, after };
}

export const CENTRE_EXAMPLE = buildExample({
  id: 'centre',
  caption: 'Pressing the centre flips the cross of five cells and leaves the four corners alone.',
  size: 3,
  presses: [4],
});

export const CORNER_EXAMPLE = buildExample({
  id: 'corner',
  caption: 'Pressing a corner flips only three cells, because a corner has just two neighbours.',
  size: 3,
  presses: [0],
});

export const TWO_PRESS_SOLVE_EXAMPLE = buildExample({
  id: 'two-press-solve',
  caption: 'This board solves in two presses: first the centre, then the top-left corner.',
  size: 3,
  presses: [4, 0],
});

export const HELP_EXAMPLES: readonly HelpExample[] = [
  CENTRE_EXAMPLE,
  CORNER_EXAMPLE,
  TWO_PRESS_SOLVE_EXAMPLE,
];

export function isExampleConsistent(example: HelpExample): boolean {
  const expected = applyPresses(example.before, example.presses);

  return (
    expected.length === example.after.length &&
    expected.every((lit, index) => lit === example.after[index])
  );
}

export function isSolvableInExactly(example: HelpExample, pressCount: number): boolean {
  const solvedByClaimedPresses = isSolved(
    applyPresses(example.before, example.presses.slice(0, pressCount)),
  );
  const notSolvableInFewer = !isSolvableWithin(example.before, pressCount - 1);

  return solvedByClaimedPresses && notSolvableInFewer;
}
