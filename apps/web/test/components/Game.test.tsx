import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSolvableBoard } from '../../src/game/board';
import { findDifficultyById } from '../../src/game/difficulty';
import { Game } from '../../src/components/Game';

function constantRandom(value: number): () => number {
  return () => value;
}

function cellLabel(index: number, size: number): string {
  const row = Math.floor(index / size) + 1;
  const col = (index % size) + 1;
  return `Row ${row}, Column ${col}`;
}

function getCell(index: number, size: number): HTMLElement {
  return screen.getByRole('button', { name: cellLabel(index, size) });
}

describe('Game', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('pressing a cell changes the lit state of that cell and its neighbours', () => {
    render(<Game initialDifficultyId="easy" random={constantRandom(0)} />);

    const difficulty = findDifficultyById('easy');
    const { presses } = createSolvableBoard(
      difficulty.boardSize,
      difficulty.scrambleDepth,
      constantRandom(0),
      difficulty.minPresses,
    );
    const firstIndex = presses[0] ?? 0;
    const firstCell = getCell(firstIndex, difficulty.boardSize);
    const firstCol = (firstIndex % difficulty.boardSize) + 1;
    const neighbourCol = firstCol < difficulty.boardSize ? firstCol + 1 : firstCol - 1;
    const neighbourIndex =
      Math.floor(firstIndex / difficulty.boardSize) * difficulty.boardSize + (neighbourCol - 1);
    const neighbour = getCell(neighbourIndex, difficulty.boardSize);

    const previousPressedLit = firstCell.getAttribute('aria-pressed');
    const previousNeighbourLit = neighbour.getAttribute('aria-pressed');

    fireEvent.click(firstCell);

    expect(firstCell.getAttribute('aria-pressed')).toBe(
      previousPressedLit === 'true' ? 'false' : 'true',
    );
    expect(neighbour.getAttribute('aria-pressed')).toBe(
      previousNeighbourLit === 'true' ? 'false' : 'true',
    );
  });

  it('solving the board shows the result', () => {
    render(<Game initialDifficultyId="easy" random={constantRandom(0)} />);

    const difficulty = findDifficultyById('easy');
    const { presses } = createSolvableBoard(
      difficulty.boardSize,
      difficulty.scrambleDepth,
      constantRandom(0),
      difficulty.minPresses,
    );

    for (const index of presses) {
      fireEvent.click(getCell(index, difficulty.boardSize));
    }

    expect(screen.getByText(/Solved in/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Player name/i)).toBeInTheDocument();
  });

  it('does not start the timer before the first press', () => {
    render(<Game initialDifficultyId="easy" random={constantRandom(0)} />);

    expect(screen.getByText('Time: 0:00')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText('Time: 0:00')).toBeInTheDocument();
  });

  it('starts the timer after the first press', () => {
    render(<Game initialDifficultyId="normal" random={constantRandom(0)} />);

    const difficulty = findDifficultyById('normal');
    const { presses } = createSolvableBoard(
      difficulty.boardSize,
      difficulty.scrambleDepth,
      constantRandom(0),
      difficulty.minPresses,
    );
    const firstCell = getCell(presses[0] ?? 0, difficulty.boardSize);

    fireEvent.click(firstCell);

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByText(/Time: 0:0[12]/)).toBeInTheDocument();
  });

  it('starting a new game resets the move count and timer', () => {
    render(<Game initialDifficultyId="easy" random={constantRandom(0)} />);

    const difficulty = findDifficultyById('easy');
    const { presses } = createSolvableBoard(
      difficulty.boardSize,
      difficulty.scrambleDepth,
      constantRandom(0),
      difficulty.minPresses,
    );
    const firstCell = getCell(presses[0] ?? 0, difficulty.boardSize);

    fireEvent.click(firstCell);

    expect(screen.getByText('Moves: 1')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    fireEvent.click(screen.getByRole('button', { name: 'New game' }));

    expect(screen.getByText('Moves: 0')).toBeInTheDocument();
    expect(screen.getByText('Time: 0:00')).toBeInTheDocument();
  });

  it('ignores presses after the board is already solved', () => {
    render(<Game initialDifficultyId="easy" random={constantRandom(0)} />);

    const difficulty = findDifficultyById('easy');
    const { presses } = createSolvableBoard(
      difficulty.boardSize,
      difficulty.scrambleDepth,
      constantRandom(0),
      difficulty.minPresses,
    );

    for (const index of presses) {
      fireEvent.click(getCell(index, difficulty.boardSize));
    }

    expect(screen.getByText(`Moves: ${presses.length}`)).toBeInTheDocument();

    fireEvent.click(getCell(presses[0] ?? 0, difficulty.boardSize));

    expect(screen.getByText(`Moves: ${presses.length}`)).toBeInTheDocument();
  });

  it('changing difficulty starts a new board of the selected size', () => {
    render(<Game initialDifficultyId="easy" random={constantRandom(0)} />);

    fireEvent.change(screen.getByLabelText(/Difficulty/i), {
      target: { value: 'hard' },
    });

    expect(screen.getByText('Moves: 0')).toBeInTheDocument();
    expect(screen.getByLabelText(/Row 1, Column 7/i)).toBeInTheDocument();
  });
});
