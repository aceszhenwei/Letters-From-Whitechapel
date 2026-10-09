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

`adjacentNumber` was entered by hand. A test checks it matches what `WC.board.walk` works out for every circle.

## Alleys

An alley lets Jack cross a block of houses to any numbered circle on its edge. A block is "an area that's completely bounded, but not interrupted, by dotted lines". Because no streets cross without a place where they meet, the streets form a planar graph, and every block is one of its faces.

`map.computeAlleys()` finds the faces:

1. Sort each place's neighbours by angle.
2. Walk every street in both directions, always turning onto the next street clockwise. Each walk traces one face.
3. The face with the largest area is the outside of the map, so it is skipped.
4. The numbered circles around each remaining face (164 blocks) are linked to each other in `alley`.

The tests check Euler's formula (places − streets + faces = 2), that alleys go both ways, and that the result matches the alley data that used to be entered by hand. Number 43 sits on a spur at the map's edge and has no alleys.

## Verified against the board

The topology (which numbered circles Jack can walk or take an alley between) comes from the streets in `map.js` and nothing else. It has been **verified against the physical board** at the 13 places where it differs from [whitechapelR](https://github.com/bmewing/whitechapelR)'s map (`data/roads.rda`, `data/alley.rda`, version 0.3.0). The board agrees with this map in all 13:

| On the board | Pairs (printed numbers) | Through |
|---|---|---|
| Streets that exist (whitechapelR lacks them) | 16–34, 165–189, 169–191, 172–183, 182–184, 182–185, 182–186, 182–193, 185–192, 186–192 | 16–34 through crossings 50 and 52; 165–189 through 260 and 252; 169–191 through 284 and 282; 172–183 through 361, 345, 344 and 324; the six around 182 through the street between crossings 326 and 330 |
| Streets that don't exist (whitechapelR has them) | 165–186, 31–36 | Nothing: 165 and 186 are about 320 board pixels apart, and every route from 31 to 36 passes other circles |
| Alley that doesn't exist (whitechapelR has it) | 35–39 | 35 and 39 are not on the edge of the same block |

**whitechapelR's map is wrong in these 13 places**, probably through its computer-vision extraction: 165–186 against 165–189 looks like 186 and 189 confused. It remains a useful independent reference for inference *algorithms*, but not for the board. For a while this project treated whitechapelR's topology as canonical and overrode the 13 pairs (`map.topologyCorrections`). That was reverted once the board was checked; the [Detective inference](detective-inference-study.md) study records what it changed.

`test/unit/map-topology.test.js` pins each of the 13 connections (including which crossings block each street), the totals (775 walking links, 451 alleys, 592 streets), and that whitechapelR's map differs from this one in exactly these 13 places and nowhere else. A change to the streets that alters any connection fails it.

## Editing the map

1. Change `js/data/map.js`. Keep connections two-way: if `a` lists `b` in `adjacent`, `b` must list `a`.
2. In a browser console on `index.html`, run `map.debug()`. It should return `"0 errors"`.
3. Run `npm test`. The map tests check connections, numbering, planarity and alleys, and `map-topology.test.js` checks the board-verified connections. A street edit that changes which circles are linked fails that test; update it only after checking the physical board.
4. The game draws streets from the data, so nothing else needs regenerating. `generate-svg-map.html` still prints SVG markup if you need it for other tools.
