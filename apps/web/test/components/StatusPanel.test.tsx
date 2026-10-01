import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatusPanel } from '../../src/components/StatusPanel';

function renderPanel(props: Partial<Parameters<typeof StatusPanel>[0]> = {}) {
  return render(<StatusPanel moves={7} elapsedMs={42310} {...props} />);
}

describe('StatusPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the move and time metrics', () => {
    renderPanel();

    expect(screen.getByText('Moves: 7')).toBeInTheDocument();
    expect(screen.getByText('Time: 0:42')).toBeInTheDocument();
  });

  it('does not render the solved summary', () => {
    renderPanel();

    expect(screen.queryByText(/Solved in/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Optimal:/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Show optimal sequence/i }),
    ).not.toBeInTheDocument();
  });

  it('renders the menu button when a menu opener is provided', () => {
    renderPanel({ onOpenMenu: vi.fn() });

    expect(screen.getByRole('button', { name: /Open game menu/i })).toBeInTheDocument();
  });

  it('calls onOpenMenu when the menu button is pressed', () => {
    const onOpenMenu = vi.fn();
    renderPanel({ onOpenMenu });

    fireEvent.click(screen.getByRole('button', { name: /Open game menu/i }));

    expect(onOpenMenu).toHaveBeenCalledTimes(1);
  });
});
