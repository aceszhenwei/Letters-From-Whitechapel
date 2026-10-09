# Roadmap

## Rules not yet implemented

- **Optional rules** from the rulebook: Jack's Letters (moving patrols on later nights), False Clues, Rushing, Area Arrests, Catch Me If You Can (no hideout next to a red circle) and I Know Your Address.
- **Head of the Investigation tiles:** only needed when several people share the police.

## Board data

- Check the yellow-bordered crossings (`station`) against a printed board. The data has 7, exactly the number of patrol tokens, which leaves no choice of where to place them on the first night.

## Gameplay

- **Two people on one screen.**
- **Validate Jack AI v2 on unseen seeds** (proposed, waiting for approval: [Jack AI v2](jack-ai-v2.md#9-independent-validation-proposed-not-run)).
- **A smarter deception for Jack:** detours that vary in when and where they happen, and escape estimates recalibrated against blocking police (see [Jack AI v2](jack-ai-v2.md#10-limitations-and-future-work)).
- **Advanced coordinated containment:** police that plan cordons from time-dependent reachability, beyond [Detective AI v2](detective-ai-v2.md)'s blocking.
- **Police that see through Jack AI v2's detours**, for example by weighting hideouts by the route after an early detour.
- **Play as Jack** against the computer police in `js/ai/police.js`, which already plays from the police view.
- **Undo** for the police's last click within a phase.
- **Save and resume** a game in browser storage.
- **Show the police's deductions:** highlight circles Jack could be on, given the clues and moves so far (`js/core/deduction.js` already works them out).

## Interface

- Keyboard play for the board (moving focus between tokens with arrow keys).
- Zoom and pan on small screens, where the scaled board is small.
- Sound effects (whistles, footsteps) with a mute button.

## Code

- Speed up the page tests (most of their time is jsdom running jQuery selectors). Moving more of them to the core and headless layers would help.
- Give the default AI its own seeded random source, so interface changes can never shift Jack's choices (this changes the golden traces, so it needs a deliberate re-recording).
- Name the phases instead of numbering them (0 to 11) across the engine, the interface and the content.
