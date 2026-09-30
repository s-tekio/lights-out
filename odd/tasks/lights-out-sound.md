# Feature: lights-out-sound

**Status:** complete (local only, not pushed at the user's request)
**Branch:** `feat/bootstrap`
**Created:** 2026-09-30
**Workflow:** ODD (Organic Driven Development)

## Goal

Add retro arcade audio: a relaxed chiptune loop, a blip on every cell press, and a floating button to turn sound on and off.

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
| Music shape | A slow tempo, a looping chord progression, a triangle bass and a quiet square arpeggio, no percussion | Relaxed rather than driving. Percussion is what makes chiptune feel stressful. |
| Volume | Music well below the sound effects | The request was explicitly "not strident". |
| Press sound | A short blip with a fast decay, its pitch stepped slightly by cell so rapid presses do not sound identical | A single repeated tone becomes irritating within seconds. |
| Default state | Enabled, persisted in `localStorage` | A game is expected to have sound, and the choice has to survive a reload. The autoplay policy means nothing is heard until the user interacts anyway. |
| Toggle placement | `fixed` at the bottom right, semi-transparent, respecting the phone safe area | As requested. |
| Stacking | Below the modal backdrop | A floating element can otherwise paint on top of an open dialog, which looks broken. |

## Tasks

- [x] **T1 — The music module.** `apps/web/src/sound/music.ts` holds the note maths and the loop schedule and contains no Web Audio at all, which is what makes it testable.
- [x] **T2 — The sound engine.** `apps/web/src/sound/engine.ts` defines the seam, the Web Audio implementation with a lookahead scheduler, and a silent fallback.
- [x] **T3 — Wiring.** `Game` plays the blip only after the solved guard, so an ignored press stays silent, and `useSound` starts the music on the first gesture.
- [x] **T4 — The floating toggle.** `SoundToggle` plus the `.sound-toggle` rules: fixed, circular, semi-transparent, 44 by 44, safe-area aware, and at `z-index: 50` against the backdrop's `100` so a dialog covers it.
- [x] **T5 — Documentation.** The help dialog describes the sound and its button.
- [x] **T6 — Verification.** Committed locally. **Not pushed**, as asked.

## What was implemented

| Piece | Where |
| --- | --- |
| Note maths and the loop, pure | `apps/web/src/sound/music.ts` |
| The engine and its seam | `apps/web/src/sound/engine.ts` |
| Enabled state, persistence, first gesture | `apps/web/src/sound/useSound.ts` |
| The floating button | `apps/web/src/components/SoundToggle.tsx` |
| The press sound | `apps/web/src/components/Game.tsx` |

Music: 72 BPM, a four-bar I–vi–IV–V progression in C major, a triangle bass holding the roots and a quiet square arpeggio over it, no percussion and no noise. The gain ceiling is 0.08, under half of the press sound's peak, with a 40 ms attack and a 120 ms release so no note clicks.

## Verification evidence

| Check | Result |
| --- | --- |
| `npm run lint` | exit 0 |
| `npm run format:check` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 |
| `npm run test:coverage --workspace @lights-out/web` | exit 0, 201 tests in 17 files, 91.95% branch coverage |
| No audio files, no new dependency | confirmed in `package.json` and in the diff |

New tests cover the music schedule's determinism and bar coverage, the gain ceiling, the engine seam with a fake `AudioContext`, the silent fallback, nothing starting on mount, the first-gesture start, persistence, the press firing only on a real board change, and the toggle's two states.

## What is deliberately not verified

**Nobody has heard it.** jsdom has no Web Audio implementation and there is no headless browser here, so no test asserts how any of this sounds. The tests pin the structure, the frequencies, the gain ceiling and the scheduling calls; the actual audio is reasoned about, not measured.

The manual check a reader should do in a browser: click a cell and confirm the loop starts and a blip sounds; solve the board and click again and confirm it stays silent; open Help and confirm the floating button sits behind the dialog; toggle it off and on and confirm the icon changes shape.

## Known limitations to record

- The music starts on the first interaction rather than on load, because the browser forbids anything else.
- There is no volume control, only on and off. A slider is a separate decision.
- Sound is off in any environment without the Web Audio API, silently.
