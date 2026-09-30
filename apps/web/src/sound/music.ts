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

export type WaveShape = 'triangle' | 'square' | 'sawtooth' | 'noise';

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

export const TEMPO_BPM = 172;

// A controlled ceiling so the music sits below the press sound.
// The press sound peaks at PRESS_PEAK_GAIN; music stays under half of it.
export const MUSIC_GAIN_CEILING = 0.08;

// Voice levels: the lead must sit above the accompaniment, so the
// accompaniment is lowered instead of raising the ceiling.
export const BASS_GAIN = 0.028;
export const ARPEGGIO_GAIN = 0.022;
export const PERCUSSION_DOWNBEAT_GAIN = 0.02;
export const PERCUSSION_OFFBEAT_GAIN = 0.009;
export const LEAD_GAIN = 0.055;

// A tight attack and a short release keep the fast loop punchy and clean.
const ATTACK_SECONDS = 0.01;
const RELEASE_SECONDS = 0.06;

export const ENVELOPE = {
  attack: ATTACK_SECONDS,
  release: RELEASE_SECONDS,
} as const;

export const LEAD_WAVE: WaveShape = 'sawtooth';

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

// A sixteen-bar arcade progression in C major.
// The bass and percussion lay down a relentless pulse, the arpeggio keeps
// the harmony moving, and a monophonic sawtooth lead states a hook and then
// answers it in a higher register.
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
    });
  }

  // Busy square-wave arpeggio: sixteenth-note chord tones.
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
      wave: 'square',
    });
  }

  return events;
}

function buildPercussion(barOffset: number, beat: number): ScheduleEvent[] {
  const events: ScheduleEvent[] = [];

  // A kick-like hit on every beat keeps the pulse forward.
  for (let step = 0; step < 4; step += 1) {
    events.push({
      time: barOffset + step * beat,
      frequency: 0,
      duration: 0.03,
      gain: step === 0 ? PERCUSSION_DOWNBEAT_GAIN : 0.012,
      wave: 'noise',
    });
  }

  // Offbeat hi-hats fill the gaps so the groove never lets up.
  for (let step = 0; step < 4; step += 1) {
    events.push({
      time: barOffset + (step + 0.5) * beat,
      frequency: 0,
      duration: 0.015,
      gain: PERCUSSION_OFFBEAT_GAIN,
      wave: 'noise',
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
  const barOffset = barIndex * 4 * beat;
  const events: ScheduleEvent[] = [];
  let beatOffset = 0;

  for (const step of steps) {
    if (step.note !== null) {
      events.push({
        time: barOffset + beatOffset * beat,
        frequency: noteToFrequency(step.note),
        duration: step.beats * beat - 0.015,
        gain: LEAD_GAIN,
        wave: LEAD_WAVE,
      });
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
