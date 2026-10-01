import { MAX_BOARD_SIZE, MIN_BOARD_SIZE } from './difficulty';

/**
 * The result of finding an optimal solution for a Lights Out board.
 *
 * `presses` is the minimum number of distinct presses. `cells` is one optimal
 * press set, sorted ascending for readability only; presses commute, so order
 * has no gameplay meaning.
 */
export type OptimalSolution = {
  readonly presses: number;
  readonly cells: readonly number[];
};

function assertValidSize(size: number): void {
  if (!Number.isInteger(size) || size < MIN_BOARD_SIZE || size > MAX_BOARD_SIZE) {
    throw new Error(
      `Board size must be an integer between ${MIN_BOARD_SIZE} and ${MAX_BOARD_SIZE}, got ${size}`,
    );
  }
}

/**
 * Count the number of set bits in a non-negative `bigint` mask.
 *
 * `bigint` is needed because a 7×7 board has 49 cells, exceeding the 32-bit
 * width that JavaScript bitwise operators silently truncate. `solver.ts`
 * documents that truncation bug.
 */
function popcount(mask: bigint): number {
  let count = 0;
  let remaining = mask;

  while (remaining !== 0n) {
    count += Number(remaining & 1n);
    remaining >>= 1n;
  }

  return count;
}

/**
 * Build the toggle matrix for a board size as an array of `bigint` row masks.
 *
 * Row `j` represents pressing cell `j`; its set bits are `j` and its orthogonal
 * neighbours. The matrix is symmetric because the toggle relationship is.
 */
function buildToggleMatrix(size: number): bigint[] {
  const cellCount = size * size;
  const rows: bigint[] = [];

  for (let index = 0; index < cellCount; index += 1) {
    const row = Math.floor(index / size);
    const col = index % size;
    let mask = 0n;

    for (let otherIndex = 0; otherIndex < cellCount; otherIndex += 1) {
      const otherRow = Math.floor(otherIndex / size);
      const otherCol = otherIndex % size;
      const isPressedCell = otherIndex === index;
      const isOrthogonalNeighbour = Math.abs(otherRow - row) + Math.abs(otherCol - col) === 1;

      if (isPressedCell || isOrthogonalNeighbour) {
        mask |= 1n << BigInt(otherIndex);
      }
    }

    rows.push(mask);
  }

  return rows;
}

/**
 * Compute a basis for the nullspace of the Lights Out toggle matrix over GF(2).
 *
 * Uses Gauss-Jordan elimination: rows are reduced so each pivot column contains
 * a single 1. In reduced row echelon form, every free column yields one basis
 * vector (free variable 1, pivot variables set from the row coefficients).
 *
 * Supported sizes have kernel dimensions 0 (3×3), 2 (5×5), 0 (7×7). A 4×4 has
 * dimension 4 and a 9×9 has dimension 8; both would still be enumerable but
 * should be revisited before those sizes become playable.
 */
/**
 * Return a matrix row, throwing if it is missing.
 *
 * The matrix has exactly `size * size` rows, so access inside that range is
 * guaranteed. The check satisfies TypeScript's `noUncheckedIndexedAccess`
 * without a non-null assertion.
 */
function expectRow(rows: bigint[], index: number): bigint {
  const row = rows[index];

  if (row === undefined) {
    throw new Error(`Invariant: toggle matrix row ${index} is missing`);
  }

  return row;
}

