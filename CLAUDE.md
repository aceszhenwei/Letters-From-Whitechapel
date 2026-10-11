# CLAUDE.md: onboarding for coding agents

A browser version of the board game *Letters from Whitechapel* (revised edition), with researched computer opponents and a pipeline for studying games people play. This file is a map, not the documentation. The details are in `docs/`, whose index ([docs/README.md](docs/README.md)) links every reference page and research report.

**Status:** v1.0.0 released (2026-10-10). Work since then is under **Unreleased** in [CHANGELOG.md](CHANGELOG.md).

## Ground rules for agents

- **Pull requests only.** Branch from `master`, open a pull request, and let the repository owner review and merge. Never merge, push to `master`, or move a tag yourself.
- **Every change gets docs and a changelog entry:**
  - update the relevant page in `docs/`;
  - add an entry under **Unreleased** in `CHANGELOG.md`;
  - follow [docs/contributing.md](docs/contributing.md).
- **Scope discipline:** do what the assignment asks.
  - **No AI changes without an assignment.** Don't change an AI's behaviour, a difficulty mapping, the rules or the record format unless the assignment says so.
  - **Research proposes; it doesn't apply.** A research report proposes a fix; changing the AI is a separate assignment.
- **Not approved; don't start without explicit approval:**
  - Detective AI v4: an assignment was put on hold after its Part 0 audit, and [the later study](docs/detective-study.md) found no v4 justified;
  - Jack v3;
  - the proposals under "Potential research" in [docs/roadmap.md](docs/roadmap.md).
- **Research reports are evidence:**
  - Keep each report's methods, seeds, negative results and limitations as written; a later study builds on an earlier one rather than rewriting it.
  - Never claim an analysis happened because a record validated.
  - Never generalise from the small human sample.

## Architecture (implemented)

A static site: ES5 JavaScript with jQuery 1.11 and Underscore 1.8, with no build step, bundler or modules. Each file adds one object to the global `WC` namespace and takes its dependencies as arguments. `index.html` fixes the script load order. Details: [docs/architecture.md](docs/architecture.md).

| Layer | Files | Rule |
|---|---|---|
| Data | `js/data/map.js` (map ids 0–428; printed numbers 1–195 via `map[id].number`) | Code uses map ids; numbers are only for text the player sees |
| Core | `js/core/board.js`, `rules.js` (legality, `jackView`/`policeView`), `engine.js` (the only writer of `game.state`; phases 0–12), `deduction.js`, `random.js`, `record.js` | No page access; runs in Node |
| AI | `js/ai/` (Jacks, police, `containment.js`, level tables) | Decides only from its side's view; the engine validates every decision |
| UI | `js/ui/` (renderer, setup, autopolice, jack-player, review, export, playtests) and `js/main.js` | Never decides legality |

- **Boundaries are enforced** by `test/unit/architecture.test.js`.
- **Code style** ([docs/contributing.md](docs/contributing.md)):
  - tabs in JavaScript, four spaces in CSS and HTML;
  - `var` everywhere in `js/`;
  - cite the rulebook phase where code enforces a rule.

## Game modes and AIs (implemented)

| Mode | The person plays | The computer plays (levels) |
|---|---|---|
| Detectives (default) | The five policemen | Jack: **Normal** = Strategic Jack (default), **Hard** = Jack AI v2 |
| Jack (`?role=jack`) | Jack, through the engine's `humanJack` setting (`jackTurn` events; `game.jackHideout`, `jackWomen`, `jackWait`, `jackVictims`, `jackReveal`, `jackMove`) | Detectives: **Easy** = Detective AI v2, **Normal** = Detective AI v3 (default). They get only `game.policeActions()` (a frozen facade) and `rules.policeView` |
| Developer Mode (`?dev=1`) | Either side, or watch | Adds Baseline Jack (Easy), Jack AI v2 with strategic waiting (experimental), and police levels to watch: Easy = original, Normal = v2, Hard = v3 |

