import { useCallback, useEffect, useRef, useState } from 'react';
import { createSoundEngine, type SoundEngine } from './engine.ts';

const STORAGE_KEY = 'lights-out:soundEnabled';

function readStoredSoundEnabled(): boolean {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === null || stored === 'true';
  } catch {
    // Storage may be disabled; the game continues with the default.
    return true;
  }
}

function writeStoredSoundEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // Storage may be disabled; the game continues without persistence.
  }
}

export type SoundControls = {
  readonly enabled: boolean;
  readonly toggle: () => void;
  readonly engine: SoundEngine;
};

export function useSound(injectedEngine?: SoundEngine): SoundControls {
  const engineRef = useRef<SoundEngine>(injectedEngine ?? createSoundEngine());
  const [enabled, setEnabled] = useState(readStoredSoundEnabled);
  const gestureStartedRef = useRef(false);

  const toggle = useCallback(() => {
    setEnabled((previous) => {
      const next = !previous;
      writeStoredSoundEnabled(next);

      const engine = engineRef.current;
      if (next) {
        void engine.start();
      } else {
        engine.stop();
      }

      return next;
    });
  }, []);

  useEffect(() => {
    if (!enabled || gestureStartedRef.current) {
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
  }, [enabled]);

  useEffect(() => {
    const engine = engineRef.current;
    return () => {
      engine.dispose();
    };
  }, []);

  return {
    enabled,
    toggle,
    engine: engineRef.current,
  };
}
