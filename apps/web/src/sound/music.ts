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
  | 'G5';

export type WaveShape = 'triangle' | 'square';

export type MusicNote = {
  readonly frequency: number;
  readonly duration: number;
  readonly gain: number;
  readonly wave: WaveShape;
};

export type ScheduleEvent = MusicNote & {
  readonly time: number;
};

export type LoopSchedule = {
  readonly events: readonly ScheduleEvent[];
  readonly duration: number;
};

export const TEMPO_BPM = 72;

// A relaxed ceiling so the music sits well below the press sound.
// The press sound peaks at PRESS_PEAK_GAIN; music stays under half of it.
export const MUSIC_GAIN_CEILING = 0.08;

// A slow attack and release keeps the loop from clicking or feeling urgent.
const ATTACK_SECONDS = 0.04;
const RELEASE_SECONDS = 0.12;

export const ENVELOPE = {
  attack: ATTACK_SECONDS,
  release: RELEASE_SECONDS,
} as const;

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
};

export function noteToFrequency(note: NoteName): number {
  const offset = NOTE_OFFSETS[note];
  return 440 * 2 ** (offset / 12);
}

export function beatSeconds(bpm: number): number {
  return 60 / bpm;
}

export function barSeconds(bpm: number): number {
  return beatSeconds(bpm) * 4;
}

// A gentle I - vi - IV - V progression in C major.
// The bass holds roots in a low triangle wave; the arpeggio traces chord tones
// with a quiet square wave. No percussion, no noise, slow tempo.
const CHORDS = [
  { name: 'C', root: 'C3' as const, tones: ['C4', 'E4', 'G4', 'C5'] as const },
  { name: 'Am', root: 'A2' as const, tones: ['A3', 'C4', 'E4', 'A4'] as const },
  { name: 'F', root: 'F2' as const, tones: ['F3', 'A3', 'C4', 'F4'] as const },
  { name: 'G', root: 'G2' as const, tones: ['G3', 'B3', 'D4', 'G4'] as const },
];

function buildBar(
  bpm: number,
  barIndex: number,
  root: NoteName,
  tones: readonly NoteName[],
): ScheduleEvent[] {
  const beat = beatSeconds(bpm);
  const barOffset = barIndex * 4 * beat;
  const events: ScheduleEvent[] = [];

  // Triangle-wave bass: whole notes, one per bar, low and steady.
  events.push({
    time: barOffset,
    frequency: noteToFrequency(root),
    duration: 4 * beat - 0.05,
    gain: 0.05,
    wave: 'triangle',
  });

  // Square-wave arpeggio: eighth-note chord tones, quiet and wandering.
  // The pattern stays inside the chord so it never clashes or feels hurried.
  const arpeggioGain = 0.03;
  const step = beat / 2;
  for (let index = 0; index < 8; index += 1) {
    const tone = tones[index % tones.length];
    if (tone === undefined) {
      continue;
    }
    events.push({
      time: barOffset + index * step,
      frequency: noteToFrequency(tone),
      duration: step - 0.02,
      gain: arpeggioGain,
      wave: 'square',
    });
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
    events.push(...buildBar(bpm, barIndex, chord.root, chord.tones));
  }

  // Sort by start time so the scheduler can walk the list in order.
  events.sort((left, right) => left.time - right.time);

  return {
    events,
    duration: CHORDS.length * barSeconds(bpm),
  };
}
