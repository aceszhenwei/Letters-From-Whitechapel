# Changelog

All notable changes to *Letters From Whitechapel*, newest first. Versions follow the convention in [Releasing](docs/releasing.md#versioning): **major** for changes that break saved game records or the rules as played, **minor** for new features, **patch** for bug fixes. Each release lists its changes pull request by pull request; the reports they link hold the full results.

## Unreleased

#### Automatic playtest collection

- **Fix: import pull requests now keep `analysis-state.json`'s snapshot current.**
  - **The failure:** the first import (#34) added a game without refreshing the snapshot of games awaiting review, so `playtests-dataset.test.js` failed on it.
  - **The fix:** the import now refreshes the snapshot, as `--update-state` does. The path guard accepts `analysis-state.json` only when nothing but its `snapshot` changed. No game is marked analysed.
- **Anonymous Gameplay Research** ([Automatic playtest collection](docs/automatic-playtest-collection.md)): when the site is built with a playtest intake, the full record of each game a person finishes, in either role, is submitted automatically after it is kept in the browser.
  - **The setting:** on by default, with a clear notice in the setup dialog before play and a **Research** button in the top bar. Turning it off is remembered, cancels waiting games and stops retries, and never sends games played while it was off. Global Privacy Control and Do Not Track start it off.
  - **Sending:** in the background, one game at a time, with bounded exponential backoff that honours `Retry-After`; offline games wait. No cookie, referrer or identifier is sent. The game never waits for it.
  - **Status:** each kept game has a submission status (not submitted, pending, submitting, submitted, will retry or retry required, permanently rejected), independent of its export status. The ending dialog shows it with the game ID, and Developer Mode's playtest records gain an **Online** column and a **Submit** button.
  - **Off unless configured:** without the repository variable `PLAYTEST_API_URL`, the site sends nothing and shows none of this.
- **The intake** (`worker/`, a separate Cloudflare Worker on the free plan, with a private D1 database):
  - **Checks:** structural checks only (format, schema, rule set, a completed game one person played, a safe game ID, no extra fields or notes), plus size limits;
  - **Abuse limits:** a per-address rate limit, daily, count and size caps, and an emergency pause;
  - **Storage:** atomic, never-overwriting storage by game ID, with duplicates told from conflicts;
  - **Import:** read-only import endpoints behind a token;
  - **Retention:** a daily job deletes submissions after 365 days.

  Nothing about the sender is stored. D1 was chosen over R2 because R2 needs a payment method and bills past its allowance; the Free plan cannot bill.
- **Daily import** (`playtest-import.yml`, `tools/playtests/intake.js`, `import-pr.js`):
  - downloads new submissions and replays each with the collection's existing checks;
  - writes eligible records byte for byte with a provenance ledger (`research/human-playtests/intake.json`);
  - opens or updates one **Import human playtests — date** pull request, never commits to master, and never marks a game as analysed.
- **Deployment** (`playtest-worker.yml`, `worker/scripts/deploy.mjs`): deploy, pause or resume by hand. The Pages build writes the intake address from `PLAYTEST_API_URL`.
- **`npm run playtests`** also counts games by source and checks that imported records are unchanged.
- **Privacy text revised** wherever it said nothing is sent: the UI, `docs/playtests.md`, `docs/game-records.md` and the README.
- **Tests:** the Worker (against Node's SQLite running the real migrations), the browser queue, the importer and pull request, the site build, and an end-to-end test from a Human Jack game in the page to the five-game counter. Also checked once by hand in Cloudflare's local runtime (`wrangler dev`), which found two bugs now fixed and guarded by tests.
- **Gameplay, AIs and the record format are unchanged.**

#### Human playtest collection

- **Games are kept automatically:** every game a person finishes, as Jack or as the detectives, is saved as its full game record in the browser's IndexedDB.
  - Each game is kept once, by its game ID; unfinished games and games the computer played alone are not kept.
  - The ending dialog says whether the game was kept. If storage fails, the game plays on and the existing export still works.
  - Nothing is sent anywhere.
- **Playtest records** (Developer Mode, in the top bar or the setup dialog): a table of the kept games, with:
  - **Export new playtests** (a ZIP of the games not exported yet), **Export selected**, **Export all (again)**, and one JSON per game;
  - import of JSON files or batch ZIPs, each checked by a full replay first: duplicates are skipped, and conflicts and bad files are reported, never overwriting;
  - delete, and clear after confirming.

  A record is marked exported once its ZIP's download has started. Exporting never uploads.
- **The research collection** `research/human-playtests/`:
  - one full record per game, `records/<game id>.json`;
  - `reports/`;
  - `analysis-state.json`, recording which games reports have covered, the methodology version, AI changes and a snapshot of the games awaiting review.
- **`npm run playtests`** (`tools/playtests/dataset.js`) checks every record with the existing importer and its full replay. It reports:
  - invalid, misnamed, ineligible, duplicate, conflicting and incompatible files;
  - the research batch: **Collecting**, or **Ready for Review** at five new games;
  - cumulative statistics by cohort (app version, rule set, role, opponent, difficulty).

  It also records completed analyses. **`npm run playtests:add`** copies valid records from exported files into the collection.
- **GitHub Actions** (`playtests.yml`) checks the collection on every change to it, read-only, with a summary and annotations. It shows a notice when a research batch is ready. The Pages workflow no longer redeploys for changes to the collection alone.
- **The first human game**, `g91d4014f17ae09e6`: Human Jack against Detective AI v3 (Normal), Jack escaped all four nights.
  - Verified by full replay, added unchanged, and counted once.
  - It is collected and awaiting review: no analysis has been done.
- **The second human game**, `ga36125530c4b4076` (the same matchup, Jack escaped again), uploaded and renamed to its game ID.
- **The first research report**, [an investigation](research/human-playtests/reports/2026-10-11-investigation-arrests.md) of both games, commissioned once to test the workflow. Detective AI v3 never arrested because no arrest was ever likely; this is not a defect. v3's belief stayed more diffuse against this player than against the computer's Jacks, which is recorded as a pattern to watch. Both games are now analysed. No AI changed.
- **Not changed:** the rules, the AIs, the difficulty levels, and the game record format (schema version 1).
- **Tests:** `playtests-store.test.js`, `playtests-dataset.test.js` and `playtests-ui.test.js`, with `fake-indexeddb` as the browsers' storage (a development dependency only).
- **Research process** in two tiers: a 1–2-page triage report for each batch of five games, and separate, targeted investigations only when triage, a recurring pattern or an alarming game gives a reason; cumulative reviews after about 20 games look at trends. Findings are labelled as patterns to watch, defect candidates, confirmed defects or confirmed strategic weaknesses. With a batch-report template and assignment prompts ([Commissioning an analysis](docs/playtests.md#commissioning-an-analysis)).
- **Docs:** see [Human playtests](docs/playtests.md).

## v1.0.0 (2026-10-10)

The first formal release: the complete four-night game, playable online on computers and phones, as the detectives or as Jack. Release notes: [docs/releases/v1.0.0.md](docs/releases/v1.0.0.md).

### Highlights

- **The complete game:** the revised edition's rules over four nights, including the double event, real and fake patrols, the Time of the Crime with waiting, coaches and alleys, searching and arresting, on a map verified against the physical board.
- **Two ways to play:** lead the five detectives against the computer's Jack (Normal: Strategic Jack; Hard: Jack AI v2), or play Jack against the computer's detectives (Easy: Detective AI v2; Normal: Detective AI v3).
- **Play anywhere:** published on GitHub Pages, with zooming and panning, large touch targets and an interface laid out for phones.
- **The detective's tools:** undoing moves, reviewing each night with walking distances, faster searching.
- **Game records:** export a game as a versioned JSON record, then check, replay and summarise records offline.
- **Developer Mode** (`?dev=1`): every AI level, experimental Jacks, and computer police to watch.
- **Research infrastructure:** a headless engine, seeded simulations, test tiers, and pre-registered studies behind every AI, with negative results recorded.

### Changes by pull request

#### Play as Jack ([aceszhenwei/Letters-From-Whitechapel#28](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/28))

- **Play as Jack** against the computer's detectives, from the ordinary setup dialog: **Play as the Detectives** (the default, unchanged) or **Play as Jack**. As Jack the opponent is **Easy** (Detective AI v2) or **Normal** (Detective AI v3, the default); each role keeps its own saved difficulty. The address can fix both: `?role=jack&detectives=easy`. See [Playing Jack](docs/playing-jack.md).
- **Jack's interface:**
  - Choose a hideout, place the women (marked or decoys), kill or wait, and reveal a patrol token.
  - Walk, take a coach (choosing its stop) or slip through an alley.
  - Every choice is drawn from the rules and confirmed before it counts. Cancel and switching the kind of move cost nothing, and a move that isn't available says why.
  - The board shows the hideout, Jack, his route tonight and his choices; the Jack card shows everything he knows.
  - The case log is in his words, and the ending has a summary.
  - The detectives' turns are paced so they can be followed (policemen glide one after another), with **Skip to my turn** and a setting to turn the pacing off.
  - On phones, the choices are large enough to tap and always on top.
- **Engine:**
  - One setting, `humanJack`: the engine waits for each of Jack's decisions (`jackTurn`) and takes them through `jackHideout`, `jackWomen`, `jackWait`, `jackVictims`, `jackReveal` and `jackMove`. They share their code with the AI's decisions, so both play by the same rules: a test makes an AI's decisions by hand and gets exactly the AI's game.
  - `policeActions()` gives a computer police player the police's methods alone. The page's computer police now get only these and the police view, never the game or its state.
- **Fairness:** tests check that Detective AI v2 and v3 make exactly the same moves whatever Jack's hideout and route, and that Jack's screen shows none of their reasoning.
- **Game records:** unchanged format. A human Jack game records `players.jack.type: "human"`, the detectives' AI, and the seed of their tie-breaks. The record replays exactly. The export dialog adds **Download Jack's record**.
- **Unchanged:** Strategic Jack, Jack AI v2, Detective AI v2 and v3, the waiting policy, the research harnesses, and the detectives' mode (apart from the role choice in the dialog).
- **Tests:** `human-jack.test.js` (11) and `human-jack-ui.test.js`, with `test/helpers/jack.js` playing Jack through the page. Whole games were also played by real clicks and taps in Chromium on a desktop and an emulated iPhone 13.

#### Adaptive deception, Study J3 ([aceszhenwei/Letters-From-Whitechapel#27](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/27))

- **Study:** [Adaptive deception under opponent uncertainty](docs/jack-adaptive.md) asks whether Jack can choose how much to deceive from what he sees of the police. It was pre-registered, with development, selection and held-out seeds (21,200 games) and six detectives, two held out. Two of the detectives were built for the study to forgive Jack AI v2's detours.
- **Results:**
  - Reading the police across nights fails: the signal is the same against every detective, and relaxing deception costs 5–14 points.
  - Varying deception at random loses 3.7 points.
  - `safe-skip`, Jack AI v2 whose detour steps avoid the policemen's next-turn reach, gains +4.1 points on held-out seeds (+1.6 to +6.7) and +3.1 over a control that skips as often at random, with no regression. It misses the pre-registered +5-point bar and doesn't behave differently by detective. **Recommendation B: kept as experimental**; no AI or difficulty level changed.
- **Jack AI v2's independent validation** ran (9,000 games, seeds 760001–761000):
  - It beats Strategic Jack against Detective AI v2 (65.8% against 30.0%).
  - Its edge over Detour Jack is not established (p 0.068).
  - It is 4.5 points behind Strategic Jack against the original police ([Jack AI v2 §9](docs/jack-ai-v2.md#9-independent-validation)).
- **Scripts:** `research/jack-adaptive/`. **Tests:** `jack-adaptive.test.js`.

#### Repository clean-up ([aceszhenwei/Letters-From-Whitechapel#26](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/26))

- **Removed files nothing used** (all still in the git history): `construction/whitechapel.ai` (the board's Illustrator source, 5.9 MB), `svg/` (three street drawings; the game draws the streets from the map data), `images/whitechapel-numbers.jpg`, `css/font-awesome.css` (the page loads the minified copy) and `fonts/FontAwesome.otf` (the stylesheet loads the web fonts). The published site is 1.5 MB instead of 2.6.
- **Moved** `generate-svg-map.html` to `tools/`.
- **Documents brought up to date:** the roadmap (what is implemented now, ideas done), the architecture (the game record, the workflows, the files), the interface's layout, contributing (the online game, `npm run site`), and notes in two reports that no Detective AI v4 was built; [Historical plans](docs/archive/plans.md) records what became of those plans.

#### Playable on phones ([aceszhenwei/Letters-From-Whitechapel#25](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/25))

- **Zooming the board:** **−**, **Fit** and **+** above the board; zoomed in, the board scrolls with a finger instead of shrinking. Touch screens start zoomed in, so numbered circles are about 21 pixels across (4–6 before, on a phone) and every tap target at least 20. After each step the board scrolls to what can be tapped. Desktop starts at Fit, as before.
- **Fixes:** the Stay pill could cover a destination ring, which then couldn't be clicked; destination rings are now drawn above it. In Clues and suspicion, tapping a policeman brings his Search and Arrest pills to the front where neighbours' pills overlap. Watching the computer police, the board can now be scrolled.
- **Checked** on emulated iPhone SE, Galaxy S8, iPhone 13, Pixel 7 and iPad Mini, tapping real elements: whole games reach a legal ending.

#### Searching fixed, and faster ([aceszhenwei/Letters-From-Whitechapel#24](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/24))

- **Fixed a softlock in Clues and suspicion:** a policeman who had chosen to search could lose all his Search here tokens when another policeman found a clue (or another's failed arrest removed his Arrest here tokens), so the phase could never end. Policemen now act one at a time, and each token belongs to its policeman.
- **Faster searching:** **Search his remaining circles** finishes the chosen policeman's search, and **Search with every policeman left** searches with every policeman still to act who can search. Both search in the same order a player would click, stopping each search at its first clue; no rule changed.
- **Tests:** in `ui-flows.test.js`, the reported case, two policemen beside the same circle, and both buttons.

#### Play online ([aceszhenwei/Letters-From-Whitechapel#23](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/23))

- **The game is on GitHub Pages:** https://aceszhenwei.github.io/Letters-From-Whitechapel/, linked at the top of the README.
- **Deployment** ([Deployment](docs/deployment.md)): `.github/workflows/pages.yml` runs the fast tests, stages only the game's files (`tools/site/build.js`, `npm run site`, which also checks every asset reference), and publishes on each push to `master` or by hand.
- No change to the game: every path was already relative.

#### A simpler setup, and Developer Mode ([aceszhenwei/Letters-From-Whitechapel#22](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/22))

- **Setup:** players choose only Jack's difficulty, **Normal** (the default, Strategic Jack) or **Hard** (Jack AI v2), by name, with no description of how Jack plays. The player always leads the detectives.
- **Developer Mode** (`index.html?dev=1`) shows every level with its AI:
  - Easy (Baseline Jack);
  - an experimental **Hard, waiting** level (Jack AI v2 with strategic waiting);
  - who leads the detectives, the player or the computer police.

  Its choices are saved under their own keys, and a saved choice the ordinary dialog doesn't offer is ignored, so developer settings never carry into an ordinary game.
- **Addresses** (`?difficulty=…`, `?police=…`) still select any level, with or without Developer Mode, for tests and research.
- No AI or rule changed.

#### Game records ([aceszhenwei/Letters-From-Whitechapel#21](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/21))

- **Export the game log:** **Game log** in the top bar, or **Export game log** at the end, saves the game as a JSON file on the device. The police's record (no spoilers) is available at any time. The full record (Jack's hideout and route) is available once the game is over, or after the player ends it and confirms. Nothing is sent anywhere.
- **A versioned record** ([Game records](docs/game-records.md)):
  - every action that stands, Jack's and the police's, in order, with its night, phase, Jack's move count and how much of the night's public record had been seen;
  - undone moves and patrol tokens taken back are kept apart;
  - the rule set, the levels played, the settings and the outcome.
- **The engine** reports each decision it accepts as an `action` event. No rule, AI or difficulty level changed.
- **Importer:** `npm run research:import` checks records (structure, hidden information, consistency with each night's public record), replays full records exactly through the engine, rejects malformed, tampered and incompatible ones, summarises many games, and cuts test fixtures from a full record.
- **Examples:** four synthetic records in `docs/examples/game-records/`.
- **Tests:** `game-records.test.js`, `game-export-ui.test.js`.

#### Detective coordination and inference ([aceszhenwei/Letters-From-Whitechapel#20](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/20))

- **Study:** [Detective coordination and inference](docs/detective-study.md) asks why Detective AI v3 loses, on the last night, from identical positions:
  - **Hideout inference** is the one large gap: told the true hideout, v3 wins 119 more games and loses 5 (Jack AI v2: 28 of 30 instead of 7). No weighting the police could use recovers it, including one that learns the Jack's route style.
  - **Coordinated blocking** loses (12 against 27 discordant games): it spreads the policemen away from the likeliest hideout.
  - **Interception:** of 102 lost last nights, a cut the police knew enough to make was missed 3 times.
  - No legal change beats v3; doubled blocking weight gains 1.5 points, not significant.
- **Recommendation:** no Detective AI v4. A study of new public evidence about the hideout comes first.
- **Tests:** `detective-study.test.js`.
- **Scripts:** `research/detective-study/`.

#### Waiting against containment ([aceszhenwei/Letters-From-Whitechapel#19](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/19))

- **Study:** [Waiting against containment](docs/waiting-containment.md) tests why strategic waiting seemed to beat Detective AI v3 on the last night. It does not:
  - Jack AI v2's last-night murders are never one walk from his hideout, so v3's containment never acts against him.
  - Waiting on the last night alone, with nights 1–3 played identically, changes nothing (−2.0 points, 95% CI −6.6 to +2.6, 250 paired games).
  - The overall gain from waiting is small and uncertain (0.0 on new seeds; +3.7 pooled).
- **`containWretched`,** re-tested against Jacks who wait, cuts first-move escapes after a wait but changes no win rate, so it stays off.
- **v3's waiting-aware threat model** has known inaccuracies (illegal neighbours, one step out, the police's choice ignored), but none costs a game in the data.
- **Recommendation:** no new Detective AI version. PR #17's report is corrected.
- **Tests:** `waiting-containment.test.js` (positions set up by hand).
- **Scripts:** `research/waiting-containment/`.

#### The detective's tools ([aceszhenwei/Letters-From-Whitechapel#18](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/18))

- **Undo a policeman's move:** in Hunting the monster, the chosen policeman is ringed and his crossings are ringed in his colour. **Undo last move** takes moves back, newest first, until the player chooses **Done**. Moves can't be undone after that, since searches can reveal clues.
- **Night review:** when Jack reaches his hideout, the board stays as it was (policemen, crime scenes, clues, searches and failed arrests) until the player chooses **Begin the next night**. The **case files** show each night's log in order, can show any earlier night on the board read-only, and give walking distances from a crime scene or clue. All of it comes from `rules.nightRecord`, a frozen copy of the public record that never holds Jack's route or hideout.
- **Women and Wretched:** drawn as rings around their circles with a badge, so the numbers stay readable. Women are all alike (face down); the Wretched being moved is ringed. **Highlight** fades the rest of the map.
- **Engine:** two settings, `confirmPoliceMoves` and `reviewNights` (phase 12, The night is over), and the actions `undoPoliceMove`, `finishPoliceMoves` and `beginNextNight`. They are off by default, so simulations and the computer police play as before; the page turns them on. The golden traces are unchanged.
- **Fix:** a policeman who has moved shows his shield, not a face-down patrol's question mark.
- **Tests:** `police-undo.test.js`, `night-review-ui.test.js`. Screenshots: `tools/screenshots/capture.js`, `docs/images/night-review/`.

#### Strategic waiting ([aceszhenwei/Letters-From-Whitechapel#17](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/17))

- **Study:** [Strategic waiting](docs/jack-waiting.md) explains why Strategic Jack and Jack AI v2 never wait (a fixed rule, which is right against the original police) and measures what waiting is worth.
- **Policy:** strategic waiting (`js/ai/jack-waiting.js`, an option played by no level) waits only when its measured chance of escaping is higher than killing now, assuming the police move the victims where it hurts him most.
- **Results:** wrapped around Jack AI v2, it beat Detective AI v3 more often on two held-out seed sets (66.0% → 74.0%, p = 0.009; 67.0% → 71.0%, p = 0.13, the pre-registered test, not significant), without regressing against the other police. (The explanation given then, that the gain came from taking the last night's murder off the red circles v3 prepares, was withdrawn: see Waiting against containment above.)
- **Patrol information:** revealed patrols still change no decision.
- **Jack's view** gains `wretchedMoves(mapid)`: where the police could move a Wretched (public information).
- **Tests:** `jack-waiting.test.js`, and a smoke step.

#### Fake Wretched and fake patrol audit ([aceszhenwei/Letters-From-Whitechapel#16](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/16))

- **Study:** [Fake Wretched and fake patrols](docs/deception-audit.md) audits how each AI uses the preparation phase's deception. Both mechanics follow fixed rules, and against the current AIs perfect information about either is worth nothing measurable. No AI changed.

#### Documentation cleanup ([aceszhenwei/Letters-From-Whitechapel#15](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/15))

- **Documentation reorganised** without changing any code, rule, AI or result. New: an [AI overview](docs/ai.md) (every AI, level, option and the evidence behind it), a research-report index in the [documentation index](docs/README.md#research-reports), one sorted [seed table](docs/testing.md#seeds), and an [archive](docs/archive/README.md) for superseded plans. The [roadmap](docs/roadmap.md) now separates what is implemented, known limitations, potential research (not approved) and other ideas. The root README points to the index instead of repeating it.

#### Detective AI v3 ([aceszhenwei/Letters-From-Whitechapel#14](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/14))

- **Detective AI v3** (`WC.policeVariants.v3`, the new **Hard police**): Detective AI v2 plus containment for the last night. On night 3 each policeman also values standing where he could stop Jack from killing next to his hideout and walking home on his first move (`js/ai/containment.js`). On nights 2–4 a station's patrol token is made real instead of a policeman's when it clearly closes more of the night's threat. On fresh seeds it more than doubles the police's wins against short-return Jacks (14.0% → 32.7%), stops the BoardGameGeek hideout-134 scheme every time, and matches v2 against the other Jacks (56.3% → 56.5%). Easy and Normal police are unchanged. See [Detective AI v3](docs/detective-ai-v3.md).
- **Police options** for containment (`contain`, `containHideouts`, `containNeighbours`, `containEarly`, `containCoordinate`, `containPatrols`, `containSwap`, `containWretched`, `containTiming`, `containScale`), all off by default: the original police and v2 play exactly as before.
- **Study** (`research/detective-v3/`): a lifecycle audit of where the police can act, the failure analysis (positioning, not information), 19 screened configurations, a comparison, an ablation and a fresh-seed confirmation. Tests: `containment.test.js` (the tactical scenarios), the Hard level in `police-levels.test.js`, v3 in the smoke tier and a new medium step.

#### Human strategy literature ([aceszhenwei/Letters-From-Whitechapel#13](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/13))

- **Study:** [Human strategy literature](docs/human-strategy-literature.md) reviews five BoardGameGeek strategy threads and compares every claim with the AIs. The forum's board facts all match our map (an independent check on the map data). Two forum schemes that kill next to home beat Detective AI v2, because neither police prepares positions for the next night; a detective who expects Jack AI v2's detours beats it. Recommendation: research the detectives' cross-night positioning next. Scripts in `research/human-strategy/`; `test/unit/human-strategy-scenarios.test.js` pins the board facts. No AI or rule changed.

#### A vanishing policeman ([aceszhenwei/Letters-From-Whitechapel#12](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/12))

- Choosing a second policeman before moving the first no longer makes the first disappear and stall the turn.

#### Jack AI v2 ([aceszhenwei/Letters-From-Whitechapel#11](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/11))

- **Jack AI v2** (`js/ai/jack-v2.js`, the new **Hard** difficulty): the strategic Jack, unchanged, plus early detours. On every night but the last, while 6 moves would stay spare, his first moves walk away from his hideout. Against Detective AI v2 on development seeds it wins 70.5% of games, against 32.0% for the strategic Jack and 68.0% for Detour Jack. It also beats Detour Jack against the original police (95.5% against 91.5%) and uniform blocking (65.5% against 60.5%). Validation on unseen seeds is proposed, not yet run. See [Jack AI v2](docs/jack-ai-v2.md).
- **The study** (`research/jack-v2/`): a diagnosis of the strategic Jack's losses (direct routes give the hideout away; the policemen then wall it off) and five candidate mechanisms screened and compared. Kept: early detours, and none on the last night. Left out: a waypoint planner, a way-home estimate around the policemen, random choice among near-best moves.
- **Harness:** `research/jack-v2/run.js` stores each game with a fingerprint of the files it depends on, so runs resume and unchanged games aren't replayed.
- **Tests:** `jack-v2.test.js` (14 tests); the Hard level in `difficulty.test.js`; Jack v2 in the smoke tier, in a new medium step and in the full tier. The strategic Jack, Detour Jack and the golden traces are unchanged.

#### Detective AI v2 ([aceszhenwei/Letters-From-Whitechapel#10](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/10))

- **Detective AI v2** (`WC.policeVariants.v2`): the computer police weight the possible hideouts by how direct Jack's routes would have been to reach them, and stand between Jack and them. On fresh seeds it cuts the strategic Jack's win rate from 98.0% to 31.6%, the baseline Jack's from 21.8% to 12.6%, and a detouring Jack's from 88.8% to 63.0%. Coordination, a cordon, reachable-only hideouts and a lower arrest threshold were tested and left out. See [Detective AI v2](docs/detective-ai-v2.md).
- **Watch the computer police:** the setup dialog asks who leads the detectives: you (the default), Easy police (the original AI) or Normal police (v2). `?police=` fixes it for testing. Jack's difficulty is unaffected.
- **Deduction fix:** a coach can no longer end where it started. The deduction now matches an exhaustive list of legal routes exactly; this sharpens both the police's beliefs and the strategic Jack's model of them.
- `deduction.hideouts` takes a weighting (`walk`, the default; `uniform`; `hybrid`). `WC.createPolice` takes the v2 options, all off by default, so the original police play exactly as before.
- Tests: `deduction.test.js` and `police-levels.test.js`; v2 in the smoke, medium and full test tiers.

#### The verified board ([aceszhenwei/Letters-From-Whitechapel#9](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/9))

- **The map follows the physical board again.** The board was checked at the 13 places where this map and whitechapelR's differ, and agrees with this map in all of them. The whitechapelR topology overrides (`map.topologyCorrections`) are removed, and the three golden traces re-recorded for them (seeds 5, 7, 9) are back to their original recordings. `test/unit/map-topology.test.js` now pins the 13 board-verified connections. See [Map data](docs/map-data.md#verified-against-the-board).
- **Test tiers:** fast, smoke, medium and full (`tools/tiers/`), with fingerprints so unchanged expensive steps are skipped. See [Testing](docs/testing.md#test-tiers).
- **Detective study re-run on the verified board**, with the improved police's components measured separately, and compared with the earlier runs. See [Detective inference](docs/detective-inference-study.md).

#### Difficulty levels and a study of the detectives ([aceszhenwei/Letters-From-Whitechapel#8](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/8))

- **Jack's difficulty:** choose Easy (the baseline AI, the default) or Normal (the strategic AI) in the setup dialog. The level shows in the top bar and is remembered; `?difficulty=normal` (or the older `?jack=strategic`) fixes it for testing. Nothing else changes with the level. See [Jack's AI](docs/jack-ai.md#difficulty-levels).
- **Map topology followed whitechapelR's** (since reverted: see above). Its map was treated as canonical: 10 walking links removed, 2 added and 1 alley added (`map.topologyCorrections`; the drawn streets are unchanged). `test/unit/map-topology.test.js` checks every link. Three golden traces (seeds 5, 7, 9) were re-recorded, because the baseline Jack walks the corrected links. Earlier simulation results are labelled as using the previous map. See [Map data](docs/map-data.md#verified-against-the-board).
- **Study:** [Detective inference](docs/detective-inference-study.md) compares the police's deduction with [whitechapelR](https://github.com/bmewing/whitechapelR), checks it against an exhaustive reference, and finds why the computer police lose to the strategic Jack. Scripts and results are in `research/detective-inference/`.

#### A smarter Jack ([aceszhenwei/Letters-From-Whitechapel#7](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/7))

- **Strategic Jack** (`js/ai/strategic-jack.js`): values each move by the measured chance of surviving the police's next turn and of getting home in time, looks two moves ahead, and makes its Hell choices with the same estimates. It wins 97.2% of 5,000 games against a deductive police AI, where the baseline wins 25.0% (94.2% against 46.9% against random police). The baseline stays the default; `index.html?jack=strategic` plays the strategic AI. See [Jack's AI](docs/jack-ai.md).
- **Public record and deduction:** the engine records what the police see each night (`state.police[n].log`); `js/core/deduction.js` works out from it alone where Jack could be and where his hideout could be. Jack's view gains `publicLog()`, `pastLogs()` and `patrols()`; a new `rules.policeView` gives a computer police player only what the police know.
- **Computer police** (`js/ai/police.js`): a deductive player and a random one, for simulations.
- **Simulation tools:** `tools/simulate.js` (many seeded games, in parallel), and `tools/sim/` to compare runs (with McNemar's test), replay a game, diagnose losses, calibrate the estimates and benchmark decisions. Results are in `experiments/`.
- **Tests:** properties of the strategic AI (legal moves, resources, urgency, avoiding danger, keeping tokens, determinism) and of what it may know. The golden traces are unchanged: the baseline plays exactly as before.

#### Modules for maintainability ([aceszhenwei/Letters-From-Whitechapel#6](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/6))

- **`js/script.js` split into modules** with one job each: `core/board.js` (map queries), `core/rules.js` (what is legal), `core/engine.js` (state, phases, effects, events), `ai/jack.js` (Jack's decisions) and `ui/renderer.js` (drawing and clicks). See [Architecture](docs/architecture.md).
- **One source of truth for the rules.** The engine, Jack's AI and the interface ask `rules.js` instead of each deciding legality.
- **Jack's AI is replaceable.** It is six decision functions, given a view of what Jack knows. The engine checks each decision against the rules.
- **No behaviour change.** Ten golden traces recorded before the refactor are reproduced step by step. One visible fix: a policeman keeps his colour from Hunting the monster into Clues and suspicion.
- **Tests:** the core, a headless game and Jack's AI are tested without a page. Architecture tests guard the module boundaries.
- **Moved:** vendored libraries to `js/vendor/`, data to `js/data/`.

#### Clean-up ([aceszhenwei/Letters-From-Whitechapel#5](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/5))

- Removed the unused Bootstrap 3 files and the `user-interface.html` mock-up.
- README: our own description, credit to the original project, and a note that this is an unofficial fan project. Removed the original author's donation link.

#### Interface and documentation ([aceszhenwei/Letters-From-Whitechapel#4](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/4))

- **New interface:** a dark Victorian frame around a parchment board, a sidebar with the current phase, instructions and progress, Jack's public status and a case log, plus intro and game-over dialogs.
- **Board:** circle numbers are visible, streets are drawn as dotted lines from the map data, and tokens are modelled on the physical pieces (coloured policemen, translucent clue and crime scene markers).
- **Responsive:** the board scales to fit; on narrow screens the page becomes one column with the instructions first.
- **Fixes:** phase text no longer repeats every round; map pieces have proper `px` positions (they only worked in quirks mode before).
- **Documentation:** a new `docs/` folder.

#### Following the rulebook ([aceszhenwei/Letters-From-Whitechapel#3](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/3))

- Women and Wretched per night, patrol placement on later nights, and a hideout that is never a red circle.
- The Time of the Crime token, the order of Suspense grows and Ready to kill, Wretched movement limits, and crime scenes that stay all game.
- The double event, the move track (15 to 19 moves), escape only by a normal move, and one action per policeman.

#### Alleys, coaches and tests ([aceszhenwei/Letters-From-Whitechapel#2](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/2))

- Alleys computed from the map's blocks, and Jack's coach and alley moves.
- Automated unit and regression tests with jsdom, run by GitHub Actions.
- Fixes: finding a clue redrew the map, Jack couldn't walk through map id 0, and crime scene tokens piled up.

#### Game logic fixes ([aceszhenwei/Letters-From-Whitechapel#1](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/1))

- Fixed out-of-range random picks, the hideout choice, `jack.canMove`, Jack heading home, and several display bugs.
- Added game endings and new nights.
