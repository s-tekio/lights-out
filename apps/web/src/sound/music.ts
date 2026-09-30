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

export type WaveShape = 'triangle' | 'square' | 'noise';

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

export const TEMPO_BPM = 148;

// A controlled ceiling so the music sits below the press sound.
// The press sound peaks at PRESS_PEAK_GAIN; music stays under half of it.
export const MUSIC_GAIN_CEILING = 0.08;

// A tight attack and a short release keep the fast loop punchy and clean.
const ATTACK_SECONDS = 0.01;
const RELEASE_SECONDS = 0.06;

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

// An eight-bar arcade progression in C major.
// The bass is a driving quarter-note figure with octave jumps.
// The arpeggio runs sixteenth notes through the chord tones.
// A single short noise hit marks the downbeat for arcade punch.
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
  const bassGain = 0.05;
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
      gain: bassGain,
      wave: 'triangle',
    });
  }

  // Busy square-wave arpeggio: sixteenth-note chord tones.
  const arpeggioGain = 0.04;
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
      gain: arpeggioGain,
      wave: 'square',
    });
  }

  // One short, quiet noise hit on the downbeat for rhythmic definition.
  // Kept deliberately below the arpeggio so it adds energy, not loudness.
  events.push({
    time: barOffset,
    frequency: 0,
    duration: 0.03,
    gain: 0.025,
    wave: 'noise',
  });

  return events;
}

export function buildLoopSchedule(bpm: number = TEMPO_BPM): LoopSchedule {
  const events: ScheduleEvent[] = [];

  for (let barIndex = 0; barIndex < CHORDS.length; barIndex += 1) {
    const chord = CHORDS[barIndex];
    if (chord === undefined) {
      continue;
    }
    events.push(...buildBar(bpm, barIndex, chord.root, chord.octave, chord.tones));
  }

  // Sort by start time so the scheduler can walk the list in order.
  events.sort((left, right) => left.time - right.time);

  return {
    events,
    duration: CHORDS.length * barSeconds(bpm),
  };
}
