import { buildLoopSchedule, ENVELOPE, type LoopSchedule, type ScheduleEvent } from './music.ts';

export type SoundEngine = {
  readonly isSupported: boolean;
  start(): void;
  stop(): void;
  press(): void;
  dispose(): void;
  setMusicEnabled(enabled: boolean): void;
  setEffectsEnabled(enabled: boolean): void;
};

type AudioContextFactory = () => AudioContext | undefined;

export const PRESS_PEAK_GAIN = 0.15;

const SCHEDULER_INTERVAL_MS = 25;
const SCHEDULER_LOOKAHEAD_SECONDS = 0.1;

function applyEnvelope(
  gainNode: GainNode,
  peakGain: number,
  startTime: number,
  duration: number,
): void {
  const attack = ENVELOPE.attack;
  const release = Math.min(ENVELOPE.release, duration / 2);
  const sustainLevel = peakGain * 0.7;
  const releaseStart = startTime + duration - release;

  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(sustainLevel, startTime + attack);
  gainNode.gain.setValueAtTime(sustainLevel, releaseStart);
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
}

function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const sampleRate = context.sampleRate;
  const length = Math.ceil(sampleRate * 0.05);
  const buffer = context.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  return buffer;
}

function playNote(context: AudioContext, event: ScheduleEvent): void {
  const gainNode = context.createGain();

  applyEnvelope(gainNode, event.gain, event.time, event.duration);

  if (event.wave === 'noise') {
    const source = context.createBufferSource();
    source.buffer = createNoiseBuffer(context);
    source.connect(gainNode);
    gainNode.connect(context.destination);
    source.start(event.time);
    source.stop(event.time + event.duration + 0.02);
    return;
  }

  const oscillator = context.createOscillator();

  oscillator.type = event.wave;
  oscillator.frequency.value = event.frequency;

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(event.time);
  oscillator.stop(event.time + event.duration + 0.05);
}

function createWebAudioEngine(createContext: AudioContextFactory = getAudioContext): SoundEngine {
  let context: AudioContext | undefined;
  let schedule: LoopSchedule | undefined;
  let loopStartTime = 0;
  let nextEventIndex = 0;
  let schedulerId: ReturnType<typeof setInterval> | undefined;
  let isRunning = false;
  let musicEnabled = true;
  let effectsEnabled = true;

  function ensureContext(): AudioContext | undefined {
    if (context === undefined) {
      context = createContext();
    }
    return context;
  }

  function scheduleUpcomingNotes(): void {
    const activeContext = context;
    const activeSchedule = schedule;
    if (activeContext === undefined || activeSchedule === undefined || !isRunning) {
      return;
    }

    const horizon = activeContext.currentTime + SCHEDULER_LOOKAHEAD_SECONDS;

    while (nextEventIndex < activeSchedule.events.length) {
      const event = activeSchedule.events[nextEventIndex];
      if (event === undefined) {
        nextEventIndex += 1;
        continue;
      }

      const eventTime = loopStartTime + event.time;
      if (eventTime >= horizon) {
        break;
      }

      playNote(activeContext, { ...event, time: eventTime });
      nextEventIndex += 1;

      if (nextEventIndex >= activeSchedule.events.length) {
        loopStartTime += activeSchedule.duration;
        nextEventIndex = 0;
      }
    }
  }

  return {
    isSupported: true,

    start() {
      if (!musicEnabled) {
        return;
      }

      const activeContext = ensureContext();
      if (activeContext === undefined) {
        return;
      }

      if (schedule === undefined) {
        schedule = buildLoopSchedule();
      }

      if (activeContext.state === 'suspended') {
        void activeContext.resume();
      }

      if (!isRunning) {
        isRunning = true;
        // Begin the loop slightly ahead of the current clock so the first
        // scheduler tick has notes to dispatch immediately.
        loopStartTime = activeContext.currentTime + 0.05;
        nextEventIndex = 0;
        schedulerId = setInterval(scheduleUpcomingNotes, SCHEDULER_INTERVAL_MS);
      }
    },

    stop() {
      isRunning = false;
      if (schedulerId !== undefined) {
        clearInterval(schedulerId);
        schedulerId = undefined;
      }
      if (context !== undefined && context.state === 'running') {
        void context.suspend();
      }
    },

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
      isRunning = false;
      if (schedulerId !== undefined) {
        clearInterval(schedulerId);
        schedulerId = undefined;
      }
      if (context !== undefined) {
        void context.close();
        context = undefined;
      }
      schedule = undefined;
    },

    setMusicEnabled(enabled: boolean) {
      musicEnabled = enabled;
      if (!enabled && isRunning) {
        this.stop();
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
  start: () => undefined,
  stop: () => undefined,
  press: () => undefined,
  dispose: () => undefined,
  setMusicEnabled: () => undefined,
  setEffectsEnabled: () => undefined,
};

export function createSoundEngine(): SoundEngine {
  if (typeof window === 'undefined' || window.AudioContext === undefined) {
    return silentSoundEngine;
  }
  return createWebAudioEngine();
}
