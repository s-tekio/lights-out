import { describe, expect, it } from 'vitest';
import {
  ARPEGGIO_DUTY_CYCLE,
  barSeconds,
  beatSeconds,
  buildLoopSchedule,
  DUTY_CYCLES,
  ENVELOPE,
  HI_HAT_DURATION,
  HI_HAT_GAIN,
  LEAD_DUTY_CYCLE,
  LEAD_HOOK_SEQUENCE,
  LEAD_WAVE,
  MUSIC_GAIN_CEILING,
  noteToFrequency,
  PITCH_STEPS_PER_OCTAVE,
  PULSE_HARMONICS,
  pulseWaveCoefficients,
  quantizeFrequency,
  SNARE_DURATION,
  SNARE_GAIN,
  TEMPO_BPM,
  vibratoStepCents,
  VIBRATO_CENTS,
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

  it('runs a busy sixteenth-note arpeggio on a pulse wave', () => {
    const schedule = buildLoopSchedule();
    const bar = barSeconds(TEMPO_BPM);
    const sixteenth = beatSeconds(TEMPO_BPM) / 4;

    for (let barIndex = 0; barIndex < 16; barIndex += 1) {
      const barOffset = barIndex * bar;
      let arpeggioCount = 0;
      for (let step = 0; step < 16; step += 1) {
        const time = barOffset + step * sixteenth;
        const hasArpeggioAtTime = schedule.events.some(
          (event) => event.wave === 'pulse' && Math.abs(event.time - time) < 0.001,
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
      .filter((event) => event.wave === LEAD_WAVE && event.dutyCycle === LEAD_DUTY_CYCLE)
      .map((event) => event.gain);
    const accompanimentGains = schedule.events
      .filter(
        (event) =>
          event.wave === 'triangle' ||
          (event.wave === 'pulse' && event.dutyCycle !== LEAD_DUTY_CYCLE),
      )
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
      .filter((event) => event.wave === LEAD_WAVE && event.dutyCycle === LEAD_DUTY_CYCLE)
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
      .filter((event) => event.wave === LEAD_WAVE && event.dutyCycle === LEAD_DUTY_CYCLE)
      .map((event) => event.frequency);
    const bassFrequencies = schedule.events
      .filter((event) => event.wave === 'triangle')
      .map((event) => event.frequency);
    const arpeggioFrequencies = schedule.events
      .filter((event) => event.wave === 'pulse' && event.dutyCycle === ARPEGGIO_DUTY_CYCLE)
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
      .filter((event) => event.wave === LEAD_WAVE && event.dutyCycle === LEAD_DUTY_CYCLE)
      .sort((left, right) => left.time - right.time);
    const hookFrequencies = LEAD_HOOK_SEQUENCE.map((note) => noteToFrequency(note));

    // Vibrato slices each written note into several events, so only the first
    // event of each written note (the onset) carries the motif frequency.
    const onsets = lead.filter((event, index) => {
      if (index === 0) {
        return true;
      }
      const previous = lead[index - 1];
      return previous !== undefined && event.time > previous.time + previous.duration + 0.0001;
    });
    const onsetFrequencies = onsets.map((event) => event.frequency);

    let occurrences = 0;
    for (let index = 0; index <= onsetFrequencies.length - hookFrequencies.length; index += 1) {
      const matches = hookFrequencies.every((frequency, offset) => {
        const value = onsetFrequencies[index + offset];
        return value !== undefined && Math.abs(value - frequency) < 0.001;
      });
      if (matches) {
        occurrences += 1;
      }
    }

    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it('quantises every scheduled frequency to the coarse table', () => {
    const schedule = buildLoopSchedule();

    for (const event of schedule.events) {
      if (event.wave === 'noise') {
        continue;
      }
      const ideal = event.frequency;
      const requantised = quantizeFrequency(ideal);
      expect(requantised).toBe(ideal);
    }
  });

  it('keeps pitch quantisation within a small bounded deviation', () => {
    const notes = ['C2', 'A2', 'C3', 'A3', 'C4', 'A4', 'C5', 'G5', 'A5', 'B5', 'C6', 'D6'] as const;
    const maxCents = 1200 / PITCH_STEPS_PER_OCTAVE / 2;

    for (const note of notes) {
      const ideal = 440 * 2 ** (NOTE_OFFSETS[note] / 12);
      const quantised = noteToFrequency(note);
      const ratio = quantised / ideal;
      const cents = Math.abs(Math.log2(ratio) * 1200);
      expect(cents).toBeLessThanOrEqual(maxCents + 0.001);
    }
  });

  it('makes quantised pitch deterministic', () => {
    expect(noteToFrequency('G5')).toBe(noteToFrequency('G5'));
    expect(noteToFrequency('D6')).toBe(noteToFrequency('D6'));
  });

  it('produces recognisably different coefficient sets for each duty cycle', () => {
    const sets = DUTY_CYCLES.map((duty) => pulseWaveCoefficients(duty));

    for (const set of sets) {
      expect(set.real.length).toBe(PULSE_HARMONICS + 1);
      expect(set.imag.length).toBe(PULSE_HARMONICS + 1);
      expect(set.real[0]).toBeDefined();
    }

    for (let index = 1; index < DUTY_CYCLES.length; index += 1) {
      const previous = sets[index - 1];
      const current = sets[index];
      if (previous === undefined || current === undefined) {
        throw new Error('Expected coefficient sets to be defined');
      }
      let differences = 0;
      for (let harmonic = 1; harmonic <= PULSE_HARMONICS; harmonic += 1) {
        const previousValue = previous.real[harmonic];
        const currentValue = current.real[harmonic];
        if (
          previousValue !== undefined &&
          currentValue !== undefined &&
          Math.abs(previousValue - currentValue) > 0.0001
        ) {
          differences += 1;
        }
      }
      expect(differences).toBeGreaterThan(0);
    }
  });

  it('keeps pulse coefficient output stable for the same duty cycle', () => {
    const first = pulseWaveCoefficients(0.25);
    const second = pulseWaveCoefficients(0.25);

    for (let index = 0; index <= PULSE_HARMONICS; index += 1) {
      const firstReal = first.real[index];
      const secondReal = second.real[index];
      const firstImag = first.imag[index];
      const secondImag = second.imag[index];
      expect(firstReal).toBe(secondReal);
      expect(firstImag).toBe(secondImag);
    }
  });

  it('schedules the lead and arpeggio with different duty cycles', () => {
    const schedule = buildLoopSchedule();
    const leadDuties = new Set(
      schedule.events
        .filter((event) => event.wave === LEAD_WAVE && event.dutyCycle === LEAD_DUTY_CYCLE)
        .map((event) => event.dutyCycle),
    );
    const arpeggioDuties = new Set(
      schedule.events
        .filter((event) => event.wave === 'pulse' && event.dutyCycle === ARPEGGIO_DUTY_CYCLE)
        .map((event) => event.dutyCycle),
    );

    expect(leadDuties.size).toBe(1);
    expect(leadDuties.has(LEAD_DUTY_CYCLE)).toBe(true);
    expect(arpeggioDuties.size).toBe(1);
    expect(arpeggioDuties.has(ARPEGGIO_DUTY_CYCLE)).toBe(true);
    expect(LEAD_DUTY_CYCLE).not.toBe(ARPEGGIO_DUTY_CYCLE);
  });

  it('uses short hard envelopes with no sustain curve', () => {
    expect(ENVELOPE.attack).toBeLessThanOrEqual(0.005);
    expect(ENVELOPE.release).toBeLessThanOrEqual(0.01);
  });

  it('steps vibrato through discrete cents values', () => {
    const values = Array.from({ length: 8 }, (_, index) => vibratoStepCents(index));
    const unique = new Set(values);
    expect(unique.size).toBeGreaterThan(1);
    expect(Math.max(...values)).toBe(VIBRATO_CENTS);
    expect(Math.min(...values)).toBe(-VIBRATO_CENTS);
  });

  it('splits held lead notes into discrete vibrato events instead of one smooth note', () => {
    const schedule = buildLoopSchedule();
    const lead = schedule.events
      .filter((event) => event.wave === LEAD_WAVE && event.dutyCycle === LEAD_DUTY_CYCLE)
      .sort((left, right) => left.time - right.time);

    // Walk contiguous lead runs; a held note becomes several events with
    // no gap between them, each at a possibly different quantized pitch.
    const beat = beatSeconds(TEMPO_BPM);
    let foundStepped = false;
    let groupStart = 0;

    while (groupStart < lead.length) {
      let groupEnd = groupStart;
      while (groupEnd + 1 < lead.length) {
        const current = lead[groupEnd];
        const next = lead[groupEnd + 1];
        if (
          current === undefined ||
          next === undefined ||
          Math.abs(next.time - (current.time + current.duration)) >= 0.0001
        ) {
          break;
        }
        groupEnd += 1;
      }

      const first = lead[groupStart];
      const last = lead[groupEnd];
      if (first !== undefined && last !== undefined) {
        const span = last.time + last.duration - first.time;
        if (span >= beat) {
          const group = lead.slice(groupStart, groupEnd + 1);
          const frequencies = new Set(group.map((event) => event.frequency));
          if (group.length >= 2 && frequencies.size >= 2) {
            foundStepped = true;
            break;
          }
        }
      }

      groupStart = groupEnd + 1;
    }

    expect(foundStepped).toBe(true);
  });

  it('uses two distinct percussion envelopes', () => {
    const schedule = buildLoopSchedule();
    const noise = schedule.events.filter((event) => event.wave === 'noise');
    const envelopes = new Set(noise.map((event) => `${event.duration.toFixed(6)},${event.gain}`));

    expect(noise.length).toBeGreaterThan(0);
    expect(envelopes.size).toBe(2);

    const snare = noise.find((event) => event.duration === SNARE_DURATION);
    const hiHat = noise.find((event) => event.duration === HI_HAT_DURATION);

    expect(snare).toBeDefined();
    expect(hiHat).toBeDefined();
    expect(SNARE_DURATION).toBeGreaterThan(HI_HAT_DURATION);
    expect(SNARE_GAIN).toBeLessThan(HI_HAT_GAIN);
  });
});

// Helper used by the quantisation deviation test: raw equal-temperament offsets.
const NOTE_OFFSETS: Record<
  'C2' | 'D2' | 'A2' | 'C3' | 'A3' | 'C4' | 'A4' | 'C5' | 'G5' | 'A5' | 'B5' | 'C6' | 'D6',
  number
> = {
  C2: -33,
  D2: -31,
  A2: -24,
  C3: -21,
  A3: -12,
  C4: -9,
  A4: 0,
  C5: 3,
  G5: 10,
  A5: 12,
  B5: 14,
  C6: 15,
  D6: 17,
};
