# Feature: lights-out-win-modal

**Status:** in progress
**Branch:** `feat/bootstrap`
**Created:** 2026-10-01
**Workflow:** ODD (Organic Driven Development)

## Goal

Rebuild the end of a game. The completion content moves into a modal, the headline drops to the size of the other screen titles, and the fireworks keep running until the player has decided.

## Origin

Reported by the user after finishing a game. Three problems, in their order of severity as stated:

1. **The serious one.** The headline and the name field sat on top of the game summary. The "Show optimal sequence" button could not be clicked, and the two texts overlapped.
2. The fireworks froze instead of playing through.
3. `CONGRATULATIONS` was far too large.

They also proposed the shape of the fix: one modal holding the headline, then the summary with its button, then the name entry, with the fireworks behind it.

## The cause of the serious one

Two render paths both described the same moment and neither knew about the other. The summary with its button was rendered by the status panel as part of the game screen, while the headline and the form were a separate fixed overlay. Layering them is what produced both the overlap and the dead button.

So moving the content into a modal is not cosmetic: **the summary has to leave the status panel**. If it stayed there it would render twice, which is the same defect wearing a different hat.

## Decisions

| Decision | Chosen | Rationale |
| --- | --- | --- |
| Modal or custom overlay | The existing `Modal` | It already handles the focus trap, the escape key, the labelled dialog and the focus return. A second overlay would have to reimplement all of it and would drift. |
| The revealed sequence | Stays where it can be seen | It was already rendered as a list of coordinates, and the board is behind the modal, so the list is what makes the button meaningful. No new presentation is needed. |
| Escape and a backdrop click | Treated as Cancel | The alternative is a state where the dialog is gone and the score was never saved, which is a dead end rather than a choice. |
| The one second delay | Kept | The order was specified as headline, summary, then input, and the delay is what makes that order read as a sequence instead of a wall. |
| Fireworks behind the dialog | Visible, not dimmed away | The shared backdrop is 70 percent black. Fireworks behind that are a rumour rather than a decoration, so this dialog needs a lighter scrim or the layer has to move. |
| Fireworks duration | Until the dialog closes | They were a few second burst, which is why they appeared to freeze mid-game. They now run while the moment lasts. |
| Music default | **Unchanged, and it was already correct** | Verified before changing anything: a missing key reads as enabled, nothing writes the flag except the two toggles, and a refused autoplay does not touch it. A value seen as off is a stored preference, not a default. |

## Tasks

- [x] **W1 — The content moves.** The summary leaves the status panel, and the modal holds the headline, the summary with its button, and the form.
- [x] **W2 — The presentation.** The headline at the screen-title size, and the fireworks visible behind the dialog and running until it closes.
- [x] **W3 — Behaviour.** Escape and the backdrop cancel, the delay survives, the score still submits.
- [x] **W4 — Tests.** Including that the summary renders once, which is the testable form of the overlap.

## Known limitations to record

- The fireworks stop when the dialog closes, so the board is quiet afterwards.
- The revealed sequence stays revealed after the dialog closes, which is harmless because the screen is left behind at that point.
