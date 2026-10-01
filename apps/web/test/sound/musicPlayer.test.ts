import { describe, expect, it } from 'vitest';
import {
  createMusicPlayer,
  handleMusicPlayRejection,
  MUSIC_VOLUME,
  silentMusicPlayer,
  type MusicPlayer,
} from '../../src/sound/musicPlayer';

function createFakeAudioElement(): HTMLAudioElement & {
  playCalls: number;
  pauseCalls: number;
  srcCleared: boolean;
  playRejections: unknown[];
  resolvePlay(): void;
  rejectPlay(error: unknown): void;
} {
  let playResolve: (() => void) | null = null;
  let playReject: ((error: unknown) => void) | null = null;

  const fake = {
    src: '',
    loop: false,
    preload: '',
    volume: 0,
    playCalls: 0,
    pauseCalls: 0,
    srcCleared: false,
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

    resolvePlay() {
      playResolve?.();
    },

    rejectPlay(error: unknown) {
      playReject?.(error);
    },
  };

  return fake as unknown as HTMLAudioElement & {
    playCalls: number;
    pauseCalls: number;
    srcCleared: boolean;
    playRejections: unknown[];
    resolvePlay(): void;
    rejectPlay(error: unknown): void;
  };
}

function createPlayer(): { player: MusicPlayer; fake: ReturnType<typeof createFakeAudioElement> } {
  const fake = createFakeAudioElement();
  const player = createMusicPlayer(() => fake);
  return { player, fake };
}

describe('musicPlayer', () => {
  it('configures the audio element with loop and volume', () => {
    const { fake } = createPlayer();
    expect(fake.loop).toBe(true);
    expect(fake.preload).toBe('auto');
    expect(fake.volume).toBe(MUSIC_VOLUME);
    expect(fake.src).not.toBe('');
  });

  it('plays the audio element', async () => {
    const { player, fake } = createPlayer();
    const playPromise = player.play();
    fake.resolvePlay();
    await playPromise;
    expect(fake.playCalls).toBe(1);
  });

  it('pauses the audio element', () => {
    const { player, fake } = createPlayer();
    player.pause();
    expect(fake.pauseCalls).toBe(1);
  });

  it('does not play when disabled', async () => {
    const { player, fake } = createPlayer();
    player.setEnabled(false);
    await player.play();
    expect(fake.playCalls).toBe(0);
  });

  it('pauses when disabled while playing', () => {
    const { player, fake } = createPlayer();
    void player.play();
    player.setEnabled(false);
    expect(fake.pauseCalls).toBe(1);
  });

  it('disposes by pausing and clearing the source', () => {
    const { player, fake } = createPlayer();
    void player.play();
    player.dispose();
    expect(fake.pauseCalls).toBe(1);
    expect(fake.src).toBe('');
  });

  it('silent player is a frozen no-op', async () => {
    expect(silentMusicPlayer.isSupported).toBe(false);
    await expect(silentMusicPlayer.play()).resolves.toBe(undefined);
    expect(silentMusicPlayer.pause()).toBe(undefined);
    expect(silentMusicPlayer.dispose()).toBe(undefined);
    expect(silentMusicPlayer.setEnabled(false)).toBe(undefined);
  });

  describe('handleMusicPlayRejection', () => {
    it('swallows a NotAllowedError autoplay refusal', () => {
      const error = new DOMException('Autoplay blocked', 'NotAllowedError');
      expect(() => handleMusicPlayRejection(error)).not.toThrow();
    });

    it('re-throws any other error', () => {
      const error = new Error('Network failure');
      expect(() => handleMusicPlayRejection(error)).toThrow(error);
    });
  });
});
