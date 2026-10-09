# Roadmap

## Rules not yet implemented

- **Optional rules** from the rulebook: Jack's Letters (moving patrols on later nights), False Clues, Rushing, Area Arrests, Catch Me If You Can (no hideout next to a red circle) and I Know Your Address.
- **Head of the Investigation tiles:** only needed when several people share the police.

## Board data

- Check the yellow-bordered crossings (`station`) against a printed board. The data has 7, exactly the number of patrol tokens, which leaves no choice of where to place them on the first night.

## Gameplay

- **Two people on one screen.**
- **A Jack that hides his hideout across nights**, and other next steps for the strategic AI (see [Jack's AI](jack-ai.md#what-would-come-next)).
- **Stronger computer police**, in the order the [detective study](detective-inference-study.md#10-recommendations) ranks: guard the likely hideouts (H1) with hideout weights that don't assume Jack wanders (H2), and fix coach moves in the deduction (H3).
- **Hard difficulty:** a third Jack level, once there is an AI to justify it (see [Detective inference](detective-inference-study.md#10-recommendations) for what the police need first).
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
