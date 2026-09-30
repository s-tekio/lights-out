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

    resume: vi.fn().mockImplementation(function (this: typeof context) {
      this.state = 'running';
      return Promise.resolve();
    }),

    suspend: vi.fn().mockImplementation(function (this: typeof context) {
      this.state = 'suspended';
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
    expect(engine.start()).toBe(undefined);
    expect(engine.stop()).toBe(undefined);
    expect(engine.press(0)).toBe(undefined);
    expect(engine.dispose()).toBe(undefined);
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

    it('resumes the context and starts scheduling on start', async () => {
      engine.start();
      expect(fake.context.resume).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(50);
      expect(fake.context.createOscillator).toHaveBeenCalled();
      expect(fake.context.createGain).toHaveBeenCalled();
    });

    it('does not play notes until started', async () => {
      await vi.advanceTimersByTimeAsync(100);
      expect(fake.context.createOscillator).not.toHaveBeenCalled();
    });

    it('stops scheduling and suspends the context on stop', async () => {
      engine.start();
      await vi.advanceTimersByTimeAsync(50);
      expect(fake.context.createOscillator).toHaveBeenCalled();

      const callsBeforeStop = fake.context.createOscillator.mock.calls.length;
      engine.stop();

      await vi.advanceTimersByTimeAsync(200);
      expect(fake.context.suspend).toHaveBeenCalledTimes(1);
      expect(fake.context.createOscillator.mock.calls.length).toBe(callsBeforeStop);
    });

    it('press creates a square oscillator with a stepped frequency', () => {
      engine.start();
      engine.press(3);

      const oscillator = fake.oscillators[fake.oscillators.length - 1];
      expect(oscillator).toBeDefined();
      if (oscillator === undefined) {
        throw new Error('Expected an oscillator to be created');
      }
      expect(oscillator.type).toBe('square');
      expect(oscillator.frequency.value).toBeGreaterThan(500);
    });

    it('press gain peaks at the configured value', () => {
      engine.start();
      engine.press(0);

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

    it('dispose closes the context and stops scheduling', async () => {
      engine.start();
      await vi.advanceTimersByTimeAsync(50);
      engine.dispose();

      expect(fake.context.close).toHaveBeenCalledTimes(1);
      const callsAfterDispose = fake.context.createOscillator.mock.calls.length;
      await vi.advanceTimersByTimeAsync(200);
      expect(fake.context.createOscillator.mock.calls.length).toBe(callsAfterDispose);
    });
  });

  it('silent engine is a frozen no-op', () => {
    expect(silentSoundEngine.isSupported).toBe(false);
    expect(silentSoundEngine.start()).toBe(undefined);
    expect(silentSoundEngine.stop()).toBe(undefined);
    expect(silentSoundEngine.press(0)).toBe(undefined);
    expect(silentSoundEngine.dispose()).toBe(undefined);
  });
});