**AI research status** (reference: [docs/ai.md](docs/ai.md); reports linked from [docs/README.md](docs/README.md#research-reports)):

| AI | Status |
|---|---|
| Baseline Jack | Rules of thumb; Developer Mode only |
| Strategic Jack | Measured risk plus lookahead. Gives his hideout away with direct routes |
| Jack AI v2 | Validated in Study J3: confirmed against Detective v2; its edge over Detour Jack not established |
| Strategic waiting | An option, not a level. Its gain against v3 is in doubt |
| `safe-skip` (J3) | Experimental; below its pre-registered threshold |
| Original police | Arrests at belief ≥ 0.2 |
| Detective AI v2 | Hideout weighting plus blocking |
| Detective AI v3 | v2 plus last-night containment. **Not independently validated** (proposed, not run) |

All AI strength claims are AI against AI.

## Game records and replay (implemented)

Reference: [docs/game-records.md](docs/game-records.md).

- **The format:** `js/core/record.js` (`WC.record`) records every action as a versioned JSON file with `format: "whitechapel-game-log"` and **schema version 1**.
- **Two kinds of record:**
  - a **public** record, for one side's view, available at any time;
  - a **full** record, with hidden information and `final.state`, available only once the game is over or ended.
- **Rule set:** `ruleset.id` (currently `whitechapel-fff8e378d715`) hashes `rules.config` and the map. Changing either makes older records *incompatible*, because the current code can't replay them.
- **Format changes:** a new police action or record field means teaching `record.js` and `tools/game-log/validate.js`, and raising `schemaVersion`.
- **Replay:** `WC.record.replay(record, { upto })` plays the actions back through the engine, with Jack's recorded decisions standing in for any AI, and compares every action. Use `upto` to study a position.
- **Validator:** `tools/game-log/validate.js` gives each file a verdict: `verified`, `partial`, `invalid` or `incompatible`.
- **Analysing many records:** `npm run research:import -- <files or folder>` validates them and summarises them. `tools/game-log/core.js` loads the core, optionally with the AIs, into Node.
- **Players and seeds:** records name the players (`game.players`). A Human Jack game is seeded, so the detectives' tie-breaks replay.

## Human playtest pipeline

### Implemented (PRs #30–32)

Reference: [docs/playtests.md](docs/playtests.md).

**In the browser:**
- **Auto-save:** a game a person finishes by a rule is saved as its full record. This applies to both roles.
  - Not saved: a game ended by hand, an unfinished game, or computer-only play.
  - Storage: IndexedDB `whitechapel-playtests`, store `records`, one entry per game ID.
- **Duplicates and conflicts** are detected by a fingerprint that ignores the export date and the player's note:
  - the same record again is a *duplicate*;
  - a different record with the same game ID is a *conflict*, which is never overwritten.
- **Manager** (Developer Mode, **Playtests**):
  - export new, selected or all games as a ZIP (`manifest.json` plus `records/<id>.json`), or one game as JSON;
  - import JSON or ZIP files, each checked by full replay;
  - delete one game, or clear all after confirming.
- **Code:** `js/ui/playtest-store.js` (`WC.playtests`), `playtests.js` and `zip.js`, a dependency-free ZIP writer and reader that Node uses too.
- **Nothing is sent anywhere:**
  - exporting doesn't upload;
  - a record is marked "exported" once its download starts;
  - the docs and UI promise local-only storage.

**In the repository:** `research/human-playtests/`:
- `records/<game id>.json`: unchanged full records. Never edit them, and never delete them because newer games exist. They must be named after their game ID, and the workflow fails otherwise.
- `reports/`: dated reports, plus the scripts that reproduce them.
- `analysis-state.json`: `methodologyVersion`, `batchThreshold` (5), `reports`, `analysed`, `aiChanges` and a dated `snapshot`.

**The tool:** `tools/playtests/dataset.js`.

| Command | What it does |
|---|---|
| `npm run playtests` | Inventory, problems, batch status and statistics by cohort |
| `npm run playtests:add -- <zip or json files>` | Validates the files and copies new valid records into `records/` |
| `npm run playtests -- --record-analysis --report reports/<file>.md --outstanding` (or `--games <id,…>`) | Marks games as analysed. The report must already exist |
| `npm run playtests -- --update-state` | Refreshes the snapshot |
| `--ci [--changed …]` | What `.github/workflows/playtests.yml` runs, read-only, on changes to the collection, its tools or the core. It fails on any problem |

**Research statuses and cohorts:**
- **Collected:** valid, but not yet covered by a report.
- **Analysed:** covered by a report under the current methodology.
- **Eligible for reanalysis:** analysed under an earlier `methodologyVersion`.
- **Batch status:** **Collecting**, then **Ready for Review** once 5 collected games are awaiting review. Nothing runs automatically.
- **Cohorts:** a cohort is app version · rule set · role · opponent AI · level. Compare and pool games only within a cohort.

**Two-tier research** ([docs/playtests.md#commissioning-an-analysis](docs/playtests.md#commissioning-an-analysis)):

| Tier | When | What |
|---|---|---|
| Batch triage | Every 5 games | A 1–2-page report from the template, read at the level of night summaries. It ends with `--record-analysis --outstanding` |
| Investigation | Triggered by a defect candidate, a recurring pattern or an alarming game | A targeted, forensic study of one issue, reproduced from the records. It proposes fixes; it never changes an AI |
| Cumulative review | About every 20 games | Trends across reports. It covers no new games and doesn't record any |

- **Finding labels:** pattern to watch, defect candidate, confirmed defect (needs a failing test), confirmed strategic weakness (needs evidence across several games plus a targeted test).
- **Where findings get confirmed:** triage only flags; confirmation comes from an investigation, or from a cumulative review backed by a test.

**Collection so far:** two valid games, both a person as Jack against Detective AI v3 (Normal), Jack winning both. Both are analysed by `reports/2026-10-11-investigation-arrests.md`, a one-off workflow test:
- **Finding:** v3 never arrested because no arrest was likely. That was not a defect.
- **Pattern to watch:** v3's belief stayed diffuse against this player.

### Planned, NOT implemented: automatic public playtest submission

This is the next major extension. None of it exists yet, and its exact design will be settled in its assignment. Intended shape:

- **Submission:**
  - after a qualifying game, the page POSTs the full record to a **Cloudflare Worker**;
  - the Worker stores it in a **private R2 bucket**, which is never publicly readable.
- **Default-on, with a persistent opt-out:**
  - collection is on by default, with a clear notice;
  - the opt-out is a visible setting, remembered in the browser, and honoured before anything is sent;
  - local saving and manual export keep working either way.
- **Security protections expected:**
  - **Validate before storing:** the Worker checks size, schema, format and rule set; ideally it replays the record or applies the same checks as `WC.playtests.check`, and rejects anything else.
  - **Limit abuse:** rate limiting, CORS restricted to the Pages origin, and an idempotent key by game ID or fingerprint.
  - **Keep personal data out:** no IP addresses or identifiers stored with records.
  - **Keep secrets server-side:** no secrets in the client; Worker and R2 credentials live only in Cloudflare and in GitHub Actions secrets.
  - **Defend against tampering and spam:** treat every submission as untrusted.
- **Import:** a **scheduled GitHub Actions workflow** pulls new objects from R2, validates them with `tools/playtests/dataset.js`, and opens a **pull request** adding `records/<id>.json`.
  - It never commits to `master` directly; a person reviews and merges.
  - Research tracking and the triage workflow stay as they are.
- **Precautions when building it:**
  - **Revise the privacy promise.** Today's "nothing is sent anywhere" appears in `docs/playtests.md` §9, `docs/game-records.md` §9, the UI text and the tests. Rewrite it everywhere rather than leaving it contradicted.
  - **Keep the Pages deployment static.** The Worker is a separate deployment.
  - **Don't let records break the site.** Imported records must not trigger Pages redeploys; `pages.yml` already ignores `research/human-playtests/**`.
  - **Respect the gameplay boundaries.** Gameplay, AI and record format stay unchanged unless the assignment says so.

## Commands

```
npm install                 # Node 22+; dev dependencies: jsdom, fake-indexeddb
npm test                    # fast tier: unit + regression, incl. golden traces (CI; a few minutes)
npm run test:smoke          # small simulations; required for AI/rules/engine/map changes (CI runs it)
npm run eval:medium         # algorithmic AI changes (~13 min); results in experiments/medium/
npm run research:full       # research milestones only (~4 h); never routine
npm run research:import -- <files>   # validate/replay/summarise exported records
npm run playtests           # the human playtest collection (see above)
npm run site                # stage _site/ exactly as the Pages workflow does, and check references
```

The tier runner (`tools/tiers/`) skips medium and full steps whose inputs haven't changed (`experiments/tiers/manifest.json`).

## Testing conventions

Reference: [docs/testing.md](docs/testing.md).

- **Runner and environment:** `node:test`.
  - Core and AI tests run headless.
  - Page tests use jsdom through `test/helpers/game.js`, which loads the scripts in `index.html` order.
  - jsdom lacks `TextEncoder`/`TextDecoder`, so the helper injects Node's.
  - UI storage tests use `fake-indexeddb`.
- **Golden traces** (`test/fixtures/golden-traces.json`):
  - They pin how seeded games play.
  - If a change alters them, it is a behaviour change: regenerate them only deliberately, and explain why in the PR.
  - The default Jack AI shares the page's random source, so UI code that draws random numbers can shift them.
- **Seeds:** fixed seed ranges per study, listed in testing.md. Don't reuse held-out ranges.
- **What a change needs:**
  - a bug fix gets a regression test in `test/regression/bugs.test.js` that fails without it;
  - a rules change gets a test in `test/unit/rules*.test.js`;
  - an engine or AI change gets a core test.
- **Live data:** tests that read `research/human-playtests/` must not hard-code research status. Check it against `analysis-state.json`, because it changes as reports are recorded.

## Deployment and releases (implemented)

- **GitHub Pages:**
  - `pages.yml` publishes https://aceszhenwei.github.io/Letters-From-Whitechapel/ on every push to `master`.
  - It runs `npm test`, then stages only `index.html`, `css/`, `js/`, `images/` and `fonts/` with `tools/site/build.js`.
  - It ignores pushes that only touch `research/human-playtests/**`.
  - The repository setting **Pages source** must be **GitHub Actions**.
  - The site lives under a project path, so no root-relative URLs.
- **Releases** ([docs/releasing.md](docs/releasing.md)):
  - A release is an annotated `vX.Y.Z` tag plus a GitHub Release with notes in `docs/releases/`.
  - Bump `package.json`, `package-lock.json` and `appVersion` in `js/core/record.js`. Records carry `app.version`, so a release starts new cohorts.
  - Where tag pushes are refused, run **Actions › Release › Run workflow** (`release.yml`) instead.
  - Releases don't deploy.
- **Workflows:** `test.yml` (tests plus smoke on pushes and PRs), `pages.yml`, `playtests.yml`, `release.yml`.

## Known limitations and precautions

- **Rules not implemented:** the optional rules and the Head of the Investigation tiles. Playing Jack has no undo or night review ([docs/roadmap.md](docs/roadmap.md#known-limitations)).
- **Browser playtest storage is per browser and per device;** clearing site data loses it. ZIPs re-compressed by other tools import only where `DecompressionStream` exists.
- **Phases are numbered (0–12), not named.** Page tests are slow, because most of their time is jsdom.
- **`docs/roadmap.md` lags behind:** under "Other ideas" it still lists playing Jack against the computer police, which is now implemented.
- **Replay depends on the rule set:** records from another rule set can only be replayed by checking out the release that made them.
