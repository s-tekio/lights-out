import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import { TitleScreen } from '../../src/components/TitleScreen';

function renderTitleScreen(props: Partial<Parameters<typeof TitleScreen>[0]> = {}) {
  return render(
    <TitleScreen
      onNewGame={vi.fn()}
      onLeaderboard={vi.fn()}
      onSettings={vi.fn()}
      onHowToPlay={vi.fn()}
      helpTriggerRef={createRef<HTMLButtonElement>()}
      {...props}
    />,
  );
}

describe('TitleScreen', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the game title', () => {
    renderTitleScreen();

    expect(screen.getByRole('heading', { name: /Lights Out/i })).toBeInTheDocument();
  });

  it('calls onNewGame when New Game is pressed', () => {
    const onNewGame = vi.fn();
    renderTitleScreen({ onNewGame });

    fireEvent.click(screen.getByRole('button', { name: /New Game/i }));

    expect(onNewGame).toHaveBeenCalledTimes(1);
  });

  it('calls onLeaderboard when Leaderboard is pressed', () => {
    const onLeaderboard = vi.fn();
    renderTitleScreen({ onLeaderboard });

    fireEvent.click(screen.getByRole('button', { name: /Leaderboard/i }));

    expect(onLeaderboard).toHaveBeenCalledTimes(1);
  });

  it('calls onSettings when Settings is pressed', () => {
    const onSettings = vi.fn();
    renderTitleScreen({ onSettings });

    fireEvent.click(screen.getByRole('button', { name: /Settings/i }));

    expect(onSettings).toHaveBeenCalledTimes(1);
  });

  it('calls onHowToPlay when How to play is pressed', () => {
    const onHowToPlay = vi.fn();
    renderTitleScreen({ onHowToPlay });

    fireEvent.click(screen.getByRole('button', { name: /How to play/i }));

    expect(onHowToPlay).toHaveBeenCalledTimes(1);
  });

  it('renders the How to play menu entry', () => {
    renderTitleScreen();

    expect(screen.getByRole('button', { name: /How to play/i })).toBeInTheDocument();
  });
});
