import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DifficultyScreen } from '../../src/components/DifficultyScreen';
import { DIFFICULTIES, formatDifficultyLabel } from '../../src/game/difficulty';

describe('DifficultyScreen', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders one button per difficulty', () => {
    render(<DifficultyScreen onSelect={vi.fn()} />);

    for (const difficulty of DIFFICULTIES) {
      expect(
        screen.getByRole('button', { name: formatDifficultyLabel(difficulty) }),
      ).toBeInTheDocument();
    }
  });

  it('calls onSelect with the chosen difficulty id', () => {
    const onSelect = vi.fn();
    render(<DifficultyScreen onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: /Hard/i }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('hard');
  });
});
