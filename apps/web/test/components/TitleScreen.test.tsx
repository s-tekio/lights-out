import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TitleScreen } from '../../src/components/TitleScreen';

describe('TitleScreen', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the game title', () => {
    render(<TitleScreen onNewGame={vi.fn()} onLeaderboard={vi.fn()} onSettings={vi.fn()} />);

    expect(screen.getByRole('heading', { name: /Lights Out/i })).toBeInTheDocument();
  });

  it('calls onNewGame when New Game is pressed', () => {
    const onNewGame = vi.fn();
    render(<TitleScreen onNewGame={onNewGame} onLeaderboard={vi.fn()} onSettings={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /New Game/i }));

    expect(onNewGame).toHaveBeenCalledTimes(1);
  });

  it('calls onLeaderboard when Leaderboard is pressed', () => {
    const onLeaderboard = vi.fn();
    render(<TitleScreen onNewGame={vi.fn()} onLeaderboard={onLeaderboard} onSettings={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Leaderboard/i }));

    expect(onLeaderboard).toHaveBeenCalledTimes(1);
  });

  it('calls onSettings when Settings is pressed', () => {
    const onSettings = vi.fn();
    render(<TitleScreen onNewGame={vi.fn()} onLeaderboard={vi.fn()} onSettings={onSettings} />);

    fireEvent.click(screen.getByRole('button', { name: /Settings/i }));

    expect(onSettings).toHaveBeenCalledTimes(1);
  });
});
