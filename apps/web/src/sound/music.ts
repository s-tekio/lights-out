export type NoteName =
  | 'C2'
  | 'D2'
  | 'E2'
  | 'F2'
  | 'G2'
  | 'A2'
  | 'B2'
  | 'C3'
  | 'D3'
  | 'E3'
  | 'F3'
  | 'G3'
  | 'A3'
  | 'B3'
  | 'C4'
  | 'D4'
  | 'E4'
  | 'F4'
  | 'G4'
  | 'A4'
  | 'B4'
  | 'C5'
  | 'D5'
  | 'E5'
  | 'F5'
  | 'G5'
  | 'A5'
  | 'B5'
  | 'C6'
  | 'D6';

// The arcade chips had pulse channels with selectable duty cycles, not a
// fixed 50 % square. We model the lead and arpeggio as pulse waves and keep
// the triangle bass as the chip's dedicated bass voice.
export const DUTY_CYCLES = [0.125, 0.25, 0.5] as const;
export type DutyCycle = (typeof DUTY_CYCLES)[number];

export type WaveShape = 'triangle' | 'pulse' | 'noise';

export type MusicNote = {
  readonly frequency: number;
  readonly duration: number;
  readonly gain: number;
  readonly wave: WaveShape;
  readonly dutyCycle: DutyCycle | null;
};

export type ScheduleEvent = MusicNote & {
  readonly time: number;
};

export type LoopSchedule = {
  readonly events: readonly ScheduleEvent[];
  readonly duration: number;
};

export const TEMPO_BPM = 172;

// A controlled ceiling so the music sits below the press sound.
// The press sound peaks at PRESS_PEAK_GAIN; music stays under half of it.
export const MUSIC_GAIN_CEILING = 0.08;

// Voice levels: the lead must sit above the accompaniment, so the
// accompaniment is lowered instead of raising the ceiling.
export const BASS_GAIN = 0.028;
export const ARPEGGIO_GAIN = 0.022;
export const LEAD_GAIN = 0.055;

// Percussion is now two noise envelopes: a very short hi-hat and a slightly
// longer, quieter snare, instead of a single hit shape for every beat.
export const HI_HAT_GAIN = 0.012;
export const HI_HAT_DURATION = 0.015;
export const SNARE_GAIN = 0.008;
export const SNARE_DURATION = 0.04;

// A chip has no swell and no reverb: a note starts and stops. The attack and
// release are only long enough to prevent an audible click.
const ATTACK_SECONDS = 0.003;
const RELEASE_SECONDS = 0.005;

export const ENVELOPE = {
  attack: ATTACK_SECONDS,
  release: RELEASE_SECONDS,
} as const;

// Thin 12.5 % duty for the lead gives that bright NES-style solo voice;
// 25 % is the classic square-ish pulse used for the busy arpeggio.
export const LEAD_DUTY_CYCLE: DutyCycle = 0.125;
export const ARPEGGIO_DUTY_CYCLE: DutyCycle = 0.25;
export const LEAD_WAVE: WaveShape = 'pulse';

// The hardware frequency table was coarse. 128 steps per octave gives a
// maximum deviation of about 4 cents: clearly authentic, but still subtle.
export const PITCH_STEPS_PER_OCTAVE = 128;

// Vibrato is stepped, not swept: the hardware jumped between table entries.
// One discrete update every 1/16 of a beat is fast enough to sound like
// vibrato while staying obviously stepped.
export const VIBRATO_SUBDIVISION = 16;
export const VIBRATO_CENTS = 25;

const VIBRATO_PATTERN = [0, VIBRATO_CENTS, 0, -VIBRATO_CENTS] as const;

// Equal temperament: f = 440 * 2^((n - 69) / 12), where n is the MIDI number.
const NOTE_OFFSETS: Record<NoteName, number> = {
  C2: -33,
  D2: -31,
  E2: -29,
  F2: -28,
  G2: -26,
  A2: -24,
  B2: -22,
  C3: -21,
  D3: -19,
  E3: -17,
  F3: -16,
  G3: -14,
  A3: -12,
  B3: -10,
  C4: -9,
  D4: -7,
  E4: -5,
  F4: -4,
  G4: -2,
  A4: 0,
  B4: 2,
  C5: 3,
  D5: 5,
  E5: 7,
  F5: 8,
  G5: 10,
  A5: 12,
  B5: 14,
  C6: 15,
  D6: 17,
};

