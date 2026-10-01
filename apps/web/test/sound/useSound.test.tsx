import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useSound, type SoundDependencies } from '../../src/sound/useSound';
import type { SoundEngine } from '../../src/sound/engine';
import type { MusicPlayer } from '../../src/sound/musicPlayer';

function createMockEngine(): SoundEngine & {
  pressCalls: number;
  disposeCalls: number;
  lastEffectsEnabled: boolean | null;
} {
  return {
    isSupported: true,
    pressCalls: 0,
    disposeCalls: 0,
    lastEffectsEnabled: null,
    press() {
      this.pressCalls += 1;
    },
    dispose() {
      this.disposeCalls += 1;
    },
    setEffectsEnabled(enabled: boolean) {
      this.lastEffectsEnabled = enabled;
    },
  };
}

function createMockMusicPlayer(): MusicPlayer & {
  playCalls: number;
  pauseCalls: number;
  disposeCalls: number;
  lastEnabled: boolean | null;
  playRejections: unknown[];
  resolvePlay(): void;
  rejectPlay(error: unknown): void;
} {
  let playResolve: (() => void) | null = null;
  let playReject: ((error: unknown) => void) | null = null;

  return {
    isSupported: true,
    playCalls: 0,
    pauseCalls: 0,
    disposeCalls: 0,
    lastEnabled: null,
    playRejections: [] as unknown[],

    play() {
      this.playCalls += 1;
      return new Promise<void>((resolve, reject) => {
        playResolve = resolve;
        playReject = reject;
      }).catch((error: unknown) => {
        this.playRejections.push(error);
        throw error;
      });
    },

    pause() {
      this.pauseCalls += 1;
    },

    dispose() {
      this.disposeCalls += 1;
    },

    setEnabled(enabled: boolean) {
      this.lastEnabled = enabled;
    },

    resolvePlay() {
      playResolve?.();
    },

    rejectPlay(error: unknown) {
      playReject?.(error);
    },
  };
}

function TestHarness({ deps }: { deps: SoundDependencies }) {
  const { musicEnabled, effectsEnabled, toggleMusic, toggleEffects } = useSound(deps);
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

  it('attempts to play music on mount when music is enabled', () => {
    const music = createMockMusicPlayer();
    const effects = createMockEngine();
    render(<TestHarness deps={{ music, effects }} />);
    expect(music.playCalls).toBe(1);
  });

  it('does not attempt to play music on mount when music is disabled', () => {
    window.localStorage.setItem('lights-out:musicEnabled', 'false');
    const music = createMockMusicPlayer();
    const effects = createMockEngine();
    render(<TestHarness deps={{ music, effects }} />);
    expect(music.playCalls).toBe(0);
  });

  it('arms the gesture listener when the autoplay attempt is rejected', async () => {
    const music = createMockMusicPlayer();
    const effects = createMockEngine();
    render(<TestHarness deps={{ music, effects }} />);
    expect(music.playCalls).toBe(1);

    const autoplayError = new DOMException('Autoplay blocked', 'NotAllowedError');
    await act(async () => {
      music.rejectPlay(autoplayError);
      await Promise.resolve();
    });

    // The rejection is swallowed; it must not surface through the hook.
    expect(music.playRejections).toHaveLength(1);
    expect(music.playRejections[0]).toBe(autoplayError);
    expect(music.playCalls).toBe(1);

    fireEvent.pointerDown(document);
    expect(music.playCalls).toBe(2);

    fireEvent.pointerDown(document);
    expect(music.playCalls).toBe(2);
  });

  it('starts the music on the first keyboard gesture when autoplay is rejected', async () => {
    const music = createMockMusicPlayer();
    const effects = createMockEngine();
    render(<TestHarness deps={{ music, effects }} />);

    await act(async () => {
      music.rejectPlay(new DOMException('Autoplay blocked', 'NotAllowedError'));
      await Promise.resolve();
    });

    fireEvent.keyDown(document);
    expect(music.playCalls).toBe(2);
  });

  it('toggles music off and pauses the player', () => {
    const music = createMockMusicPlayer();
    const effects = createMockEngine();
    render(<TestHarness deps={{ music, effects }} />);

    fireEvent.click(getMusicButton());
    expect(getMusicButton()).toHaveTextContent('Music Off');
    expect(music.pauseCalls).toBe(1);
    expect(music.lastEnabled).toBe(false);
    expect(effects.lastEffectsEnabled).toBeNull();
  });

  it('toggles music back on and plays the player', () => {
    const music = createMockMusicPlayer();
    const effects = createMockEngine();
    render(<TestHarness deps={{ music, effects }} />);
    const initialPlayCalls = music.playCalls;

    fireEvent.click(getMusicButton());
    fireEvent.click(getMusicButton());

    expect(getMusicButton()).toHaveTextContent('Music On');
    expect(music.lastEnabled).toBe(true);
    expect(music.playCalls).toBe(initialPlayCalls + 1);
  });

  it('toggles effects without touching the music player', () => {
    const music = createMockMusicPlayer();
    const effects = createMockEngine();
    render(<TestHarness deps={{ music, effects }} />);
    const playCallsBefore = music.playCalls;
    const pauseCallsBefore = music.pauseCalls;

    fireEvent.click(getEffectsButton());
    expect(getEffectsButton()).toHaveTextContent('Effects Off');
    expect(effects.lastEffectsEnabled).toBe(false);
    expect(music.playCalls).toBe(playCallsBefore);
    expect(music.pauseCalls).toBe(pauseCallsBefore);

    fireEvent.click(getEffectsButton());
    expect(getEffectsButton()).toHaveTextContent('Effects On');
    expect(effects.lastEffectsEnabled).toBe(true);
  });

  it('persists the music state to localStorage independently', () => {
    const music = createMockMusicPlayer();
    const effects = createMockEngine();
    render(<TestHarness deps={{ music, effects }} />);

    fireEvent.click(getMusicButton());
    expect(window.localStorage.getItem('lights-out:musicEnabled')).toBe('false');
    expect(window.localStorage.getItem('lights-out:effectsEnabled')).toBeNull();

    cleanup();

    const nextMusic = createMockMusicPlayer();
    const nextEffects = createMockEngine();
    render(<TestHarness deps={{ music: nextMusic, effects: nextEffects }} />);
    expect(getMusicButton()).toHaveTextContent('Music Off');
  });

  it('persists the effects state to localStorage independently', () => {
    const music = createMockMusicPlayer();
    const effects = createMockEngine();
    render(<TestHarness deps={{ music, effects }} />);

    fireEvent.click(getEffectsButton());
    expect(window.localStorage.getItem('lights-out:effectsEnabled')).toBe('false');
    expect(window.localStorage.getItem('lights-out:musicEnabled')).toBeNull();

    cleanup();

    const nextMusic = createMockMusicPlayer();
    const nextEffects = createMockEngine();
    render(<TestHarness deps={{ music: nextMusic, effects: nextEffects }} />);
    expect(getEffectsButton()).toHaveTextContent('Effects Off');
  });

  it('disposes both players on unmount', () => {
    const music = createMockMusicPlayer();
    const effects = createMockEngine();
    const { unmount } = render(<TestHarness deps={{ music, effects }} />);

    act(() => {
      unmount();
    });

    expect(music.disposeCalls).toBe(1);
    expect(effects.disposeCalls).toBe(1);
  });
});
