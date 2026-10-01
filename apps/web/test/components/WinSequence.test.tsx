import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WinSequence } from '../../src/components/WinSequence';

const baseSubmission = {
  boardSize: 5,
  moves: 7,
  elapsedMs: 42310,
};

const optimalSolution = {
  presses: 5,
  cells: [0, 6, 12, 18, 24],
};

const originalMatchMedia: typeof window.matchMedia = (...args) => window.matchMedia(...args);

function renderWinSequence(props: Partial<Parameters<typeof WinSequence>[0]> = {}) {
  return render(
    <WinSequence
      submission={baseSubmission}
      optimalSolution={optimalSolution}
      showSolution={false}
      onToggleSolution={() => undefined}
      onScoreSubmitted={() => undefined}
      onCancel={() => undefined}
      {...props}
    />,
  );
}

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

  it('renders the congratulations headline immediately inside the dialog', () => {
    renderWinSequence();

    const dialog = screen.getByRole('dialog');
    const headline = screen.getByRole('heading', { name: /CONGRATULATIONS!/i });

    expect(dialog).toContainElement(headline);
  });

  it('uses the screen-title class for the headline, not the game-title class', () => {
    renderWinSequence();

    const headline = screen.getByRole('heading', { name: /CONGRATULATIONS!/i });

    expect(headline).toHaveClass('screen-title');
    expect(headline).not.toHaveClass('game-title');
  });

  it('renders the solved-in line and the operable solution reveal before the form delay', () => {
    renderWinSequence();

    expect(screen.getByText(/Solved in 7 moves and 0:42/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show optimal sequence/i })).toBeInTheDocument();
  });

  it('renders the headline, then the summary, then the form after the delay', () => {
    renderWinSequence();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const dialog = screen.getByRole('dialog');
    const headline = screen.getByRole('heading', { name: /CONGRATULATIONS!/i });
    const summary = dialog.querySelector('.win-sequence__summary');
    const form = dialog.querySelector('.win-sequence__form');

    expect(summary).not.toBeNull();
    expect(form).not.toBeNull();

    if (summary === null || form === null) {
      throw new Error('Expected summary and form to be present');
    }

    expect(headline.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(summary.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('renders the summary exactly once in the document', () => {
    renderWinSequence();

    expect(screen.getAllByText(/Solved in/i)).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /Show optimal sequence/i })).toHaveLength(1);
  });

  it('does not render the name form before the delay has elapsed', () => {
    renderWinSequence();

    expect(screen.queryByRole('textbox', { name: /Player name/i })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(999);
    });

    expect(screen.queryByRole('textbox', { name: /Player name/i })).not.toBeInTheDocument();
  });

  it('reveals the name form after the one-second delay', () => {
    renderWinSequence();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByRole('textbox', { name: /Player name/i })).toBeInTheDocument();
  });

  it('clears the delay timer when unmounted before it fires', () => {
    const { unmount } = renderWinSequence();

    unmount();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByRole('textbox', { name: /Player name/i })).not.toBeInTheDocument();
  });

  it('calls onCancel when the form cancel button is pressed', () => {
    const onCancel = vi.fn();
    renderWinSequence({ onCancel });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Escape is pressed', () => {
    const onCancel = vi.fn();
    renderWinSequence({ onCancel });

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the backdrop is clicked', () => {
    const onCancel = vi.fn();
    renderWinSequence({ onCancel });

    const backdrop = screen.getByRole('dialog').parentElement;
    expect(backdrop).toHaveClass('dialog-backdrop');

    if (backdrop === null) {
      throw new Error('Expected the dialog to have a backdrop parent element');
    }

    fireEvent.click(backdrop);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('keeps scheduling animation frames while the dialog is open and stops on unmount', async () => {
    // requestAnimationFrame is not synchronous in jsdom, so this test uses
    // real timers and waits for the first frame to be scheduled. Reduced motion
    // must be off or the canvas is not rendered at all.
    vi.useRealTimers();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;

    const fakeContext = {
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      globalAlpha: 1,
      fillStyle: '',
    };
    const originalGetContext = HTMLCanvasElement.prototype.getContext.bind(
      HTMLCanvasElement.prototype,
    );
    HTMLCanvasElement.prototype.getContext = vi.fn((contextId: string) => {
      if (contextId === '2d') {
        return fakeContext as unknown as CanvasRenderingContext2D;
      }
      return originalGetContext(contextId);
    }) as typeof HTMLCanvasElement.prototype.getContext;

    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(123);
    const cafSpy = vi.spyOn(window, 'cancelAnimationFrame');

    const { unmount } = renderWinSequence();

    await waitFor(() => expect(rafSpy).toHaveBeenCalled());

    unmount();

    expect(cafSpy).toHaveBeenCalledWith(123);

    HTMLCanvasElement.prototype.getContext = originalGetContext;
    rafSpy.mockRestore();
    cafSpy.mockRestore();
    vi.useFakeTimers();
  });

  it('skips the fireworks canvas when reduced motion is requested', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;

    const { container } = renderWinSequence();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(container.querySelector('.fireworks')).not.toBeInTheDocument();
  });
});
