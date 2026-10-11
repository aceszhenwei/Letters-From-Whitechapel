# Game records: export, import and replay

A player can save the record of a game as a JSON file, and share it if they choose. A researcher can then check the file, replay it exactly through the engine, and summarise many files together. The record is versioned, it keeps hidden information safe while a game is being played, and it holds game data only.

| Part | Where |
|---|---|
| Recording, the exports, replay | [`js/core/record.js`](../js/core/record.js) (no page: the same code runs in the browser, the tests and the tools) |
| The engine's `action` events it listens to | [`js/core/engine.js`](../js/core/engine.js) |
| The export dialog | [`js/ui/export.js`](../js/ui/export.js), in `index.html` |
| Checking, replaying and summarising files | [`tools/game-log/`](../tools/game-log/) (`npm run research:import`) |
| Example records (synthetic games) | [`docs/examples/game-records/`](examples/game-records/) |

## Contents

1. [For players](#1-for-players)
2. [The audit: what was there before](#2-the-audit-what-was-there-before)
3. [The record format (schema version 1)](#3-the-record-format-schema-version-1)
4. [Hidden information](#4-hidden-information)
5. [Checking and replaying records](#5-checking-and-replaying-records)
6. [Analysing many games](#6-analysing-many-games)
7. [Turning a game into a test case](#7-turning-a-game-into-a-test-case)
8. [Versions and compatibility](#8-versions-and-compatibility)
9. [Privacy](#9-privacy)
10. [Limitations and future work](#10-limitations-and-future-work)

## 1. For players

**Exporting a game.** Once a game has begun, choose **Game log** in the top bar, or **Export game log** when the game is over. The dialog says how the game stands and offers two files:

| File | What it holds | When |
|---|---|---|
| **The police's record** (`whitechapel-game-<date>-public.json`) | Only what the police could see: the crime scenes, the kind of each of Jack's moves, your patrols, moves, searches and arrests. No spoilers | Any time, even in the middle of a game |
| **The full record** (`whitechapel-game-<date>-full.json`) | Everything, including Jack's hideout, every move he made and his secret choices | When the game is over, or after you end it on purpose |

**Ending a game early.** To get the full record of an unfinished game, you have to end the game first. In the dialog, tick *I understand: end this game and reveal Jack's secrets*, then choose **End the game**. The dialog then shows Jack's hideout, and the board takes no more moves. A game ended this way can't be continued. If you don't want spoilers, save only the police's record.

**What the file contains.** Game data only: the rules and map version, the difficulty levels chosen, every action in order, and the outcome. It has no name, email, account, address, device or browser information, and no tracking identifier. Each game gets a random identifier, so two files from the same game can be matched; nothing links it to you. Under **Add a note to the file** you can add an anonymous label and comments, if you want to. Leave them empty and they are not in the file. Don't put your name or contact details there.

**Sharing.** The file is made on your device and saved where your browser saves downloads. The game never sends it anywhere. To share it, send the file yourself, for example by email or as an attachment to an issue on the project's repository. Before you share a full record with someone who might still play that game, remember that it shows Jack's hideout.

## 2. The audit: what was there before

Before this change, the code was reviewed: the engine, its events and the public record, the AI interfaces, the human player's input, the golden traces, the night review, the research harnesses, and the test and documentation conventions.

| Question | Before | What was reused, what changed |
|---|---|---|
| 1. Can a game be rebuilt from its start and its actions? | **No.** The engine kept the state and each night's public record, but no list of actions. The golden traces replay only seeded games with a fixed police driver. A browser game's Jack draws from an unseeded `Math.random`, so his AI can't be run again to the same decisions | The record keeps Jack's decisions as well as the police's actions. A replay feeds his recorded decisions to the engine in place of his AI, so it needs neither the AI nor its random numbers |
| 2. Which actions were logged? | The public record (`recordPublic`): crimes, the kind of each move by Jack (with where the policemen stood), searches, failed arrests, escapes. Not logged: the hideout, the women, waiting, reveals, patrol placements, Wretched moves, policemen's moves, the choice of searching or arresting, undo, the night review | The engine now reports each accepted decision as one `action` event (17 places: every decision and action the engine already had). No other event system was added |
| 3. Are human inputs recorded like the AI's? | Both use the same engine methods (the computer police in the page call them too), and the interface's clicks call them | Recording at the engine captures humans and AIs alike. A click the engine refuses is not an action, and is not recorded |
| 4. Seeds and random numbers | The browser draws from an unseeded `Math.random`; the tests and tools seed it in their own context; the police AIs take a random source | Records say `"source": "unseeded"` for browser games and give the seed for seeded ones. The recorder never draws a random number (its game identifier uses `crypto`), so seeded games still play the same |
| 5. Do the night-review snapshots suffice? | `rules.nightRecord` is a frozen, police-safe copy of a night: patrols, routes, clues and the public record. It has no order between the police's actions and no secrets | Reused as the police record's per-night summary. The action list adds the order and, in full records, the secrets |
| 6. Can a log tell what a player knew from what happened? | The public record against the state, but only at the end | Each action gives `known`: how many entries of that night's public record had been seen when it was taken (section 4) |
| 7. Would recording more leak secrets? | Yes, if done carelessly: engine events carry Jack's moves; the state holds his hideout and route; the police view holds the fake patrols, which Jack must not see | Exports are built field by field from what each side sees, never by deleting secrets from a copy of the state (section 4). Tests and the importer check it |
| 8. Can the research tools read a shared format? | Every study writes its own JSON. All of them, and the deduction, read the engine's public record | Records keep the same public record format (`nights[].log`), so the deduction and the research scripts can read them directly |

**Minimum changes made:** one `action` event in the engine; the recorder (`js/core/record.js`); the dialog; the tools in `tools/game-log/`. No rule, AI or difficulty level changed.

## 3. The record format (schema version 1)

A record is one JSON object. In the files, each action is on its own line ([examples](examples/game-records/)).

### Top level

| Field | Public | Full | Meaning |
|---|---|---|---|
| `format` | ✓ | ✓ | Always `"whitechapel-game-log"` |
| `schemaVersion` | ✓ | ✓ | `1`. Raised whenever a reader would misread the record otherwise (section 8) |
| `disclosure` | ✓ | ✓ | `"public"` or `"full"` |
| `role` | ✓ | | Whose view a public record shows: `"police"`, or `"jack"` (section 4). `null` in a full record |
| `app` | ✓ | ✓ | `{ name, version, commit }`. `version` is `package.json`'s; `commit` is `null`, since the page can't know it |
| `ruleset` | ✓ | ✓ | `{ id, config, map }`: the rules' numbers (`rules.config`), a hash of the map, and an identifier made from both |
| `game` | ✓ | ✓ | `{ id, exportedOn, status, nightsPlayed, players, settings, randomness }`, below |
| `outcome` | ✓ | ✓ | `null` while the game is in progress; otherwise `{ result, winner, night, jackMove, mapid? }`, below |
| `feedback` | optional | optional | `{ label?, comments? }`, only if the player wrote them |
| `actions` | ✓ | ✓ | Every action that stands, in order (below) |
| `interactions` | ✓ (the police's) | ✓ | What was taken back: undone moves, patrol tokens taken back or switched. Never replayed |
| `nights` | ✓ | ✓ | Per night. Police role: `rules.nightRecord` (crime scenes, patrols, the policemen's routes, clues, the public record `log`). Jack role: his sheet, the public record, and the patrol tokens as he can tell them apart. Full: `{ police: nightRecord, jack: the engine's night record }` |
| `current` | ✓ | | The position when exported, as that side sees it |
| `final` | | ✓ | `{ state }`: the engine's whole state at the end (or when the game was ended) |

**`game`:**

| Field | Meaning |
|---|---|
| `id` | A random identifier for the game (`g` and 16 hex digits), the same in every record of that game |
| `exportedOn` | The date of the export (UTC, `YYYY-MM-DD`); no time of day |
| `status` | `"completed"` (a rule ended it), `"inProgress"`, or `"abandoned"` (the player ended it) |
| `nightsPlayed` | Nights begun, 0 to 4 |
| `players` | `{ jack, police }`, each `{ type: "human" \| "ai", level?, ai? }`: the levels chosen in the setup dialog (for example `{ "type": "ai", "level": "hard", "ai": "Jack AI v2" }`, or, when a person plays Jack, `{ "jack": { "type": "human" }, "police": { "type": "ai", "level": "normal", "ai": "Detective AI v3" } }`) |
| `settings` | `{ confirmPoliceMoves, reviewNights }`: the engine's settings, which change when it waits for the player (the page sets both; replay needs them) |
| `randomness` | `{ source: "unseeded" \| "seeded", seed }`. A human Jack game records the seed of the detectives' random numbers (they only break ties) and `uses` |

**`outcome`:** `result` is the engine's `arrested`, `trapped`, `outOfMoves` or `jackWins`, or `abandoned`; `winner` is `"police"`, `"jack"` or `null` (abandoned); `night` is the night it ended on (1 to 4); `jackMove` is how many moves Jack had made that night; `mapid` is where the arrest was made.

### Actions

Every action has: `seq` (1, 2, 3 … with no gaps), `side` (`"jack"` or `"police"`), `type`, `night` (0 to 3; `null` for the hideout, before the first night), `phase` (the engine's phase, [Architecture](architecture.md#phases)), `jackMove` (Jack's moves so far that night), `timeOfCrime`, `remainingMoves`, `known` (section 4), `args`, and `result` where there is one.

| Side | Type | Phase | `args` | `result` | Public (police role) shows |
|---|---|---:|---|---|---|
| Jack | `hideout` | 0 | `mapid` | | Only that it happened |
| Jack | `women` | 1 | `marked`, `unmarked` | | `women` (all of them, in order of map id); `wretched` once the victims are chosen (phase 3) |
| Jack | `wait` | 4 | | | All |
| Jack | `victims` | 4 | `scenes` (in the order he killed) | | `scenes` in map-id order (on the double event, not which came first) |
| Jack | `reveal` | 6 | `mapid` | `fake` | All |
| Jack | `move` | 9 | `type` (`walk`, `alley`, `carriage`), `mapid`, `via` (a coach's stop) | `escaped` | `type` and `escaped` |
| Police | `patrol` | 2 | `mapid`, `kind` (`real`, `fake`) | `placed` | All |
| Police | `wretched` | 5 | `from`, `to` | | All |
| Police | `keepWretched` | 5 | `mapid` | | All |
| Police | `policeman` | 10 | `index`, `to` | `from` | All |
| Police | `finishMoves` | 10 | | | All |
| Police | `choose` | 11 | `index`, `action` (`search`, `arrest`) | | All |
| Police | `search` | 11 | `index`, `mapid` | `clue`, `miss` or `none` (nothing left to search) | All |
| Police | `arrest` | 11 | `index`, `mapid` | `arrested` or `missed` | All |
| Police | `beginNight` | 12 | | | All |

Map ids are the code's (0 to 428); [the glossary](README.md#glossary) explains how they relate to the printed numbers. `wait` is recorded only when Jack waits; when he kills at once, `victims` follows directly.

**What stands, and what was taken back.** A policeman's move that was undone is taken out of `actions`; so is a patrol token taken back, or the first placement of a token switched between real and fake. Each goes into `interactions` (`kind`: `undone`, `takenBack` or `replaced`; `at`: how many actions stood then, approximate once later ones were removed). Because the engine undoes moves newest first, the actions that stand replay to exactly the same game.

## 4. Hidden information

**Two exports, built differently.** A public record is built from what one side sees at the table, action by action and field by field (`seenByPolice` and `seenByJack` in `record.js`). It never copies the state and deletes secrets. The full record is the only export with Jack's secrets, and the recorder refuses it while a game is in progress unless the player has ended it with `abandon({ confirmed: true })`.

**What the police's record never contains:** the hideout; Jack's route (where he moved, a coach's stop); which women are marked before the victims are chosen; the order of the double event's crime scenes; anything from Jack's AI beyond its decisions (no reasoning, no debug objects, no views). Its `nights` are the night review's records, already police-safe, and its `current` is a few fields of the police view.

**The Jack side's record** (**Download Jack's record** when the player plays Jack; `exportPublic('jack')`) shows his own secrets but not which patrol tokens are real until the policemen take the board (phase 8), or until he reveals one.

**What each side knew when it acted.** Every action's `known` is the number of entries of that night's public record (`nights[n].log`) that had been seen when it was taken: the crimes, Jack's moves, and the results of earlier searches and arrests. So a search can be judged on `log.slice(0, known)`, not on clues found later. With the earlier nights' records, that is everything the police knew. Nothing is stored twice for this: the deduction can rebuild the police's belief at any action from those entries (`WC.deduction.track(log.slice(0, known))`).

**Checked by:** `test/unit/game-records.test.js` (the fields of every public action, the women before and after the victims are chosen, the Jack role's patrols) and the importer, which rejects a public record with any field its role couldn't know (section 5).

## 5. Checking and replaying records

```
npm run research:import -- path/to/game.json                   # one file
npm run research:import -- path/to/folder another.json        # many files, then a summary
npm run research:import -- --json path/to/folder              # the same, as JSON
```

Each file gets a verdict, and separately the game's status (an unfinished game is not an error):

| Verdict | Meaning |
|---|---|
| **verified** | A full record that replays exactly: legal, and the same game in every action, result and context, night records and final state |
| **partial** | A public record that is well formed and consistent, but can't be replayed (Jack's secrets aren't in it). Checked against the deduction instead: some route and hideout for Jack must fit every night's public record |
| **invalid** | Not JSON, not a record, missing or malformed fields, an unknown action, actions out of order or missing, an illegal action, a public record that says more than its role could know, actions that don't match the nights' records or the outcome, or a replay that differs from the record |
| **incompatible** | Another schema version or another rule set: reported, not checked against these rules |

**What is checked:**
1. **Format:** the file is valid JSON and a game record. It has no `__proto__`, `constructor` or `prototype` keys, nesting is limited, and it is at most 5 MB.
2. **Versions:** the schema version is supported and the rule set matches; a different app version only gives a warning.
3. **Metadata:** required fields, status against outcome, and the winner against the result.
4. **Actions:**
   - each action's `seq`, side, type and arguments;
   - the action is in its phase;
   - nights and Jack's moves never go back;
   - the first action is the hideout.
5. **Hidden information:** a public record's fields against its role (section 4).
6. **Consistency:**
   - each night's public record is rebuilt from the actions and compared (crimes, Jack's move kinds, escapes, searches and their results, failed arrests);
   - each action's `known` is checked;
   - the outcome agrees with the last action.
7. **Replay** (full records): the engine plays the actions again with Jack's recorded decisions. Every action the engine accepts must match the record, and so must the final state, each night's public record and the result.

**Replay guarantees.** A verified record replays exactly, independent of any AI, any random number generator, or the speed of the page, because Jack's decisions are recorded and the police's actions are the engine's own. The same file gives the same verdict every time.

**Limits.**
- Replay is only against the rule set the record names. Records from other rules or another map are *incompatible*, never forced through (section 8).
- A public record can't be replayed. It can be checked only for consistency and against the deduction.
- Replay reproduces what Jack *did*. It can't say what his AI would do in another position (section 7).
- A browser game's Jack AI can't be re-run to the same decisions, because its random numbers are unseeded. The record doesn't need it to be.

**Untrusted files.** Records are read with `JSON.parse` only; nothing in them is run, evaluated or used as a path. Folders are read one level deep, `.json` files only. The tool writes nothing except a fixture, to a path given on the command line, and never overwrites a file.

## 6. Analysing many games

Given several files, the importer adds a summary. A game with several records (say, a public record saved during play and the full one after) counts once, using the most complete. Only *verified* and *partial* records are counted; the others are listed by verdict. Everything counted is public, so public and full records mix safely.

| Summary | From |
|---|---|
| Files by verdict; games by status; records by kind | The verdicts, `game.status`, `disclosure` and `role` |
| Players, and the Jack AI each human detective faced | `game.players` |
| Results and wins | `outcome` |
| Nights played; nights Jack escaped | `game.nightsPlayed`; moves with `escaped` |
| Waiting | `wait` actions per night with a murder, and games with a wait |
| Special moves | Moves by kind: walks, alleys and coaches |
| Average length | Actions, and Jack's moves, per game |
| Rule sets | `ruleset.id` |

For deeper questions, read the records directly (for example, with `tools/game-log/validate.js` to load and check each one):

| Question | Where to look |
|---|---|
| Which hideouts do human Jacks prefer? | `actions[0].args.mapid` in full records where `game.players.jack.type` is `"human"` |
| How often do humans wait? | `wait` actions, with `timeOfCrime` on the `victims` that follow |
| Which routes do Jacks take? | Full records: `move` actions, or `nights[n].jack.route` |
| Where do detectives search wrongly? | `search` actions with result `miss` or `none`, against `nights[n].jack.route` in full records |
| What did the police know when they searched? | `nights[n].police.log.slice(0, known)` |
| Which AIs do humans beat? | `outcome.winner` by `game.players` |

## 7. Turning a game into a test case

A full record can be cut into a **fixture**: its first actions, ending where the police are to act:

```
npm run research:import -- --fixture test/fixtures/my-position.json --upto 120 path/to/game-full.json
```

The fixture keeps the rule set's identifier and the game's settings. It is checked by replaying it before it is written. A test rebuilds the position with:

```js
const { loadCore } = require('../../tools/game-log/core');
const { WC } = loadCore();
const fixture = JSON.parse(fs.readFileSync('test/fixtures/my-position.json', 'utf8'));
const { ok, game } = WC.record.replay(fixture);   // game.state: the position, exactly as it was
```

From there a test can ask any police AI what it would do (`ai.turn(game, WC.rules.policeView(game.state), random)`), or check a rule.

**Replay is not imitation.** A replay reproduces one game exactly because nothing in it changes. Once a test plays differently from the record (another police move, another search), Jack's recorded decisions no longer answer the position, because a human's choices depend on what they saw. Using recorded human moves as an opponent in new positions needs a model of the human, which is a separate research question. Keep the two apart:
- a fixture is a position to test decisions in;
- a human game is evidence about what humans do;
- neither is an AI opponent.

## 8. Versions and compatibility

- **`schemaVersion`** changes when the record's meaning changes (a field renamed, an action added, a meaning altered). The importer reads only the versions it lists (`supportedVersions` in `validate.js`). A newer schema should add a reader for older versions rather than reinterpret them.
- **`ruleset.id`** changes when the rules' numbers or the map change. A record is replayed only against the same rule set; others are *incompatible*. To analyse old records after a rules or map change, check out the commit that matches their `app.version` and import them there, or keep them as their own dataset. Never mix rule sets in one summary; the summary lists the rule sets it counted.
- **`app.version`** is `package.json`'s version, and a test keeps `record.js` equal to it. Raise it when a release changes behaviour. A different app version with the same rule set only gives a warning: the replay still decides.
- **Human playtests** ([Human playtests](playtests.md)) keep and upload these same full records, unchanged; the collection's tool checks them with this importer.
- **Human Jack games** ([Playing Jack](playing-jack.md#6-game-records)) needed no new format: `players.jack.type` is `"human"`, `players.police` names the detectives' AI, and `randomness` holds the seed of the detectives' tie-breaks. Schema version 1 is unchanged, so every existing record still reads and replays.

## 9. Privacy

- **Exporting makes files only when the player asks,** and sends nothing. No account, telemetry or analytics was added.
- **Online submission is separate and optional:** when the site has a playtest intake, the full record of a game a person finished is sent to it, unless the player turned off Anonymous Gameplay Research. Nothing else is sent, and never the optional note ([Automatic playtest collection §3](automatic-playtest-collection.md#3-privacy)).
- **No personal data:** no names, emails, accounts, IP addresses, browser or device details, and no persistent identifier. The game identifier is random, made per game, and stored nowhere.
- **The date has no time of day.** The optional label and comments are length-limited, and only included when written.
- **The full record says plainly that it reveals Jack's secrets,** and needs the game to be over, or ended on purpose.
- **Sharing is up to the player.**

## 10. Limitations and future work

- **`keepWretched`** (a Wretched with no legal move) is recorded and replayed by the same code as the other actions. It is rare and occurs in none of the example or test games.
- **The interface's own mistakes** (clicks the engine refuses) are not recorded. Only actions taken back are, as interactions.
- **No commit identifier** in browser records: the page can't know it. `app.version` and `ruleset.id` identify the code that matters for replay.
- **Re-running the AI:** a browser game's Jack AI used unseeded random numbers, so checking that the recorded decisions are what the AI *would* choose isn't possible; replay doesn't depend on it.
- **Example records** are synthetic: the computer plays both sides (`players.police.type` is `"ai"`). Regenerate them with `node tools/game-log/make-examples.js` after a change to the format.
