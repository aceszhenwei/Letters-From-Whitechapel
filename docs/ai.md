# AI overview

Every computer player in the game, the level that plays it, how it is configured, and the report that justifies it. This page is the reference for what exists. The reports linked from it hold the design, the experiments and the evidence.

Every AI decides only from its side's view: Jack's AIs from `rules.jackView` (see [Jack's AI](jack-ai.md#the-view-what-jack-knows)) and the computer police from `rules.policeView`. The engine checks every decision against the rules, so no AI can change what is legal.

## Jack

Each Jack AI is an object with the same six decision functions ([the interface](jack-ai.md#the-interface)).

| AI | Code | Made by | Level | What it adds | Report |
|---|---|---|---|---|---|
| Baseline Jack | `js/ai/jack.js` | `WC.jackAI` (the game's own instance), `WC.createJackAI(board, random, _)` | **Easy** (Developer Mode only) | Simple rules of thumb | [Jack's AI §1](jack-ai.md#1-the-baseline-ai) |
| Strategic Jack | `js/ai/strategic-jack.js` | `WC.createStrategicJack(board, deduction, random, _, options)` | **Normal** (default) | Values each move by the measured chance of surviving the police's next turn and of getting home in time; two-move lookahead | [Jack's AI §3–10](jack-ai.md#3-the-strategic-ai-design) |
| Jack AI v2 | `js/ai/jack-v2.js` | `WC.createJackV2(board, deduction, random, _, options)` | **Hard** | Strategic Jack, plus early detours away from his hideout on every night but the last | [Jack AI v2](jack-ai-v2.md) |

**Options** (all on, or at their defaults, in the game; the comments in the code are the authoritative list):

- Strategic Jack: `path`, `risk`, `lookahead`, `hideout`, `hell` (each part can be switched off for ablations) and `beam` (6). `WC.strategicVariants` names the combinations measured in [Jack's AI §9](jack-ai.md#ablation-which-parts-help-1000-games-each-seeds-1-to-1000-deductive-police).
- Jack AI v2: `detourMoves` (3), `detourSpare` (6), `detourLastNight` (false). See [Jack AI v2 §6](jack-ai-v2.md#6-jack-ai-v2).

**Strategic waiting** (`js/ai/jack-waiting.js`, `WC.createWaitingJack(board, base, _, options)`) wraps any Jack AI with a `wantsToWait` that compares killing now with waiting, by measured escape chances (`options.table`: `'jack-v2'` or `'strategic'`; `options.info`). It is an option, played by no player level; Developer Mode's experimental **Hard, waiting** level plays it on top of Jack AI v2. See [Strategic waiting](jack-waiting.md).

**Research-only Jacks**, never played in the game: Detour Jack (`research/detective-v2/jacks.js`), the Jack v2 candidates (`research/jack-v2/policies/`), the BoardGameGeek schemes (`research/human-strategy/policies.js`) the short-return Jacks (`research/detective-v3/jacks.js`), and the forced-wait diagnostics (`research/jack-waiting/jacks.js`).

## Police

Every computer police is `WC.createPolice(board, rules, deduction, _, options)` in `js/ai/police.js`, with a configuration from `WC.policeVariants`. The player leads the detectives by default; a computer level lets them watch instead.

| AI | Configuration | Level | What it adds | Report |
|---|---|---|---|---|
| Original police | `WC.policeVariants.original` (the defaults; also `WC.policeAI`) | **Easy police** | Chase Jack's likely circle from the deduction; arrest at 20% | [Detective inference](detective-inference-study.md) (the study of why it loses) |
| Detective AI v2 | `WC.policeVariants.v2`: `hideoutWeighting: 'hybrid'`, `hideoutW: 0.9`, `hideoutRho: 0.5`, `blockWeight: 1` | **Normal police** | Hideouts weighted by how direct Jack's routes would have been; policemen stand between Jack and them | [Detective AI v2](detective-ai-v2.md) |
| Detective AI v3 | `WC.policeVariants.v3`: v2 plus `contain: 10`, `containEarly: 0`, `containScale: 'absolute'`, `containCoordinate: true`, `containPatrols: true` | **Hard police** | Containment for the last night (`js/ai/containment.js`), and the choice of which patrol tokens are real | [Detective AI v3](detective-ai-v3.md) |
| Random police | `WC.randomPolice` | None (simulations and tests) | Random legal choices | [Jack's AI §8](jack-ai.md#8-evaluation-method) |

**Options.** Every option is off by default, so the original police play exactly as they always have. Their meanings are in the comments at the top of `WC.createPolice`:

- the original police's `arrestAt` and `blockWeight`;
- the hideout belief: `hideoutWeighting` (`walk`, `uniform`, `hybrid`; see `deduction.hideouts` in `js/core/deduction.js`), `hideoutW`, `hideoutRho`;
- v2's rejected alternatives: `liveHideouts`, `coordinate`, `cordon` ([Detective AI v2 §3](detective-ai-v2.md#3-changes));
- containment: `contain`, `containHideouts`, `containNeighbours`, `containEarly`, `containCoordinate`, `containPatrols`, `containSwap`, `containWretched`, `containTiming`, `containScale` ([Detective AI v3 §5–6](detective-ai-v3.md#5-proposed-mechanisms)).

The research configurations built from them are in `research/detective-v2/configs.js` and `research/detective-v3/configs.js`.

## Difficulty levels

Players choose only Jack's level, Normal or Hard, by name; the player always leads the detectives. **Developer Mode** (`index.html?dev=1`) shows every level of both, with the AI each plays. No level changes the rules or what a side may know.

| Jack (`js/ai/difficulty.js`, `WC.difficulty`) | Detectives (`js/ai/police-levels.js`, `WC.policeLevels`; Developer Mode, or the address) |
|---|---|
| Normal: Strategic Jack (default) | You (default, and the only choice outside Developer Mode) |
| Hard: Jack AI v2 ("Deceptive Jack v2") | Easy police: the original police |
| Easy: Baseline Jack (Developer Mode) | Normal police: Detective AI v2 |
| Hard, waiting: Jack AI v2 with strategic waiting (Developer Mode, experimental) | Hard police: Detective AI v3 |

The labels name AIs; they are not claims about how hard a human opponent would find them. Where a choice comes from, strongest first: the address (`?difficulty=easy|normal|hard|hard-waiting`, or the older `?jack=baseline|strategic`; `?police=you|easy|normal|hard`; any level, with or without Developer Mode, for tests and research), the dialog, the choice saved from the last game (Developer Mode keeps its own), the default. To add a level, add an entry to `levels` in the matching file: the dialog lists the levels from there. More detail: [Jack's AI, Difficulty levels](jack-ai.md#difficulty-levels).

## How each AI was chosen

| AI | Evidence | Seeds | Headline result | Independent validation |
|---|---|---|---|---|
| Strategic Jack | [Jack's AI §9](jack-ai.md#9-results) | 1–5,000 | Wins 97.2% against the original police, where the baseline wins 25.0% | The evaluation seeds were used once, at the end; development and calibration used other seeds |
| Detective AI v2 | [Detective AI v2 §5](detective-ai-v2.md#5-results) | 650001–650500 (fresh) | Strategic Jack's win rate 98.0% → 31.6% | Fresh seeds, as above |
| Jack AI v2 | [Jack AI v2 §5–7](jack-ai-v2.md#5-controlled-comparison) | 420001–420200 (development) | Wins 70.5% against v2, against 32.0% for Strategic Jack | **Proposed, not run** (seeds 760001–761000 reserved) |
| Detective AI v3 | [Detective AI v3 §9](detective-ai-v3.md#9-comparative-results) | 470001–470100 (fresh) | Police wins against short-return Jacks 14.0% → 32.7%; against ordinary Jacks 56.3% → 56.5% | **Proposed, not run** (seeds 480001–480500 reserved) |

The research that led to each, in order, is listed in the [documentation index](README.md#research-reports). What the AIs still do badly is in the [roadmap](roadmap.md#known-limitations).