function computeKernelBasis(size: number): readonly bigint[] {
  const cellCount = size * size;
  const rows = buildToggleMatrix(size);
  const pivotColumns: number[] = [];
  let pivotRow = 0;

  for (let col = 0; col < cellCount && pivotRow < cellCount; col += 1) {
    let foundRow = -1;

    for (let row = pivotRow; row < cellCount; row += 1) {
      if ((expectRow(rows, row) >> BigInt(col)) & 1n) {
        foundRow = row;
        break;
      }
    }

    if (foundRow === -1) {
      continue;
    }

    const pivotValue = expectRow(rows, pivotRow);
    rows[pivotRow] = expectRow(rows, foundRow);
    rows[foundRow] = pivotValue;

    pivotColumns.push(col);

    for (let row = 0; row < cellCount; row += 1) {
      if (row !== pivotRow && (expectRow(rows, row) >> BigInt(col)) & 1n) {
        rows[row] = expectRow(rows, row) ^ expectRow(rows, pivotRow);
      }
    }

    pivotRow += 1;
  }

  const isPivot = new Array<boolean>(cellCount).fill(false);
  for (const col of pivotColumns) {
    isPivot[col] = true;
  }

  const basis: bigint[] = [];

  for (let freeCol = 0; freeCol < cellCount; freeCol += 1) {
    if (isPivot[freeCol]) {
      continue;
    }

    let vector = 1n << BigInt(freeCol);

    for (let rowIndex = 0; rowIndex < pivotColumns.length; rowIndex += 1) {
      if ((expectRow(rows, rowIndex) >> BigInt(freeCol)) & 1n) {
        const pivotCol = pivotColumns[rowIndex];

        if (pivotCol !== undefined) {
          vector |= 1n << BigInt(pivotCol);
        }
      }
    }

    basis.push(vector);
  }

  return basis;
}

const kernelCache = new Map<number, readonly bigint[]>();

/**
 * Return a basis for the kernel of the toggle matrix for the given board size.
 *
 * The kernel depends only on board size, so the result is cached per size.
 */
export function kernelBasis(size: number): readonly bigint[] {
  assertValidSize(size);

  const cached = kernelCache.get(size);

  if (cached !== undefined) {
    return cached;
  }

  const basis = computeKernelBasis(size);
  kernelCache.set(size, basis);
  return basis;
}

/**
 * Find an optimal solution for the board described by its scramble press set.
 *
 * Every solution lies in the coset `S + ker(A)` over GF(2), where `S` is the
 * scramble press set and `A` is the toggle matrix. The optimal number of
 * presses is the minimum Hamming weight of `S Δ v` over all kernel vectors
 * `v`.
 *
 * The kernel basis has at most two elements for supported sizes, so the
 * enumeration checks at most four candidates. Ties break by keeping the first
 * representative in subset order.
 */
export function findOptimalSolution(
  size: number,
  scramblePresses: readonly number[],
): OptimalSolution {
  assertValidSize(size);

  const cellCount = size * size;

  for (const press of scramblePresses) {
    if (!Number.isInteger(press) || press < 0 || press >= cellCount) {
      throw new Error(`Press index ${press} is out of range for size ${size}`);
    }
  }

  const basis = kernelBasis(size);

  let scrambleMask = 0n;
  for (const press of scramblePresses) {
    // The board is the parity set: only indices that appear an odd number of
    // times matter.
    scrambleMask ^= 1n << BigInt(press);
  }

  let bestMask = scrambleMask;
  let bestCount = popcount(scrambleMask);

  const dimension = basis.length;
  // Supported sizes have dimension 0 or 2, so a plain `number` shift is safe.
  // Larger kernels would need a BigInt enumeration loop.
  const subsetCount = 1 << dimension;

  for (let subset = 1; subset < subsetCount; subset += 1) {
    let combination = 0n;

    for (let bit = 0; bit < dimension; bit += 1) {
      if (subset & (1 << bit)) {
        const vector = basis[bit];

        if (vector !== undefined) {
          combination ^= vector;
        }
      }
    }

    const candidate = scrambleMask ^ combination;
    const count = popcount(candidate);

    if (count < bestCount) {
      bestCount = count;
      bestMask = candidate;
    }
  }

  const cells: number[] = [];
  for (let index = 0; index < cellCount; index += 1) {
    if ((bestMask >> BigInt(index)) & 1n) {
      cells.push(index);
    }
  }

  return { presses: bestCount, cells };
}
