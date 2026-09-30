import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsScreen } from '../../src/components/SettingsScreen';

describe('SettingsScreen', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the current state of both switches', () => {
    render(
      <SettingsScreen
        musicEnabled={true}
        effectsEnabled={false}
        onToggleMusic={vi.fn()}
        onToggleEffects={vi.fn()}
      />,
    );

    const musicToggle = screen.getByRole('button', { name: /Music/i });
    const effectsToggle = screen.getByRole('button', { name: /Effects/i });

    expect(musicToggle).toHaveAttribute('aria-pressed', 'true');
    expect(effectsToggle).toHaveAttribute('aria-pressed', 'false');
    expect(musicToggle.textContent).toMatch(/On/i);
    expect(effectsToggle.textContent).toMatch(/Off/i);
  });

  it('calls the toggle callbacks', () => {
    const onToggleMusic = vi.fn();
    const onToggleEffects = vi.fn();
    render(
      <SettingsScreen
        musicEnabled={false}
        effectsEnabled={true}
        onToggleMusic={onToggleMusic}
        onToggleEffects={onToggleEffects}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Music/i }));
    fireEvent.click(screen.getByRole('button', { name: /Effects/i }));

    expect(onToggleMusic).toHaveBeenCalledTimes(1);
    expect(onToggleEffects).toHaveBeenCalledTimes(1);
  });
});
