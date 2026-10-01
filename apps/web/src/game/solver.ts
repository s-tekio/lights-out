import type { Board } from './board';

/**
 * Keep validation consistent with `board.ts`.
 */
function assertValidMaxPresses(maxPresses: number): void {
  if (!Number.isInteger(maxPresses) || maxPresses < 0) {
    throw new Error(`maxPresses must be a non-negative integer, got ${maxPresses}`);
  }
}

/**
 * Pre-compute the cells toggled by each press. Avoids scanning the whole board
 * on every recursive step.
 */
function buildToggleIndices(size: number): readonly (readonly number[])[] {
  const cellCount = size * size;
  const toggleIndices: number[][] = [];

  for (let index = 0; index < cellCount; index += 1) {
    const row = Math.floor(index / size);
    const col = index % size;
    const affected: number[] = [];

    for (let otherIndex = 0; otherIndex < cellCount; otherIndex += 1) {
      const otherRow = Math.floor(otherIndex / size);
      const otherCol = otherIndex % size;
      const isPressedCell = otherIndex === index;
      const isOrthogonalNeighbour = Math.abs(otherRow - row) + Math.abs(otherCol - col) === 1;

      if (isPressedCell || isOrthogonalNeighbour) {
        affected.push(otherIndex);
      }
    }

    toggleIndices.push(affected);
  }

  return toggleIndices;
}

/**
 * Toggle a press in-place on a mutable working board and return the change in
 * lit cells.
 *
 * Presses are self-inverse, so the same helper applies on the way down and
 * undoes on the way up.
 */
function pressInPlace(board: boolean[], affected: readonly number[]): number {
  let delta = 0;

  for (const index of affected) {
    const wasLit = board[index];
    board[index] = !wasLit;
    delta += wasLit ? -1 : 1;
  }

  return delta;
}

/**
 * Depth-first search over combinations of distinct cells.
 *
 * Cells are pressed in strictly increasing index order, so each combination is
 * visited exactly once. Presses commute and are self-inverse, so order does not
 * matter and permutations are not enumerated.
 *
 * A running count of lit cells replaces scanning the whole board: solved when
 * the count is zero, so the per-node check is O(1).
 *
 * JavaScript bitwise operators truncate to 32 bits, folding bits back onto
 * lower positions on boards larger than 32 cells. That makes a mask-XOR solver
 * report false positives on 7x7 (49 cells) and larger; this implementation
 * avoids bitwise board state entirely.
 */
function search(
  board: boolean[],
  toggleIndices: readonly (readonly number[])[],
  startIndex: number,
  depth: number,
  maxPresses: number,
  litCount: number,
): boolean {
  if (litCount === 0) {
    return true;
  }

  if (depth === maxPresses) {
    return false;
  }

  for (let index = startIndex; index < board.length; index += 1) {
    const affected = toggleIndices[index];

    if (affected === undefined) {
      continue;
    }

    const delta = pressInPlace(board, affected);

    if (search(board, toggleIndices, index + 1, depth + 1, maxPresses, litCount + delta)) {
      return true;
    }

    pressInPlace(board, affected);
  }

  return false;
}

/**
 * Return whether `board` is already solved or can be solved with at most
 * `maxPresses` distinct presses.
 *
 * The search explores combinations in increasing size order. Because presses
 * commute and are self-inverse, the first solved board found uses the smallest
 * possible number of presses.
 *
 * A mutable working array replaces the public `toggleAt` helper: the search
 * creates one board state per node, and mutating in-place removes the per-node
 * allocation. The original input is never mutated.
 *
 * Cost: at most sum(C(n, k)) nodes for k from 0 to `maxPresses`. Each node
 * toggles at most five cells and checks an O(1) lit-cell count. At
 * `maxPresses = 2` this is 326 nodes for 5x5, 1 226 for 7x7, 3 322 for 9x9.
 * The project keeps `minPresses` at 3, so generation only needs
 * `isSolvableWithin(board, 2)`.
 */
export function isSolvableWithin(board: Board, maxPresses: number): boolean {
  assertValidMaxPresses(maxPresses);

  const size = Math.sqrt(board.length);

  if (!Number.isInteger(size)) {
    throw new Error('Board length is not a perfect square');
  }

  if (maxPresses === 0) {
    return board.every((lit) => !lit);
  }

  const working = board.slice();
  const litCount = working.filter(Boolean).length;
  const toggleIndices = buildToggleIndices(size);

  return search(working, toggleIndices, 0, 0, maxPresses, litCount);
}
