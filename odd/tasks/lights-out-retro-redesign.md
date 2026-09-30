# Feature: lights-out-retro-redesign

**Status:** complete (local only, not pushed at the user's request)
**Branch:** `feat/bootstrap`
**Created:** 2026-09-30
**Workflow:** ODD (Organic Driven Development)

## Goal

Turn the app into something that reads as a game: a space backdrop, a title screen, a menu, screens for the leaderboard and settings, an in-game menu, and a win sequence with fireworks and a name entry. Plus the music feedback: more arcade, less relaxed.

## Origin

Requested by the user after hearing the first version of the music. The sound style was right, the tempo was too relaxed. The rest is the visual and structural redesign they specified item by item.

Local commits only. **No push** until they say so.

## What the user asked for, and what it collides with

| Asked for | Collision found | Resolution |
| --- | --- | --- |
| Menu with exactly New Game, Leaderboard, Settings | The Help dialog has no home, and the game screen has no way back to the menu, so the player is trapped in a board until they solve it | The in-game modal gets Main menu and How to play in addition to the specified Reset Game and the two sound switches. Both fix a hole, neither replaces anything the user asked for. |
| A icon button opening a modal with Reset Game and sound switches | The always-visible floating sound button from the previous feature becomes the third sound control | **Removed.** Sound now lives where the user specified. Flagged to them; restoring it is one component and one line. |
| Player name input with a label cutting the border | This is exactly what a `fieldset` with a `legend` does | Use it, rather than a `div` with a positioned label. The legend becomes the input's accessible name through `aria-labelledby`, so the name is not announced twice. |
| A title in the spirit of the DOOM lettering | The real font is proprietary and the project has no webfont pipeline | Approximated with a heavy system stack, a purple fill, a white stroke and a second white ring. Not a copy, and no binary asset or network request. |

## Decisions

| Decision | Chosen | Rationale |
| --- | --- | --- |
| Screens | A single `view` state in the app shell, one value per screen | Small enough not to need a router, and a pure reducer is testable without rendering. |
| Starfield | Generated once from a seeded pseudo-random function, twinkling with a CSS `opacity` animation | A seeded generator makes the layout deterministic and therefore testable. Animating only opacity keeps the work on the compositor, which matters on a phone. No canvas and no per-frame script. |
| Twinkling and motion | Honours `prefers-reduced-motion` | A page of blinking dots is exactly the kind of motion that setting exists for. |
| Fireworks | Canvas, with the animation loop cancelled on unmount | The one place where a per-frame loop earns its cost. A leaked frame loop would keep a phone busy after the game is over. |
| Fonts | System stack, no webfont | No new network dependency and no binary asset. Recorded as a limitation: the lettering is inspired by the style, not the typeface. |
| Corners and palette | Sharp corners, black field, purple accent, white text | The retro read comes from sharp edges and high contrast. The accent stays light enough on black for text contrast. |
| Sound settings | Independent switches for music and effects, both persisted | The user asked for them separately in two different screens, so one flag is no longer enough. |
| After the score is saved | Go to the leaderboard | The payoff of entering a name is seeing where the score landed. Cancel goes back to the title. |

## Tasks

- [x] **R1 — Sound.** Split the music and effects switches, and take the music from relaxed to arcade. Recorded in `lights-out-sound.md`.
- [x] **R2 — Space backdrop.** The starfield, and the retro foundation in the stylesheet.
- [x] **R3 — Screens.** Title, menu, difficulty and settings, with the app shell that moves between them.
- [x] **R4 — The game screen.** The board alone plus the in-game modal.
- [x] **R5 — The win sequence.** Fireworks, the headline, and the delayed name entry.
- [x] **R6 — The leaderboard screen.** The table and the restyled delete dialog.
- [x] **R7 — Verification and the record.** Local only.

## Verification evidence

| Check | Result |
| --- | --- |
| `npm run lint` | exit 0 |
| `npm run format:check` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 |
| `npm run test:coverage --workspace @lights-out/web` | exit 0, 259 tests in 26 files, 92.18% branch coverage |
| No new dependency, webfont or binary asset | confirmed |

The starfield is pinned by tests: seventy stars from a fixed seed, the same seed producing the same layout, a different seed a different one, all positions in range, all sizes one or two pixels. The navigation is pinned: every menu entry reaches its screen, a level reaches the game, and Back returns to the menu. The win sequence is pinned with fake timers: nothing of the name form exists before the delay and it exists after, and the timer does not outlive the component. The particle maths is pinned. The canvas is inert to clicks and the frame loop is cancelled on unmount, both checked against the source rather than asserted by a test.

## What is deliberately not verified

**Nobody has looked at it.** There is no headless browser here, so no test asserts that any of this looks right: not the palette, not the title's two rings, not the starfield's twinkle, not the layout on a phone. Those were reasoned about and the CSS was read, and that is a weaker claim than a measurement.

The manual check: confirm the stars twinkle and that they stop twinkling with reduced motion enabled; confirm the name reads as purple inside two white rings; walk New Game to a level to the board; solve it and confirm the fireworks and the headline appear with the name form about a second later; confirm the form can be typed in, which is what the inert canvas protects; submit and confirm the leaderboard shows the score; then check the delete dialog wears the same bordered field shape.

## Known limitations to record

- The title lettering is an approximation of a style, not the typeface.
- The fireworks are decorative; they are skipped when reduced motion is requested.
- No push until the user asks.
