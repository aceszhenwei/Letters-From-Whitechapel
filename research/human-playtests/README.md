# Human playtests

The permanent collection of games people have played, kept as research evidence. How records get here, how they are checked and how analyses are commissioned: [docs/playtests.md](../../docs/playtests.md).

| Path | What it holds |
|---|---|
| `records/<game id>.json` | One full game record per completed game a person played, exactly as the game exported it. Never edited, renamed or deleted because newer games exist |
| `reports/` | Dated research reports, each naming exactly the game IDs it covers |
| `analysis-state.json` | Which games each report covered, the methodology version, AI and rule changes that affect records, and a snapshot of the games awaiting review |

**Adding games:**
- Upload the `.json` files from an exported batch ZIP's `records/` folder into `records/`, in a pull request. Or, with a clone, run `npm run playtests:add -- <the ZIP>`.
- The **Human playtests** workflow checks every record by full replay.

**Status:** `npm run playtests` prints:
- the inventory and any problems;
- the research batch status: **Collecting**, or **Ready for Review** at 5 new games;
- cumulative statistics by cohort.

**Collected so far:** see `analysis-state.json` (`snapshot`) or run `npm run playtests`. The first two games, `g91d4014f17ae09e6` (10 October 2026) and `ga36125530c4b4076` (11 October 2026), are both a person as Jack against Detective AI v3 (Normal), app version 1.0.0, with Jack escaping on all four nights.

**Reports so far:** [2026-10-11-investigation-arrests](reports/2026-10-11-investigation-arrests.md), a one-off investigation commissioned to test the workflow. It covers both games: why v3 never arrested. Its finding: not a defect; one pattern to watch.
