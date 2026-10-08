# Jack's AI

The computer plays Jack with simple heuristics and some randomness. It only ever uses information Jack would have, though it does know where the real policemen are once they are on the board, as Jack does.

## Biased randomness

Many choices pick from a sorted list with `game.randomSafeIndex(percentage, length)`. It favours the start of the list: the higher the percentage, the more strongly. This keeps Jack sensible but not predictable.

## Hell

| Decision | How Jack decides | Code |
|---|---|---|
| Hideout | Random, among numbered circles that aren't red. | `game.selectBase` |
| Where to put the Wretched | Red circles sorted by how close their walking distance to the hideout is to 7 moves, then picked with a strong bias to the top. Decoy women go on the other red circles at random. | `game.theTargetsAreIdentified`, `game.sortSevenSteps` |
| Kill or wait | A coin toss, until V, where he must kill. | `game.bloodOnTheStreets` |
| Which patrol to reveal | Random, among those not yet revealed. | `game.revealPolice` |
| Which Wretched to kill | Sorted by closeness to 7 moves from the hideout, with a weak bias. On the double event, the other victim is random and Jack escapes from the better-placed one. | `game.murder` |

Walking distances come from `jack.baseDistance`, a breadth-first search from the hideout that is cached per hideout.

## Hunting

On each move `jack.move` first asks `jack.chooseSpecial` whether to use a coach or alley, and otherwise walks with `jack.walk`.

### Danger

`jack.arrestable` counts, for each numbered circle, how many ways the policemen could reach it next round and arrest there. It uses every crossing each policeman has stood on tonight, two crossings out.

### Special movements (`jack.chooseSpecial`)

Jack uses a coach or alley when:

1. **Police block every street.** It is his only legal move.
2. **Walking can't reach the hideout in time:** no walk leaves him within reach with the moves left, but a special movement does.
3. **Every walk could be arrested**, but a special movement reaches a safe circle and still gets home in time.

Among the options he prefers, in order: reaching home in time, fewer ways to be arrested, closer to home, then fewer track spaces (an alley over a coach). Because a special movement onto the hideout can't end the night, landing there counts as two moves from home: step off, then walk back on.

### Walking (`jack.walk`)

| When | Behaviour |
|---|---|
| First move | Avoid circles the police could arrest at, then prefer circles nearer the hideout (straight-line distance), with a strong bias. |
| Second move | Sort by danger and distance, then pick with a strong bias. |
| From the sixth entry on his sheet | If the hideout is next to him, walk onto it. Otherwise prefer circles nearer the hideout. |

Jack always declares his escape when a normal move takes him onto his hideout.

## Ideas for a stronger Jack

- Use the move count left, not straight-line distance, when walking.
- Avoid being near the hideout early in the night, so the police learn less about it.
- Use revealed patrols when choosing a victim.
