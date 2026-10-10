# Changelog

Newest first. Each entry is one pull request; the reports it links hold the full results.

## Unreleased: detective coordination and inference

- **Study:** [Detective coordination and inference](detective-study.md) asks why Detective AI v3 loses, on the last night, from identical positions:
  - **Hideout inference** is the one large gap: told the true hideout, v3 wins 119 more games and loses 5 (Jack AI v2: 28 of 30 instead of 7). No weighting the police could use recovers it, including one that learns the Jack's route style.
  - **Coordinated blocking** loses (12 against 27 discordant games): it spreads the policemen away from the likeliest hideout.
  - **Interception:** of 102 lost last nights, a cut the police knew enough to make was missed 3 times.
  - No legal change beats v3; doubled blocking weight gains 1.5 points, not significant.
- **Recommendation:** no Detective AI v4. A study of new public evidence about the hideout comes first.
- **Tests:** `detective-study.test.js`.
- **Scripts:** `research/detective-study/`.

## Waiting against containment ([aceszhenwei/Letters-From-Whitechapel#19](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/19))

- **Study:** [Waiting against containment](waiting-containment.md) tests why strategic waiting seemed to beat Detective AI v3 on the last night. It does not:
  - Jack AI v2's last-night murders are never one walk from his hideout, so v3's containment never acts against him.
  - Waiting on the last night alone, with nights 1–3 played identically, changes nothing (−2.0 points, 95% CI −6.6 to +2.6, 250 paired games).
  - The overall gain from waiting is small and uncertain (0.0 on new seeds; +3.7 pooled).
- **`containWretched`,** re-tested against Jacks who wait, cuts first-move escapes after a wait but changes no win rate, so it stays off.
- **v3's waiting-aware threat model** has known inaccuracies (illegal neighbours, one step out, the police's choice ignored), but none costs a game in the data.
- **Recommendation:** no new Detective AI version. PR #17's report is corrected.
- **Tests:** `waiting-containment.test.js` (positions set up by hand).
- **Scripts:** `research/waiting-containment/`.

## The detective's tools ([aceszhenwei/Letters-From-Whitechapel#18](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/18))

- **Undo a policeman's move:** in Hunting the monster, the chosen policeman is ringed and his crossings are ringed in his colour. **Undo last move** takes moves back, newest first, until the player chooses **Done**. Moves can't be undone after that, since searches can reveal clues.
- **Night review:** when Jack reaches his hideout, the board stays as it was (policemen, crime scenes, clues, searches and failed arrests) until the player chooses **Begin the next night**. The **case files** show each night's log in order, can show any earlier night on the board read-only, and give walking distances from a crime scene or clue. All of it comes from `rules.nightRecord`, a frozen copy of the public record that never holds Jack's route or hideout.
- **Women and Wretched:** drawn as rings around their circles with a badge, so the numbers stay readable. Women are all alike (face down); the Wretched being moved is ringed. **Highlight** fades the rest of the map.
- **Engine:** two settings, `confirmPoliceMoves` and `reviewNights` (phase 12, The night is over), and the actions `undoPoliceMove`, `finishPoliceMoves` and `beginNextNight`. They are off by default, so simulations and the computer police play as before; the page turns them on. The golden traces are unchanged.
- **Fix:** a policeman who has moved shows his shield, not a face-down patrol's question mark.
- **Tests:** `police-undo.test.js`, `night-review-ui.test.js`. Screenshots: `tools/screenshots/capture.js`, `docs/images/night-review/`.

## Strategic waiting ([aceszhenwei/Letters-From-Whitechapel#17](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/17))

