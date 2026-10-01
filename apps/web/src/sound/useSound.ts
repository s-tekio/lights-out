import { useCallback, useEffect, useRef, useState } from 'react';
import { createSoundEngine, type SoundEngine } from './engine.ts';
import {
  createMusicPlayer,
  handleMusicPlayRejection,
  silentMusicPlayer,
  type MusicPlayer,
} from './musicPlayer.ts';

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

export type SoundDependencies = {
  readonly music?: MusicPlayer;
  readonly effects?: SoundEngine;
};

export function useSound(deps: SoundDependencies = {}): SoundControls {
  const musicRef = useRef<MusicPlayer>(deps.music ?? createMusicPlayer());
  const effectsRef = useRef<SoundEngine>(deps.effects ?? createSoundEngine());
  const [musicEnabled, setMusicEnabled] = useState(() => readStoredFlag(MUSIC_STORAGE_KEY));
  const [effectsEnabled, setEffectsEnabled] = useState(() => readStoredFlag(EFFECTS_STORAGE_KEY));
  const gestureStartedRef = useRef(false);
  const autoplayAttemptedRef = useRef(false);

  const toggleMusic = useCallback(() => {
    setMusicEnabled((previous) => {
      const next = !previous;
      writeStoredFlag(MUSIC_STORAGE_KEY, next);

      const music = musicRef.current;
      music.setEnabled(next);
      if (next) {
        void music.play().catch(handleMusicPlayRejection);
      } else {
        music.pause();
      }

      return next;
    });
  }, []);

  const toggleEffects = useCallback(() => {
    setEffectsEnabled((previous) => {
      const next = !previous;
      writeStoredFlag(EFFECTS_STORAGE_KEY, next);
      effectsRef.current.setEffectsEnabled(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!musicEnabled || autoplayAttemptedRef.current) {
      return;
    }
    autoplayAttemptedRef.current = true;

    // Browsers block autoplay with sound until the user has interacted with the
    // site, so this attempt will often reject. It is still worth trying because
    // a repeat visit may be allowed, and the gesture fallback costs nothing.
    void musicRef.current.play().catch(handleMusicPlayRejection);
  }, [musicEnabled]);

  useEffect(() => {
    if (!musicEnabled || gestureStartedRef.current) {
      return undefined;
    }

    const startOnGesture = () => {
      if (gestureStartedRef.current) {
        return;
      }
      gestureStartedRef.current = true;
      void musicRef.current.play().catch(handleMusicPlayRejection);
    };

    window.addEventListener('pointerdown', startOnGesture, { once: true });
    window.addEventListener('keydown', startOnGesture, { once: true });

    return () => {
      window.removeEventListener('pointerdown', startOnGesture);
      window.removeEventListener('keydown', startOnGesture);
    };
  }, [musicEnabled]);

  useEffect(() => {
    const music = musicRef.current;
    const effects = effectsRef.current;
    return () => {
      music.dispose();
      effects.dispose();
    };
  }, []);

  return {
    musicEnabled,
    effectsEnabled,
    toggleMusic,
    toggleEffects,
    engine: effectsRef.current,
  };
}

export { silentMusicPlayer };
