# Roadmap

## Rules not yet implemented

- **Optional rules** from the rulebook: Jack's Letters (moving patrols on later nights), False Clues, Rushing, Area Arrests, Catch Me If You Can (no hideout next to a red circle) and I Know Your Address.
- **Head of the Investigation tiles:** only needed when several people share the police.

## Board data

- Check the yellow-bordered crossings (`station`) against a printed board. The data has 7, exactly the number of patrol tokens, which leaves no choice of where to place them on the first night.

## Gameplay

- **Play as Jack** against computer police, or let two people play on one screen.
- **A stronger Jack** (see [Jack's AI](jack-ai.md#ideas-for-a-stronger-jack)), and difficulty levels.
- **Undo** for the police's last click within a phase.
- **Save and resume** a game in browser storage.
- **Show the police's deductions:** highlight circles Jack could be on, given the clues and moves so far.

## Interface

- Keyboard play for the board (moving focus between tokens with arrow keys).
- Zoom and pan on small screens, where the scaled board is small.
- Sound effects (whistles, footsteps) with a mute button.

## Code

- Split `js/script.js` into files for the game, Jack's AI and drawing.
- Speed up the full-game tests (most of their time is jsdom running jQuery selectors).