- **Study:** [Strategic waiting](jack-waiting.md) explains why Strategic Jack and Jack AI v2 never wait (a fixed rule, which is right against the original police) and measures what waiting is worth.
- **Policy:** strategic waiting (`js/ai/jack-waiting.js`, an option played by no level) waits only when its measured chance of escaping is higher than killing now, assuming the police move the victims where it hurts him most.
- **Results:** wrapped around Jack AI v2, it beat Detective AI v3 more often on two held-out seed sets (66.0% → 74.0%, p = 0.009; 67.0% → 71.0%, p = 0.13, the pre-registered test, not significant), without regressing against the other police. (The explanation given then, that the gain came from taking the last night's murder off the red circles v3 prepares, was withdrawn: see Waiting against containment above.)
- **Patrol information:** revealed patrols still change no decision.
- **Jack's view** gains `wretchedMoves(mapid)`: where the police could move a Wretched (public information).
- **Tests:** `jack-waiting.test.js`, and a smoke step.

## Fake Wretched and fake patrol audit ([aceszhenwei/Letters-From-Whitechapel#16](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/16))

- **Study:** [Fake Wretched and fake patrols](deception-audit.md) audits how each AI uses the preparation phase's deception. Both mechanics follow fixed rules, and against the current AIs perfect information about either is worth nothing measurable. No AI changed.

## Documentation cleanup ([aceszhenwei/Letters-From-Whitechapel#15](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/15))

- **Documentation reorganised** without changing any code, rule, AI or result. New: an [AI overview](ai.md) (every AI, level, option and the evidence behind it), a research-report index in the [documentation index](README.md#research-reports), one sorted [seed table](testing.md#seeds), and an [archive](archive/README.md) for superseded plans. The [roadmap](roadmap.md) now separates what is implemented, known limitations, potential research (not approved) and other ideas. The root README points to the index instead of repeating it.

## Detective AI v3 ([aceszhenwei/Letters-From-Whitechapel#14](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/14))

- **Detective AI v3** (`WC.policeVariants.v3`, the new **Hard police**): Detective AI v2 plus containment for the last night. On night 3 each policeman also values standing where he could stop Jack from killing next to his hideout and walking home on his first move (`js/ai/containment.js`). On nights 2–4 a station's patrol token is made real instead of a policeman's when it clearly closes more of the night's threat. On fresh seeds it more than doubles the police's wins against short-return Jacks (14.0% → 32.7%), stops the BoardGameGeek hideout-134 scheme every time, and matches v2 against the other Jacks (56.3% → 56.5%). Easy and Normal police are unchanged. See [Detective AI v3](detective-ai-v3.md).
- **Police options** for containment (`contain`, `containHideouts`, `containNeighbours`, `containEarly`, `containCoordinate`, `containPatrols`, `containSwap`, `containWretched`, `containTiming`, `containScale`), all off by default: the original police and v2 play exactly as before.
- **Study** (`research/detective-v3/`): a lifecycle audit of where the police can act, the failure analysis (positioning, not information), 19 screened configurations, a comparison, an ablation and a fresh-seed confirmation. Tests: `containment.test.js` (the tactical scenarios), the Hard level in `police-levels.test.js`, v3 in the smoke tier and a new medium step.

## Human strategy literature ([aceszhenwei/Letters-From-Whitechapel#13](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/13))

- **Study:** [Human strategy literature](human-strategy-literature.md) reviews five BoardGameGeek strategy threads and compares every claim with the AIs. The forum's board facts all match our map (an independent check on the map data). Two forum schemes that kill next to home beat Detective AI v2, because neither police prepares positions for the next night; a detective who expects Jack AI v2's detours beats it. Recommendation: research the detectives' cross-night positioning next. Scripts in `research/human-strategy/`; `test/unit/human-strategy-scenarios.test.js` pins the board facts. No AI or rule changed.

## A vanishing policeman ([aceszhenwei/Letters-From-Whitechapel#12](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/12))

- Choosing a second policeman before moving the first no longer makes the first disappear and stall the turn.

## Jack AI v2 ([aceszhenwei/Letters-From-Whitechapel#11](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/11))

- **Jack AI v2** (`js/ai/jack-v2.js`, the new **Hard** difficulty): the strategic Jack, unchanged, plus early detours. On every night but the last, while 6 moves would stay spare, his first moves walk away from his hideout. Against Detective AI v2 on development seeds it wins 70.5% of games, against 32.0% for the strategic Jack and 68.0% for Detour Jack. It also beats Detour Jack against the original police (95.5% against 91.5%) and uniform blocking (65.5% against 60.5%). Validation on unseen seeds is proposed, not yet run. See [Jack AI v2](jack-ai-v2.md).
- **The study** (`research/jack-v2/`): a diagnosis of the strategic Jack's losses (direct routes give the hideout away; the policemen then wall it off) and five candidate mechanisms screened and compared. Kept: early detours, and none on the last night. Left out: a waypoint planner, a way-home estimate around the policemen, random choice among near-best moves.
- **Harness:** `research/jack-v2/run.js` stores each game with a fingerprint of the files it depends on, so runs resume and unchanged games aren't replayed.
- **Tests:** `jack-v2.test.js` (14 tests); the Hard level in `difficulty.test.js`; Jack v2 in the smoke tier, in a new medium step and in the full tier. The strategic Jack, Detour Jack and the golden traces are unchanged.

## Detective AI v2 ([aceszhenwei/Letters-From-Whitechapel#10](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/10))

- **Detective AI v2** (`WC.policeVariants.v2`): the computer police weight the possible hideouts by how direct Jack's routes would have been to reach them, and stand between Jack and them. On fresh seeds it cuts the strategic Jack's win rate from 98.0% to 31.6%, the baseline Jack's from 21.8% to 12.6%, and a detouring Jack's from 88.8% to 63.0%. Coordination, a cordon, reachable-only hideouts and a lower arrest threshold were tested and left out. See [Detective AI v2](detective-ai-v2.md).
- **Watch the computer police:** the setup dialog asks who leads the detectives: you (the default), Easy police (the original AI) or Normal police (v2). `?police=` fixes it for testing. Jack's difficulty is unaffected.
- **Deduction fix:** a coach can no longer end where it started. The deduction now matches an exhaustive list of legal routes exactly; this sharpens both the police's beliefs and the strategic Jack's model of them.
- `deduction.hideouts` takes a weighting (`walk`, the default; `uniform`; `hybrid`). `WC.createPolice` takes the v2 options, all off by default, so the original police play exactly as before.
- Tests: `deduction.test.js` and `police-levels.test.js`; v2 in the smoke, medium and full test tiers.

## The verified board ([aceszhenwei/Letters-From-Whitechapel#9](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/9))

- **The map follows the physical board again.** The board was checked at the 13 places where this map and whitechapelR's differ, and agrees with this map in all of them. The whitechapelR topology overrides (`map.topologyCorrections`) are removed, and the three golden traces re-recorded for them (seeds 5, 7, 9) are back to their original recordings. `test/unit/map-topology.test.js` now pins the 13 board-verified connections. See [Map data](map-data.md#verified-against-the-board).
- **Test tiers:** fast, smoke, medium and full (`tools/tiers/`), with fingerprints so unchanged expensive steps are skipped. See [Testing](testing.md#test-tiers).
- **Detective study re-run on the verified board**, with the improved police's components measured separately, and compared with the earlier runs. See [Detective inference](detective-inference-study.md).

## Difficulty levels and a study of the detectives ([aceszhenwei/Letters-From-Whitechapel#8](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/8))

- **Jack's difficulty:** choose Easy (the baseline AI, the default) or Normal (the strategic AI) in the setup dialog. The level shows in the top bar and is remembered; `?difficulty=normal` (or the older `?jack=strategic`) fixes it for testing. Nothing else changes with the level. See [Jack's AI](jack-ai.md#difficulty-levels).
- **Map topology followed whitechapelR's** (since reverted: see above). Its map was treated as canonical: 10 walking links removed, 2 added and 1 alley added (`map.topologyCorrections`; the drawn streets are unchanged). `test/unit/map-topology.test.js` checks every link. Three golden traces (seeds 5, 7, 9) were re-recorded, because the baseline Jack walks the corrected links. Earlier simulation results are labelled as using the previous map. See [Map data](map-data.md#verified-against-the-board).
- **Study:** [Detective inference](detective-inference-study.md) compares the police's deduction with [whitechapelR](https://github.com/bmewing/whitechapelR), checks it against an exhaustive reference, and finds why the computer police lose to the strategic Jack. Scripts and results are in `research/detective-inference/`.

## A smarter Jack ([aceszhenwei/Letters-From-Whitechapel#7](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/7))

- **Strategic Jack** (`js/ai/strategic-jack.js`): values each move by the measured chance of surviving the police's next turn and of getting home in time, looks two moves ahead, and makes its Hell choices with the same estimates. It wins 97.2% of 5,000 games against a deductive police AI, where the baseline wins 25.0% (94.2% against 46.9% against random police). The baseline stays the default; `index.html?jack=strategic` plays the strategic AI. See [Jack's AI](jack-ai.md).
- **Public record and deduction:** the engine records what the police see each night (`state.police[n].log`); `js/core/deduction.js` works out from it alone where Jack could be and where his hideout could be. Jack's view gains `publicLog()`, `pastLogs()` and `patrols()`; a new `rules.policeView` gives a computer police player only what the police know.
- **Computer police** (`js/ai/police.js`): a deductive player and a random one, for simulations.
- **Simulation tools:** `tools/simulate.js` (many seeded games, in parallel), and `tools/sim/` to compare runs (with McNemar's test), replay a game, diagnose losses, calibrate the estimates and benchmark decisions. Results are in `experiments/`.
- **Tests:** properties of the strategic AI (legal moves, resources, urgency, avoiding danger, keeping tokens, determinism) and of what it may know. The golden traces are unchanged: the baseline plays exactly as before.

## Modules for maintainability ([aceszhenwei/Letters-From-Whitechapel#6](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/6))

- **`js/script.js` split into modules** with one job each: `core/board.js` (map queries), `core/rules.js` (what is legal), `core/engine.js` (state, phases, effects, events), `ai/jack.js` (Jack's decisions) and `ui/renderer.js` (drawing and clicks). See [Architecture](architecture.md).
- **One source of truth for the rules.** The engine, Jack's AI and the interface ask `rules.js` instead of each deciding legality.
- **Jack's AI is replaceable.** It is six decision functions, given a view of what Jack knows. The engine checks each decision against the rules.
- **No behaviour change.** Ten golden traces recorded before the refactor are reproduced step by step. One visible fix: a policeman keeps his colour from Hunting the monster into Clues and suspicion.
- **Tests:** the core, a headless game and Jack's AI are tested without a page. Architecture tests guard the module boundaries.
- **Moved:** vendored libraries to `js/vendor/`, data to `js/data/`.

## Clean-up ([aceszhenwei/Letters-From-Whitechapel#5](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/5))

- Removed the unused Bootstrap 3 files and the `user-interface.html` mock-up.
- README: our own description, credit to the original project, and a note that this is an unofficial fan project. Removed the original author's donation link.

## Interface and documentation ([aceszhenwei/Letters-From-Whitechapel#4](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/4))

- **New interface:** a dark Victorian frame around a parchment board, a sidebar with the current phase, instructions and progress, Jack's public status and a case log, plus intro and game-over dialogs.
- **Board:** circle numbers are visible, streets are drawn as dotted lines from the map data, and tokens are modelled on the physical pieces (coloured policemen, translucent clue and crime scene markers).
- **Responsive:** the board scales to fit; on narrow screens the page becomes one column with the instructions first.
- **Fixes:** phase text no longer repeats every round; map pieces have proper `px` positions (they only worked in quirks mode before).
- **Documentation:** a new `docs/` folder.

## Following the rulebook ([aceszhenwei/Letters-From-Whitechapel#3](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/3))

- Women and Wretched per night, patrol placement on later nights, and a hideout that is never a red circle.
- The Time of the Crime token, the order of Suspense grows and Ready to kill, Wretched movement limits, and crime scenes that stay all game.
- The double event, the move track (15 to 19 moves), escape only by a normal move, and one action per policeman.

## Alleys, coaches and tests ([aceszhenwei/Letters-From-Whitechapel#2](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/2))

- Alleys computed from the map's blocks, and Jack's coach and alley moves.
- Automated unit and regression tests with jsdom, run by GitHub Actions.
- Fixes: finding a clue redrew the map, Jack couldn't walk through map id 0, and crime scene tokens piled up.

## Game logic fixes ([aceszhenwei/Letters-From-Whitechapel#1](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/1))

- Fixed out-of-range random picks, the hideout choice, `jack.canMove`, Jack heading home, and several display bugs.
- Added game endings and new nights.
