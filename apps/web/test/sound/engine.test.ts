import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSoundEngine,
  PRESS_PEAK_GAIN,
  silentSoundEngine,
  type SoundEngine,
} from '../../src/sound/engine';

type FakeOscillator = {
  type: string;
  frequency: FakeAudioParam;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
};

type FakeGain = {
  gain: FakeAudioParam;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

type FakeAudioParam = {
  value: number;
  setValueAtTime: ReturnType<typeof vi.fn>;
  linearRampToValueAtTime: ReturnType<typeof vi.fn>;
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
};

function createFakeAudioParam(): FakeAudioParam {
  return {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
}

function createFakeAudioContext() {
  const oscillators: FakeOscillator[] = [];
  const gains: FakeGain[] = [];

  const context = {
    state: 'suspended',
    currentTime: 0,
    destination: { connect: vi.fn() } as unknown as AudioDestinationNode,
    sampleRate: 48000,

    resume: vi.fn().mockImplementation(function (this: typeof context) {
      this.state = 'running';
      return Promise.resolve();
    }),

    close: vi.fn().mockImplementation(function (this: typeof context) {
      this.state = 'closed';
      return Promise.resolve();
    }),

    createOscillator: vi.fn().mockImplementation(() => {
      const oscillator: FakeOscillator = {
        type: 'sine',
        frequency: createFakeAudioParam(),
        connect: vi.fn().mockReturnThis(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(oscillator);
      return oscillator;
    }),

    createGain: vi.fn().mockImplementation(() => {
      const gain: FakeGain = {
        gain: createFakeAudioParam(),
        connect: vi.fn().mockReturnThis(),
        disconnect: vi.fn(),
      };
      gains.push(gain);
      return gain;
    }),
  };

  return { context, oscillators, gains };
}

describe('engine', () => {
  let originalAudioContext: unknown;

  beforeEach(() => {
    vi.useFakeTimers();
    originalAudioContext = window.AudioContext;
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, 'AudioContext', {
      value: originalAudioContext,
      writable: true,
      configurable: true,
    });
  });

  it('returns a silent engine when AudioContext is unavailable', () => {
    Object.defineProperty(window, 'AudioContext', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const engine = createSoundEngine();
    expect(engine.isSupported).toBe(false);
    expect(engine.press()).toBe(undefined);
    expect(engine.dispose()).toBe(undefined);
    expect(engine.setEffectsEnabled(false)).toBe(undefined);
  });

  it('returns a supported engine when AudioContext is available', () => {
    const { context } = createFakeAudioContext();
    Object.defineProperty(window, 'AudioContext', {
      value: function () {
        return context;
      },
      writable: true,
      configurable: true,
    });

    const engine = createSoundEngine();
    expect(engine.isSupported).toBe(true);
  });

  describe('with a fake audio context', () => {
    let engine: SoundEngine;
    let fake: ReturnType<typeof createFakeAudioContext>;

    beforeEach(() => {
      fake = createFakeAudioContext();
      Object.defineProperty(window, 'AudioContext', {
        value: function () {
          return fake.context;
        },
        writable: true,
        configurable: true,
      });
      engine = createSoundEngine();
    });

    afterEach(() => {
      engine.dispose();
    });

    it('press creates a square oscillator with the same fixed frequency every time', () => {
      engine.press();

      const firstOscillator = fake.oscillators[fake.oscillators.length - 1];
      expect(firstOscillator).toBeDefined();
      if (firstOscillator === undefined) {
        throw new Error('Expected an oscillator to be created');
      }
      expect(firstOscillator.type).toBe('square');
      expect(firstOscillator.frequency.value).toBeGreaterThan(500);

      const firstFrequency = firstOscillator.frequency.value;

      engine.press();
      const secondOscillator = fake.oscillators[fake.oscillators.length - 1];
      expect(secondOscillator?.frequency.value).toBe(firstFrequency);
    });

    it('press gain peaks at the configured value', () => {
      engine.press();

      const gain = fake.gains[fake.gains.length - 1];
      expect(gain).toBeDefined();
      if (gain === undefined) {
        throw new Error('Expected a gain node to be created');
      }
      const peakCalls = gain.gain.linearRampToValueAtTime.mock.calls.filter(
        (call: unknown[]) => call[0] === PRESS_PEAK_GAIN,
      );
      expect(peakCalls.length).toBeGreaterThan(0);
    });

    it('dispose closes the context', () => {
      engine.press();
      engine.dispose();

      expect(fake.context.close).toHaveBeenCalledTimes(1);
    });

    it('skips press when effects are disabled', () => {
      engine.setEffectsEnabled(false);
      engine.press();
      expect(fake.context.createOscillator).not.toHaveBeenCalled();
    });

    it('re-enables press when effects are turned back on', () => {
      engine.setEffectsEnabled(false);
      engine.setEffectsEnabled(true);
      engine.press();
      expect(fake.context.createOscillator).toHaveBeenCalled();
    });
  });

  it('silent engine is a frozen no-op', () => {
    expect(silentSoundEngine.isSupported).toBe(false);
    expect(silentSoundEngine.press()).toBe(undefined);
    expect(silentSoundEngine.dispose()).toBe(undefined);
    expect(silentSoundEngine.setEffectsEnabled(false)).toBe(undefined);
  });
});