export function quantizeFrequency(frequency: number): number {
  if (frequency <= 0 || !Number.isFinite(frequency)) {
    return frequency;
  }
  const steps = Math.round(Math.log2(frequency / 440) * PITCH_STEPS_PER_OCTAVE);
  return 440 * 2 ** (steps / PITCH_STEPS_PER_OCTAVE);
}

export function noteToFrequency(note: NoteName): number {
  const offset = NOTE_OFFSETS[note];
  return quantizeFrequency(440 * 2 ** (offset / 12));
}

export function vibratoStepCents(stepIndex: number): number {
  const value = VIBRATO_PATTERN[stepIndex % VIBRATO_PATTERN.length];
  return value ?? 0;
}

export function applyVibrato(frequency: number, cents: number): number {
  return frequency * 2 ** (cents / 1200);
}

// Fourier coefficients for a bipolar pulse wave with the given duty cycle.
// The result is suitable for Web Audio's createPeriodicWave: `real` holds the
// cosine terms, `imag` the sine terms. The DC offset is 2*d - 1, and the nth
// harmonic is (4 / (n*pi)) * sin(n*pi*d).
export const PULSE_HARMONICS = 32;

export function pulseWaveCoefficients(
  duty: DutyCycle,
  harmonics: number = PULSE_HARMONICS,
): { readonly real: Float32Array; readonly imag: Float32Array } {
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);

  real[0] = 2 * duty - 1;
  for (let n = 1; n <= harmonics; n += 1) {
    real[n] = (4 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
    imag[n] = 0;
  }

  return { real, imag };
}

export function beatSeconds(bpm: number): number {
  return 60 / bpm;
}

export function barSeconds(bpm: number): number {
  return beatSeconds(bpm) * 4;
}

// A sixteen-bar arcade progression in C major.
// The bass and percussion lay down a relentless pulse, the pulse arpeggio
// keeps the harmony moving, and a monophonic pulse lead states a hook and
// then answers it in a higher register.
type ChordDef = {
  readonly name: string;
  readonly root: NoteName;
  readonly octave: NoteName;
  readonly tones: readonly NoteName[];
};

const CHORDS: readonly ChordDef[] = [
  { name: 'C', root: 'C2', octave: 'C3', tones: ['C4', 'E4', 'G4', 'C5'] },
  { name: 'Am', root: 'A2', octave: 'A3', tones: ['A3', 'C4', 'E4', 'A4'] },
  { name: 'F', root: 'F2', octave: 'F3', tones: ['F3', 'A3', 'C4', 'F4'] },
  { name: 'G', root: 'G2', octave: 'G3', tones: ['G3', 'B3', 'D4', 'G4'] },
  { name: 'C', root: 'C2', octave: 'C3', tones: ['C4', 'E4', 'G4', 'C5'] },
  { name: 'F', root: 'F2', octave: 'F3', tones: ['F3', 'A3', 'C4', 'F4'] },
  { name: 'G', root: 'G2', octave: 'G3', tones: ['G3', 'B3', 'D4', 'G4'] },
  { name: 'Am', root: 'A2', octave: 'A3', tones: ['A3', 'C4', 'E4', 'A4'] },
  { name: 'C', root: 'C2', octave: 'C3', tones: ['C4', 'E4', 'G4', 'C5'] },
  { name: 'G', root: 'G2', octave: 'G3', tones: ['G3', 'B3', 'D4', 'G4'] },
  { name: 'Am', root: 'A2', octave: 'A3', tones: ['A3', 'C4', 'E4', 'A4'] },
  { name: 'F', root: 'F2', octave: 'F3', tones: ['F3', 'A3', 'C4', 'F4'] },
  { name: 'C', root: 'C2', octave: 'C3', tones: ['C4', 'E4', 'G4', 'C5'] },
  { name: 'F', root: 'F2', octave: 'F3', tones: ['F3', 'A3', 'C4', 'F4'] },
  { name: 'G', root: 'G2', octave: 'G3', tones: ['G3', 'B3', 'D4', 'G4'] },
  { name: 'Am', root: 'A2', octave: 'A3', tones: ['A3', 'C4', 'E4', 'A4'] },
];

