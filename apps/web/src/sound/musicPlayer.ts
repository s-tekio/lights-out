import musicUrl from '../assets/audio/neon-overdrive-cyberpunk-gaming-edm.mp3';

export type MusicPlayer = {
  readonly isSupported: boolean;
  play(): Promise<void>;
  pause(): void;
  dispose(): void;
  setEnabled(enabled: boolean): void;
  applyAudibility(): void;
};

// The file is loudness-normalised to -18 LUFS, which is a background-music
// target. A modest element volume keeps it clearly under the short, percussive
// press blip while still being audible on a phone speaker.
export const MUSIC_VOLUME = 0.25;

export function isNotAllowedError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotAllowedError';
}

function createAudioElement(): HTMLAudioElement {
  const audio = document.createElement('audio');
  audio.src = musicUrl;
  return audio;
}

export function createMusicPlayer(
  createElement: () => HTMLAudioElement = createAudioElement,
): MusicPlayer {
  if (typeof document === 'undefined') {
    return silentMusicPlayer;
  }

  let audio: HTMLAudioElement | undefined;
  let enabled = true;

  function ensureAudio(): HTMLAudioElement | undefined {
    if (audio === undefined) {
      audio = createElement();
      if (audio !== undefined) {
        if (audio.src === '') {
          audio.src = musicUrl;
        }
        audio.loop = true;
        audio.preload = 'auto';
        audio.volume = MUSIC_VOLUME;
      }
    }
    return audio;
  }

  // Create the element eagerly so the browser can begin loading before the
  // first play() call; this is important for the autoplay-on-mount attempt.
  ensureAudio();

  return {
    isSupported: true,

    play() {
      if (!enabled) {
        return Promise.resolve();
      }

      const activeAudio = ensureAudio();
      if (activeAudio === undefined) {
        return Promise.resolve();
      }

      const promise = activeAudio.play();
      // Defensive: very old browsers returned undefined. Modern browsers and
      // jsdom return a Promise, but the seam accepts either shape.
      if (promise === undefined) {
        return Promise.resolve();
      }
      return promise;
    },

    pause() {
      if (audio !== undefined) {
        audio.pause();
      }
    },

    dispose() {
      if (audio !== undefined) {
        audio.pause();
        audio.src = '';
        audio = undefined;
      }
    },

    setEnabled(isEnabled: boolean) {
      enabled = isEnabled;
      if (!enabled && audio !== undefined) {
        audio.pause();
      }
    },

    applyAudibility() {
      const activeAudio = ensureAudio();
      if (activeAudio !== undefined) {
        activeAudio.volume = MUSIC_VOLUME;
        activeAudio.muted = false;
      }
    },
  };
}

export const silentMusicPlayer: MusicPlayer = {
  isSupported: false,
  play: () => Promise.resolve(),
  pause: () => undefined,
  dispose: () => undefined,
  setEnabled: () => undefined,
  applyAudibility: () => undefined,
};

export function handleMusicPlayRejection(error: unknown): void {
  // Autoplay with sound is blocked by browsers until the user interacts with
  // the site. This is not a bug and cannot be coded around, so policy refusals
  // are swallowed here. A genuine load error is a different thing and should
  // propagate to the caller.
  if (isNotAllowedError(error)) {
    return;
  }
  throw error;
}
