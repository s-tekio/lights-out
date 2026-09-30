import { useCallback, useEffect, useRef, useState } from 'react';
import { createSoundEngine, type SoundEngine } from './engine.ts';

const MUSIC_STORAGE_KEY = 'lights-out:musicEnabled';
const EFFECTS_STORAGE_KEY = 'lights-out:effectsEnabled';

function readStoredFlag(key: string): boolean {
  try {
    const stored = window.localStorage.getItem(key);
    return stored === null || stored === 'true';
  } catch {
    // Storage may be disabled; the game continues with the default.
    return true;
  }
}

function writeStoredFlag(key: string, enabled: boolean): void {
  try {
    window.localStorage.setItem(key, String(enabled));
  } catch {
    // Storage may be disabled; the game continues without persistence.
  }
}

export type SoundControls = {
  readonly musicEnabled: boolean;
  readonly effectsEnabled: boolean;
  readonly toggleMusic: () => void;
  readonly toggleEffects: () => void;
  readonly engine: SoundEngine;
};

export function useSound(injectedEngine?: SoundEngine): SoundControls {
  const engineRef = useRef<SoundEngine>(injectedEngine ?? createSoundEngine());
  const [musicEnabled, setMusicEnabled] = useState(() => readStoredFlag(MUSIC_STORAGE_KEY));
  const [effectsEnabled, setEffectsEnabled] = useState(() => readStoredFlag(EFFECTS_STORAGE_KEY));
  const gestureStartedRef = useRef(false);

  const toggleMusic = useCallback(() => {
    setMusicEnabled((previous) => {
      const next = !previous;
      writeStoredFlag(MUSIC_STORAGE_KEY, next);

      const engine = engineRef.current;
      engine.setMusicEnabled(next);
      if (next) {
        void engine.start();
      } else {
        engine.stop();
      }

      return next;
    });
  }, []);

  const toggleEffects = useCallback(() => {
    setEffectsEnabled((previous) => {
      const next = !previous;
      writeStoredFlag(EFFECTS_STORAGE_KEY, next);
      engineRef.current.setEffectsEnabled(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!musicEnabled || gestureStartedRef.current) {
      return undefined;
    }

    const startOnGesture = () => {
      if (gestureStartedRef.current) {
        return;
      }
      gestureStartedRef.current = true;
      void engineRef.current.start();
    };

    window.addEventListener('pointerdown', startOnGesture, { once: true });
    window.addEventListener('keydown', startOnGesture, { once: true });

    return () => {
      window.removeEventListener('pointerdown', startOnGesture);
      window.removeEventListener('keydown', startOnGesture);
    };
  }, [musicEnabled]);

  useEffect(() => {
    const engine = engineRef.current;
    return () => {
      engine.dispose();
    };
  }, []);

  return {
    musicEnabled,
    effectsEnabled,
    toggleMusic,
    toggleEffects,
    engine: engineRef.current,
  };
}
