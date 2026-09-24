import { MAX_BOARD_SIZE, MIN_BOARD_SIZE } from './difficulty';

/**
 * Board representation: a flat, read-only array of booleans.
 *
 * For a board of size `n`, the cell at row `r` and column `c` is stored at
 * index `r * n + c`. `true` means lit, `false` means off.
 *
 * A flat array was chosen because it makes cloning, indexing and neighbour
 * calculations straightforward while staying immutable from the caller's
 * perspective.
 */
export type Board = ReadonlyArray<boolean>;

function assertValidSize(size: number): void {
  if (!Number.isInteger(size) || size < MIN_BOARD_SIZE || size > MAX_BOARD_SIZE) {
    throw new Error(
      `Board size must be an integer between ${MIN_BOARD_SIZE} and ${MAX_BOARD_SIZE}, got ${size}`,
    );
  }
}

function assertValidIndex(board: Board, index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= board.length) {
    throw new Error(`Index ${index} is out of bounds for board of length ${board.length}`);
  }
}

function boardSizeFromLength(length: number): number {
  const size = Math.sqrt(length);

  if (!Number.isInteger(size)) {
    throw new Error('Board length is not a perfect square');
  }

  return size;
}

export function createBoard(size: number): Board {
  assertValidSize(size);
  return Array.from<boolean>({ length: size * size }).fill(false);
}

export function toggleAt(board: Board, index: number): Board {
  assertValidIndex(board, index);

  const size = boardSizeFromLength(board.length);
  const row = Math.floor(index / size);
  const col = index % size;

  return board.map((lit, currentIndex) => {
    const currentRow = Math.floor(currentIndex / size);
    const currentCol = currentIndex % size;
    const isPressedCell = currentIndex === index;
    const isOrthogonalNeighbour = Math.abs(currentRow - row) + Math.abs(currentCol - col) === 1;

    return isPressedCell || isOrthogonalNeighbour ? !lit : lit;
  });
}

export function isSolved(board: Board): boolean {
  return board.every((lit) => !lit);
}

export function createSolvableBoard(
  size: number,
  scrambleDepth: number,
  random: () => number,
): { readonly board: Board; readonly presses: readonly number[] } {
  assertValidSize(size);

  if (!Number.isInteger(scrambleDepth) || scrambleDepth < 0) {
    throw new Error(`scrambleDepth must be a non-negative integer, got ${scrambleDepth}`);
  }

  const cellCount = size * size;
  const presses: number[] = [];
  let board = createBoard(size);

  for (let step = 0; step < scrambleDepth; step += 1) {
    const index = Math.floor(random() * cellCount);
    presses.push(index);
    board = toggleAt(board, index);
  }

  return { board, presses };
}
