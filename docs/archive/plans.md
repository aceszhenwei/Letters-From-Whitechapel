# Historical plans

Plans written in earlier documents, and what became of them. The plans are left unchanged where they were written; this page only records their outcome. For what is planned or proposed now, see the [roadmap](../roadmap.md).

## Plans in the reports

| Plan | Written in | What became of it |
|---|---|---|
| Value the hideout across nights (routes that don't give it away) | [Jack's AI, What would come next](../jack-ai.md#what-would-come-next), 1 | Taken up by [Jack AI v2](../jack-ai-v2.md): early detours |
| Simulate the police's next move instead of their reach | [Jack's AI](../jack-ai.md#what-would-come-next), 2 | Not done |
| Measure the arrest estimate per situation | [Jack's AI](../jack-ai.md#what-would-come-next), 3 | Not done; Jack AI v2's study found the table roughly calibrated against Detective AI v2 and did not prototype it |
| A stronger police AI to test Jack against | [Jack's AI](../jack-ai.md#what-would-come-next), 4 | [Detective AI v2](../detective-ai-v2.md), then [v3](../detective-ai-v3.md) |
| H1–H3: positioning that uses the hideout, hideout weights that don't assume Jack wanders, the coach fix | [Detective inference §10](../detective-inference-study.md#10-recommendations) | Implemented in [Detective AI v2](../detective-ai-v2.md) |
| M1: arrest decisions by expected value | [Detective inference §10](../detective-inference-study.md#medium-priority-promising-needs-validation) | Only a lower threshold was tried, in Detective AI v2, and left out |
| M2: coordinated positioning | [Detective inference §10](../detective-inference-study.md#medium-priority-promising-needs-validation) | Not as a joint assignment. A sequential form (later policemen credited only for what earlier ones leave) was rejected for v2's blocking and kept for v3's containment (`containCoordinate`) |
| M4: evaluate against a population | [Detective inference §10](../detective-inference-study.md#medium-priority-promising-needs-validation) | Adopted by later studies: Jack AI v2 against three police, Detective AI v3 against eight Jacks |
| M3, L1, L3, L4 | [Detective inference §10](../detective-inference-study.md#medium-priority-promising-needs-validation) | Not done (L2, the map check, was done) |
| Deceptive Jack | [Detective AI v2 §9](../detective-ai-v2.md#9-limitations-and-future-work) | [Jack AI v2](../jack-ai-v2.md) |
| Advanced coordinated containment; re-measuring Strategic Jack's risk tables against v2 | [Detective AI v2 §9](../detective-ai-v2.md#9-limitations-and-future-work) | Open: [roadmap](../roadmap.md#potential-research-not-approved). Detective AI v3's containment covers one-walk escapes only |
| 1: police that value end-of-night positions next to likely hideouts | [Human strategy literature §10](../human-strategy-literature.md#10-prioritised-recommendations) | [Detective AI v3](../detective-ai-v3.md) |
| 2: hideout-aware Wretched movement | [Human strategy literature §10](../human-strategy-literature.md#10-prioritised-recommendations) | Tried in Detective AI v3 (`containWretched`) and left out |
| Detective AI v4: leave fake Wretched and fake patrols out of its core, and add a patient, observant Jack to its validation | [Deception audit](../deception-audit.md#summary) | Not built: [Detective coordination and inference](../detective-study.md#9-recommendation) found no weakness that a change the police could make would fix |
| Detective AI v4's evaluation: include Jack AI v2 with strategic waiting; no waiting-specific containment | [Strategic waiting §9](../jack-waiting.md#9-implications-for-detective-ai-v4), [Waiting against containment §7](../waiting-containment.md#7-recommendation) | The waiting Jack was an opponent in the detective study; no v4 was built |
| Ideas once in the roadmap: undo the police's last click; zoom and pan on small screens | The roadmap | Done: undoing a policeman's move ([aceszhenwei/Letters-From-Whitechapel#18](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/18)); zooming the board ([aceszhenwei/Letters-From-Whitechapel#25](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/25)) |
| 3–5: detour-aware detectives, cross-night planning for Jack, the uncollected threads | [Human strategy literature §10](../human-strategy-literature.md#10-prioritised-recommendations) | Open: [roadmap](../roadmap.md#potential-research-not-approved) |

## The roadmap before the documentation cleanup

As it stood after Detective AI v3, unchanged except for its links (now relative to this folder). It mixed limitations, proposals and ideas; the current [roadmap](../roadmap.md) separates them.


### Rules not yet implemented

- **Optional rules** from the rulebook: Jack's Letters (moving patrols on later nights), False Clues, Rushing, Area Arrests, Catch Me If You Can (no hideout next to a red circle) and I Know Your Address.
- **Head of the Investigation tiles:** only needed when several people share the police.

### Board data

- Check the yellow-bordered crossings (`station`) against a printed board. The data has 7, exactly the number of patrol tokens, which leaves no choice of where to place them on the first night.

### Gameplay

- **Two people on one screen.**
- **Validate Jack AI v2 on unseen seeds** (proposed, waiting for approval: [Jack AI v2](../jack-ai-v2.md#9-independent-validation)). *Run in Study J3: confirmed against Detective AI v2, edge over Detour Jack not established.*
- **A smarter deception for Jack:** detours that vary in when and where they happen, and escape estimates recalibrated against blocking police (see [Jack AI v2](../jack-ai-v2.md#10-limitations-and-future-work)). *Tested in [Adaptive deception](../jack-adaptive.md): varying detours at random or by the police's guarding lost; skipping detour steps within the policemen's reach gained a little and is kept as experimental.*
- **Advanced coordinated containment:** police that plan cordons from time-dependent reachability, beyond [Detective AI v2](../detective-ai-v2.md)'s blocking.
- **Validate Detective AI v3 on unseen seeds** (proposed, waiting for approval: [Detective AI v3](../detective-ai-v3.md#14-conclusion)), and extend its containment to two-move escapes and earlier nights.
- **Police that see through Jack AI v2's detours** by learning a Jack's habit from earlier nights (a fixed detour-aware model beats Jack AI v2 but loses to a direct Jack).
- **Play as Jack** against the computer police in `js/ai/police.js`, which already plays from the police view.
- **Undo** for the police's last click within a phase.
- **Save and resume** a game in browser storage.
- **Show the police's deductions:** highlight circles Jack could be on, given the clues and moves so far (`js/core/deduction.js` already works them out).

### Interface

- Keyboard play for the board (moving focus between tokens with arrow keys).
- Zoom and pan on small screens, where the scaled board is small.
- Sound effects (whistles, footsteps) with a mute button.

### Code

- Speed up the page tests (most of their time is jsdom running jQuery selectors). Moving more of them to the core and headless layers would help.
- Give the default AI its own seeded random source, so interface changes can never shift Jack's choices (this changes the golden traces, so it needs a deliberate re-recording).
- Name the phases instead of numbering them (0 to 11) across the engine, the interface and the content.
