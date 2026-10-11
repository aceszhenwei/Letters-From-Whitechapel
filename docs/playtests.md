# Human playtests

How games played by people are collected, checked and kept as research evidence, so the AIs can later be studied against real play. The pipeline is deliberately small: no server, account, cloud storage or automatic upload.

```
Play → saved automatically in the browser → export a batch (ZIP) → upload the records to GitHub by hand
     → GitHub Actions checks them → five new games make a research batch → a short triage report, commissioned by hand
     → targeted investigations only where triage finds a reason
```

## Contents

1. [Playing: games are kept automatically](#1-playing-games-are-kept-automatically)
2. [Exporting new games](#2-exporting-new-games)
3. [Uploading records to GitHub](#3-uploading-records-to-github)
4. [How GitHub Actions checks them](#4-how-github-actions-checks-them)
5. [Is a research batch ready?](#5-is-a-research-batch-ready)
6. [Commissioning an analysis](#commissioning-an-analysis)
7. [Historical evidence, cohorts and versions](#7-historical-evidence-cohorts-and-versions)
8. [Statistics](#8-statistics)
9. [Privacy and browser storage](#9-privacy-and-browser-storage)
10. [For developers](#10-for-developers)

## 1. Playing: games are kept automatically

**When a game is kept.** A game a person plays (as Jack or as the detectives) is kept in the browser the moment it ends by a rule: an escape on the last night, an arrest, Jack out of moves, or Jack trapped.
- **What is kept:** its full game record ([Game records](game-records.md), schema version 1, unchanged), stored in IndexedDB on this device.
- **The ending dialog** says whether the game was kept.
- **Not kept:** a game ended by hand (End the game in the export dialog) or left unfinished, and a game the computer played alone (Developer Mode's watching).

**What each entry holds:** the game ID, the date, the player's role, the AI opponent and its difficulty, the outcome, the app version, the rule set, and the full record with every action.
- **Once per game:** a game is kept once, by its ID, so the same game is never saved twice.
- **Survives sessions:** records stay after closing the page, until they are deleted.

**If storage fails,** the game is unaffected. The ending dialog says the game couldn't be kept, and the existing **Game log › Download the full record** still saves it as a file. This can happen in private browsing, with site storage blocked, or with a full disk.

## 2. Exporting new games

Open the game with **Developer Mode** (`index.html?dev=1`) and choose **Playtests** in the top bar. The table lists every game kept in this browser: date, role, opponent, difficulty, outcome, game ID, and when it was exported.

| Button | What it does |
|---|---|
| **Export new playtests** | A ZIP of the games not exported before; then marks them as exported |
| **Export selected** | A ZIP of the ticked games (exported or not) |
| **Export all (again)** | A ZIP of every game kept, including those exported before |
| **JSON** (in a row) | That game's full record as `<game id>.json` |
| **Import JSON or ZIP** | Adds records from full-record files or batch ZIPs, after checking each (below) |
| **Delete** (in a row) / **Clear all** | Removes records from this browser, after confirming. Exported files are not affected |

**The batch ZIP** (`whitechapel-playtests-YYYYMMDD-HHMM.zip`):
```
manifest.json                game IDs, export time, number of records, schema, rule set and app version
records/g91d4014f17ae09e6.json   one full record per game, named after its game ID, exactly as kept
records/…
```

**What "exported" means.** A game is marked as exported once its ZIP has been made and the browser's download started. The page can't know whether the download finished, and **exporting does not upload anything to GitHub**. Records are never deleted by exporting.

**Importing:**
- **Checked first:** each record must be a full record of a completed game a person played, made with this version's schema and rule set. It must replay exactly through the engine, ending as recorded.
- **Duplicates:** a game already here, with the same content, is skipped (a re-export with another date or note counts as the same).
- **Conflicts:** a different record with an existing game ID is reported and not imported. Nothing is overwritten.
- **Compressed ZIPs:** a ZIP re-compressed by another tool is read where the browser can decompress it. Otherwise, extract it and import the JSON files.

## 3. Uploading records to GitHub

The research collection is `research/human-playtests/records/` in the repository: one file per game, named `<game id>.json` ([README](../research/human-playtests/README.md)).

**On the GitHub website:**
1. Extract the exported ZIP on your computer. You only need the files inside its `records/` folder; `manifest.json` stays out.
2. In the repository, open `research/human-playtests/records/` and choose **Add file › Upload files**.
3. Drag in the `.json` files. Don't rename them, and don't edit them: a changed record fails the replay.
4. Choose **Create a new branch … and start a pull request**, then open the pull request. GitHub Actions checks the records (section 4).
5. Merge it once the check passes.

**With a clone,** `npm run playtests:add -- ~/Downloads/whitechapel-playtests-….zip` (or `.json` files) does steps 1–3:
- it checks every record and copies only the valid new ones into `records/` as `<game id>.json`;
- it reports duplicates and conflicts, never overwriting;
- then commit the new files on a branch and open a pull request.

**Don't commit** the ZIP itself, `manifest.json`, renamed copies, or public records: only full records belong in `records/`.

## 4. How GitHub Actions checks them

`.github/workflows/playtests.yml` (**Human playtests**) runs on every pull request and every push to `master` that touches the collection, the record tools or the core. It can also be run by hand. It runs `node tools/playtests/dataset.js --ci` and:

- **checks every file** with the existing importer (`tools/game-log/validate.js`, including the full replay);
- **requires** a full record of a completed human game, named `<game id>.json`;
- **flags** files that are invalid, misnamed or ineligible, duplicates (the same game twice) and conflicts (different records with one game ID);
- **records from another schema or rule set** are *incompatible*: a newly added one fails, while old ones already in the collection are kept as historical evidence and only noted;
- **checks** that the statistics can be generated, and that `analysis-state.json` names only games that exist;
- **writes a summary** to the run's page: the counts of valid, invalid, ineligible, duplicate, conflicting, misnamed and incompatible records, the research batch status, and the files in the change. Problems also appear as annotations on the files.

**Pass or fail:** the check fails on any problem, so a pull request with a bad record can't be merged unnoticed.

**What it doesn't do:** it is read-only. It changes no file, needs no secrets, and doesn't deploy: the Pages workflow ignores changes to the collection.

## 5. Is a research batch ready?

`research/human-playtests/analysis-state.json` records which games research reports have already covered. Every valid game is one of:

| Status | Meaning |
|---|---|
| **Collected** | Valid, and not yet covered by a report: awaiting review |
| **Analysed** | Covered by a completed report, under the current methodology |
| **Eligible for reanalysis** | Covered by a report under an earlier methodology version (section 7) |

**The batch:**
- **Collecting** while fewer than **5** collected games await review.
- **Ready for Review** once 5 do. The threshold is `batchThreshold` in the state.
- **To see it:** run `npm run playtests`, or open the summary of the latest **Human playtests** run on GitHub. When a batch is ready, that run shows a **Research batch ready** notice.

**Nothing runs automatically:** no agent is started and no report is written. Passing validation doesn't make a game analysed. The state also holds a dated snapshot of the games awaiting review; `npm run playtests -- --update-state` refreshes it, and CI only notes when it is out of date.

## Commissioning an analysis

Research runs in two tiers, so the routine cost stays low and the close, forensic work goes only where something looks wrong.

| Tier | When | What it is | Length |
|---|---|---|---|
| **Batch triage** | Each research batch (5 games awaiting review) | A summary of the batch: outcomes, notable behaviour, recurring patterns, possible defects. No turn-by-turn analysis | 1–2 pages |
| **Investigation** | When triage or a single game gives a reason (below) | A targeted study of one issue, reproduced from the records | As long as the issue needs |
| **Cumulative review** | After about 20 games in total, then occasionally | Trends across batches and cohorts | A few pages |

Nothing runs automatically: you commission each one by hand, as a separate assignment.

### Findings: four kinds

Every finding is labelled with one of these. A finding moves up only on the evidence named here, never on how it looks.

| Kind | Meaning | Evidence | Where it goes |
|---|---|---|---|
| **Pattern to watch** | Something seen in one or a few games that might matter | An observation, with the game IDs | Noted in the triage report; looked for again in later batches |
| **Defect candidate** | Behaviour that looks wrong: a rule broken, information the AI shouldn't have, an obvious move missed | Specific games and moments that point to a defect | Flagged in the triage report; an investigation decides |
| **Confirmed defect** | The code does something it shouldn't | Reproduced from a record, with a failing scenario or test | An investigation report; a fix proposed as its own assignment |
| **Confirmed strategic weakness** | The AI plays legally but predictably badly in a situation | Seen across several games, preferably more than one batch, and reproduced in a targeted test or simulation | An investigation or cumulative review; an improvement proposed as its own assignment |

A defect candidate that doesn't reproduce is closed, with the reason, in the investigation report. A pattern that doesn't recur stays a pattern to watch; it isn't dropped silently.

### Batch triage (every 5 games)

The routine report. It records what the batch shows and decides whether anything needs an investigation; it doesn't try to settle every question itself.

- **Read each game once, at the level of the night summaries:** who won and how, the nights, Jack's routes and hideout exposure, the detectives' searches and arrests. Follow a moment more closely only when it looks like a defect candidate.
- **Compare with earlier reports:** is a pattern recurring? Has a pattern to watch now appeared in enough games to justify an investigation?
- **No exhaustive turn-by-turn analysis,** no new tools, and no AI changes.
- **"Nothing new" is a valid result.** A batch that only confirms earlier patterns gets a short report saying so.

**Template** (`research/human-playtests/reports/YYYY-MM-DD-batch-N.md`):

```markdown
# Playtest batch N: triage

- **Date:** YYYY-MM-DD · **Methodology version:** 1
- **Games:** g…, g…, g…, g…, g… (5)
- **Cohorts:** e.g. 1.0.0 · whitechapel-fff8e378d715 · jack · Detective AI v3 · normal (3); …

## Outcomes
| Game | Cohort | Winner | How it ended | Nights |
|---|---|---|---|---|

## Notable behaviour
One to three lines per game, only where something stood out.

## Patterns
- **Recurring** (seen before, with the earlier reports):
- **New patterns to watch:**

## Defect candidates
Each with the game ID, night and move, and why it looks wrong. "None" if none.

## Recommendation
None / an investigation of … / a cumulative review.

## Limitations
The sample: its size, cohorts, and that the players' experience isn't recorded.
```

**Assignment prompt:**

> Triage the human playtest research batch, following docs/playtests.md#commissioning-an-analysis.
> 1. Run `npm run playtests` and list the games awaiting review (Collected, plus any Eligible for reanalysis you include), by game ID and cohort.
> 2. Validate them: `npm run research:import -- research/human-playtests/records` must verify every one.
> 3. Read each game at the level of its night summaries and write a 1–2-page triage report from the batch template: outcomes, notable behaviour, recurring patterns and new patterns to watch, and defect candidates. Compare with earlier reports in `research/human-playtests/reports/`, within cohorts.
> 4. Recommend an investigation only where the triggers in the docs apply. Do not investigate in depth, write tools, or change an AI in this assignment.
> 5. Once the report is complete, run `npm run playtests -- --record-analysis --report reports/<file>.md --outstanding` and include the updated `analysis-state.json` in the same pull request.

### Investigations (targeted)

The forensic tier: one issue, followed to a conclusion. Commission one when:
- a triage report flags a **defect candidate**;
- a **pattern to watch recurs** across batches, or a cumulative review finds a trend worth testing as a strategic weakness;
- a **single game is alarming** enough not to wait for a batch: an AI that seems to know Jack's hideout or route, an impossible move, or a result the rules shouldn't allow.

An investigation:
- states its question and the games it uses;
- reproduces the behaviour from the records (`WC.record.replay`, the full record's nights, and the research tools in `research/`), down to the turn where needed;
- concludes with one of the four kinds: a **confirmed defect** with a failing scenario or test, a **confirmed strategic weakness** with the games and the targeted test that show it, or not confirmed (the finding stays a pattern to watch, or is closed with the reason);
- proposes a fix or improvement, but **doesn't change an AI** in the same assignment;
- is written up as `research/human-playtests/reports/YYYY-MM-DD-investigation-<topic>.md`.

**Recording it:** an investigation of games already analysed doesn't run `--record-analysis`; they keep the triage report that covered them. An urgent investigation of a game still awaiting review may record it with `--games <id>`, so it isn't counted in the next batch.

**Assignment prompt:**

> Investigate <the issue> in the human playtest records, following docs/playtests.md#investigations-targeted. Games: <ids>, from <report>.
> Reproduce it from the records, and conclude whether it is a confirmed defect (with a failing test), a confirmed strategic weakness (with the evidence), or not confirmed. Propose a fix; do not change an AI. Write the dated investigation report.

### Cumulative reviews (about every 20 games)

A look across batches, not a repeat of them: it reads the triage and investigation reports and the statistics from `npm run playtests`, not each game again.
- **Trends:** results by cohort, how games end, and whether they change between app or AI versions.
- **Patterns:** which patterns to watch keep recurring, which have faded, and whether any now justify an investigation.
- **Status of earlier findings:** defects fixed since (with `aiChanges`), weaknesses still open, conclusions that no longer describe current behaviour.
- It covers no new games, so it doesn't run `--record-analysis`. Write it as `reports/YYYY-MM-DD-cumulative-review.md`.

### Rules for every tier

- **Don't repeat analyses:** an analysed game isn't re-examined unless an investigation needs it, there is new evidence, or the methodology changes.
- **Keep the tiers apart:** a triage report flags; an investigation confirms; a cumulative review looks for trends. A finding is confirmed only by an investigation, or for a strategic weakness, a cumulative review backed by a targeted test.
- **The sample is small and uncontrolled:** describe it, don't generalise.
- **Who played:** players differ in experience, and nothing records it.
  - Never exclude a game because the person played badly or lost quickly.
  - Never conclude the AI is "superhuman" from casual games.

## 7. Historical evidence, cohorts and versions

- **Records are never deleted because newer ones exist.** Old games are evidence of how the AIs behaved then, and they don't go stale with time.
- **Cohorts.** Games are pooled only within one cohort: the same app version, rule set, player role, AI opponent and difficulty, all from the record's own metadata (`app.version`, `ruleset.id`, `game.players`). The statistics give each cohort separately. Don't combine materially different AI or rule versions into one estimate without saying how.
- **A new AI version** starts a new cohort, because its records name the new AI or carry a new app version. Old records stay valid; they simply belong to the old cohort.
- **A rule or map change** makes older records *incompatible*: they can no longer be replayed by the current code. They stay in the collection as history; check out the release that made them to replay them ([Game records §8](game-records.md#8-versions-and-compatibility)).
- **When an AI bug is fixed,** add an entry to `aiChanges` in `analysis-state.json`. Say:
  - which AI and app versions were affected;
  - which cohorts or games the bug could have touched;
  - whether earlier reports' conclusions still hold.

  Earlier conclusions stay on record. Mark which no longer describe current behaviour; don't rewrite them.
- **A methodology change:** raise `methodologyVersion` and describe the new version in `methodology`. Games analysed under an earlier version become *eligible for reanalysis*, without copying or changing their files, and their original reports stay as they were.

## 8. Statistics

`npm run playtests` (or `--json`) prints cumulative statistics, reproducible from the files in `records/`:
- **Counts:** the total number of valid completed games, and games by role.
- **Wins:** the person's wins by role and AI opponent, and by cohort.
- **How games ended:** victory conditions, nights played, actions per game and Jack's moves per game.
- **Who played against what:** games by difficulty, opponent, app version and rule set.
- **Research status:** collected, analysed, and eligible for reanalysis.
- **Problems:** invalid, ineligible, duplicate, conflicting, misnamed and incompatible files.

These describe a small, uncontrolled collection of casual games. They are not estimates of human or AI strength. Detailed evaluation of AI decisions is the job of a targeted investigation ([Commissioning an analysis](#commissioning-an-analysis)).

## 9. Privacy and browser storage

- **Local only:** records are kept only on the device, in the browser's IndexedDB for this site. Nothing is sent anywhere. Files leave the device only when the player exports them and chooses to upload them.
- **No personal data:** a record holds game data only, as described in [Game records](game-records.md#9-privacy). The optional note in the export dialog is the player's own, and only in files exported from that dialog.
- **Browser storage is not a backup:**
  - clearing site data, uninstalling the browser, private browsing or the browser's own clean-up can delete it;
  - another browser or device doesn't see it.

  Export new games regularly.

## 10. For developers

| Piece | File |
|---|---|
| Browser storage, saving, checking, batches | `js/ui/playtest-store.js` (`WC.playtests`) |
| The manager (Developer Mode) | `js/ui/playtests.js` (`WC.ui.playtests`); wired in `js/main.js` |
| ZIP files (no dependency) | `js/ui/zip.js` (`WC.zip`), also used by the tools in Node |
| The collection's checks, state and statistics | `tools/playtests/dataset.js` (`npm run playtests`, `npm run playtests:add`) |
| The workflow | `.github/workflows/playtests.yml` |
| Tests | `test/unit/playtests-store.test.js`, `test/unit/playtests-dataset.test.js`, `test/regression/playtests-ui.test.js` ([Testing](testing.md)) |
