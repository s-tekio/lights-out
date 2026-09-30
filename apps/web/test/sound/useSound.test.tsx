import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useSound } from '../../src/sound/useSound';
import type { SoundEngine } from '../../src/sound/engine';

function createMockEngine(): SoundEngine & {
  startCalls: number;
  stopCalls: number;
  pressCalls: number;
  disposeCalls: number;
  lastMusicEnabled: boolean | null;
  lastEffectsEnabled: boolean | null;
} {
  return {
    isSupported: true,
    startCalls: 0,
    stopCalls: 0,
    pressCalls: 0,
    disposeCalls: 0,
    lastMusicEnabled: null,
    lastEffectsEnabled: null,
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
    setMusicEnabled(enabled: boolean) {
      this.lastMusicEnabled = enabled;
    },
    setEffectsEnabled(enabled: boolean) {
      this.lastEffectsEnabled = enabled;
    },
  };
}

function TestHarness({ engine }: { engine: SoundEngine }) {
  const { musicEnabled, effectsEnabled, toggleMusic, toggleEffects } = useSound(engine);
  return (
    <div>
      <button type="button" onClick={toggleMusic}>
        Music {musicEnabled ? 'On' : 'Off'}
      </button>
      <button type="button" onClick={toggleEffects}>
        Effects {effectsEnabled ? 'On' : 'Off'}
      </button>
    </div>
  );
}

function getMusicButton() {
  return screen.getByRole('button', { name: /Music/i });
}

function getEffectsButton() {
  return screen.getByRole('button', { name: /Effects/i });
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

  it('starts the engine on the first pointer gesture when music is enabled', () => {
    const engine = createMockEngine();
    render(<TestHarness engine={engine} />);

    fireEvent.pointerDown(document);
    expect(engine.startCalls).toBe(1);

    fireEvent.pointerDown(document);
    expect(engine.startCalls).toBe(1);
  });

  it('starts the engine on the first keyboard gesture when music is enabled', () => {
    const engine = createMockEngine();
    render(<TestHarness engine={engine} />);

    fireEvent.keyDown(document);
    expect(engine.startCalls).toBe(1);
  });

  it('does not start the engine on gesture when music is disabled', () => {
    const engine = createMockEngine();
    window.localStorage.setItem('lights-out:musicEnabled', 'false');
    render(<TestHarness engine={engine} />);

    fireEvent.pointerDown(document);
    expect(engine.startCalls).toBe(0);
  });

  it('toggles music off and stops the engine', () => {
    const engine = createMockEngine();
    render(<TestHarness engine={engine} />);

    fireEvent.click(getMusicButton());
    expect(getMusicButton()).toHaveTextContent('Music Off');
    expect(engine.stopCalls).toBe(1);
    expect(engine.startCalls).toBe(0);
    expect(engine.lastMusicEnabled).toBe(false);
  });

  it('toggles music back on and starts the engine', () => {
    const engine = createMockEngine();
    render(<TestHarness engine={engine} />);

    fireEvent.click(getMusicButton());
    fireEvent.click(getMusicButton());

    expect(getMusicButton()).toHaveTextContent('Music On');
    expect(engine.startCalls).toBe(1);
    expect(engine.lastMusicEnabled).toBe(true);
  });

  it('toggles effects without touching the engine loop', () => {
    const engine = createMockEngine();
    render(<TestHarness engine={engine} />);

    fireEvent.click(getEffectsButton());
    expect(getEffectsButton()).toHaveTextContent('Effects Off');
    expect(engine.stopCalls).toBe(0);
    expect(engine.startCalls).toBe(0);
    expect(engine.lastEffectsEnabled).toBe(false);

    fireEvent.click(getEffectsButton());
    expect(getEffectsButton()).toHaveTextContent('Effects On');
    expect(engine.lastEffectsEnabled).toBe(true);
  });

  it('persists the music state to localStorage', () => {
    const engine = createMockEngine();
    render(<TestHarness engine={engine} />);

    fireEvent.click(getMusicButton());
    expect(window.localStorage.getItem('lights-out:musicEnabled')).toBe('false');

    cleanup();

    const nextEngine = createMockEngine();
    window.localStorage.setItem('lights-out:effectsEnabled', 'true');
    render(<TestHarness engine={nextEngine} />);
    expect(getMusicButton()).toHaveTextContent('Music Off');
  });

  it('persists the effects state to localStorage independently', () => {
    const engine = createMockEngine();
    render(<TestHarness engine={engine} />);

    fireEvent.click(getEffectsButton());
    expect(window.localStorage.getItem('lights-out:effectsEnabled')).toBe('false');
    expect(window.localStorage.getItem('lights-out:musicEnabled')).toBeNull();

    cleanup();

    const nextEngine = createMockEngine();
    render(<TestHarness engine={nextEngine} />);
    expect(getEffectsButton()).toHaveTextContent('Effects Off');
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
