export type SoundEngine = {
  readonly isSupported: boolean;
  press(): void;
  dispose(): void;
  setEffectsEnabled(enabled: boolean): void;
};

type AudioContextFactory = () => AudioContext | undefined;

export const PRESS_PEAK_GAIN = 0.15;

function createWebAudioEngine(createContext: AudioContextFactory = getAudioContext): SoundEngine {
  let context: AudioContext | undefined;
  let effectsEnabled = true;

  function ensureContext(): AudioContext | undefined {
    if (context === undefined) {
      context = createContext();
    }
    return context;
  }

  return {
    isSupported: true,

    press() {
      if (!effectsEnabled) {
        return;
      }

      const activeContext = ensureContext();
      if (activeContext === undefined) {
        return;
      }

      if (activeContext.state === 'suspended') {
        void activeContext.resume();
      }

      const oscillator = activeContext.createOscillator();
      const gainNode = activeContext.createGain();

      const frequency = 523.25; // C5
      const duration = 0.08;

      oscillator.type = 'square';
      oscillator.frequency.value = frequency;

      const now = activeContext.currentTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(PRESS_PEAK_GAIN, now + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

      oscillator.connect(gainNode);
      gainNode.connect(activeContext.destination);

      oscillator.start(now);
      oscillator.stop(now + duration + 0.02);
    },

    dispose() {
      if (context !== undefined) {
        void context.close();
        context = undefined;
      }
    },

    setEffectsEnabled(enabled: boolean) {
      effectsEnabled = enabled;
    },
  };
}

function getAudioContext(): AudioContext | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const Constructor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (Constructor === undefined) {
    return undefined;
  }
  return new Constructor();
}

export const silentSoundEngine: SoundEngine = {
  isSupported: false,
  press: () => undefined,
  dispose: () => undefined,
  setEffectsEnabled: () => undefined,
};

export function createSoundEngine(): SoundEngine {
  if (typeof window === 'undefined' || window.AudioContext === undefined) {
    return silentSoundEngine;
  }
  return createWebAudioEngine();
}
