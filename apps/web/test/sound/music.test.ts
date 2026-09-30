import { describe, expect, it } from 'vitest';
import {
  barSeconds,
  beatSeconds,
  buildLoopSchedule,
  MUSIC_GAIN_CEILING,
  noteToFrequency,
  TEMPO_BPM,
} from '../../src/sound/music';

describe('music', () => {
  it('maps every note name to a positive frequency', () => {
    const notes = ['C2', 'A2', 'C3', 'A3', 'C4', 'A4', 'C5', 'G5'] as const;
    for (const note of notes) {
      const frequency = noteToFrequency(note);
      expect(frequency).toBeGreaterThan(0);
      expect(Number.isFinite(frequency)).toBe(true);
    }
  });

  it('places A4 at 440 Hz', () => {
    expect(noteToFrequency('A4')).toBeCloseTo(440, 5);
  });

  it('computes beat and bar length from tempo', () => {
    expect(beatSeconds(TEMPO_BPM)).toBeCloseTo(60 / TEMPO_BPM, 5);
    expect(barSeconds(TEMPO_BPM)).toBeCloseTo((60 / TEMPO_BPM) * 4, 5);
  });

  it('produces a deterministic schedule', () => {
    const first = buildLoopSchedule();
    const second = buildLoopSchedule();
    expect(first.duration).toBe(second.duration);
    expect(first.events).toEqual(second.events);
  });

  it('covers whole bars', () => {
    const schedule = buildLoopSchedule();
    const bar = barSeconds(TEMPO_BPM);
    expect(schedule.duration).toBeCloseTo(bar * 8, 5);
  });

  it('contains bass notes on every bar', () => {
    const schedule = buildLoopSchedule();
    const bar = barSeconds(TEMPO_BPM);
    const barStarts = [0, bar, bar * 2, bar * 3, bar * 4, bar * 5, bar * 6, bar * 7];

    for (const start of barStarts) {
      const hasBassOnBar = schedule.events.some(
        (event) => event.wave === 'triangle' && Math.abs(event.time - start) < 0.001,
      );
      expect(hasBassOnBar).toBe(true);
    }
  });

  it('drives the bass with quarter notes and octave jumps', () => {
    const schedule = buildLoopSchedule();
    const bar = barSeconds(TEMPO_BPM);
    const beat = beatSeconds(TEMPO_BPM);

    for (let barIndex = 0; barIndex < 8; barIndex += 1) {
      const barOffset = barIndex * bar;
      const bassTimes = [0, beat, 2 * beat, 3 * beat].map((offset) => barOffset + offset);
      for (const time of bassTimes) {
        const hasBassAtTime = schedule.events.some(
          (event) => event.wave === 'triangle' && Math.abs(event.time - time) < 0.001,
        );
        expect(hasBassAtTime).toBe(true);
      }
    }
  });

  it('runs a busy sixteenth-note arpeggio', () => {
    const schedule = buildLoopSchedule();
    const bar = barSeconds(TEMPO_BPM);
    const sixteenth = beatSeconds(TEMPO_BPM) / 4;

    for (let barIndex = 0; barIndex < 8; barIndex += 1) {
      const barOffset = barIndex * bar;
      let arpeggioCount = 0;
      for (let step = 0; step < 16; step += 1) {
        const time = barOffset + step * sixteenth;
        const hasArpeggioAtTime = schedule.events.some(
          (event) => event.wave === 'square' && Math.abs(event.time - time) < 0.001,
        );
        if (hasArpeggioAtTime) {
          arpeggioCount += 1;
        }
      }
      expect(arpeggioCount).toBe(16);
    }
  });

  it('adds a short percussion hit on every downbeat', () => {
    const schedule = buildLoopSchedule();
    const bar = barSeconds(TEMPO_BPM);

    for (let barIndex = 0; barIndex < 8; barIndex += 1) {
      const hits = schedule.events.filter(
        (event) => event.wave === 'noise' && Math.abs(event.time - barIndex * bar) < 0.001,
      );
      expect(hits.length).toBe(1);
      expect(hits[0]?.duration).toBeLessThanOrEqual(0.05);
    }
  });

  it('every event has a sane frequency and duration', () => {
    const schedule = buildLoopSchedule();
    expect(schedule.events.length).toBeGreaterThan(0);

    for (const event of schedule.events) {
      expect(Number.isFinite(event.frequency)).toBe(true);
      expect(event.frequency).toBeGreaterThanOrEqual(0);
      expect(event.duration).toBeGreaterThan(0);
      expect(event.duration).toBeLessThanOrEqual(schedule.duration);
    }
  });

  it('keeps every gain under the ceiling', () => {
    const schedule = buildLoopSchedule();
    for (const event of schedule.events) {
      expect(event.gain).toBeGreaterThan(0);
      expect(event.gain).toBeLessThanOrEqual(MUSIC_GAIN_CEILING);
    }
  });

  it('orders events by time', () => {
    const schedule = buildLoopSchedule();
    for (let index = 1; index < schedule.events.length; index += 1) {
      const previous = schedule.events[index - 1];
      const current = schedule.events[index];
      if (previous === undefined || current === undefined) {
        throw new Error('Expected schedule events to be defined');
      }
      expect(previous.time).toBeLessThanOrEqual(current.time);
    }
  });
});
