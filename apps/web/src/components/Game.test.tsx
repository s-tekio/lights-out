import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Game } from './Game';

function constantRandom(value: number): () => number {
  return () => value;
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

    const pressedCell = screen.getByRole('button', { name: 'Row 1, Column 1' });
    const neighbour = screen.getByRole('button', { name: 'Row 1, Column 2' });

    expect(pressedCell).toHaveAttribute('aria-pressed', 'true');
    expect(neighbour).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(pressedCell);

    expect(pressedCell).toHaveAttribute('aria-pressed', 'false');
    expect(neighbour).toHaveAttribute('aria-pressed', 'false');
  });

  it('solving the board shows the result', () => {
    render(<Game initialDifficultyId="easy" random={constantRandom(0)} />);

    const cell = screen.getByRole('button', { name: 'Row 1, Column 1' });
    fireEvent.click(cell);

    expect(screen.getByText(/Solved in/i)).toBeInTheDocument();
    expect(screen.getByText(/Score submission will be added here/i)).toBeInTheDocument();
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

    const cell = screen.getByRole('button', { name: 'Row 1, Column 2' });
    fireEvent.click(cell);

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByText(/Time: 0:0[12]/)).toBeInTheDocument();
  });

  it('starting a new game resets the move count and timer', () => {
    render(<Game initialDifficultyId="easy" random={constantRandom(0)} />);

    const cell = screen.getByRole('button', { name: 'Row 1, Column 1' });
    fireEvent.click(cell);

    expect(screen.getByText('Moves: 1')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    fireEvent.click(screen.getByRole('button', { name: 'New game' }));

    expect(screen.getByText('Moves: 0')).toBeInTheDocument();
    expect(screen.getByText('Time: 0:00')).toBeInTheDocument();
  });
});
