# Jack's AI

This page covers two AIs for Jack: the **baseline** (`js/ai/jack.js`, played at Easy, in Developer Mode) and the **strategic AI** (`js/ai/strategic-jack.js`, played at Normal, the default), which wins 97.2% of games against a deductive computer police player where the baseline wins 25.0%. This page describes the interface they share, both strategies, how they were compared, and what the strategic AI still does badly. [Jack AI v2](jack-ai-v2.md), played at Hard, builds on the strategic AI; the [AI overview](ai.md) lists every AI.

| Section | |
|---|---|
| [1. The baseline AI](#1-the-baseline-ai) | [6. Search, pruning and caching](#6-search-pruning-and-caching) |
| [2. Weaknesses of the baseline](#2-weaknesses-of-the-baseline) | [7. Performance](#7-performance) |
| [3. The strategic AI: design](#3-the-strategic-ai-design) | [8. Evaluation method](#8-evaluation-method) |
| [4. Information allowed](#4-information-allowed) | [9. Results](#9-results) |
| [5. How moves are evaluated](#5-how-moves-are-evaluated) | [10. Remaining weaknesses](#10-remaining-weaknesses) |

The computer plays Jack through an object with six decision functions. The engine asks it for each of Jack's choices, checks the answer against the rules, and applies it. The AI never changes the game or touches the page, so a strategy can be read, replaced or tested on its own.

## The interface

| Function | Asked during | Returns |
|---|---|---|
| `chooseHideout(choices)` | `game.start()` | One of `choices` (numbered circles that aren't red) |
| `placeWomen(view)` | The targets are identified | `{ marked: [...], unmarked: [...] }`: `view.women.marked` and `view.women.women - view.women.marked` circles from `view.targets` |
| `wantsToWait(view)` | Blood on the streets, only while waiting is allowed (before V) | `true` to wait, `false` to kill |
| `chooseVictims(view)` | Blood on the streets, when killing | `view.victims` circles from `view.wretched`. Jack starts the hunt at the last one |
| `choosePatrolToReveal(view, hidden)` | Ready to kill | One of `hidden` |
| `chooseMove(view)` | Escape in the night | `{ mapid, type: 'walk' }`, `{ mapid, type: 'alley' }` or `{ mapid, type: 'carriage', via }` |

The engine checks every answer (`rules.isLegalHideout`, `isLegalWomen`, `isLegalVictims`, `isLegalJackMove`) and throws `Jack's AI broke the rules: ...` if one is illegal.

## The view: what Jack knows

`view` comes from `WC.rules.jackView(state)`. It holds what Jack would know at the table, and nothing more. For example, it doesn't say which patrol tokens are real until he reveals them.

| Field or question | Meaning |
|---|---|
| `hideout`, `night`, `timeOfCrime`, `remainingMoves` | His hideout, the night (0 to 3), the Time of the Crime (1 to 5), move-track spaces left |
| `route`, `position` | His sheet tonight, and where he is |
| `tokens` | `{ carriages, alleys }` left tonight |
| `targets`, `women` | Where women can go tonight, and how many (`{ women, marked }`) |
| `wretched`, `victims` | Where the Wretched are, and how many he must kill tonight |
| `walks()` | Circles he can walk to (not past policemen) |
| `specialMoves()` | Coach and alley moves he can make: `{ mapid, type, via, moves }` |
| `canMove()` | Whether he has any legal move |
| `endsNight(move)` | Whether a move would end the night (only a normal move onto the hideout does) |
| `distanceToHideout(mapid)` | Fewest walking moves from a circle to the hideout |
| `threats()` | For each circle, how many ways the policemen could arrest there next round |
| `policeNow()` | Where the policemen are (they are on the board, so Jack can see them) |
| `patrols()` | The patrol tokens: `{ mapid, revealed, real }`, with `real` only once he has revealed the token |
| `wretchedMoves(mapid)` | Where the police could move a Wretched if he waits (public: the tokens, the Wretched and the crime scenes are on the board) |
| `publicLog()`, `pastLogs()` | The public record of tonight and of earlier nights: what the police have seen (see [Information allowed](#4-information-allowed)) |
| `debug` | Whether the engine was created with `debug: true` |

The AI can also use `WC.board` for map geometry, such as `board.straightLine(a, b)`, and `WC.random` for random choices.

## Replacing the strategy

Write an object with the six functions and give it to the engine. In the page, that's one line in `js/main.js`:

```js
var game = WC.engine.create({ ai: myJack });
```

For an experiment without a page, the tests show how to load the core in Node and play the police through engine actions (`test/helpers/core.js` and `test/helpers/headless.js`). `test/unit/engine.test.js` plays whole games with a deliberately simple AI in about twenty lines.

To make a strategy's random choices reproducible and unaffected by anything else on the page, give it its own random source:

```js
var ai = WC.createJackAI(WC.board, WC.random.create(seededSource), _);
var strategic = WC.createStrategicJack(WC.board, WC.deduction, WC.random.create(seededSource), _);
```

Nothing outside `js/ai/` needs to change, unless the new strategy needs to know something the view doesn't offer. In that case, add it to `rules.jackView`, keeping to what Jack would know.

## Difficulty levels

The player chooses which AI plays Jack in the setup dialog. `js/ai/difficulty.js` maps each level to an AI that already exists; it doesn't play itself. Players see only Normal and Hard, by name, with no description of how Jack plays; Developer Mode (`index.html?dev=1`) shows every level and its AI.

| Level | Offered to | AI | Made by |
|---|---|---|---|
| Easy | Developer Mode | Baseline Jack | `WC.jackAI`: the very object the game has always used, so recorded games replay exactly |
| Normal (default) | Everyone | Strategic Jack | `WC.createStrategicJack(WC.board, WC.deduction, WC.random, _)` |
| Hard | Everyone | Jack AI v2 ("Deceptive Jack v2") | `WC.createJackV2(WC.board, WC.deduction, WC.random, _)`: the strategic Jack plus early detours (see [Jack AI v2](jack-ai-v2.md)) |
| Hard, waiting (`hard-waiting`) | Developer Mode | Jack AI v2 with strategic waiting (experimental) | `WC.createWaitingJack(WC.board, <Jack AI v2>, _, { table: 'jack-v2' })` (see [Strategic waiting](jack-waiting.md)) |

The page creates the game with Easy (so the golden traces, which start the game without the dialog, are unchanged); when the player starts it, `js/ui/setup.js` sets `game.ai` to the chosen level's AI, before Jack's first decision (the hideout). Every level's AI gets the same view and is checked by the same rules, so a level changes only how Jack decides.

**Where the choice comes from**, strongest first (`WC.difficulty.resolve`):

1. The address: `index.html?difficulty=easy`, `normal`, `hard` or `hard-waiting`, any level, with or without Developer Mode (for tests and research). The older `?jack=baseline` and `?jack=strategic` mean the same. The dialog then doesn't let it change (outside Developer Mode a developer-only level isn't shown at all), and the choice isn't saved.
2. The level selected in the dialog when the game starts.
3. The level saved from the last game (in the browser's local storage), which pre-selects the dialog, if the dialog offers it. Developer Mode saves under its own keys (`whitechapel.dev.difficulty`, `whitechapel.dev.police`), so a developer's choice never carries into an ordinary game.
4. Normal.

Unknown levels are ignored. The detectives have their own levels (`js/ai/police-levels.js`; see the [AI overview](ai.md#difficulty-levels)). A person can't play Jack, so Jack's level always applies.

**Adding a level**: add an entry to `levels` in `js/ai/difficulty.js` with an `id`, `label`, `ai`, `player` (true to offer it outside Developer Mode), `description` and a `create(WC)` that returns an object with the six decision functions. The dialog lists the levels from there, so the page needs no change.

## 1. The baseline AI

The current AI (`WC.jackAI`, made by `WC.createJackAI`) uses simple heuristics and biased randomness. `random.safeIndex(percentage, length)` picks from a sorted list, favouring the start: the higher the percentage, the more strongly.

### Hell (baseline)

| Decision | How the current AI decides |
|---|---|
| Hideout | Random, among the allowed circles |
| Where to put the Wretched | Red circles sorted by how close their walking distance to the hideout is to 7 moves (`sortSevenSteps`), then picked with a strong bias to the top. Decoy women go on the others at random |
| Kill or wait | A coin toss |
| Which patrol to reveal | Random |
| Which Wretched to kill | Sorted by closeness to 7 moves from the hideout, with a weak bias. On the double event, the other victim is random and Jack escapes from the better-placed one |

### Hunting (baseline)

`chooseMove` first asks `chooseSpecial` whether to use a coach or alley, and otherwise walks with `chooseWalk`.

**Special movements.** Jack uses a coach or alley when:

1. police block every street;
2. walking can't reach the hideout in time, but a special movement can;
3. every walk could be arrested, but a special movement reaches a safe circle in time.

He prefers, in order: reaching home in time, fewer threats, closer to home, then fewer track spaces. A special movement onto the hideout doesn't end the night (`view.endsNight`), so landing there counts as two moves from home.

**Walking.**

| When | Behaviour |
|---|---|
| First move | Avoid threatened circles, then prefer circles nearer the hideout (straight-line distance), with a strong bias |
| Second move | Sort by threats and distance, then pick with a strong bias |
| From the sixth entry on his sheet | If the hideout is next to him, walk onto it. Otherwise prefer circles nearer the hideout |

`WC.jackAI.debug` keeps the last walk's options (and, with `debug: true`, the shortest routes home) for the browser console.

## 2. Weaknesses of the baseline

To find out how the baseline loses, I played it against a computer police player (below), looked inside the games with `tools/sim/diagnose.js`, and checked each suspicion with numbers. 600 games, seeds 100001 to 100600:

| Area | Evidence | Verdict |
|---|---|---|
| **Movement quality** | Only 66.0% of its walks bring it closer to home; 27.6% stay the same distance and 6.4% go further away. Escaped nights take 10.3 moves where 6.1 would do. **Every one of the 163 nights it lost on time had at least 5 moves to spare at the murder**; it ended them 2.1 circles from home on average. | **The most important weakness.** It steers by straight-line distance, and in Whitechapel's streets the straight line is often a dead end. It wastes the time it has, then runs out |
| Danger | 42.8% of its moves end on a circle a policeman could reach next turn (14.3% of moves had no other choice). At an arrest the police are 45% sure of his circle on average | The second weakness. It avoids threatened circles only on its first two moves, and doesn't know how sure the police can be |
| Information leakage | It never thinks about what its moves reveal. Wandering does hide the hideout well (52 possible hideouts after a game), but only by accident and at the cost of time | A weakness in principle; in practice its wandering leaks little |
| Lookahead | None: each move is judged alone. Its rule "walk home if adjacent from the sixth move" ignores time entirely | Matters less than the two above |
| Hell | Waiting is a coin toss, so it often kills late (only 775 of 1,612 murders at I) and starts the night with fewer moves; the hideout is random and may be far from every red circle | A real cost: every move of waiting is a move less for getting home |

Against the deductive police over 5,000 games it loses 75.0%: 48.3% arrested and 26.5% out of moves.

## 3. The strategic AI: design

`js/ai/strategic-jack.js` makes `WC.createStrategicJack(board, deduction, random, _, options)`, an object with the same six decision functions as the baseline. The engine can't tell them apart, so they are interchangeable: `WC.engine.create({ ai })`, `node tools/simulate.js --jack strategic|baseline`, or Normal difficulty in the browser.

**What it optimises for.** The chance of getting through the night: of surviving the police's next turn, and of getting home before the move track runs out. It values each move as

> value = (1 − P(arrested next turn)) × P(home tonight, given the moves to spare after this move)

and plays the move with the best value, looking two moves ahead for the most promising ones. Winning the game is getting through four nights, so a policy that maximises surviving each night maximises winning, as long as one night's play doesn't hurt the next (the hideout, below).

**The two estimates come from measurements, not guesses.** `tools/sim/calibrate.js` played 1,500 games (seeds 900001 to 902500, apart from the evaluation seeds) and recorded, after each move, what happened next. The tables in the code are those measurements:

| Estimate | Depends on | Measured |
|---|---|---|
| P(arrested next turn) | Whether a policeman can reach a crossing next to his circle, and how sure the police could be that he is on it (his circle's share of where the police think he could be) | Out of reach 0.8%. In reach: 1.2% at a share of 0, 3.2% at 7.5%, 12.3% at 15%, 58% at 27.5%, 75% from 40% up (interpolated between) |
| P(home tonight) | Moves to spare: moves left minus the walking distance home | 4% with too few moves, 56% with 0 to spare, 73% with 2, 83% with 6 or more, 87% with 9 |

So there are no hand-tuned weights in the move valuation: a move is worth what such moves were worth in measured games. The few remaining numbers are each explained where they are used: the beam of 6 (below), 6 spare moves for waiting (where the escape table levels off), 2 hideout candidates for "pinned", and 0.02 for "as good as the best hideout".

**Its parts**, each of which can be switched off (`options`) for the ablation:

| Part | Option | What it does |
|---|---|---|
| Path planning | `path` | Real walking distance home (`board.distance`) instead of straight-line distance |
| Risk | `risk` | The arrest estimate above, using what the police could deduce (section 4) |
| Lookahead | `lookahead` | Values the 6 most promising first moves by the best second move, with the police's reach widened to two turns |
| Hideout | `hideout` | Doesn't end a night on the hideout if that would leave the police only 1 or 2 possible hideouts and there are 3 or more moves to spare: then ending the night counts as only as good as coming back two moves later |
| Hell | `hell` | Chooses the hideout, waiting, the victims and which patrol to reveal with the same estimates (section 5). Off: the baseline's Hell |

When a walk is as good as a coach or alley, it walks: tokens don't carry over to the next night, but they are worth more later in the night, when the police are closer.

## 4. Information allowed

Jack's AI must play fair: it may use what Jack knows at the table, and what anyone at the table could work out. It gets only the view from `rules.jackView`.

| Jack knows | Jack doesn't know |
|---|---|
| His hideout, his route tonight, his position, moves left, coaches and alleys left | Which unrevealed patrol tokens are real (`patrols()` says `real` only once revealed) |
| Where the policemen are now (`policeNow()`) | Where the police will move, or what they will search |
| Where the Wretched and women are, the victims needed | The police's plans or AI |
| The public record (`publicLog()`, `pastLogs()`): crime scenes, the type of each of his moves and where the policemen stood, every search result and arrest, each escape | — |

**Modelling what the police believe.** The strategic AI does model the police's beliefs, and it can do so exactly, because the police's knowledge is public: they know only what is in the public record. `js/core/deduction.js` reads a night's record and works out every circle Jack could be on, and how likely each is (forward filtering over his possible routes, with each search result, arrest and time limit applied when it happened). The deductive police use exactly this to hunt him. Jack's AI runs the same deduction on the same record, and projects it one move on: the police will see the *type* of his next move (walk, alley or coach) but not where it goes, so the projection depends only on the type, and is the same for every destination of that type. That is how it knows "if I walk now, the police will think I'm on one of these 12 circles, and this one has a 30% share".

It does **not** model the police's *policy*. It assumes they arrest when they are sure enough and can reach him, with the measured probabilities above; it doesn't simulate their moves. The tables were measured against the deductive police, so they describe that opponent best (section 8 checks it against another).

**Enforced by tests** (`test/unit/strategic-jack.test.js`, `jack-ai.test.js`, `architecture.test.js`):

- the AI's decisions read only the fields of the view, and never change the state;
- the view hides patrol identities; the public record contains no route, hideout or coach stop;
- the police view and its records hold nothing secret, and two states differing only in Jack's hidden route give the same record and the same deduction;
- the deduction never rules out where Jack really is;
- the AI and police files never read `state`, `base` or `route`, and the deduction reads only the record.

## 5. How moves are evaluated

`chooseMove(view)`:

1. **Legal moves.** Every walk from his circle (not past policemen), every alley and coach route he has the tokens for, kept only if the rules' own `view.specialMoves()` offers it.
2. **What the police would believe.** The deduction of tonight's record (once per decision), projected one move on for each move type: at most 3 projections.
3. **First-move value.** For each move: moves to spare after it (walking distance home), the escape estimate, and, unless it lands on a circle out of every policeman's reach, the arrest estimate from his share of the projected belief. Walking onto the hideout ends the night: worth 1, unless the hideout rule applies.
4. **Lookahead** for the best 6: for each second move from there, with the tokens left, the same value with the police's reach widened to two turns and the belief projected two moves on (memoised by the pair of types). The first move is worth P(surviving it) × the best second move.
5. **Choose** the best; ties go to walks, then at random.

**Hell.**

| Decision | Strategic AI |
|---|---|
| Hideout | The mean P(home) from the red circles with 15 moves, averaged over all red circles; at random among those within 0.02 of the best, so the police can't guess it |
| Wait or kill | Waits only while the best victim would leave fewer than 6 moves to spare. In practice it always kills at I. Waiting gives more moves, but lets the police move the victims; [Strategic waiting](jack-waiting.md) measures that trade and offers a policy that weighs it |
| Victims | Each Wretched valued like a move: P(home from there) × P(surviving the police's first turn). Any unrevealed patrol could be real. On the double event the police move first and know he is on one of the two scenes (a 50% share); otherwise he moves first and they know he is next to the scene. He escapes from the best one |
| Patrol to reveal | The one threatening the most Wretched: if it is fake, it leaves the board |
| Placing women | The baseline's |

## 6. Search, pruning and caching

| Technique | Where | Saves |
|---|---|---|
| Beam of 6 | Lookahead looks at the 6 best first moves only | Moves valued per decision: 225 on average instead of 995 (max 408 instead of 3,212). It chose the same move as looking at all of them in 91.1% of decisions, and lost nothing measurable |
| Belief per move type | The projection of what the police believe depends only on the type of move, so it is computed once per type (and per pair of types ahead): at most 12 per decision | Most of the speed: earlier, projecting per destination took 167 ms per decision; per type it takes 21 ms, with identical choices |
| Hideout inference once a night | Earlier nights' records don't change during a night | One inference per night instead of per move |
| Walks memo | Walks from each circle with tonight's policemen | Repeated walk computations in the lookahead |
| Deduction caches | Free walks, walks past policemen, distance bounds, crossings within two (in `board.js` and `deduction.js`) | The police AI went from 1.6 s to 0.4 s per game |
| Time pruning in the deduction | A circle he couldn't get home from in the moves left is dropped | Fewer states, and sharper beliefs |

## 7. Performance

`node tools/sim/benchmark.js 100` (100 games, seeds 1 to 100, one thread, idle machine; `experiments/benchmark.txt`):

| Per decision | Mean | Median | p95 | Max |
|---|---:|---:|---:|---:|
| Time (ms) | 27.4 | 20.7 | 76.8 | 179.3 |
| Moves valued | 225 | 238 | 351 | 408 |
| Belief projections | 8 | 8 | 12 | 12 |
| Circles the police consider | 26 | 17 | 83 | 158 |

Without the beam, time is barely higher (28.9 ms mean): the cost is dominated by the deduction, not by valuing moves, so the beam saves states rather than time. The worst decisions come late in a night when the police consider many circles. The baseline takes 1.9 ms per decision. Both are far below what a player would notice; in the 5,000-game runs the maxima (up to 750 ms) came from four games running at once on a busy machine.

## 8. Evaluation method

> **Map.** Every number here was measured on the board-verified map ([Map data](map-data.md#verified-against-the-board)). For a while the map followed whitechapelR's topology instead; that was reverted, so these results stand as recorded.

**Opponents.** A fair test needs an opponent that hunts, so `js/ai/police.js` adds a computer police player that sees only the police view (never Jack's route or hideout). The **deductive police** place patrols near red circles, keep the Wretched near real patrols, move each policeman to cover the most of Jack's likely position, arrest when one circle holds at least 20% of the belief, and otherwise search where his route most likely passed. Its two settings were chosen by trying alternatives against the baseline (comments in the code). The **random police** make random legal choices, like a careless player. The main results are against the deductive police; the random police check that the strategic AI isn't tuned to one opponent.

**Seeds.** Each game has a seed; Jack and the police get separate random streams derived from it, so every Jack faces the same police dice on the same seed. Seeds 1 to 5,000 are the evaluation set, used once at the end. Seeds 300001 on were used while developing, and 900001 on for calibration, so the AI was never tuned on the games it is judged by.

**Statistics.** Win rates with 95% Wilson intervals; strategies compared with McNemar's test, pairing games by seed.

**Reproducing.**

```
node tools/simulate.js --jack baseline --police deductive --games 5000 --out experiments/baseline-deductive.json
node tools/simulate.js --jack strategic --police deductive --games 5000 --out experiments/strategic-deductive.json
node tools/sim/compare.js experiments/baseline-deductive.json experiments/strategic-deductive.json
node tools/sim/replay.js 52 strategic        # one game, move by move
node tools/sim/diagnose.js --jack baseline   # why a strategy loses
node tools/sim/benchmark.js 100              # work per decision
```

The summaries are in `experiments/*.txt` (the per-game files are left out of git, and take a few minutes to regenerate). `--workers` sets the threads; results don't depend on it.

## 9. Results

### Baseline against strategic, 5,000 games each, seeds 1 to 5,000

| Metric | Baseline | Strategic | Baseline | Strategic |
|---|---:|---:|---:|---:|
| Police | Deductive | Deductive | Random | Random |
| **Jack win rate** | **25.0%** | **97.2%** | **46.9%** | **94.2%** |
| 95% interval | 23.8–26.2% | 96.7–97.7% | 45.5–48.3% | 93.6–94.9% |
| Police win rate | 75.0% | 2.8% | 53.1% | 5.8% |
| Lost: arrested | 48.3% | 2.4% | 11.3% | 5.6% |
| Lost: out of moves | 26.5% | 0.3% | 41.8% | 0.1% |
| Lost: trapped | 0.2% | 0.1% | 0.0% | 0.1% |
| Nights escaped per game | 1.94 | 3.96 | 2.43 | 3.87 |
| Lost games end on night | 2.25 | 3.64 | 2.05 | 2.69 |
| Moves to hideout (escaped nights) | 10.3 | 6.4 | 10.8 | 6.5 |
| Shortest possible | 6.1 | 5.7 | 6.3 | 5.7 |
| Distance to hideout, per move | 3.79 | 2.62 | 3.74 | 2.58 |
| Coaches per game | 2.65 | 5.37 | 2.78 | 5.33 |
| Alleys per game | 0.57 | 1.06 | 0.67 | 1.17 |
| Moves with every option in police reach | 14.3% | 6.9% | 10.5% | 6.9% |
| Moves onto a circle in reach | 43.2% | 37.0% | 46.4% | 44.3% |
| Circles the police consider (mean) | 67.2 | 55.5 | 106.1 | 70.7 |
| Possible hideouts after the game | 52.3 | 17.5 | 106.0 | 34.7 |

Paired by seed against the deductive police, the strategic AI won 3,651 games the baseline lost, and lost 37 the baseline won (McNemar exact p < 10⁻¹²). Against the random police: 2,491 and 123 (p < 10⁻¹²). The baseline was played twice, once before and once after the last changes to the police code, with identical games.

Coaches and alleys are tokens to use, not to save, so using more is not a cost: the strategic AI uses them where they save moves (95.8% of its special moves bring it closer, against 50.8% for the baseline), and still walks when a walk does as well.

### Ablation: which parts help? 1,000 games each, seeds 1 to 1,000, deductive police

| Variant | Jack wins | 95% interval |
|---|---:|---:|
| Baseline | 25.2% | 22.6–28.0% |
| **Adding parts one at a time** | | |
| Path planning | 28.1% | 25.4–31.0% |
| + risk | 61.9% | 58.8–64.9% |
| + lookahead | 58.9% | 55.8–61.9% |
| + hideout | 59.0% | 55.9–62.0% |
| + Hell = full strategic | 98.1% | 97.1–98.8% |
| **Removing one part from the full AI** | | |
| Without path planning | 95.6% | 94.1–96.7% |
| Without risk | 35.1% | 32.2–38.1% |
| Without lookahead | 95.4% | 93.9–96.5% |
| Without the hideout rule | 98.1% | 97.1–98.8% |
| Without Hell | 59.0% | 55.9–62.0% |

(The full AI on these seeds is taken from the 5,000-game run. "Without Hell" has the same settings as "+ hideout", and played the same games.)

What it shows:

- **Risk has the largest effect.** Removing it costs 63 points (98.1% to 35.1%); adding it to path planning gains 34. Knowing how sure the police could be is what keeps Jack from being arrested.
- **Hell is next**, and the two need each other: without Hell, risk-aware movement reaches 59–62%; with it, 98%. Most of the Hell gain is the victim choice on the double event: the police move first that night, and the baseline's victim choice left them a 50% guess between two crime scenes, often with a policeman in reach. Before that fix, 33 of 37 arrests in development games happened right there.
- **Path planning on its own is worth little** (28.1% against 25.2%): walking efficiently home gets Jack there sooner but straight into arrests. Within the full AI it is worth 2.5 points, mostly time losses (16 games lost out of moves without it, 2 with it, in 1,000 games).
- **Lookahead adds about 2.7 points** within the full AI, and nothing without Hell (58.9% against 61.9%, within noise).
- **The hideout rule does nothing measurable**: the same 98.1%, and only 2 of 1,000 seeds end differently. It is kept, switched on, because it is cheap and its reasoning is sound, but the evidence doesn't support it; see section 10.

### Interesting games

Each replays exactly with `node tools/sim/replay.js <seed> <jack>`. On the same seed both Jacks face the same police dice, but they choose different hideouts and victims, so the games differ from the first decision.

**Seed 2: the strategic AI clearly better.** The baseline kills at 22 with 15 moves for a walk of 7. Its first move goes from 7 circles away to 8, then 9, and it spends 4 moves going nowhere (moves 2 to 5 all end 9 circles from home); by move 9 it has no moves to spare, the police close in, and it runs out of moves on night 1, 2 circles from home. The strategic Jack, facing the same police dice, chooses a hideout close to the red circles, uses coaches and alleys where they save moves, gets home in 3 to 6 moves every night, and wins with 9 or more moves to spare each night.

**Seed 880: hard for both.** On night 3 (the double event, when the police move first), both are kept from home. The baseline wanders from 6 circles away and runs out of moves 1 circle short. The strategic Jack, after two quick nights, has given away its hideout: the police know the area and, 2 circles from home, every move it has is in their reach. It is pushed back to 3, then 4 and 5 circles away, and runs out of moves. When the police stand between Jack and home, neither AI has an answer.

**Seed 52: the strategic AI worse.** The baseline wins this seed; the strategic Jack is arrested on night 4. It went home by short, direct routes on three nights, which left the police few possible hideouts, all in one area (13 by the end of the game). On night 4 they waited there: one circle from home every option was in reach, it stepped back, and they arrested it with a 33% guess. The baseline's slow, wandering routes (10 to 15 moves a night) left 38 possible hideouts and an empty approach on night 4. This is the strategic AI's main remaining weakness, below.

## 10. Remaining weaknesses

- **It gives the hideout away.** Fast, direct routes home leave the police 17.5 possible hideouts after a game, against the baseline's 52.3. Its losses come late: 83 of its 138 losses to the deductive police are arrests on night 4, when the police know the area. The hideout rule, the attempt at a fix, only looks at the end of a night, when it is already too late; what gives the hideout away is the direction of the whole route, every night.
- **It doesn't model the police's moves.** It knows what they believe, but treats every circle in their reach alike and every policeman as independent. It doesn't foresee them closing a ring around the hideout (seed 880).
- **The estimates are measured against one opponent.** Against the random police it still wins 94.2%, so it isn't tuned to one opponent's quirks, but it is arrested more there (5.6% against 2.4%), because a careless police player's arrests don't follow the deductive police's pattern.
- **Coaches and alleys are valued only by the moves they save**, not by how much they blur the police's picture (a coach makes the next belief much wider).
- **Placing women is the baseline's.**

### What would come next

[Jack AI v2](jack-ai-v2.md) took up the first of these against Detective AI v2: hiding the hideout across nights turned out to matter far more than anything else, and the simplest way that worked was walking away from home first.

1. **Value the hideout across nights.** Add the cost of what a route reveals about the hideout (the expected number of hideouts left after the night) to the value of each route, with the trade-off measured, like the other estimates, from how often night-4 arrests follow from few hideout candidates. Choosing routes that approach from different sides on different nights would attack the main remaining loss directly.
2. **Simulate the police's next move instead of their reach.** The deductive police are cheap to run; sampling their response to each candidate move would replace "in reach" with "would they come here", and catch rings closing.
3. **Measure the arrest estimate per situation.** The table depends only on reach and share; adding the number of policemen in reach and the moves left would sharpen it, with the calibration games already recorded.
4. **A stronger police AI to test against**, for example one that guards the likely hideout on the last night, so Jack is measured against the opponent he is weakest against.
