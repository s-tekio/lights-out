import type { Board } from './board';

/**
 * Validate `maxPresses` the same way `board.ts` validates its numeric inputs.
 */
function assertValidMaxPresses(maxPresses: number): void {
  if (!Number.isInteger(maxPresses) || maxPresses < 0) {
    throw new Error(`maxPresses must be a non-negative integer, got ${maxPresses}`);
  }
}

/**
 * Pre-compute the list of cell indices toggled by each press on an `size x size`
 * board. This avoids scanning the whole board on every recursive step.
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
 * the number of lit cells.
 *
 * Applying the same press twice restores the original state, so this single
 * helper is used both to apply a press on the way down and to undo it on the
 * way up during the depth-first search.
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
 * We press cells in strictly increasing index order, so each combination is
 * visited exactly once. The board state is maintained as a mutable boolean
 * array. We toggle a press in-place on the way down and toggle it again on
 * the way up, which restores the previous state because presses are
 * involutions.
 *
 * Instead of scanning the whole board to check whether it is solved, we keep
 * a running count of lit cells. A board is solved exactly when the count is
 * zero, which makes the per-node check O(1) instead of O(n).
 *
 * JavaScript bitwise operators on numbers truncate to 32 bits, so a bitmask
 * representation folds bits 32..n back onto bits 0..(n-32) on boards larger
 * than 32 cells. That fold is a linear map, which makes a mask-XOR solver
 * report false positives on 7x7 (49 cells) and larger. This implementation
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
 * The search explores combinations of distinct cells in increasing size order:
 * size 0, then all size-1 subsets, then all size-2 subsets, and so on. Because
 * presses commute and are self-inverse, order does not matter; we never
 * enumerate permutations. The first solved board found is therefore a solution
 * with the smallest possible number of presses.
 *
 * We use a mutable working array instead of the public `toggleAt` helper
 * because the search creates and discards one board state per node. Mutating
 * in-place removes the per-node array allocation and makes the DFS cheap even
 * on 9x9 boards. The original input is never mutated.
 *
 * Cost: the search visits at most sum(C(n, k)) nodes for k from 0 to
 * `maxPresses`, where n is the number of cells. Each node performs an
 * in-place toggle over at most five cells and an O(1) lit-cell count check.
 * At `maxPresses = 2` this is:
 * - 5x5: n=25, 1 + 25 + C(25,2) = 326
 * - 7x7: n=49, 1 + 49 + C(49,2) = 1226
 * - 9x9: n=81, 1 + 81 + C(81,2) = 3322
 * A `maxPresses` of 4 or more on 9x9 (about 88 000 nodes) is where this
 * approach stops being cheap. The project deliberately keeps `minPresses` at 3,
 * so generation only needs `isSolvableWithin(board, 2)`.
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
