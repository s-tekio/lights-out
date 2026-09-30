import { describe, expect, it } from 'vitest';
import {
  barSeconds,
  beatSeconds,
  buildLoopSchedule,
  LEAD_HOOK_SEQUENCE,
  LEAD_WAVE,
  MUSIC_GAIN_CEILING,
  noteToFrequency,
  TEMPO_BPM,
} from '../../src/sound/music';

describe('music', () => {
  it('maps every note name to a positive frequency', () => {
    const notes = ['C2', 'A2', 'C3', 'A3', 'C4', 'A4', 'C5', 'G5', 'A5', 'B5', 'C6', 'D6'] as const;
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

  it('uses a tempo around 172 bpm', () => {
    expect(TEMPO_BPM).toBe(172);
  });

  it('produces a deterministic schedule', () => {
    const first = buildLoopSchedule();
    const second = buildLoopSchedule();
    expect(first.duration).toBe(second.duration);
    expect(first.events).toEqual(second.events);
  });

  it('loops for sixteen bars', () => {
    const schedule = buildLoopSchedule();
    const bar = barSeconds(TEMPO_BPM);
    expect(schedule.duration).toBeCloseTo(bar * 16, 5);
  });

  it('contains bass notes on every bar', () => {
    const schedule = buildLoopSchedule();
    const bar = barSeconds(TEMPO_BPM);
    const barStarts = Array.from({ length: 16 }, (_, index) => index * bar);

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

    for (let barIndex = 0; barIndex < 16; barIndex += 1) {
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

    for (let barIndex = 0; barIndex < 16; barIndex += 1) {
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

    for (let barIndex = 0; barIndex < 16; barIndex += 1) {
      const hits = schedule.events.filter(
        (event) => event.wave === 'noise' && Math.abs(event.time - barIndex * bar) < 0.001,
      );
      expect(hits.length).toBe(1);
      expect(hits[0]?.duration).toBeLessThanOrEqual(0.05);
    }
  });

  it('adds a percussion hit on every beat', () => {
    const schedule = buildLoopSchedule();
    const bar = barSeconds(TEMPO_BPM);
    const beat = beatSeconds(TEMPO_BPM);

    for (let barIndex = 0; barIndex < 16; barIndex += 1) {
      const barOffset = barIndex * bar;
      for (let step = 0; step < 4; step += 1) {
        const hasPercussion = schedule.events.some(
          (event) =>
            event.wave === 'noise' && Math.abs(event.time - (barOffset + step * beat)) < 0.001,
        );
        expect(hasPercussion).toBe(true);
      }
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

  it('keeps every gain under the ceiling without raising the ceiling', () => {
    const schedule = buildLoopSchedule();
    expect(MUSIC_GAIN_CEILING).toBe(0.08);

    for (const event of schedule.events) {
      expect(event.gain).toBeGreaterThan(0);
      expect(event.gain).toBeLessThanOrEqual(MUSIC_GAIN_CEILING);
    }

    const leadGains = schedule.events
      .filter((event) => event.wave === LEAD_WAVE)
      .map((event) => event.gain);
    const accompanimentGains = schedule.events
      .filter((event) => event.wave === 'triangle' || event.wave === 'square')
      .map((event) => event.gain);

    expect(leadGains.length).toBeGreaterThan(0);
    expect(accompanimentGains.length).toBeGreaterThan(0);
    expect(Math.min(...leadGains)).toBeGreaterThan(Math.max(...accompanimentGains));
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

  it('plays the lead monophonically', () => {
    const schedule = buildLoopSchedule();
    const lead = schedule.events
      .filter((event) => event.wave === LEAD_WAVE)
      .sort((left, right) => left.time - right.time);

    expect(lead.length).toBeGreaterThan(0);

    for (let index = 1; index < lead.length; index += 1) {
      const previous = lead[index - 1];
      const current = lead[index];
      if (previous === undefined || current === undefined) {
        throw new Error('Expected lead events to be defined');
      }
      expect(previous.time + previous.duration).toBeLessThanOrEqual(current.time + 0.0001);
    }
  });

  it('places the lead above the accompaniment', () => {
    const schedule = buildLoopSchedule();
    const leadFrequencies = schedule.events
      .filter((event) => event.wave === LEAD_WAVE)
      .map((event) => event.frequency);
    const bassFrequencies = schedule.events
      .filter((event) => event.wave === 'triangle')
      .map((event) => event.frequency);
    const arpeggioFrequencies = schedule.events
      .filter((event) => event.wave === 'square')
      .map((event) => event.frequency);

    expect(leadFrequencies.length).toBeGreaterThan(0);
    expect(bassFrequencies.length).toBeGreaterThan(0);
    expect(arpeggioFrequencies.length).toBeGreaterThan(0);

    const minLead = Math.min(...leadFrequencies);
    expect(minLead).toBeGreaterThan(Math.max(...bassFrequencies));
    expect(minLead).toBeGreaterThan(Math.max(...arpeggioFrequencies));
  });

  it('repeats the lead hook motif at different points', () => {
    const schedule = buildLoopSchedule();
    const lead = schedule.events
      .filter((event) => event.wave === LEAD_WAVE)
      .sort((left, right) => left.time - right.time);
    const hookFrequencies = LEAD_HOOK_SEQUENCE.map((note) => noteToFrequency(note));

    let occurrences = 0;
    for (let index = 0; index <= lead.length - hookFrequencies.length; index += 1) {
      const matches = hookFrequencies.every((frequency, offset) => {
        const event = lead[index + offset];
        return event !== undefined && Math.abs(event.frequency - frequency) < 0.001;
      });
      if (matches) {
        occurrences += 1;
      }
    }

    expect(occurrences).toBeGreaterThanOrEqual(2);
  });
});
