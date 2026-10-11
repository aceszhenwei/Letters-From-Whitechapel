# Human playtests

The permanent collection of games people have played, kept as research evidence. How records get here, how they are checked and how analyses are commissioned: [docs/playtests.md](../../docs/playtests.md).

| Path | What it holds |
|---|---|
| `records/<game id>.json` | One full game record per completed game a person played, exactly as the game exported it. Never edited, renamed or deleted because newer games exist |
| `reports/` | Dated research reports, each naming exactly the game IDs it covers |
| `analysis-state.json` | Which games each report covered, the methodology version, AI and rule changes that affect records, and a snapshot of the games awaiting review |
| `intake.json` | Created by the first automatic import: every online submission the import workflow examined, with its submission number, date received, SHA-256 and verdict (imported, duplicate, conflict, rejected, excluded). Provenance for records that arrived online ([docs/automatic-playtest-collection.md](../../docs/automatic-playtest-collection.md)) |

**Adding games:**
- Upload the `.json` files from an exported batch ZIP's `records/` folder into `records/`, in a pull request. Or, with a clone, run `npm run playtests:add -- <the ZIP>`.
- Games submitted online arrive in an **Import human playtests** pull request, already replayed; review and merge it.
- The **Human playtests** workflow checks every record by full replay.

**Status:** `npm run playtests` prints:
- the inventory and any problems;
- the research batch status: **Collecting**, or **Ready for Review** at 5 new games;
- cumulative statistics by cohort.

**Collected so far:** see `analysis-state.json` (`snapshot`) or run `npm run playtests`. The first two games, `g91d4014f17ae09e6` (10 October 2026) and `ga36125530c4b4076` (11 October 2026), are both a person as Jack against Detective AI v3 (Normal), app version 1.0.0, with Jack escaping on all four nights. Five more arrived as online submissions on 11 October 2026, in the same cohort. Jack won 4 of them; the police arrested him once, on the double event.

**Reports so far:** [2026-10-11-investigation-arrests](reports/2026-10-11-investigation-arrests.md), a one-off investigation commissioned to test the workflow. It covers both games: why v3 never arrested. Its finding: not a defect; one pattern to watch. [2026-10-11-batch-1](reports/2026-10-11-batch-1.md), the first batch triage, covering the five online games:
- **No defect candidates.**
- **The diffuse-belief pattern recurs.**
- **New patterns to watch:** coin-flip arrests on the double event, and a last-night escape next to home.
- **Recommendation:** an investigation.

Two investigations followed it, both of games already analysed (they record no games):
- [2026-10-11-investigation-coaches](reports/2026-10-11-investigation-coaches.md): the habit of spending all three coaches early on night 1 doesn't make Detective AI v3 lose track of Jack (1,800 computer games). v3 tracks people worse for another, unknown reason, which stays a pattern to watch.
- [2026-10-11-movement](reports/2026-10-11-movement.md), an exploratory comparison of how Human Jack moves (the first two games) with Strategic Jack and Jack AI v2 (25 games each, seeds 612001–612025):
  - **Human routes:** 4.5 track spaces longer than needed, against 1 and 3 for the computer Jacks.
  - **Coaches and alleys:** every coach spent early and often not homeward, and about twice as many alleys.
  - **Waiting:** they waited, which the computer Jacks never do.
  - **Police proximity:** the same for every Jack.
  - **Inconclusive:** these differences may explain only part of v3's weaker tracking. Within sets of the same size it still ranked people lower, mostly after ordinary walks.
  - **Update, all seven games:** every game shows the same patterns. Human nights also began with a policeman in reach more often (9 of 26 against 4–10 of about 90), always after a wait, and were answered by a coach out of reach.
- [2026-10-11-investigation-night4](reports/2026-10-11-investigation-night4.md): the night-4 escape in `g6b7af2a30b071ae6` came from v3 itself moving the waited-for Wretched next to Jack's hideout, ignoring its own threat model. This is a confirmed decision-level flaw, but it costs no measurable games, even against a Jack who lures on purpose. No AI was changed.
