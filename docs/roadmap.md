# Roadmap

This page keeps four things apart: what is **implemented**, its **known limitations**, **potential research** that has been proposed but not approved, and **other ideas** nobody has scheduled. Nothing under the last two is committed work. Earlier plans, and what became of them, are in the [archive](archive/plans.md).

## Implemented

- **The game:** the revised edition's standard rules, for one player as the police against a computer Jack, or as Jack against the computer's detectives ([Playing Jack](playing-jack.md)) ([Game rules](game-rules.md)), on a map verified against the physical board ([Map data](map-data.md#verified-against-the-board)).
- **Play online:** https://aceszhenwei.github.io/Letters-From-Whitechapel/, published from `master` ([Deployment](deployment.md)), playable on phones (zoom and pan).
- **Computer players:** as the detectives, players choose Jack's difficulty, Normal (Strategic Jack) or Hard (Jack AI v2); as Jack, the detectives' difficulty, Easy (Detective AI v2) or Normal (Detective AI v3). Developer Mode (`?dev=1`) adds Baseline Jack, an experimental Jack with strategic waiting, and three computer police levels (original, Detective AI v2, Detective AI v3) to watch instead of playing ([AI overview](ai.md)).
- **The detective's tools:** undoing a move, reviewing each night, faster searching, zooming the board ([User interface](ui.md#the-detectives-tools)).
- **Game records:** players can export a game (the police's record at any time, the full record once it is over), and `npm run research:import` checks, replays and summarises the files ([Game records](game-records.md)).
- **Testing:** fast, smoke, medium and full tiers, with fixed seed ranges for every experiment ([Testing](testing.md)).

The [changelog](changelog.md) lists every change, pull request by pull request.

## Known limitations

**Rules** (details in [Game rules](game-rules.md#not-implemented)):
- The optional rules (Jack's Letters, False Clues, Rushing, Area Arrests, Catch Me If You Can, I Know Your Address) and the Head of the Investigation tiles are not implemented.
- Playing Jack has no undo and no review between nights ([Playing Jack §8](playing-jack.md#8-known-limitations)).
- The map has 7 yellow-bordered crossings, exactly the number of patrol tokens; they have not been checked against a printed board ([Known differences](game-rules.md#known-differences-from-the-physical-board)).

**AIs** (details in each report's limitations section):
- **Every result is AI against AI.** No level is a claim about how hard a person would find it. Exported human games ([Game records](game-records.md)) are the way to start measuring that.
- **Detective AI v3 has not been validated on unseen seeds**; the validation is proposed below. Jack AI v2's was run ([Jack AI v2 §9](jack-ai-v2.md#9-independent-validation)): confirmed against Detective AI v2, but 4.5 points behind Strategic Jack against the original police, and its edge over Detour Jack is not established.
- **Strategic Jack** gives his hideout away with direct routes, and his escape and arrest estimates were measured against the original police ([Jack's AI §10](jack-ai.md#10-remaining-weaknesses)).
- **Jack AI v2**'s gain depends on Detective AI v2's directness model; his detours always come first and lead away, so they are predictable in shape; once the hideout is walled off he still hovers near it ([Jack AI v2 §10](jack-ai-v2.md#10-limitations-and-future-work)).
- **Detective AI v2** has no cordon planning or time-dependent reachability, and trades searching for blocking ([Detective AI v2 §9](detective-ai-v2.md#9-limitations-and-future-work)).
- **Detective AI v3** contains only one-walk escapes and prepares only the last night; short-return Jacks still win 58–78% against it ([Detective AI v3 §13](detective-ai-v3.md#13-limitations)).

**Code:**
- The page tests are slow: most of their time is jsdom running jQuery selectors.
- The default Jack AI shares the page's random source, so an interface change that draws random numbers could shift Jack's choices.
- The phases are numbered (0 to 12) rather than named across the engine, the interface and the content.

## Potential research (not approved)

Proposals made by the reports. **None is approved or scheduled**; each would need a decision first, and the validations need approval to run.

| Proposal | Proposed in | Status |
|---|---|---|
| Validation of `safe-skip` (Jack AI v2 whose detour steps avoid the policemen's reach): 400 games against v2, v3 and the original police on seeds 595001–595400; then whether Hard should use it | [Adaptive deception §11](jack-adaptive.md#11-recommendation) | Idea (kept as experimental) |
| Independent validation of Detective AI v3: 8,000 games on seeds 480001–480500 | [Detective AI v3 §14](detective-ai-v3.md#14-conclusion) | Awaiting a decision |
| Containment for two-move escapes and for earlier nights; a Jack that adapts to visible containment as a robustness opponent | [Detective AI v3 §14](detective-ai-v3.md#14-conclusion) | Idea |
| Detectives that learn a Jack's habitual detour from earlier nights (simple ones that forgive detours did not beat Jack AI v2, and a Jack that varies his detours at random or by the police's guarding lost: [Adaptive deception](jack-adaptive.md)) | [Human strategy literature §10](human-strategy-literature.md#10-prioritised-recommendations), [Jack AI v2 §10](jack-ai-v2.md#10-limitations-and-future-work) | Idea |
| Coordinated containment: cordons from time-dependent reachability, policemen assigned to approaches (*not supported:* on the last night, coordination loses and missed cuts come from the hideout belief, not the decision; [Detective coordination and inference](detective-study.md)) | [Detective AI v2 §9](detective-ai-v2.md#9-limitations-and-future-work) | Not planned |
| Hideout inference from new public evidence (routes relative to the policemen, coach and alley use), measured offline against the oracle ceiling first | [Detective coordination and inference §9](detective-study.md#9-recommendation) | Idea |
| Recalibrating Jack's escape and arrest estimates against blocking police | [Jack AI v2 §10](jack-ai-v2.md#10-limitations-and-future-work) | Idea |
| Cross-night victim and hideout planning for Jack, evaluated only against containing police | [Human strategy literature §10](human-strategy-literature.md#10-prioritised-recommendations) | Idea |
| Strategic waiting as a difficulty level, after a larger validation (its gain against v3 is now in doubt: [Waiting against containment](waiting-containment.md)); a version that tells the police apart or values hiding the hideout across nights | [Strategic waiting §8](jack-waiting.md#8-limitations) | Idea |
| Reading the BoardGameGeek threads not yet collected | [Human strategy literature §10](human-strategy-literature.md#10-prioritised-recommendations) | Waiting for the threads |

## Other ideas (not scheduled)

- **Gameplay:** two people on one screen; play as Jack against the computer police (`js/ai/police.js` already plays from the police view); undo patrol placement or a Wretched's move as moves can be undone now; save and resume a game in browser storage; show the police's deductions (where Jack could be, from `js/core/deduction.js`).
- **Interface:** keyboard play for the board; pinch to zoom the board itself; sound effects with a mute button.
- **Code:** move more page tests to the core and headless layers; give the default AI its own seeded random source (this changes the golden traces, so it needs a deliberate re-recording); name the phases.
