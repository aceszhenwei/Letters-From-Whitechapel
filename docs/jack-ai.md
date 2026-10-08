# Jack's AI

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
```

Nothing outside `js/ai/` needs to change, unless the new strategy needs to know something the view doesn't offer. In that case, add it to `rules.jackView`, keeping to what Jack would know.

## The current strategy

The current AI (`WC.jackAI`, made by `WC.createJackAI`) uses simple heuristics and biased randomness. `random.safeIndex(percentage, length)` picks from a sorted list, favouring the start: the higher the percentage, the more strongly.

### Hell

| Decision | How the current AI decides |
|---|---|
| Hideout | Random, among the allowed circles |
| Where to put the Wretched | Red circles sorted by how close their walking distance to the hideout is to 7 moves (`sortSevenSteps`), then picked with a strong bias to the top. Decoy women go on the others at random |
| Kill or wait | A coin toss |
| Which patrol to reveal | Random |
| Which Wretched to kill | Sorted by closeness to 7 moves from the hideout, with a weak bias. On the double event, the other victim is random and Jack escapes from the better-placed one |

### Hunting

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

## Ideas for a stronger Jack

- Use walking distance and moves left, not straight-line distance, when walking.
- Avoid being near the hideout early in the night, so the police learn less about it.
- Use revealed patrols when choosing a victim.
- Evaluate strategies by playing many seeded headless games (`test/helpers/headless.js`) and comparing win rates.
