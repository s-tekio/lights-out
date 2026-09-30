import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WinSequence } from '../../src/components/WinSequence';

const baseSubmission = {
  boardSize: 5,
  moves: 7,
  elapsedMs: 42310,
};

const originalMatchMedia: typeof window.matchMedia = (...args) => window.matchMedia(...args);

describe('WinSequence', () => {
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
    vi.restoreAllMocks();
    window.matchMedia = originalMatchMedia;
  });

  it('renders the congratulations headline immediately', () => {
    render(
      <WinSequence
        submission={baseSubmission}
        onScoreSubmitted={() => undefined}
        onCancel={() => undefined}
      />,
    );

    expect(screen.getByRole('heading', { name: /CONGRATULATIONS!/i })).toBeInTheDocument();
  });

  it('does not render the name form before the delay has elapsed', () => {
    render(
      <WinSequence
        submission={baseSubmission}
        onScoreSubmitted={() => undefined}
        onCancel={() => undefined}
      />,
    );

    expect(screen.queryByRole('textbox', { name: /Player name/i })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(999);
    });

    expect(screen.queryByRole('textbox', { name: /Player name/i })).not.toBeInTheDocument();
  });

  it('reveals the name form after the one-second delay', () => {
    render(
      <WinSequence
        submission={baseSubmission}
        onScoreSubmitted={() => undefined}
        onCancel={() => undefined}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByRole('textbox', { name: /Player name/i })).toBeInTheDocument();
  });

  it('clears the delay timer when unmounted before it fires', () => {
    const { unmount } = render(
      <WinSequence
        submission={baseSubmission}
        onScoreSubmitted={() => undefined}
        onCancel={() => undefined}
      />,
    );

    unmount();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByRole('textbox', { name: /Player name/i })).not.toBeInTheDocument();
  });

  it('calls onCancel when the form cancel button is pressed', () => {
    const onCancel = vi.fn();
    render(
      <WinSequence
        submission={baseSubmission}
        onScoreSubmitted={() => undefined}
        onCancel={onCancel}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('skips the fireworks canvas when reduced motion is requested', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;

    const { container } = render(
      <WinSequence
        submission={baseSubmission}
        onScoreSubmitted={() => undefined}
        onCancel={() => undefined}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(container.querySelector('.fireworks')).not.toBeInTheDocument();
  });
});
