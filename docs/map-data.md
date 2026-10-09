# Map data

`js/data/map.js` describes the board as a graph of 429 places (map ids 0 to 428) joined by 592 street segments.

## Fields

```js
map[3].position = [164.142, 31.381];   // x, y in board pixels (the board is 1000 by 663)
map[3].adjacent = [4, 2];              // places joined to this one by a dotted line
map[3].number = 1;                     // numbered circles only: the printed number
map[3].adjacentNumber = [6, 116, ...]; // numbered circles only: the numbers Jack can walk to
map[8].murder = true;                  // red numbered circles (8 of them)
map[33].station = true;                // yellow-bordered crossings (7 of them)
// computed at load:
map[3].alley = [119, 121];             // numbered circles around the same block(s)
```

| Kind | How to tell | Count |
|---|---|---|
| Numbered circle | has `number` | 195 |
| Red numbered circle | has `murder` | 8 |
| Crossing | no `number` | 234 |
| Yellow-bordered crossing | has `station` | 7 |

Map ids and printed numbers are different. Code uses map ids; anything shown to the player should use `map[id].number`.

## Walking

- **Jack and the Wretched** walk from a numbered circle along streets, through crossings, to the next numbered circle: `WC.board.walk(mapid, blocked)`. It never passes a crossing in `blocked`, which is where the policemen or patrol tokens are.
- **Policemen** move between crossings and pass through numbered circles without stopping: `WC.board.crossingSteps` and `WC.board.crossingsWithinTwo`.
- **Searches and arrests** reach only the numbered circles directly joined to a policeman's crossing: `WC.board.adjacentNumbers`.

These are questions about the map alone, in `js/core/board.js`. Which of them are legal in a game (past which policemen, with which tokens) is decided in `js/core/rules.js`.

`adjacentNumber` was entered by hand, then adjusted by the topology corrections below. A test checks it matches what `WC.board.walk` works out for every circle.

## Alleys

An alley lets Jack cross a block of houses to any numbered circle on its edge. A block is "an area that's completely bounded, but not interrupted, by dotted lines". Because no streets cross without a place where they meet, the streets form a planar graph, and every block is one of its faces.

`map.computeAlleys()` finds the faces:

1. Sort each place's neighbours by angle.
2. Walk every street in both directions, always turning onto the next street clockwise. Each walk traces one face.
3. The face with the largest area is the outside of the map, so it is skipped.
4. The numbered circles around each remaining face (164 blocks) are linked to each other in `alley`.

The tests check Euler's formula (places − streets + faces = 2), that alleys go both ways, and that the result matches the alley data that used to be entered by hand. Number 43 sits on a spur at the map's edge and has no alleys.

## Topology corrections

The **circle-to-circle topology** (which numbered circles Jack can walk or take an alley between) follows [whitechapelR](https://github.com/bmewing/whitechapelR)'s map (`data/roads.rda`, `data/alley.rda`, version 0.3.0, MIT licence), which this project treats as the canonical source. The streets in `map.js` (positions, crossings, how they're drawn, how policemen move, which blocks there are) are unchanged.

When the two were compared ([Detective inference](detective-inference-study.md#3-whitechapelr-what-it-does)), they agreed on 765 walking links and 451 alleys and differed on 13 pairs. Each was resolved in whitechapelR's favour, in `map.topologyCorrections` (printed numbers):

| Change | Pairs | How the streets made them, or not |
|---|---|---|
| Walking links removed (10) | 16–34, 165–189, 169–191, 172–183, 182–184, 182–185, 182–186, 182–193, 185–192, 186–192 | Each was a route through crossings only: 16 and 34 through crossings 50 and 52; 165 and 189 through 260 and 252; 169 and 191 through 284 and 282; 172 and 183 through 361, 345, 344 and 324; the six around 182 all through the street between crossings 326 and 330 |
| Walking links added (2) | 165–186, 31–36 | No street-only route joins them: 165 and 186 are about 320 board pixels apart (a typical link is about 72), and every route from 31 to 36 passes other circles |
| Alley added (1) | 35–39 | 35 and 39 are not on the edge of the same block in the drawn streets |

`map.applyTopologyCorrections()` runs at load, after `computeAlleys()`:

- **Walking.** Each circle gets `walkRemove` and `walkAdd` lists, which `WC.board.walk` applies after following the streets. `adjacentNumber` is updated to match. Everything that walks uses it: Jack, the Wretched, distances, the deduction and both AIs.
- **Alleys.** The pairs are added to (or removed from) each circle's `alley` list.
- **Policemen and added links.** A policeman blocks a remaining link exactly as before, if it passes his crossing. An added link passes no crossing, so no policeman can block it.

**Caveat, from the board scan.** `images/whitechapel-numbers.jpg` is this project's labelled scan of the board. It shows a dotted street from 16 through crossings 50 and 52 to 34, and no street joining 165 to 186 or 31 to 36. Some of whitechapelR's pairs may therefore be errors in its computer-vision extraction, rather than errors here: 165–186 against 165–189 looks like 186 and 189 confused. The choice of whitechapelR as canonical is a project decision. Every correction is one line in `map.topologyCorrections`, so it can be revisited against a printed board. The drawn streets still show the old links, and don't show the added ones.

`test/unit/map-topology.test.js` checks that every walking link and alley matches whitechapelR's (`test/fixtures/whitechapelR-map.json`), that each correction holds both ways, and that the streets themselves are unchanged. Results produced before the corrections (the [Jack's AI](jack-ai.md) evaluation and the first round of the detective study) are labelled as using the previous map.

## Editing the map

1. Change `js/data/map.js`. Keep connections two-way: if `a` lists `b` in `adjacent`, `b` must list `a`.
2. In a browser console on `index.html`, run `map.debug()`. It should return `"0 errors"`.
3. Run `npm test`. The map tests check connections, numbering, planarity and alleys, and `map-topology.test.js` checks the topology against whitechapelR's. A street edit that changes which circles are linked fails that test until `map.topologyCorrections` is updated to match.
4. The game draws streets from the data, so nothing else needs regenerating. `generate-svg-map.html` still prints SVG markup if you need it for other tools.
