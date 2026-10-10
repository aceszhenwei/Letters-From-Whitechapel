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

**Collected so far:** see `analysis-state.json` (`snapshot`) or run `npm run playtests`. The first game, `g91d4014f17ae09e6`, was played on 10 October 2026: a person as Jack against Detective AI v3 (Normal), app version 1.0.0, Jack escaping on all four nights. It is collected and awaiting review: no analysis has covered it yet.
