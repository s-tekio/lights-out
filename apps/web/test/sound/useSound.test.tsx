import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useSound } from '../../src/sound/useSound';
import type { SoundEngine } from '../../src/sound/engine';

function createMockEngine(): SoundEngine & {
  startCalls: number;
  stopCalls: number;
  pressCalls: number;
  disposeCalls: number;
} {
  return {
    isSupported: true,
    startCalls: 0,
    stopCalls: 0,
    pressCalls: 0,
    disposeCalls: 0,
    start() {
      this.startCalls += 1;
    },
    stop() {
      this.stopCalls += 1;
    },
    press() {
      this.pressCalls += 1;
    },
    dispose() {
      this.disposeCalls += 1;
    },
  };
}

function TestHarness({ engine }: { engine: SoundEngine }) {
  const { enabled, toggle } = useSound(engine);
  return (
    <button type="button" onClick={toggle}>
      {enabled ? 'On' : 'Off'}
    </button>
  );
}

describe('useSound', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('does not start the engine on mount', () => {
    const engine = createMockEngine();
    render(<TestHarness engine={engine} />);
    expect(engine.startCalls).toBe(0);
  });

  it('starts the engine on the first pointer gesture when enabled', () => {
    const engine = createMockEngine();
    render(<TestHarness engine={engine} />);

    fireEvent.pointerDown(document);
    expect(engine.startCalls).toBe(1);

    fireEvent.pointerDown(document);
    expect(engine.startCalls).toBe(1);
  });

  it('starts the engine on the first keyboard gesture when enabled', () => {
    const engine = createMockEngine();
    render(<TestHarness engine={engine} />);

    fireEvent.keyDown(document);
    expect(engine.startCalls).toBe(1);
  });

  it('toggles off and stops the engine', () => {
    const engine = createMockEngine();
    render(<TestHarness engine={engine} />);

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('Off');
    expect(engine.stopCalls).toBe(1);
    expect(engine.startCalls).toBe(0);
  });

  it('toggles back on and starts the engine', () => {
    const engine = createMockEngine();
    render(<TestHarness engine={engine} />);

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByRole('button')).toHaveTextContent('On');
    expect(engine.startCalls).toBe(1);
  });

  it('persists the enabled state to localStorage', () => {
    const engine = createMockEngine();
    render(<TestHarness engine={engine} />);

    fireEvent.click(screen.getByRole('button'));
    expect(window.localStorage.getItem('lights-out:soundEnabled')).toBe('false');

    cleanup();

    const nextEngine = createMockEngine();
    render(<TestHarness engine={nextEngine} />);
    expect(screen.getByRole('button')).toHaveTextContent('Off');
  });

  it('disposes the engine on unmount', () => {
    const engine = createMockEngine();
    const { unmount } = render(<TestHarness engine={engine} />);

    act(() => {
      unmount();
    });

    expect(engine.disposeCalls).toBe(1);
  });
});
