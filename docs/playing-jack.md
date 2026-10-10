# Playing Jack

The player can play Jack the Ripper against the computer's detectives, as well as the five detectives against the computer's Jack. Both modes use the same engine, rules and AIs; this page explains how to play as Jack, how the mode is built, and what was done to keep it fair.

## Contents

1. [How to play as Jack](#1-how-to-play-as-jack)
2. [Choosing a role and a difficulty](#2-choosing-a-role-and-a-difficulty)
3. [The two interfaces compared](#3-the-two-interfaces-compared)
4. [How it is built](#4-how-it-is-built)
5. [Hidden information and fairness](#5-hidden-information-and-fairness)
6. [Game records](#6-game-records)
7. [Tests and playtesting](#7-tests-and-playtesting)
8. [Known limitations](#8-known-limitations)

## 1. How to play as Jack

In the setup dialog choose **Play as Jack**, then the detectives' difficulty, and **Begin the killing**. Each decision is made the same way: the phase card says what to decide and why. Tapping a ringed choice on the board selects it; nothing happens until you **Confirm**, so you can change your mind or **Cancel** freely.

| Step | What you do | Rules that apply |
|---|---|---|
| Hideout (once) | Tap any numbered circle that isn't red, then **Confirm the hideout** | The detectives never see it. Each night ends only when you **walk** onto it |
| The targets are identified (each night) | Tap red circles: once marks a woman (a possible victim), twice makes her a decoy, three times takes her away. **Confirm the women** when the counts are right | Night 1: 5 marked and 3 decoys; then 4+3, 3+3, 1+3 (fewer if crime scenes use up the red circles). The detectives see them all face down |
| Patrols | The detectives place 7 patrol tokens, face down: 5 real, 2 fake | |
| Blood on the streets | **Kill**: tap a Wretched (on the third night, the double event, two in order), then Kill. Or **Wait** | Waiting moves the Time of the Crime on (I → II …), one more move after the murder. The detectives then move each Wretched, and you reveal a patrol token. On V you must kill |
| Ready to kill (after waiting) | Tap a face-down patrol token, then **Reveal it** | A fake leaves the board; a real one stays face up |
| Escape in the night | Choose **Walk**, **Alley** or **Coach**, tap a ringed destination, and **Confirm the move**. A coach with several possible stops asks which (**via**) | A walk can't pass a crossing with a policeman. An alley cuts through a block; a coach goes two circles for two moves; both pass policemen and use a token. Only a walk onto the hideout ends the night |
| The detectives' turn | Watch: each policeman glides to his crossing, then searches or tries an arrest. **Skip to my turn** plays the rest at once | Every search and arrest is in the case log |

The phase card and the **You: Jack the Ripper** card always show where you are, your hideout, the moves left, the coaches and alleys left, your victims, and your route tonight. A kind of move that isn't available says why: "No alleys left tonight.", "A coach takes two moves, and you have only 1 left.", "Policemen block every walk from here."

You win by escaping on all four nights. You lose if a detective arrests you, if your last move doesn't reach the hideout, or if you can't move at all.

## 2. Choosing a role and a difficulty

| Role | Opponent difficulty | AI | Notes |
|---|---|---|---|
| **Play as the Detectives** (default) | **Normal** (default) | Strategic Jack | Unchanged |
| | **Hard** | Jack AI v2 ("Deceptive Jack v2") | Unchanged |
| | Developer Mode only | Baseline Jack; Jack AI v2 with strategic waiting | Unchanged |
| **Play as Jack** | **Easy** | Detective AI v2 | `WC.policeVariants.v2`, unchanged |
| | **Normal** (default) | Detective AI v3 | `WC.policeVariants.v3`, unchanged |

- Switching role in the dialog shows that role's difficulties, with that role's own saved choice or default selected. Each role saves its choice under its own key (`whitechapel.difficulty` for Jack's difficulty, `whitechapel.detectives` for the detectives'), so one role's choice never carries into the other.
- The detectives' difficulty is `WC.detectiveLevels` in `js/ai/police-levels.js`, and the role is `WC.roles` there. There is no Hard detective level.
- The address can fix both, for testing: `index.html?role=jack&detectives=easy`. An unknown role or level falls back to the default, so no invalid combination can start.
- Developer Mode (`?dev=1`) keeps its experimental Jacks and its "watch the computer police" choice, which applies only when the player plays the detectives; as Jack it is hidden and ignored. Developer Mode also shows which AI each level plays.

## 3. The two interfaces compared

| | Playing the detectives | Playing Jack |
|---|---|---|
| Top bar | "You are the police"; `Jack: Normal` | "You are Jack the Ripper"; `Detectives: Normal` |
| Board | Patrol choices, policemen to move, Search and Arrest pills | Your hideout (a gold house), you (a red pawn), your route tonight (numbered dots), your choices (rings); the patrol tokens face down, the policemen, crime scenes and clues |
| Women | All face down, alike | Marked (red) and decoys (purple): you know which |
| Phase card | Your instructions as the detectives | **Your turn** with your choices, or **The detectives' turn** with Skip |
| Jack card | What the police know: coaches, alleys, moves, victims | Everything you know: hideout, position, moves, tokens, victims, route |
| Case log | "Jack moves (move 3)." | "You walk to 42 (move 3)."; "The blue policeman moves to the crossing by 12/13."; "The yellow policeman searches 57, 56: no clue." |
| Night end | The board waits for **Begin the next night**, with the case files | The next night begins at once, with your women to place; the case files are there at the end |
| Ending | The result | The result from your side, and a summary: nights escaped, victims, hideout, circles searched and clues found, arrests attempted |
| Export | The police's record; the full record | Also **Download Jack's record** (your view) |

Zooming and panning work as before. On a touch screen the board starts zoomed in; your choices are at least 24 pixels across and always drawn above every other marker, so a tap always reaches them. On a narrow screen (one column, where the phase card is above the board) the status line and the buttons are repeated just under the board, so a choice made on the board is confirmed without scrolling back up. **Show the detectives' moves step by step** (in the phase card, remembered) turns the pacing off.

## 4. How it is built

No second game was written: the human Jack and the AI Jack go through the same engine code, and the detectives' AIs are the ones the other mode and the research use.

- **The engine** (`js/core/engine.js`) gained one setting, `humanJack`. With it, at each of Jack's decisions the engine reports `jackTurn` (`hideout`, `women`, `murder`, `reveal`, `move`; also `game.jackTurn()`) and waits, instead of asking `game.ai`. The page answers with `game.jackHideout(mapid)`, `jackWomen(marked, unmarked)`, `jackWait()`, `jackVictims(scenes)`, `jackReveal(mapid)` or `jackMove(move)`. Each checks the rules (`rules.isLegalHideout`, `isLegalWomen`, `mustKill`, `isLegalVictims`, `hiddenPatrols`, `isLegalJackMove`), refuses anything else without changing the state, and takes only the decision awaited, once. From there, the AI's decisions and the player's go through the same functions (`hideoutChosen`, `womenPlaced`, `jackWaits`, `jackKills`, `patrolRevealed`, `jackMoves`). The engine still owns validation, phases, movement, searches, arrests, the four nights and the endings.
- **The detectives** are played by `WC.ui.autoPolice` (`js/ui/autopolice.js`), as in Developer Mode's watching. It now hands the police AI `game.policeActions()`, a frozen object with only the police's methods, instead of the game; and the police view. A step never starts while another runs, twice, or after the game ends. Its pause can be a function of the phase, and `nudge()` takes the next step now: pacing only.
- **The interface:** `WC.ui.setRole('jack')` makes the renderer (`js/ui/renderer.js`) draw only what both sides share (map, phase card, move track). `WC.ui.jackPlayer` (`js/ui/jack-player.js`) draws Jack's board from the state at each event, draws his choices from the rules, sends confirmed decisions to the engine, writes the case log from his side, and paces the detectives (policemen glide one after another, with a CSS transition; Skip turns the pause and the glide off).
- **Setup** (`js/ui/setup.js`): the role choice; as Jack it sets `game.ai = null`, `humanJack`, no confirmation of police moves and no night review, picks the detectives' AI from `WC.detectiveLevels`, seeds their random numbers (`WC.random.seeded`), and starts `autoPolice` and `jackPlayer`.

Nothing in `js/ai/` that plays changed: not Strategic Jack, Jack AI v2, Detective AI v2 or v3, or the waiting policy. The research harnesses still pass the game to police AIs, as before.

## 5. Hidden information and fairness

**The detectives' AI sees only what detectives at the table would.**
- It is given the police's methods (`game.policeActions()`, which has no `state`, `ai` or `jackTurn`) and `rules.policeView`, which holds the board, the tokens, the crime scenes and the public record, never Jack's hideout, route or position.
- `test/unit/human-jack.test.js` checks this. On positions from real games against Detective AI v2 and v3, it changes Jack's hideout and his route tonight, and confirms two things: the police view is byte for byte the same, and the AI makes exactly the same moves.

**Jack's screen shows nothing of the detectives' reasoning.**
- `jackPlayer` listens only to the engine's events and reads the state for Jack's own pieces.
- It shows patrol tokens face down until he reveals one (`rules.jackView`). It never calls the deduction or a police AI, so no belief, route estimate or plan reaches the page.
- A test checks that the case log has no probabilities or beliefs.

**Same rules, same game.** A test plays a game with Strategic Jack, then makes exactly the same decisions through the human methods against the same police. The actions, results and final state are identical.

## 6. Game records

Human Jack games are recorded by the existing recorder ([Game records](game-records.md)) with no change to the format (schema version 1):

- `game.players` is `{ jack: { type: "human" }, police: { type: "ai", level, ai } }`, for example `"Detective AI v3"`.
- `game.randomness` is `{ source: "seeded", seed, uses: "the detectives' tie-breaks" }`. The detectives' AIs draw random numbers only to break ties, from a source of their own seeded per game; the same seed and Jack's same decisions give the same game.
- Every decision of both sides is an action, as before. A full record replays through `WC.record.replay` exactly as an AI game does: Jack's recorded decisions stand in for him.
- During play, the police's public record still hides the hideout and where Jack went. The Jack side's public record (`role: "jack"`, **Download Jack's record**) shows Jack's own sheet and only what he could tell about the patrols.

## 7. Tests and playtesting

| File | What it covers |
|---|---|
| `test/unit/human-jack.test.js` | The engine waiting for each decision; legal and illegal hideouts, women, kills, waits (refused on V), reveals and moves, each refused without changing anything and accepted once; tokens used; a coach onto the hideout not ending the night; out of moves, Jack winning, trapped, an arrest; the human path playing exactly the AI's game; the police's methods alone; Detective AI v2 and v3 deciding the same whatever Jack's secrets |
| `test/regression/human-jack-ui.test.js` | The role and difficulty choices (defaults, switching, saved choices per role, the address, Developer Mode); the hideout, women, kill, coach, alley and walk through the board; cancelling and switching moves changing nothing; a double tap making one move; the case log from Jack's side; Skip and pacing playing the same game; the detectives never overlapping or acting after the end; whole games against both difficulties; the record validating and replaying; the same seed giving the same game |
| `test/helpers/jack.js` | Plays Jack through the page as a person would (tapping the board and the buttons), for these tests |

**Playtesting.** Whole four-night games were played in Chromium by real clicks on a desktop (1280 × 900) and real taps on an emulated iPhone 13 (390 × 844, touch). The driver was a Playwright script that chose like a cautious player. It covered both difficulties and every step: the hideout, women, waiting and revealing, killing (with the double event), walks, coaches with a chosen stop, alleys, the detectives' turns, night transitions, walking home, and the ending. Three problems were found and fixed. Confirming a decision cleared the choices only after the engine had already drawn the next prompt, which emptied that prompt's state, so a victim couldn't be picked after a reveal; choices are now cleared before the decision is sent. A redrawn choice could be left under its old copy. And a static Wretched marker redrawn after an event could cover the victim choice; choices are now always drawn on top. The phone playthrough also showed that confirming meant scrolling back up past the board, hence the buttons under it.

## 8. Known limitations

- **No undo for Jack.** A confirmed decision stands, as at the table; only unconfirmed choices can be changed.
- **No night review for Jack between nights.** The next night starts at once, and the case files appear at the end. The review screens are written for the detectives (who must reconstruct Jack's route); a Jack-side review would show his own route.
- **The detectives' pacing is fixed.** Step by step, or all at once with Skip or the setting; there is no speed slider.
- **Waiting:** a human Jack may wait whenever the rules allow (not on V), independent of the experimental strategic-waiting AI, which no level plays.
- **The detectives' AIs were designed against computer Jacks.** How they fare against people is unmeasured. Records of human games (section 6) are the way to start, and are out of scope here.
- **Accessibility:** choices on the board can be reached with Tab and taken with Enter or Space, but with ~180 hideout choices this is slow; a list of circles to choose from would help keyboard and screen-reader players.