function buildBar(
  bpm: number,
  barIndex: number,
  root: NoteName,
  octave: NoteName,
  tones: readonly NoteName[],
): ScheduleEvent[] {
  const beat = beatSeconds(bpm);
  const barOffset = barIndex * 4 * beat;
  const events: ScheduleEvent[] = [];

  // Driving triangle-wave bass: quarter notes, jumping to the octave on beat 3.
  const bassNotes: readonly NoteName[] = [root, root, octave, root];
  for (let step = 0; step < bassNotes.length; step += 1) {
    const note = bassNotes[step];
    if (note === undefined) {
      continue;
    }
    events.push({
      time: barOffset + step * beat,
      frequency: noteToFrequency(note),
      duration: beat - 0.02,
      gain: BASS_GAIN,
      wave: 'triangle',
      dutyCycle: null,
    });
  }

  // Busy pulse-wave arpeggio: sixteenth-note chord tones.
  const sixteenth = beat / 4;
  const stepsPerBar = 16;
  for (let index = 0; index < stepsPerBar; index += 1) {
    const tone = tones[index % tones.length];
    if (tone === undefined) {
      continue;
    }
    events.push({
      time: barOffset + index * sixteenth,
      frequency: noteToFrequency(tone),
      duration: sixteenth - 0.005,
      gain: ARPEGGIO_GAIN,
      wave: 'pulse',
      dutyCycle: ARPEGGIO_DUTY_CYCLE,
    });
  }

  return events;
}

function buildPercussion(barOffset: number, beat: number): ScheduleEvent[] {
  const events: ScheduleEvent[] = [];

  // A longer, quieter snare on the downbeat; very short hi-hats everywhere else.
  for (let step = 0; step < 4; step += 1) {
    const isSnare = step === 0;
    events.push({
      time: barOffset + step * beat,
      frequency: 0,
      duration: isSnare ? SNARE_DURATION : HI_HAT_DURATION,
      gain: isSnare ? SNARE_GAIN : HI_HAT_GAIN,
      wave: 'noise',
      dutyCycle: null,
    });
  }

  // Offbeat hi-hats keep the groove from letting up.
  for (let step = 0; step < 4; step += 1) {
    events.push({
      time: barOffset + (step + 0.5) * beat,
      frequency: 0,
      duration: HI_HAT_DURATION,
      gain: HI_HAT_GAIN,
      wave: 'noise',
      dutyCycle: null,
    });
  }

  return events;
}

type LeadStep = {
  readonly note: NoteName | null;
  readonly beats: number;
};

export const LEAD_HOOK_SEQUENCE: readonly NoteName[] = ['G5', 'G5', 'A5', 'G5'];

// Sixteen bars of lead melody: bars 0-7 state the hook and answer it;
// bars 8-15 take the same material higher and wider as a B phrase.
const LEAD_PHRASE: readonly LeadStep[][] = [
  // A phrase — bars 0-7
  [
    { note: 'G5', beats: 1 },
    { note: 'G5', beats: 1 },
    { note: 'A5', beats: 1 },
    { note: 'G5', beats: 1 },
  ],
  [
    { note: 'B5', beats: 1 },
    { note: 'C6', beats: 1 },
    { note: 'A5', beats: 2 },
  ],
  [
    { note: 'G5', beats: 1 },
    { note: 'G5', beats: 1 },
    { note: 'A5', beats: 1 },
    { note: 'G5', beats: 1 },
  ],
  [
    { note: 'B5', beats: 0.5 },
    { note: 'C6', beats: 0.5 },
    { note: 'B5', beats: 1 },
    { note: 'A5', beats: 1 },
    { note: 'G5', beats: 1 },
  ],
  [
    { note: 'G5', beats: 1 },
    { note: 'G5', beats: 1 },
    { note: 'A5', beats: 1 },
    { note: 'G5', beats: 1 },
  ],
  [
    { note: 'C6', beats: 1 },
    { note: 'B5', beats: 1 },
    { note: 'A5', beats: 1 },
    { note: 'G5', beats: 1 },
  ],
  [
    { note: 'A5', beats: 0.5 },
    { note: 'B5', beats: 0.5 },
    { note: 'C6', beats: 1 },
    { note: 'B5', beats: 1 },
    { note: 'A5', beats: 0.5 },
    { note: 'G5', beats: 0.5 },
  ],
  [
    { note: 'C6', beats: 2 },
    { note: 'G5', beats: 2 },
  ],
  // B phrase — bars 8-15
  [
    { note: 'A5', beats: 1 },
    { note: 'B5', beats: 1 },
    { note: 'C6', beats: 1 },
    { note: 'D6', beats: 1 },
  ],
  [
    { note: 'C6', beats: 2 },
    { note: 'B5', beats: 2 },
  ],
  [
    { note: 'A5', beats: 1 },
    { note: 'G5', beats: 1 },
    { note: 'A5', beats: 1 },
    { note: 'B5', beats: 1 },
  ],
  [{ note: 'C6', beats: 4 }],
  [
    { note: 'G5', beats: 1 },
    { note: 'A5', beats: 1 },
    { note: 'B5', beats: 1 },
    { note: 'C6', beats: 1 },
  ],
  [
    { note: 'A5', beats: 2 },
    { note: 'G5', beats: 2 },
  ],
  [
    { note: 'C6', beats: 1 },
    { note: 'B5', beats: 1 },
    { note: 'A5', beats: 1 },
    { note: 'G5', beats: 1 },
  ],
  [
    { note: 'C6', beats: 3 },
    { note: 'G5', beats: 1 },
  ],
];

