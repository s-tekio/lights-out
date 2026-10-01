# Feature: lights-out-sound

**Status:** complete (local only, not pushed at the user's request)
**Branch:** `feat/bootstrap`
**Created:** 2026-09-30
**Workflow:** ODD (Organic Driven Development)

## Goal

Add retro arcade audio: an arcade-style chiptune loop, a blip on every cell press, and separate switches for music and effects.

## Origin

Requested by the user after playing on a phone. They asked for 80s/90s arcade music that is not strident or stressful, a retro sound per press, and a semi-transparent floating toggle at the bottom right.

The user also asked for this work to be committed locally and **not pushed** until they say so.

## The decision that shapes everything: synthesise, do not ship files

The audio is generated at runtime with the **Web Audio API**, not loaded from audio files.

| | Audio files in `public/` | Web Audio synthesis |
| --- | --- | --- |
| Repository weight | A 30-second loop as WAV is several MB of binary in git, and this project has no MP3 or OGG encoder available to shrink it | Zero bytes of assets |
| Licensing | Requires a track the project is allowed to redistribute | Nothing to license; the patterns are written here |
| The "bit" sound | Whatever the file contains | A square wave **is** the sound of an 80s sound chip, which is the literal request |
| Loop length | Fixed by the file | Any length, because the loop is a schedule rather than a recording |

Adding a third-party track would also mean the project ships someone else's music, which is not something to do casually in a public repository.

## The browser constraint that must be respected

**An `AudioContext` created without a user gesture starts suspended, and `resume()` has the same requirement.** Sound cannot start on page load, no matter what the code does.

Consequences the implementation has to honour:

- Nothing may be attempted on mount. A test must assert that.
- The music starts on the first user gesture, or when the toggle is switched on.
- Silence is the default state of a page nobody has touched, and enabling it later must work.

## Design decisions

| Decision | Chosen | Rationale |
| --- | --- | --- |
| Synthesis engine | A pure module for the music data and note maths, plus a thin adapter around `AudioContext` | The same port-and-adapter split used in the API. jsdom has no `AudioContext`, so an engine that cannot be injected cannot be tested at all. |
| Music shape | A fast tempo, an eight-bar looping chord progression, a driving triangle bass, a busy square arpeggio, and a light noise hit | Arcade energy rather than calm; the rhythm and density carry the feeling, not the volume. |
| Volume | Music well below the sound effects | The request was explicitly "not strident". |
| Press sound | A short blip with a fast decay, its pitch stepped slightly by cell so rapid presses do not sound identical | A single repeated tone becomes irritating within seconds. |
| Default state | Music and effects both enabled, persisted independently in `localStorage` | A game is expected to have sound, and the choices have to survive a reload. The autoplay policy means nothing is heard until the user interacts anyway. |
| Toggle placement | Removed; sound controls move to the in-game modal and the settings screen | The floating button is gone because the next screens need independent music and effects switches. |
| Stacking | Below the modal backdrop | A floating element can otherwise paint on top of an open dialog, which looks broken. |

## Tasks

- [x] **T1 — The music module.** `apps/web/src/sound/music.ts` holds the note maths and the loop schedule and contains no Web Audio at all, which is what makes it testable.
- [x] **T2 — The sound engine.** `apps/web/src/sound/engine.ts` defines the seam, the Web Audio implementation with a lookahead scheduler, and a silent fallback.
- [x] **T3 — Wiring.** `Game` plays the blip only after the solved guard, so an ignored press stays silent, and `useSound` starts the music on the first gesture.
- [x] **T4 — Remove the floating toggle.** `SoundToggle.tsx`, its test, and the `.sound-toggle` rules were deleted; the wiring was removed from `App.tsx`. Sound controls move to the in-game modal and the settings screen.
- [x] **T5 — Documentation.** The help dialog describes the separate music and effects switches without pointing to a screen that does not exist yet.
- [x] **T6 — Verification.** Committed locally. **Not pushed**, as asked.

## What was implemented

| Piece | Where |
| --- | --- |
| Note maths and the loop, pure | `apps/web/src/sound/music.ts` |
| The engine and its seam | `apps/web/src/sound/engine.ts` |
| Enabled state, persistence, first gesture | `apps/web/src/sound/useSound.ts` |
| The wiring | `apps/web/src/App.tsx` |
| The press sound | `apps/web/src/components/Game.tsx` |

Music: 148 BPM, an eight-bar C–Am–F–G–C–F–G–Am progression in C major, a driving quarter-note triangle bass with octave jumps, a busy sixteenth-note square arpeggio, and a short quiet noise hit on each downbeat. The gain ceiling stays 0.08, under half of the press sound's peak, with a 10 ms attack and a 60 ms release for a punchy arcade feel.

## Verification evidence

| Check | Result |
| --- | --- |
| `npm run lint` | exit 0 |
| `npm run format:check` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 |
| `npm run test:coverage --workspace @lights-out/web` | exit 0, 207 tests in 16 files, 92.01% branch coverage |
| No audio files, no new dependency | confirmed in `package.json` and in the diff |

New tests cover the music schedule's determinism, bar coverage, bass pattern, sixteenth-note arpeggio density, downbeat percussion, gain ceiling, the engine seam with a fake `AudioContext`, music/effects enable flags, noise scheduling, the silent fallback, nothing starting on mount, the first-gesture start, independent persistence of the two switches, and the press firing only on a real board change.

## What is deliberately not verified

**Nobody has heard it.** jsdom has no Web Audio implementation and there is no headless browser here, so no test asserts how any of this sounds. The tests pin the structure, the frequencies, the gain ceiling and the scheduling calls; the actual audio is reasoned about, not measured.

The manual check a reader should do in a browser: click a cell and confirm the loop starts and a blip sounds; solve the board and click again and confirm it stays silent; open Help and confirm the wording matches the new sound controls; once the in-game modal and settings screen exist, toggle music and effects separately and confirm each behaves as expected.

## Iteration: faster tempo, pulse and lead melody

After listening, the user asked for more energy and a recognizable lead line. The response was tempo and melody, not volume.

### Decisions

| Decision | Chosen | Rationale |
| --- | --- | --- |
| Tempo | 172 BPM | The previous bump to 148 was not enough; 172 is a clear step up while still comfortable under a puzzle game. |
| Loop length | 16 bars | Long enough for an A/B lead phrase without one bar repeated sixteen times. |
| Pulse | Bass on every beat, a kick on every beat, and offbeat hi-hats | No gaps in the groove; the loop drives forward continuously. |
| Lead voice | Monophonic `sawtooth` in a high register | Distinct from the triangle bass and square arpeggio; one note at a time so it reads as a melody, not a chord. |
| Lead register | G5 to D6 | Above the bass (max A3) and above the arpeggio (max C5) so it does not compete. |
| Mix | Lower the accompaniment, keep the 0.08 ceiling | Bass 0.028, arpeggio 0.022, percussion 0.02/0.009, lead 0.055. The lead is louder than the accompaniment without touching the ceiling. |
| Hook | A four-note G5-G5-A5-G5 motif | Short enough to be memorable; it recurs in bars 0, 2 and 4 of the A phrase. |
| A/B phrases | Bars 0-7 state the hook and answer it; bars 8-15 take the material higher and wider | The loop varies across its length instead of repeating one bar. |

### What changed

- `apps/web/src/sound/music.ts`
  - Tempo raised from 148 to 172.
  - Progression extended to 16 bars.
  - Bass and arpeggio gains lowered.
  - Percussion now hits every beat plus offbeats.
  - Added a monophonic sawtooth lead with `LEAD_HOOK_SEQUENCE`, A phrase (bars 0-7) and B phrase (bars 8-15).
  - Added high notes (`A5`, `B5`, `C6`, `D6`) and the `sawtooth` wave shape.
- `apps/web/test/sound/music.test.ts`
  - Updated existing bar-count tests from 8 to 16 bars.
  - Added tempo, monophony, hook repetition, lead register, accompaniment-lowered, and every-beat percussion tests.

### Verification evidence (iteration)

| Check | Result |
| --- | --- |
| `npm run lint` | exit 0 |
| `npm run format:check` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 |
| `npm run test:coverage --workspace @lights-out/web` | exit 0, 261 tests, branch coverage 92.28% |
| No audio files, no new dependency | confirmed |

### What is deliberately not verified

No one here can hear the result. The tests pin the structure, the register, the gains and the repetition; whether the melody feels like the requested track can only be judged by the user.

## Known limitations to record

- The music starts on the first interaction rather than on load, because the browser forbids anything else.
- There is no volume control, only on and off. A slider is a separate decision.
- Sound is off in any environment without the Web Audio API, silently.

## Iteration: closer to arcade chip character

The user asked for a more authentic chip-music character through the techniques the hardware actually had, while keeping the approved fast tempo, relentless pulse, monophonic lead hook, and unchanged gain ceiling. The material stays original; nothing was transcribed or imitated.

### Decisions

| Trait | Applied? | Choice |
| --- | --- | --- |
| Pulse waves with selectable duty cycle | Yes | Lead uses a 12.5 % duty-cycle pulse (`LEAD_DUTY_CYCLE = 0.125`); arpeggio uses 25 % (`ARPEGGIO_DUTY_CYCLE = 0.25`). The waveform is built from Fourier coefficients via `createPeriodicWave`, with a plain `square` fallback when `createPeriodicWave` is unavailable. |
| Hard note envelopes | Yes | `ENVELOPE.attack = 0.003 s`, `ENVELOPE.release = 0.005 s`. The gain rises to peak, holds flat, then falls to silence; no sustain curve, no reverb tail. |
| Stepped vibrato | Yes | The lead vibrates in discrete pitch steps. `VIBRATO_SUBDIVISION = 16` slices per beat, `VIBRATO_CENTS = ±25`, pattern `[0, +25, 0, -25]` cents. Each written note resets to the base pitch, so the onset carries the written frequency. |
| Quantised pitch | Yes | `PITCH_STEPS_PER_OCTAVE = 128` steps per octave; every note frequency is quantised to that table, giving a deterministic deviation bounded below ~4.7 cents. |
| Noise percussion with two envelopes | Yes | A very short hi-hat (`HI_HAT_DURATION = 0.015 s`, `HI_HAT_GAIN = 0.012`) and a slightly longer, quieter snare (`SNARE_DURATION = 0.04 s`, `SNARE_GAIN = 0.008`) replace the previous single hit shape. |
| Triangle bass | Yes | Unchanged; still the chip-era bass voice. |
| Sawtooth lead | No | Replaced by the pulse lead; sawtooth was a placeholder, and pulse is the defining lead timbre of the era. |
| Smooth pitch sweeps / portamento | No | Deliberately avoided; the hardware could not do them. |
| Arpeggio as fixed square | No | Changed to a 25 % pulse; a fixed 50 % square is what the chip could move beyond. |

### What changed

- `apps/web/src/sound/music.ts`
  - `WaveShape` reduced to `'triangle' | 'pulse' | 'noise'`; `sawtooth` removed.
  - Added `DutyCycle`, `DUTY_CYCLES`, `LEAD_DUTY_CYCLE`, `ARPEGGIO_DUTY_CYCLE`.
  - Added `pulseWaveCoefficients(duty, harmonics)` for Fourier-coefficient construction.
  - Added `PITCH_STEPS_PER_OCTAVE` and `quantizeFrequency`.
  - Added `VIBRATO_SUBDIVISION`, `VIBRATO_CENTS`, `vibratoStepCents`, and `applyVibrato`.
  - Hardened envelopes: `ENVELOPE.attack = 0.003`, `ENVELOPE.release = 0.005`.
  - Replaced percussion constants with `HI_HAT_*` and `SNARE_*`; downbeat uses the snare envelope, all other beats and offbeats use hi-hat.
  - Lead is now a `'pulse'` wave with 12.5 % duty and stepped vibrato; arpeggio is a `'pulse'` wave with 25 % duty.
- `apps/web/src/sound/engine.ts`
  - `applyEnvelope` now holds the peak level flat instead of ramping to a sustain level.
  - `playNote` builds pulse waves via `createPeriodicWave` using the pure coefficients, falling back to `'square'` when unavailable.
- `apps/web/test/sound/music.test.ts`
  - Updated existing wave filters from `'sawtooth'` and `'square'` to `'pulse'` and duty-cycle checks.
  - Added tests for: coefficient stability and recognisable differences per duty cycle; scheduled duty-cycle separation; hard envelope bounds; discrete vibrato values; held notes split into stepped vibrato events; deterministic pitch quantisation and bounded deviation; two distinct percussion envelopes.
- `apps/web/test/sound/engine.test.ts`
  - Added `createPeriodicWave` to the fake `AudioContext`.
  - Added tests that pulse events use `createPeriodicWave` and fall back to `'square'` when it is unavailable.

### Verification evidence (iteration)

| Check | Result |
| --- | --- |
| `npm run lint` | exit 0 |
| `npm run format:check` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 |
| `npm run test:coverage --workspace @lights-out/web` | exit 0, 273 tests, branch coverage 91.97% |
| No audio files, no new dependency | confirmed |

### What is deliberately not verified

Nobody here can hear the result. jsdom has no Web Audio implementation and there is no headless browser here, so no test asserts the actual timbre of the pulse waves, the hardness of the envelopes, or the stepped vibrato. The tests pin the coefficient sets, the envelope constants, the quantisation bounds, the vibrato step pattern, the duty-cycle routing, and the scheduling calls; the audible character is reasoned about, not measured.

## Iteration: replace synthesis with a licensed track

The user supplied a real audio track to replace the synthesised music. The press blip stays
synthesised; only the music is replaced.

### Decisions

| Decision | Chosen | Rationale |
| --- | --- | --- |
| Source file | `neon-overdrive-cyberpunk-gaming-edm.mp3` from the user's local directory | Supplied by the user, who states it is licensed for free use. |
| Prepared file | 112 kbps stereo MP3 at 48 kHz, 184.392 seconds, loudness-normalised to I=-18 LUFS / TP=-1.5 / LRA=11 | Keeps the file small (~2.46 MB, 43 % of the original) without resampling; normalisation makes it sit naturally as background music. |
| Storage | `apps/web/src/assets/audio/` as a module asset | Same pattern as the self-hosted font; Vite fingerprints the file at build time. |
| Attribution | `ATTRIBUTION.md` next to the file, source URL marked pending | No author, source, URL, or licence name was invented. |
| Music playback | `<audio>` element with `loop` | Streams the file instead of decoding three minutes of stereo PCM into memory. |
| Music volume | Element volume 0.25 | The file is already loudness-normalised; 25 % is modest and keeps the music under the short press blip. |
| Press sound | Kept in `engine.ts` as a Web Audio square-wave blip | The user only asked to replace the music; the blip is unchanged. |
| Autoplay | Attempt on mount; swallow `NotAllowedError` and arm the gesture listener | Browsers block autoplay with sound until interaction, but a repeat visit may be allowed, and the fallback costs nothing. |
| Accessibility | Music switches in Settings and the in-game menu provide a stop control | No new UI needed; noted for the record. |

### What changed

- Deleted `apps/web/src/sound/music.ts` and `apps/web/test/sound/music.test.ts`.
  - Removed the note maths, loop schedule, pulse-wave coefficients, quantisation, vibrato,
    percussion envelopes, and all of their tests.
- Rewrote `apps/web/src/sound/engine.ts` as an effects-only engine.
  - Removed the scheduler, lookahead, loop scheduling, music start/stop, and music enable flag.
  - Kept `press()`, `dispose()`, `setEffectsEnabled()`, and the silent fallback.
  - Simplified `SoundEngine` to effects-only methods.
- Added `apps/web/src/sound/musicPlayer.ts`.
  - `MusicPlayer` seam with `play()`, `pause()`, `dispose()`, `setEnabled()`.
  - Imports the MP3 as a module asset and configures an `<audio>` element with `loop` and volume
    `MUSIC_VOLUME = 0.25`.
  - `handleMusicPlayRejection` swallows only `NotAllowedError` autoplay refusals.
- Updated `apps/web/src/sound/useSound.ts`.
  - Combines the injected (or default) `MusicPlayer` and `SoundEngine`.
  - Attempts to play music on mount when enabled.
  - Catches autoplay rejection silently and arms the existing first-gesture listener.
  - Toggles music and effects independently, persisting each to `localStorage`.
- Added `apps/web/test/sound/musicPlayer.test.ts` with a fake `HTMLAudioElement`.
  - Covers element configuration, play, pause, disable, dispose, and `NotAllowedError` handling.
- Updated `apps/web/test/sound/useSound.test.tsx`.
  - Covers mount play attempt, autoplay rejection and gesture fallback, music toggle pause/resume,
    effects toggle isolation, and independent persistence.
- Updated `apps/web/test/sound/engine.test.ts` to the effects-only interface.
- Updated `apps/web/test/components/Game.test.tsx` and `GameScreen.test.tsx` mock engines to the
  effects-only interface.
- Updated `apps/web/src/components/HelpDialog.tsx` wording from "arcade-style chiptune loop" to
  "Background music".
- Added `apps/web/src/assets/audio/neon-overdrive-cyberpunk-gaming-edm.mp3` and
  `apps/web/src/assets/audio/ATTRIBUTION.md`.
- Updated `README.md` with a one-line audio attribution matching the font attribution style.

### Verification evidence

| Check | Result |
| --- | --- |
| `npm run lint` | exit 0 |
| `npm run format:check` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0; audio emitted as `dist/assets/neon-overdrive-cyberpunk-gaming-edm-b2GPYclW.mp3` (2 582 160 bytes) |
| `npm run test:coverage --workspace apps/web` | exit 0, 247 tests passing |
| No invented attribution | confirmed; `ATTRIBUTION.md` marks source URL as pending and names no author or licence |

### What is deliberately not verified

Nobody can hear the result in this environment, and no test can assert that the browser permitted
autoplay on any given visit. The tests pin the seam, the play attempt, the rejection handling, the
gesture fallback, the toggle behaviour, and the persistence; the actual audible playback can only be
judged in a real browser.
