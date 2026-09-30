import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatusPanel } from '../../src/components/StatusPanel';

function renderSolvedPanel(props: Partial<Parameters<typeof StatusPanel>[0]> = {}) {
  return render(
    <StatusPanel
      moves={7}
      elapsedMs={42310}
      isSolved={true}
      boardSize={5}
      onNewGame={() => undefined}
      {...props}
    />,
  );
}

describe('StatusPanel solution reveal', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the optimal count and a toggle when a solution is provided', () => {
    const onToggleSolution = vi.fn();
    renderSolvedPanel({
      optimalSolution: { presses: 5, cells: [0, 6, 12, 18, 24] },
      showSolution: false,
      onToggleSolution,
    });

    expect(screen.getByText(/Optimal: 5 presses/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show optimal sequence/i })).toBeInTheDocument();
  });

  it('expands the ordered coordinate list when toggled', () => {
    const onToggleSolution = vi.fn();
    renderSolvedPanel({
      optimalSolution: { presses: 2, cells: [0, 6] },
      showSolution: true,
      onToggleSolution,
    });

    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getByText(/Row 1, Column 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Row 2, Column 2/i)).toBeInTheDocument();
  });

  it('calls onToggleSolution when the toggle button is pressed', () => {
    const onToggleSolution = vi.fn();
    renderSolvedPanel({
      optimalSolution: { presses: 1, cells: [12] },
      showSolution: false,
      onToggleSolution,
    });

    fireEvent.click(screen.getByRole('button', { name: /Show optimal sequence/i }));

    expect(onToggleSolution).toHaveBeenCalledTimes(1);
  });

  it('does not render the solution reveal when no solution is provided', () => {
    renderSolvedPanel();

    expect(screen.queryByText(/Optimal:/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Show optimal sequence/i }),
    ).not.toBeInTheDocument();
  });

  it('calls onNewGame when the new game button is pressed', () => {
    const onNewGame = vi.fn();
    renderSolvedPanel({ onNewGame });

    fireEvent.click(screen.getByRole('button', { name: /New game/i }));

    expect(onNewGame).toHaveBeenCalledTimes(1);
  });
});
