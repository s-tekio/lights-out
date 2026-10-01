import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  audibilityCalls: number;
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
    audibilityCalls: 0,

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

    applyAudibility() {
      this.audibilityCalls += 1;
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
  afterEach(() => {
    cleanup();
  });

  it('starts with music and effects enabled on a fresh mount', () => {
    const music = createMockMusicPlayer();
    const effects = createMockEngine();
    render(<TestHarness deps={{ music, effects }} />);
    expect(getMusicButton()).toHaveTextContent('Music On');
    expect(getEffectsButton()).toHaveTextContent('Effects On');
  });

  it('attempts to play music on mount when music is enabled', () => {
    const music = createMockMusicPlayer();
    const effects = createMockEngine();
    render(<TestHarness deps={{ music, effects }} />);
    expect(music.playCalls).toBe(1);
  });

  it('retries a refused gesture attempt on the next gesture', async () => {
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

    await act(async () => {
      music.rejectPlay(new DOMException('Still blocked', 'NotAllowedError'));
      await Promise.resolve();
    });

    fireEvent.pointerDown(document);
    expect(music.playCalls).toBe(3);
  });

  it('removes gesture listeners after a successful gesture play', async () => {
    const music = createMockMusicPlayer();
    const effects = createMockEngine();
    render(<TestHarness deps={{ music, effects }} />);

    await act(async () => {
      music.rejectPlay(new DOMException('Autoplay blocked', 'NotAllowedError'));
      await Promise.resolve();
    });

    fireEvent.pointerDown(document);
    expect(music.playCalls).toBe(2);

    await act(async () => {
      music.resolvePlay();
      await Promise.resolve();
    });

    fireEvent.pointerDown(document);
    fireEvent.keyDown(document);
    fireEvent.click(document);
    expect(music.playCalls).toBe(2);
  });

  it('lets a gesture re-assert playback even when the mount attempt resolved', async () => {
    const music = createMockMusicPlayer();
    const effects = createMockEngine();
    render(<TestHarness deps={{ music, effects }} />);
    expect(music.playCalls).toBe(1);

    await act(async () => {
      music.resolvePlay();
      await Promise.resolve();
    });

    fireEvent.pointerDown(document);
    expect(music.playCalls).toBe(2);
    expect(music.audibilityCalls).toBe(1);
  });

  it('stops retrying on a non-policy error', async () => {
    const music = createMockMusicPlayer();
    const effects = createMockEngine();
    render(<TestHarness deps={{ music, effects }} />);

    await act(async () => {
      music.rejectPlay(new DOMException('Autoplay blocked', 'NotAllowedError'));
      await Promise.resolve();
    });

    const networkError = new Error('Network failure');
    music.play = () => {
      music.playCalls += 1;
      return Promise.reject(networkError);
    };

    let unhandledReason: unknown = null;
    const unhandledHandler = (event: PromiseRejectionEvent) => {
      unhandledReason = event.reason;
      event.preventDefault();
    };
    const processHandler = (reason: unknown) => {
      unhandledReason = reason;
    };
    window.addEventListener('unhandledrejection', unhandledHandler);
    process.on('unhandledRejection', processHandler);

    fireEvent.pointerDown(document);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    });

    window.removeEventListener('unhandledrejection', unhandledHandler);
    process.off('unhandledRejection', processHandler);

    expect(unhandledReason).toBe(networkError);
    expect(music.playCalls).toBe(2);

    fireEvent.pointerDown(document);
    expect(music.playCalls).toBe(2);
  });

  it('re-asserts audibility before a gesture play', async () => {
    const music = createMockMusicPlayer();
    const effects = createMockEngine();
    render(<TestHarness deps={{ music, effects }} />);

    await act(async () => {
      music.rejectPlay(new DOMException('Autoplay blocked', 'NotAllowedError'));
      await Promise.resolve();
    });

    fireEvent.pointerDown(document);
    expect(music.audibilityCalls).toBe(1);
    expect(music.playCalls).toBe(2);

    await act(async () => {
      music.resolvePlay();
      await Promise.resolve();
    });

    expect(music.playCalls).toBe(2);
  });

  it('starts the music on a keyboard gesture', async () => {
    const music = createMockMusicPlayer();
    const effects = createMockEngine();
    render(<TestHarness deps={{ music, effects }} />);

    await act(async () => {
      music.rejectPlay(new DOMException('Autoplay blocked', 'NotAllowedError'));
      await Promise.resolve();
    });

    fireEvent.keyDown(document);
    expect(music.playCalls).toBe(2);

    await act(async () => {
      music.resolvePlay();
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
    // The explicit toggle calls play, and the global click listener also sees
    // the click as a gesture and tries to play.
    expect(music.playCalls).toBe(initialPlayCalls + 2);
  });

  it('toggles effects without changing the music state', () => {
    const music = createMockMusicPlayer();
    const effects = createMockEngine();
    render(<TestHarness deps={{ music, effects }} />);
    const playCallsBefore = music.playCalls;
    const pauseCallsBefore = music.pauseCalls;
    const enabledBefore = music.lastEnabled;

    fireEvent.click(getEffectsButton());
    expect(getEffectsButton()).toHaveTextContent('Effects Off');
    expect(effects.lastEffectsEnabled).toBe(false);
    // The global click listener treats the click as a gesture and attempts to
    // play, but it does not pause or change enabled state.
    expect(music.playCalls).toBe(playCallsBefore + 1);
    expect(music.pauseCalls).toBe(pauseCallsBefore);
    expect(music.lastEnabled).toBe(enabledBefore);

    fireEvent.click(getEffectsButton());
    expect(getEffectsButton()).toHaveTextContent('Effects On');
    expect(effects.lastEffectsEnabled).toBe(true);
  });

  it('does not read from localStorage on mount', () => {
    window.localStorage.setItem('lights-out:musicEnabled', 'false');
    window.localStorage.setItem('lights-out:effectsEnabled', 'false');

    const getItemSpy = vi.spyOn(window.localStorage, 'getItem');
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem');

    const music = createMockMusicPlayer();
    const effects = createMockEngine();
    render(<TestHarness deps={{ music, effects }} />);

    expect(getMusicButton()).toHaveTextContent('Music On');
    expect(getEffectsButton()).toHaveTextContent('Effects On');
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();

    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
  });

  it('does not write to localStorage when toggling music or effects', () => {
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem');

    const music = createMockMusicPlayer();
    const effects = createMockEngine();
    render(<TestHarness deps={{ music, effects }} />);

    fireEvent.click(getMusicButton());
    fireEvent.click(getEffectsButton());

    expect(setItemSpy).not.toHaveBeenCalled();

    setItemSpy.mockRestore();
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
