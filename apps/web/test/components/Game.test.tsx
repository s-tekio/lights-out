import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSolvableBoard } from '../../src/game/board';
import { findDifficultyById } from '../../src/game/difficulty';
import { Game } from '../../src/components/Game';
import type { SoundEngine } from '../../src/sound/engine';

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

const originalMatchMedia: typeof window.matchMedia = (...args) => window.matchMedia(...args);

describe('Game', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.matchMedia = originalMatchMedia;
  });

  it('pressing a cell changes the lit state of that cell and its neighbours', () => {
    render(<Game difficultyId="easy" random={constantRandom(0)} />);

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

  it('does not show the name form before the win-sequence delay has elapsed', () => {
    render(<Game difficultyId="easy" random={constantRandom(0)} />);

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
    expect(screen.queryByRole('textbox', { name: /Player name/i })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(999);
    });

    expect(screen.queryByRole('textbox', { name: /Player name/i })).not.toBeInTheDocument();
  });

  it('shows the result, optimal count and name form after the win-sequence delay', () => {
    render(<Game difficultyId="easy" random={constantRandom(0)} />);

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

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText(/Solved in/i)).toBeInTheDocument();
    expect(screen.getByText(/Optimal:/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Player name/i })).toBeInTheDocument();
  });

  it('does not start the timer before the first press', () => {
    render(<Game difficultyId="easy" random={constantRandom(0)} />);

    expect(screen.getByText('Time: 0:00')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText('Time: 0:00')).toBeInTheDocument();
  });

  it('starts the timer after the first press', () => {
    render(<Game difficultyId="normal" random={constantRandom(0)} />);

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

  it('ignores presses after the board is already solved', () => {
    render(<Game difficultyId="easy" random={constantRandom(0)} />);

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

  it('plays the press sound only when the board changes', () => {
    const sound = {
      isSupported: true,
      start: vi.fn(),
      stop: vi.fn(),
      press: vi.fn(),
      dispose: vi.fn(),
      setMusicEnabled: vi.fn(),
      setEffectsEnabled: vi.fn(),
    } satisfies SoundEngine;

    render(<Game difficultyId="easy" random={constantRandom(0)} sound={sound} />);

    const difficulty = findDifficultyById('easy');
    const { presses } = createSolvableBoard(
      difficulty.boardSize,
      difficulty.scrambleDepth,
      constantRandom(0),
      difficulty.minPresses,
    );

    const firstIndex = presses[0] ?? 0;
    fireEvent.click(getCell(firstIndex, difficulty.boardSize));
    expect(sound.press).toHaveBeenCalledTimes(1);

    for (const index of presses.slice(1)) {
      fireEvent.click(getCell(index, difficulty.boardSize));
    }

    const solvedPressCount = sound.press.mock.calls.length;

    fireEvent.click(getCell(firstIndex, difficulty.boardSize));
    expect(sound.press).toHaveBeenCalledTimes(solvedPressCount);
  });

  it('toggles the optimal sequence when the reveal button is pressed', () => {
    render(<Game difficultyId="easy" random={constantRandom(0)} />);

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

    const toggleButton = screen.getByRole('button', { name: /Show optimal sequence/i });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggleButton);

    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('list')).toBeInTheDocument();

    fireEvent.click(toggleButton);

    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