function buildLeadBar(bpm: number, barIndex: number, steps: readonly LeadStep[]): ScheduleEvent[] {
  const beat = beatSeconds(bpm);
  const stepSeconds = beat / VIBRATO_SUBDIVISION;
  const barOffset = barIndex * 4 * beat;
  const events: ScheduleEvent[] = [];
  let beatOffset = 0;
  let vibratoIndex = 0;

  for (const step of steps) {
    if (step.note !== null) {
      // Each written note starts from the base pitch; the vibrato pattern runs
      // inside the note so the onset always carries the written frequency.
      vibratoIndex = 0;
      const baseFrequency = noteToFrequency(step.note);
      const noteDuration = step.beats * beat;
      const releaseGap = 0.015;
      const playableDuration = Math.max(0, noteDuration - releaseGap);

      // Long enough to step: split into discrete vibrato slices. Each slice is
      // a separate event with its own quantized pitch, so the pitch jumps
      // between table entries instead of gliding.
      if (playableDuration >= stepSeconds * 2) {
        const subSteps = Math.max(2, Math.floor(playableDuration / stepSeconds));
        const subDuration = playableDuration / subSteps;

        for (let index = 0; index < subSteps; index += 1) {
          const cents = vibratoStepCents(vibratoIndex);
          vibratoIndex += 1;
          events.push({
            time: barOffset + beatOffset * beat + index * subDuration,
            frequency: quantizeFrequency(applyVibrato(baseFrequency, cents)),
            duration: subDuration,
            gain: LEAD_GAIN,
            wave: 'pulse',
            dutyCycle: LEAD_DUTY_CYCLE,
          });
        }
      } else {
        events.push({
          time: barOffset + beatOffset * beat,
          frequency: baseFrequency,
          duration: playableDuration,
          gain: LEAD_GAIN,
          wave: 'pulse',
          dutyCycle: LEAD_DUTY_CYCLE,
        });
      }
    }
    beatOffset += step.beats;
  }

  return events;
}

export function buildLoopSchedule(bpm: number = TEMPO_BPM): LoopSchedule {
  const events: ScheduleEvent[] = [];

  for (let barIndex = 0; barIndex < CHORDS.length; barIndex += 1) {
    const chord = CHORDS[barIndex];
    if (chord === undefined) {
      continue;
    }
    const barOffset = barIndex * 4 * beatSeconds(bpm);

    events.push(...buildBar(bpm, barIndex, chord.root, chord.octave, chord.tones));
    events.push(...buildPercussion(barOffset, beatSeconds(bpm)));

    const leadSteps = LEAD_PHRASE[barIndex];
    if (leadSteps !== undefined) {
      events.push(...buildLeadBar(bpm, barIndex, leadSteps));
    }
  }

  // Sort by start time so the scheduler can walk the list in order.
  events.sort((left, right) => left.time - right.time);

  return {
    events,
    duration: CHORDS.length * barSeconds(bpm),
  };
}
