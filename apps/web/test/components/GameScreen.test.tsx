import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameScreen } from '../../src/components/GameScreen';
import type { SoundEngine } from '../../src/sound/engine';

const mockSound: SoundEngine = {
  isSupported: true,
  press: vi.fn(),
  dispose: vi.fn(),
  setEffectsEnabled: vi.fn(),
};

function renderGameScreen(props: Partial<Parameters<typeof GameScreen>[0]> = {}) {
  return render(
    <GameScreen
      difficultyId="easy"
      sound={mockSound}
      musicEnabled={true}
      effectsEnabled={true}
      onToggleMusic={vi.fn()}
      onToggleEffects={vi.fn()}
      onMainMenu={vi.fn()}
      {...props}
    />,
  );
}

describe('GameScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders the board and the menu button in the status row', () => {
    renderGameScreen();

    expect(screen.getByRole('group', { name: /Lights Out board/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open game menu/i })).toBeInTheDocument();
  });

  it('opens the in-game menu from the status row button', () => {
    renderGameScreen();

    fireEvent.click(screen.getByRole('button', { name: /Open game menu/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Menu/i })).toBeInTheDocument();
  });

  it('lists the required menu entries', () => {
    renderGameScreen();

    fireEvent.click(screen.getByRole('button', { name: /Open game menu/i }));

    expect(screen.getByRole('button', { name: /Reset Game/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Music/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Effects/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /How to play/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Main menu/i })).toBeInTheDocument();
  });

  it('resets the board when Reset Game is pressed', () => {
    renderGameScreen();

    const firstCell = screen.getByRole('button', { name: /Row 1, Column 1/i });
    fireEvent.click(firstCell);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByText('Moves: 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Open game menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /Reset Game/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Moves: 0')).toBeInTheDocument();
  });

  it('opens the help dialog from How to play', () => {
    renderGameScreen();

    fireEvent.click(screen.getByRole('button', { name: /Open game menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /How to play/i }));

    expect(screen.queryByRole('heading', { name: /Menu/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /How to play/i })).toBeInTheDocument();
  });

  it('calls onMainMenu from the menu', () => {
    const onMainMenu = vi.fn();
    renderGameScreen({ onMainMenu });

    fireEvent.click(screen.getByRole('button', { name: /Open game menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /Main menu/i }));

    expect(onMainMenu).toHaveBeenCalledTimes(1);
  });
});
