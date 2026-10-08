# Map data

`js/map.js` describes the board as a graph of 429 places (map ids 0 to 428) joined by 592 street segments.

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

- **Jack and the Wretched** walk from a numbered circle along streets, through crossings, to the next numbered circle: `game.walk(mapid, blocked)`. It never passes a crossing in `blocked`, which is where the policemen or patrol tokens are.
- **Policemen** move between crossings and pass through numbered circles without stopping: `game.oneStep` and `game.twoSteps`.
- **Searches and arrests** reach only the numbered circles directly joined to a policeman's crossing: `game.arrestable`.

`adjacentNumber` was entered by hand. A test checks it matches what `game.walk` works out for every circle.

## Alleys

An alley lets Jack cross a block of houses to any numbered circle on its edge. A block is "an area that's completely bounded, but not interrupted, by dotted lines". Because no streets cross without a place where they meet, the streets form a planar graph, and every block is one of its faces.

`map.computeAlleys()` finds the faces:

1. Sort each place's neighbours by angle.
2. Walk every street in both directions, always turning onto the next street clockwise. Each walk traces one face.
3. The face with the largest area is the outside of the map, so it is skipped.
4. The numbered circles around each remaining face (164 blocks) are linked to each other in `alley`.

The tests check Euler's formula (places − streets + faces = 2), that alleys go both ways, and that the result matches the alley data that used to be entered by hand. Number 43 sits on a spur at the map's edge and has no alleys.

## Editing the map

1. Change `js/map.js`. Keep connections two-way: if `a` lists `b` in `adjacent`, `b` must list `a`.
2. In a browser console on `index.html`, run `map.debug()`. It should return `"0 errors"`.
3. Run `npm test`. The map tests check connections, numbering, planarity and alleys.
4. The game draws streets from the data, so nothing else needs regenerating. `generate-svg-map.html` still prints SVG markup if you need it for other tools.
