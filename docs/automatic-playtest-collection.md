# Automatic playtest collection

Games people finish on the public site can reach the research collection without anyone exporting or uploading a file. A finished game is kept in the browser as before. Unless the player has turned it off, its full record is then sent to a small Cloudflare Worker, which checks it and stores it privately. Once a day, a GitHub Actions workflow replays the new records and proposes the valid ones in a pull request; the owner reviews and merges it. Everything runs on free plans that stop working at their limits rather than charging.

```
A person finishes a game (Jack or the detectives)
  → kept in this browser (IndexedDB), exactly as before            js/ui/playtest-store.js
  → setting on? queued, sent in the background, retried if needed  js/ui/submission.js
  → Worker: cheap structural checks, rate limits, caps             worker/src/
  → private D1 database: one row per game id, never overwritten    worker/migrations/
  → daily GitHub Action: download new ones, full replay            tools/playtests/intake.js
  → one pull request "Import human playtests — <date>"             tools/playtests/import-pr.js
  → the owner reviews and merges
  → research/human-playtests/records/: "collected", counts toward the five-game batch (docs/playtests.md)
```

**Status.** Implemented and tested locally and in CI (section 15). **Awaiting owner configuration:** the Cloudflare account, the secrets and the variable in [Owner setup](#11-owner-setup). **Awaiting live verification:** nothing has been deployed to Cloudflare yet. Until the owner sets the repository variable `PLAYTEST_API_URL`, the published site sends nothing anywhere and shows no research setting.

## Contents

1. [Architecture and choices](#1-architecture-and-choices)
2. [For players](#2-for-players)
3. [Privacy](#3-privacy)
4. [The Worker API](#4-the-worker-api)
5. [Storage](#5-storage)
6. [Abuse, spam and data integrity](#6-abuse-spam-and-data-integrity)
7. [The import workflow](#7-the-import-workflow)
8. [Research integration](#8-research-integration)
9. [Costs: zero, and why it stays zero](#9-costs-zero-and-why-it-stays-zero)
10. [Configuration reference](#10-configuration-reference)
11. [Owner setup](#11-owner-setup)
12. [Verifying a live deployment](#12-verifying-a-live-deployment)
13. [Maintenance](#13-maintenance)
14. [Troubleshooting](#14-troubleshooting)
15. [Rollback and recovery](#15-rollback-and-recovery)
16. [Testing](#16-testing)
17. [For developers](#17-for-developers)

## 1. Architecture and choices

| Piece | Where | Role |
|---|---|---|
| GitHub Pages | unchanged static site | The game. The build writes the intake's address into `js/config.js` from the repository variable `PLAYTEST_API_URL` (`tools/site/build.js`). |
| Browser queue | `js/ui/submission.js`, `js/ui/research.js` | The setting, the queue in IndexedDB, sending, retries; the notice, the dialog and the ending line |
| Worker | `worker/` (a separate deployment) | `POST /api/v1/playtests`: checks, rate limits, caps, stores. Read-only import endpoints behind a token. A daily cron applies the retention policy |
| D1 database | Cloudflare, private | One row per game: the record exactly as received, plus metadata |
| Import workflow | `.github/workflows/playtest-import.yml` | Daily: download new submissions, replay them with the collection's own checks, open or update one pull request |
| Deploy workflow | `.github/workflows/playtest-worker.yml` | By hand: deploy, pause or resume the Worker. On pull requests: check that it bundles |

**Why D1 and not R2.** The plan in `CLAUDE.md` named R2. R2 has a free allowance (10 GB-month of storage, 1 million Class A and 10 million Class B operations a month), but Cloudflare asks for a payment method before R2 can be used, and usage beyond the allowance is billed. D1 on the Workers Free plan needs no payment method and cannot bill: Cloudflare's D1 FAQ says that when the daily limits are reached, "you will not be able to run queries against D1 … D1 API will return errors", and the free plan resets daily. D1 also gives what R2 lacks: an atomic `UNIQUE` constraint, so two simultaneous submissions of one game store it once, with no read-then-write race. Records are 100–200 KB, well inside D1's 2 MB row limit.

**Why the import goes through the Worker.** The import workflow reads through two read-only endpoints protected by a 256-bit token, not through a Cloudflare API token. A Cloudflare token able to query D1 can also change or delete it, so it would be a broader credential to keep in GitHub. The import token can only list and read submissions.

**Why the Worker doesn't replay.** A full replay takes far longer than the Free plan's 10 ms of CPU per request, and would make every public request expensive, which helps an attacker. The Worker does cheap structural checks (about 2.5 ms for a 160 KB record); the established pipeline replays later, in GitHub Actions.

## 2. For players

**The setting: Anonymous Gameplay Research.**
- **Where:** a notice with a switch in the setup dialog, shown before any game starts, and **Research** in the top bar, which opens the full notice and the same switch at any time. It is part of the normal interface, not Developer Mode, and works on phones.
- **Default:** on. It is off by default when the browser sends Global Privacy Control or Do Not Track; the player may still turn it on.
- **Remembered:** the choice is kept in `localStorage` (`whitechapel.research.submit`: `on` or `off`) and the player is never asked again.
- **Turning it off:** nothing more is sent. A request in flight is aborted, games waiting to be sent are cancelled, and retries stop. Games are still kept in the browser and can still be exported. Turning it back on sends only games finished afterwards: nothing played while it was off is sent, unless the player sends a game on purpose (below).

**What is sent and when.** Only once a game a person played ends by a rule (escape, arrest, out of moves, trapped), and only its full game record, unchanged ([Game records](game-records.md)). Both roles count. Nothing is sent during play, and never for a game ended by hand, an unfinished game or a game the computer played alone. The game never waits for the network: the record is kept locally first, and sending happens afterwards.

**Submission status** (each kept game; independent of whether it was exported):

| Status | Meaning |
|---|---|
| Not submitted | Never sent: the setting was off, the game was kept before this existed, the site has no intake, or sending was cancelled |
| Pending / Submitting | Waiting to be sent / being sent |
| Submitted | The intake acknowledged it (a "duplicate" acknowledgement counts: it had arrived before) |
| Will retry | A try failed (offline, timeout, rate limited, service paused or full); another follows automatically |
| Retry required | The automatic tries are used up (8); **Submit** in the playtest records tries again |
| Permanently rejected | The intake refused it for good (an invalid record, or a conflict with a different record of the same game ID); never sent again |

**Retries:** one game at a time, with exponential backoff (1 minute, doubling, at most 12 hours, plus up to 20% random jitter from `crypto`, never `Math.random`). A `Retry-After` from the server is honoured (at most a week). Retries happen while the page is open, when the browser comes back online, and at the next visit; a game left half-sent by a closed page is sent again (the server recognises a duplicate).

**The ending dialog** says whether the game was kept, and whether it was submitted (with its game ID, which the player needs to ask for removal).

**Developer Mode's playtest records** gain an **Online** column with each game's status, and a **Submit** button for games not submitted (including games played while the setting was off: sending one is an explicit request). Export, import, delete and clear work as before; exporting never changes the submission status and submitting never marks a game exported. Local games are never deleted after submission.

## 3. Privacy

**What is collected.** The full game record: every action both sides took, the AI opponent and level, the outcome, the app version and rule set, the date the record was made (no time of day), the detectives' random seed, and a random game ID made for that game. The record format holds no personal data ([Game records §9](game-records.md#9-privacy)). The Worker refuses a record that carries the export dialog's optional written note (`feedback`), or any field a game record doesn't have.

**What is not.** No name, email, account, cookie, or persistent player or device identifier. The browser sends no cookie (`credentials: 'omit'`) and no referrer (`referrerPolicy: 'no-referrer'`). The Worker stores no IP address, user agent or other header: its database has no column for any of them, and Workers Logs are off in `worker/wrangler.toml`. The IP address is used only as the key of Cloudflare's rate limiter, which counts in memory. Like any website host (GitHub Pages included), Cloudflare itself sees connection details while delivering requests; the application keeps none of them.

**Why.** To study how people play against the computer, and to find and fix weaknesses in Jack and the detectives ([Human playtests](playtests.md)).

**Where.** A D1 database in the owner's Cloudflare account. It is not public: there is no public listing, download or deletion endpoint. The import workflow reads it with a secret token.

**Publication.** Records that pass review are committed to the public GitHub repository (`research/human-playtests/records/`), where anyone can read them. The notice says so.

**Retention.**
- **Private database:** a submission is deleted 365 days after it was received, by the Worker's daily cron (`RETENTION_DAYS`). Daily statistics are deleted after 90 days.
- **Repository:** records merged into the repository are kept as research evidence, like the collection's other records.
- **Browser:** records stay in the browser until the player deletes them or clears site data.

**Removal.** The game ID is the only link to a game, and it isn't linked to the player. To have a game removed, the player opens an issue in the repository quoting the game ID. The owner then:
- deletes its row (section 13);
- does not merge it, or removes the record from `records/`, noting the reason in the commit;
- excludes it from future imports with `--exclude`.

Removing a record that a report already analysed means updating `analysis-state.json` too, and saying so in the report's history.

**Legal assessment (Singapore PDPA, and visitors elsewhere).** This was assessed while building the feature; it is not legal advice, and the owner should review it.
- **Singapore's PDPA** governs *personal data*: data about an individual who can be identified from that data, or from that data together with other information the organisation has or is likely to have access to. A full record identifies no one, and nothing stored could link it to a person. The owner has no IP address, account or identifier to combine it with. On that basis the records are not personal data, and the PDPA's consent obligations don't attach to them.
- **No hobby exemption assumed.** The PDPA excludes individuals acting in a personal or domestic capacity, but a public website arguably isn't that, so the design doesn't rely on the exemption.
- **Free text is the risk, so it is refused.** A player's free text (the export note) could be personal data, so it is never accepted online.
- **Visitors elsewhere:** anonymous data is outside the GDPR's scope (Recital 26). The only browser storage added is the player's own on/off choice, which is needed to honour that choice.
- **Global Privacy Control and Do Not Track** start the setting off.
- **Good practice beyond the minimum:** the notice is shown before play, the opt-out is persistent and the removal route is documented, though none of these is required for non-personal data.
- **Conclusion: no deviation needed.** Default-on with a clear notice and a persistent opt-out is lawful for this data, so the assignment's design stands.
- **If the record format ever gains personal data, revisit this.** Examples: a name, free text, or a device detail. Such a change could require consent (opt-in).

## 4. The Worker API

Base address: `https://whitechapel-playtests.<subdomain>.workers.dev` (the repository variable `PLAYTEST_API_URL`).

| Method and path | Who | Answer |
|---|---|---|
| `POST /api/v1/playtests` | browsers on the site | Submit one full record (`Content-Type: application/json`) |
| `OPTIONS /api/v1/playtests` | browsers | CORS preflight: allowed for `ALLOWED_ORIGINS` only |
| `GET /api/v1/health` | anyone | `{ intake: 'open' or 'paused', rulesets, importEnabled }`; no data |
| `GET /api/v1/admin/submissions?after=<seq>&limit=<n>` | the import token | Metadata of submissions after `seq`, oldest first, at most 500 (no records) |
| `GET /api/v1/admin/submissions/<game id>` | the import token | One record, byte for byte, with `X-Body-SHA256` |
| `GET /api/v1/admin/stats` | the import token | Daily counts of every outcome (last 90 days), and the totals |

The import endpoints are off (404) until the Worker has an `IMPORT_TOKEN` secret of at least 32 characters. They are read-only: any other method gets 405. Wrong or missing tokens get 401 before any storage is touched. Tokens are compared without leaking timing.

**Submission answers.** Each answer is JSON: `{ ok, status, message, gameId?, receipt? }`. The message is fixed text, never an echo of the input.

| HTTP | `status` | Meaning; what the browser does |
|---|---|---|
| 201 | `accepted` | Stored. Submitted |
| 200 | `duplicate` | The same game was stored before (the export date may differ). Submitted |
| 409 | `conflict` | A different record with this game ID is stored; it is kept, not replaced. Rejected |
| 400 | `invalid_json`, `invalid_body`, `not_a_record` | Not JSON, not UTF-8, or not a game record. Rejected |
| 413 | `too_large` | Over `MAX_BODY_BYTES` (512 KiB). Rejected |
| 415 | `unsupported_media_type` | Not `application/json`. Rejected |
| 422 | `unsupported_schema`, `unsupported_ruleset`, `not_full`, `not_completed`, `not_human`, `bad_game_id`, `has_note`, `unexpected_field`, `bad_…` | A record the intake doesn't accept. Rejected |
| 403 | `origin_not_allowed` | A browser on another website. Rejected |
| 405 / 404 | `method_not_allowed` / `not_found` | Wrong method or path |
| 429 | `rate_limited` | Too many from one address (`Retry-After: 60`). Retried |
| 503 | `paused`, `daily_limit`, `storage_full`, `storage_unavailable` | Paused (`Retry-After` 6 hours), today's cap reached (until midnight UTC), the store is full (a week), or D1 failing (10 minutes). Retried |
| 500 | `error` | Anything unexpected; no internals in the message. Retried |

**Intake checks** (`worker/src/validate.js`). The body must be a JSON object meeting all of these:
- **Format and versions:**
  - `format` is `whitechapel-game-log`, with schema version 1;
  - the rule set is in `ACCEPTED_RULESETS`;
  - `app.name` is this game, and `app.version` looks like a version.
- **Full record of a completed human game:**
  - disclosure `full`, game status `completed`;
  - exactly one human player and one AI, with short, plain labels;
  - an outcome consistent with its winner and nights.
- **Game ID:** matches `^g[0-9a-f]{16}$`, the form `WC.record` makes. Only this validated ID is used as a key.
- **Shape:**
  - actions numbered 1…n, each with a known side and type and an arguments object, at most 5,000;
  - one night summary per night played, and a final state.
- **Nothing extra:** no field outside the record format, and no `feedback`.

It doesn't replay the game: passing these checks makes a submission *structurally accepted*, nothing more.

## 5. Storage

`worker/migrations/0001_initial.sql`:
- `submissions`:
  - **Keys:** `seq` (increasing) and `game_id` (`UNIQUE`).
  - **Dates and sizes:** `received_on` (the UTC date, no time) and `bytes`.
  - **Integrity:** `body_sha256`, the SHA-256 of the exact bytes received.
  - **Duplicates:** `content_hash`, the SHA-256 of the record without its export date, which tells duplicates from conflicts.
  - **Metadata:** version, rule set, role, opponent, level, result, `intake_version`.
  - **The record:** `body`, the record itself, exactly as received.
- `counters`: running totals (`stored`, `stored_bytes`), kept by triggers, for the caps.
- `daily_stats`: a count per day and outcome, for monitoring abuse and for the daily cap.

**Atomic deduplication.** `INSERT … ON CONFLICT (game_id) DO NOTHING RETURNING seq` either stores the record or stores nothing; a returned row means this request stored it. Otherwise the stored row's `content_hash` decides between a duplicate and a conflict. An existing record is never replaced. Two simultaneous submissions of one game store it once (tested with eight at a time).

**Operational metadata is separate from the record:** the record is stored untouched in `body`; everything the Worker derives is in its own columns. The import workflow lists metadata without downloading bodies, and downloads a body only for a game it hasn't decided before.

**Not deleted on import.** Downloading changes nothing in D1. Records stay recoverable if an import fails or a pull request is closed, until the retention policy removes them after a year.

**Caps** (section 10): records accepted per UTC day (`DAILY_LIMIT`, 50), records kept (`MAX_STORED`, 2,000) and total size (`MAX_STORED_BYTES`, 400 MB, below D1 Free's 500 MB per database). At a cap, submissions get 503 with `Retry-After`, and browsers keep their records.

## 6. Abuse, spam and data integrity

Assume the endpoint will be found and scripted.

| Protection | How |
|---|---|
| Rate limiting | Cloudflare's rate limiting binding: 10 submissions a minute per IP address, per Cloudflare location (`[[ratelimits]]`), checked before any storage is touched. If the binding is unavailable, the caps still hold |
| Request size | `Content-Length` checked first, then the body is read in chunks and abandoned past 512 KiB |
| Structure | The intake checks (section 4); unknown fields refused |
| Safe naming | Only a game ID matching `^g[0-9a-f]{16}$` is used as a key or file name, everywhere |
| Deduplication | The `UNIQUE` game ID; conflicts never overwrite |
| Caps | Daily and total caps; the Free plan's own limits stop everything else, without charges |
| Origins | CORS for the Pages origin only, and other browsers' origins refused. **Not a security measure:** scripts send any `Origin` |
| Safe errors | Fixed messages; nothing echoed; nothing internal |
| Monitoring | Daily counts of every outcome (`GET /api/v1/admin/stats`); the import pull request warns about unusual volume or copied games |
| Emergency stop | `INTAKE_PAUSED` (section 15) |

**Turnstile is not used.** Its widget would add friction and a third-party script for every player, for a threat the caps already bound. If abuse ever outgrows the caps, it is the next step (Cloudflare Turnstile is free).

**Research data poisoning.** Anyone can read the open-source game and fabricate a record that replays perfectly. Replay proves a record is *legal and consistent*, not that a person played it. So a submission moves through four stages, and only a person promotes it to evidence:

| Stage | Where | What it shows |
|---|---|---|
| Untrusted submission | the Worker's input | Nothing |
| Structurally accepted | D1 | The shape of a full record of a completed human game |
| Replay-verified | the import pull request | Legal moves, ending as recorded (`tools/game-log/validate.js`: verified) |
| Research evidence | merged into `records/`, then read by a report | A person reviewed it; reports describe it within its cohort, never generalising |

The import pull request warns when different game IDs share identical moves (a copied or fabricated record) and when more than 25 submissions arrived on one day. Reviewers can close the pull request and `--exclude` games. No fingerprinting or surveillance is used.

## 7. The import workflow

`.github/workflows/playtest-import.yml` (**Import human playtests**):
- **When:** daily at 05:41 UTC, or by hand from **Actions › Import human playtests › Run workflow**, with an optional **dry run** that downloads and replays but opens no pull request.
- **Skipped** while the repository variable `PLAYTEST_API_URL` is unset.
- **Permissions:**
  - `contents: write` for its own branch, `pull-requests: write` and `actions: write`;
  - the import token comes from the secret `PLAYTEST_IMPORT_TOKEN`, never printed.
- **Concurrency:** one run at a time.

**Steps:**
1. Check out `master`.
2. `node tools/playtests/intake.js`:
   1. Lists every submission's metadata.
   2. Skips games already decided in `research/human-playtests/intake.json` on master (the ledger).
   3. Downloads at most 200 others, checking each one's SHA-256.
   4. Runs **the collection's own check** (`dataset.checkRecord` → `tools/game-log/validate.js`, with the full replay). There is no second validator.
   5. Compares with `records/`: an identical record is a duplicate; a different one is a conflict, never overwritten.
   6. Writes each eligible record as `records/<game id>.json`, byte for byte, and records every decision in `intake.json`.
3. `node tools/playtests/dataset.js --ci` checks the collection as it would be merged.
4. `node tools/playtests/import-pr.js` handles the pull request:
   1. **Path guard:** refuses to commit anything but `records/g<16 hex>.json` and `intake.json`.
   2. **Commit:** commits to the bot's branch `playtest-import`, rebuilt from master on each run.
   3. **Push only on change:** pushes only if the content changed (`--force-with-lease`).
   4. **One pull request:** updates the open one, or opens one titled **Import human playtests — YYYY-MM-DD**.
   5. **Starts the collection check:** a pull request made with the workflow's token doesn't start other workflows, so it runs **Human playtests** on the branch.
   6. **Nothing eligible:** it opens nothing and closes an obsolete open import pull request.

**The pull request's description** gives:
- the number examined, replay-verified, rejected, duplicated, conflicting and eligible;
- the cohorts;
- a line per game;
- warnings;
- the trust statement;
- the research batch status after merging.

**Idempotent and recoverable.**
- **Nothing new:** no pull request.
- **Already imported:** skipped by the ledger without downloading.
- **Interrupted, or retried after a failure:** the branch is rebuilt from master and the Worker still holds every record, so a re-run produces the same pull request.
- **Concurrent runs:** queued.
- **An open pull request:** reused.
- **Conflicts:** reported, never overwritten.
- **Failed downloads:** retried next run.
- **Missing, wrong or expired credentials:** a clear error (exit 2) naming the secret or variable to fix.

**Refusing a game for good:** close the pull request, run `npm run playtests:intake -- --exclude <game id> --reason "…"`, and commit `research/human-playtests/intake.json` in a pull request.

## 8. Research integration

The existing collection stays the authority ([Human playtests](playtests.md)). Merging an import pull request adds records to `research/human-playtests/records/` like any other upload:
- they are **collected** (unanalysed) and count toward the five-game batch;
- importing never marks a game as analysed; only `--record-analysis` after a report does;
- a game already in the collection is a duplicate and is never counted twice;
- cohorts (app version · rule set · role · opponent · level) keep versions apart;
- analysed records, reports and `analysis-state.json` are untouched.

`intake.json` is the provenance ledger: for each submission, its number, date received, SHA-256 and the verdict. `npm run playtests` now also reports games by source (online submission or manual upload). Its CI check fails if an imported record no longer matches the SHA-256 it was received with. The two-tier research process (batch triage, targeted investigations, cumulative reviews) is unchanged, and nothing runs an agent or changes an AI.

Manual export and upload ([Human playtests §3](playtests.md#3-uploading-records-to-github)) keep working, for players who opt out or for games from other devices.

## 9. Costs: zero, and why it stays zero

Checked against Cloudflare's documentation (its source on GitHub, `cloudflare/cloudflare-docs`, October 2026) and GitHub's published allowances. Prices and plans change: re-check the linked pages before activating.

| | GitHub Pages and Actions | Cloudflare Workers Free | Cloudflare D1 (on Workers Free) |
|---|---|---|---|
| **Account** | The existing repository | Free to create | Included in Workers Free |
| **Payment card** | No | Not needed for the Free plan ("By default, users have access to the Workers Free plan") | No |
| **Billing to enable** | No | No: never subscribe to **Workers Paid** | No |
| **Free allowance** | Pages: unchanged. Actions: free for public repositories; this adds one short daily run | 100,000 requests a day; 10 ms CPU per request; cron triggers | 5 million rows read and 100,000 rows written a day; 5 GB in total, 500 MB per database; 10 databases |
| **What could charge** | Nothing on a public repository | Only a Workers Paid subscription | Only Workers Paid (then usage is billed) |
| **At the limit** | Runs queue or fail | Error 1027 until midnight UTC; browsers keep records and retry | Queries fail until midnight UTC (storage: until data is deleted); the Worker answers 503 |
| **Spending cap** | Not needed | The Free plan is the cap: it has no billing | The same |
| **Turn off now** | Disable the workflows (Actions › workflow › ⋯ › Disable) | Pause, disable the `workers.dev` route, or delete the Worker (section 15) | Delete the database |

**Expected use** (a few hundred games), per submission:
- **Requests:** 2 (the preflight and the POST).
- **D1:** about 6 row writes and a few row reads.

The daily import costs about one row read per stored game. At 50 games a day that is about 100 requests and 300 rows written, under 0.3% of the free allowances.

**R2 is not used.** It needs a payment method on file and bills beyond its allowance. If R2 is ever wanted (for example for records over 2 MB), that is a change of risk the owner must approve.

**Residual risks, disclosed:**
- Cloudflare may change its free plans; the docs above are the place to check.
- An attacker can use up the day's free allowance (100,000 requests). Intake then stops until midnight UTC, at no cost. Players keep their games and their browsers retry.
- Within the caps, structurally valid junk can fill the daily cap (50) and, over weeks, the store (400 MB). The import pull request flags it, and the owner can purge it (section 13).

## 10. Configuration reference

Every value is named once, here. **Public** values may be seen by anyone; **secret** values never appear in a file.

| Name | Where it is set | Public or secret | What it is |
|---|---|---|---|
| `PLAYTEST_API_URL` | GitHub › Settings › Secrets and variables › Actions › **Variables** | Public | The Worker's address, e.g. `https://whitechapel-playtests.example.workers.dev`. Turns on submission in the Pages build and the daily import |
| `PLAYTEST_IMPORT_TOKEN` | GitHub › … › **Secrets** | Secret | A random string of at least 32 characters. The deploy workflow copies it to the Worker's secret `IMPORT_TOKEN`; the import workflow uses it to read |
| `CLOUDFLARE_API_TOKEN` | GitHub › … › **Secrets** | Secret | A Cloudflare API token allowed to edit Workers scripts and D1, used only by the deploy workflow |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub › … › **Secrets** | Public, kept with the token | The Cloudflare account's ID |
| `PLAYTEST_ALLOWED_ORIGINS` (optional) | GitHub › … › **Variables** | Public | Other origins allowed to submit; default `https://aceszhenwei.github.io` |
| `ALLOWED_ORIGINS`, `ACCEPTED_RULESETS`, `MAX_BODY_BYTES`, `DAILY_LIMIT`, `MAX_STORED`, `MAX_STORED_BYTES`, `INTAKE_PAUSED`, `RETENTION_DAYS` | `worker/wrangler.toml` `[vars]` | Public | The Worker's defaults; change them by pull request, then redeploy |
| `IMPORT_TOKEN` | Cloudflare › the Worker › Settings › Variables and Secrets (set by the deploy workflow) | Secret | Equal to `PLAYTEST_IMPORT_TOKEN` |

## 11. Owner setup

The pull request that introduced this has the same steps in full under **ACTION REQUIRED FROM REPOSITORY OWNER**, written for someone who has never used Cloudflare. In short:

1. Create a free Cloudflare account; choose a `workers.dev` subdomain (**Workers & Pages**). Never add a payment method or subscribe to Workers Paid.
2. Copy the **Account ID** into the GitHub secret `CLOUDFLARE_ACCOUNT_ID`.
3. Create a Cloudflare API token from the **Edit Cloudflare Workers** template, adding **Account › D1 › Edit**, for this account only. Put it in the GitHub secret `CLOUDFLARE_API_TOKEN`.
4. Make a random import token of at least 32 characters, and put it in the GitHub secret `PLAYTEST_IMPORT_TOKEN`.
5. In **Settings › Actions › General › Workflow permissions**, tick **Allow GitHub Actions to create and approve pull requests**.
6. Run **Actions › Deploy playtest Worker › Run workflow** (action `deploy`). Copy the `workers.dev` address from its summary.
7. Create the repository **variable** `PLAYTEST_API_URL` with that address.
8. Run **Actions › Deploy to GitHub Pages › Run workflow**. The site now shows Anonymous Gameplay Research.
9. Verify (section 12).

Without GitHub Actions, the same works from a terminal: `CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… PLAYTEST_IMPORT_TOKEN=… node worker/scripts/deploy.mjs`. Check the configuration with `PLAYTEST_IMPORT_TOKEN=… npm run playtests:intake -- --check-config --api <address>`.

## 12. Verifying a live deployment

1. `https://<worker address>/api/v1/health` shows `"intake":"open"` and `"importEnabled":true`.
2. Open the site: the setup dialog shows **Anonymous Gameplay Research**, switched on.
3. Play a game to the end, and check the ending dialog. It should say **Submitted anonymously for research**, with the game ID. Note the ID.
4. On the Cloudflare dashboard, open **Storage & Databases › D1 SQL Database › whitechapel-playtests › Console** and run `SELECT seq, game_id, received_on, bytes FROM submissions;`. Your game ID is there.
5. Run **Actions › Import human playtests › Run workflow**. A pull request **Import human playtests — <date>** appears, adding `research/human-playtests/records/<game id>.json`. Its **Human playtests** check passes.
6. Merge it. `npm run playtests` (or the next **Human playtests** run) lists the game as *collected*, awaiting review, and counts it once toward the batch.
7. Opt-out check: in the setup dialog, turn the switch off and finish another game. The ending dialog says it was not submitted, and the D1 query shows no new row.

## 13. Maintenance

**When the rules or map change** (a new `ruleset.id`): add the new ID to the front of `ACCEPTED_RULESETS` in `worker/wrangler.toml` (a test fails until you do), and redeploy. Keep the old ID if old-version pages still submit.

**When the record format changes** (a new `schemaVersion`): teach `worker/src/validate.js` its fields, and add the version.

**When Jack's or the detectives' AI changes:** nothing to do here. Records carry their AI and app version, so cohorts stay apart.

**Wrangler:** `worker/scripts/deploy.mjs` pins `wrangler@4.140.0`. Raise it deliberately, after `npm run playtests:worker-check`.

**Scheduled workflows** are disabled by GitHub after 60 days without activity in the repository. Re-enable **Import human playtests** in the Actions tab if that happens.

**Rotating the import token:**
1. Change `PLAYTEST_IMPORT_TOKEN` in GitHub.
2. Run **Deploy playtest Worker**.

**Monitoring:** call the stats endpoint with the import token:

```
curl -H "Authorization: Bearer $PLAYTEST_IMPORT_TOKEN" https://<worker>/api/v1/admin/stats
```

It gives daily counts of `accepted`, `duplicate`, `conflict`, `invalid_json`, `too_large` and other outcomes. Cloudflare's dashboard shows request counts and errors.

**Purging junk or honouring a removal request:** in **D1 › whitechapel-playtests › Console**, run:

```
DELETE FROM submissions WHERE game_id = 'g…';
```

To purge a day of spam:

```
DELETE FROM submissions WHERE received_on = 'YYYY-MM-DD' AND game_id NOT IN ('g…', …);
```

The counters follow by trigger. D1 keeps 7 days of Time Travel on the Free plan, should a deletion need undoing.

## 14. Troubleshooting

| Symptom | Likely cause | What to do |
|---|---|---|
| The site shows no research setting | `PLAYTEST_API_URL` unset, or Pages not rebuilt since | Set the variable; run **Deploy to GitHub Pages**. Check the build log line "Anonymous Gameplay Research: on" |
| The Pages build fails at `build.js` | `PLAYTEST_API_URL` is not a plain `https://` address | Fix the variable (no quotes, no path other than the Worker's) |
| Games stay **Will retry** | Worker unreachable, paused, rate limited or at a cap | Open `/api/v1/health`; check Cloudflare › Workers & Pages › the Worker › Metrics; see the stats endpoint |
| Games become **Permanently rejected** | The Worker refused them: often `unsupported_ruleset` after a rules change | Add the rule set to `ACCEPTED_RULESETS` and redeploy; then use **Submit** in the playtest records (Developer Mode) for the affected games |
| Browser console: CORS error | The site's origin isn't in `ALLOWED_ORIGINS` | Set `PLAYTEST_ALLOWED_ORIGINS` (or edit `wrangler.toml`), redeploy |
| Deploy workflow: "missing …" | A secret isn't set | Add it (section 10) |
| Deploy workflow: cannot list D1 databases | The API token lacks **D1 Edit**, or the account ID is wrong | Edit the token's permissions in Cloudflare › My Profile › API Tokens |
| Deploy workflow: "no workers.dev subdomain" | First use of Workers | Open Workers & Pages once and choose a subdomain |
| Import workflow skipped | `PLAYTEST_API_URL` unset | Set it |
| Import: "refused the import token (401)" | GitHub's `PLAYTEST_IMPORT_TOKEN` differs from the Worker's `IMPORT_TOKEN` | Re-run **Deploy playtest Worker** (it copies the secret across) |
| Import: "import endpoints are off (404)" | The Worker has no `IMPORT_TOKEN` | Re-run **Deploy playtest Worker** |
| Import: "GitHub Actions is not permitted to create … pull requests" | The repository setting | Settings › Actions › General › tick **Allow GitHub Actions to create and approve pull requests** |
| Import pull request has no checks | Pull requests made by the workflow's token don't start workflows | The workflow starts **Human playtests** on the branch itself; if that fails, run it by hand on `playtest-import` |
| D1 errors in the Worker (503 `storage_unavailable`) | Daily free limit reached (abuse?) or a Cloudflare incident | Wait for midnight UTC; check the stats; pause if it is abuse |

## 15. Rollback and recovery

From fastest to most thorough; none of them breaks the game, and local saving and export keep working throughout:

1. **Pause intake** (seconds; nothing is lost): **Actions › Deploy playtest Worker › Run workflow › action `pause`**. Alternatively, edit `INTAKE_PAUSED` to `true` in Cloudflare › the Worker › Settings › Variables and Secrets, then deploy. Submissions get 503 with `Retry-After: 21600`, and browsers keep their records and retry hours later. `resume` reopens it.
2. **Stop the site from sending**: delete the repository variable `PLAYTEST_API_URL` and run **Deploy to GitHub Pages**. New page loads show no setting and send nothing; this also skips the import workflow. Pages already open keep their old configuration until reloaded.
3. **Cut the Worker off**: Cloudflare › the Worker › Settings › Domains & Routes › disable `workers.dev`, or delete the Worker. Browsers get network errors, keep their records and give up after 8 tries.
4. **Stop importing**: Actions › Import human playtests › ⋯ › Disable workflow.
5. **Delete the data**: delete the D1 database (Storage & Databases › D1 SQL Database). Records already merged stay in the repository.

**Recovery.** Every accepted record stays in D1 until retention removes it. To recover from a failed import or a closed pull request, run the import again.

## 16. Testing

| What | Test | Runs in |
|---|---|---|
| The Worker: valid records, malformed JSON, oversized (declared and streamed), invalid UTF-8, schemas, rule sets, unfinished and AI-only games, unsafe IDs, notes, extra fields, duplicates, conflicts, eight simultaneous submissions, rate limits, caps, pause, storage failures (an interrupted write), import endpoints, retention, no sender data stored, the entry point's exports | `test/unit/playtest-worker.test.js` | `npm test` (CI), against `test/helpers/d1.js`: Node's SQLite running the real migrations, with D1's change counting |
| The browser queue: default on, persistent opt-out, GPC and DNT, sending once, no cookie or referrer, offline, backoff, Retry-After, bounded retries, permanent rejections, cancelling on opt-out (also mid-request), no retroactive sending, explicit Submit, recovery after a closed page, independence from exporting | `test/unit/playtest-submission.test.js` | `npm test` |
| The importer and the pull request: no-op runs, new records, duplicates, conflicts, failed replays, other rule sets, checksum mismatches, unsafe IDs, credentials (missing, wrong, endpoints off), the intake down, failed downloads recovered, bounded runs, exclusions, copied-game warnings, PR created once then updated, no push without change, obsolete PR closed, path guard | `test/unit/playtest-intake.test.js` | `npm test` |
| End to end: a Human Jack game in the page → IndexedDB → automatic submission → Worker → D1 → import with full replay → collection → five-game counter. Same game twice counted once; nothing marked analysed; opting out sends nothing; no intake address shows nothing | `test/regression/playtest-collection-e2e.test.js` | `npm test` |
| The Pages build fills in the address only when valid | `test/unit/site-build.test.js` | `npm test` |
| The Worker bundles with its configuration | `npm run playtests:worker-check` | the **Deploy playtest Worker** workflow on pull requests |

**Also verified once in the real Workers runtime** (by hand, while building this): `wrangler dev --local` (workerd and a local D1) for accepted, duplicate, conflict, origin, malformed JSON, preflight, the rate limiter (429 from the 11th request), the import endpoints byte for byte, and `tools/playtests/intake.js` against it. This found two bugs the Node stand-in could not see, both fixed and now guarded by tests:
- the runtime refuses non-handler exports from the entry module;
- D1 counts the triggers' rows in `meta.changes`.

To repeat it:

```
cd worker && npx wrangler@4.140.0 d1 migrations apply whitechapel-playtests --local
npx wrangler@4.140.0 dev --local
```

Run the `dev` command with `IMPORT_TOKEN` in a `.dev.vars` file. No test sends anything to a real service.

## 17. For developers

| Piece | File |
|---|---|
| Intake address (filled in at build) | `js/config.js`; `tools/site/build.js` |
| Browser queue and setting | `js/ui/submission.js` (`WC.submission`) |
| Notice, dialog, ending line | `js/ui/research.js` (`WC.ui.research`); `index.html`; `css/style.css` |
| Submission status in IndexedDB | `js/ui/playtest-store.js` (`setSubmission`; entries' `submission`) |
| Online column, Submit | `js/ui/playtests.js` |
| Worker | `worker/src/index.js` (entry point: only the default export), `worker/src/app.js`, `worker/src/validate.js`, `worker/migrations/`, `worker/wrangler.toml` |
| Deployment | `worker/scripts/deploy.mjs`; `.github/workflows/playtest-worker.yml` |
| Import | `tools/playtests/intake.js` (`npm run playtests:intake`), `tools/playtests/import-pr.js`; `.github/workflows/playtest-import.yml` |
| Ledger | `research/human-playtests/intake.json` (created by the first import) |

The Worker is modern JavaScript (ES modules), deployed separately: the ES5 and no-build rules apply to the site in `js/`, which is unchanged in style. The game rules, the AIs and the record format are unchanged.
