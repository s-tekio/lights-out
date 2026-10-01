# Feature: lights-out-help-examples

**Status:** in progress
**Branch:** `feat/bootstrap`
**Created:** 2026-10-01
**Workflow:** ODD (Organic Driven Development)

## Goal

Reach the help from the main menu as well as from the in-game menu, and make the rules explain the interaction with a small worked example instead of only describing it.

## Origin

Requested by the user after playing. They asked for "How to play" in the main menu using the same dialog, for the rules to say what actually happens when a cell is pressed, and for a worked example drawn as a small board showing a simple solving sequence.

## Decisions

| Decision | Chosen | Rationale |
| --- | --- | --- |
| An image or a drawing | **Drawn, as components** | A screenshot stops matching the board the moment a colour or a corner changes, and this project has kept binary assets out of the repository. A drawing reuses the real cell classes, so it inherits the theme and cannot drift. |
| Which cells light in the example | Not hand-written | The "after" state is produced by **the game's own `toggleAt`**. An illustration written by hand is an illustration that can be wrong, and a wrong illustration is worse than none because it teaches the wrong rule. |
| The example's shape | A before-and-after pair per case | The rule is about a transformation, so showing one board cannot express it. |
| What the examples cover | A centre press, a corner press, and a short solve | The centre shows the full cross of five cells, the corner shows that a corner only touches three, and the short solve shows the game being played rather than the rule being stated. |
| Accessibility of a drawing | The diagram is hidden from assistive technology and a visible caption carries the meaning | Reading out a grid of anonymous cells is noise. One sentence serves both audiences, and a caption is visible to everyone rather than announced to one. |
| The main menu | Gains a fourth entry | Earlier the menu was specified as exactly three entries. This is a deliberate amendment requested by the user, not a drift. |
| Which dialog | The existing one, reused | A second copy of the rules would drift from the first, and the dialog already handles focus, escape and the trigger reference. |

## Tasks

- [x] **H1 — Reachable from the main menu.** A fourth entry that opens the same dialog, with focus returning to the button that opened it.
- [x] **H2 — The examples.** A small board drawing, the three cases, and the after-state derived from the game rather than typed.
- [x] **H3 — The rules text.** Say what a press changes, that corners and edges have fewer neighbours, and what solved means.
- [x] **H4 — Tests and verification.** Including that each worked example is internally consistent with the rule it teaches.

## Known limitations to record

- The drawings are illustrations and are not interactive; the player cannot press them.
- They show a three by three board only, because the rule does not change with size.
