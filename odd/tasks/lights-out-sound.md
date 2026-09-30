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

## Known limitations to record

- The music starts on the first interaction rather than on load, because the browser forbids anything else.
- There is no volume control, only on and off. A slider is a separate decision.
- Sound is off in any environment without the Web Audio API, silently.
