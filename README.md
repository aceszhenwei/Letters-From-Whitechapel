# Letters From Whitechapel

Get ready to enter the poor and dreary Whitechapel district in London 1888 – the scene of the mysterious Jack the Ripper murders – with its crowded and smelly alleys, hawkers, shouting merchants, dirty children covered in rags who run through the crowd and beg for money, and prostitutes – called "the wretched" – on every street corner.

The board game Letters from Whitechapel, which plays in 90-150 minutes, takes the players right there. One player plays Jack the Ripper, and his goal is to take five victims before being caught. The other players are police detectives who must cooperate to catch Jack the Ripper before the end of the game. The game board represents the Whitechapel area at the time of Jack the Ripper and is marked with 199 numbered circles linked together by dotted lines. During play, Jack the Ripper, the Policemen, and the Wretched are moved along the dotted lines that represent Whitechapel's streets. Jack the Ripper moves stealthily between numbered circles, while policemen move on their patrols between crossings, and the Wretched wander alone between the numbered circles.

Read about [Letters From Whitechapel at boardgamegeek.com](https://boardgamegeek.com/boardgame/59959/letters-whitechapel)

## Web Development

Play as the five police charaters on the hunt for an artificially intelegent serial killer in the web browser based version.

## Rules

The game follows the [revised edition rulebook](https://boardgamegeek.com/boardgame/59959/letters-whitechapel). You play the police and the computer plays Jack.

- **Four nights**, with 8, 7, 6 and 4 women (5, 4, 3 and 1 of them marked). Women are never placed on earlier crime scenes, and crime scenes stay on the map all game.
- **Patrols**: on the first night the seven patrol tokens go on the yellow-bordered crossings. On later nights there must be a token wherever a policeman ended the night before, and the other two go on yellow-bordered crossings without a policeman.
- **Time of the Crime**: each time Jack waits, the token moves from I towards V, the Wretched move (they can't pass a patrol, end next to one, or end on a Wretched or crime scene) and Jack reveals a patrol. On V he must kill. Jack's pawn starts on the Time of the Crime token, so waiting gives him more moves (15 to 19).
- **The double event**: on the third night Jack kills two Wretched, and the police move first.
- **Escape**: Jack declares his escape when a normal move takes him onto his hideout (never a red numbered circle). He loses if he is arrested, if police block every street and he can't use a special movement, or if he uses his last move (15) without reaching his hideout.
- **Clues and suspicion**: each policeman either searches next to his crossing until he finds a clue, or tries one arrest.

### Special Movement

Jack gets 3, 2, 2 and 1 coaches and 2, 2, 1 and 1 alleys over the four nights.

- **Coach:** Jack moves two numbered circles in one turn, even past police. It covers two spaces on the move track.
- **Alley:** Jack crosses a block to any numbered circle around it. Alleys are worked out from the map itself: the streets form a planar graph, and every block is one of its faces (see `map.computeAlleys` in `js/map.js`).

The police see on the move track and below the title when Jack uses one.

## Tests

The tests run the game in a simulated browser ([jsdom](https://github.com/jsdom/jsdom)) with Node.js 22 or later:

```
npm install
npm test
```

- `test/unit` checks the map data, random numbers, movement and Jack's special moves.
- `test/regression` has a test for each bug that has been fixed, and plays whole seeded games checking the rules after every action.

## In Development

- The optional rules (Jack's Letters, False Clues, Rushing, Area Arrests and others)
- The Head of the Investigation tiles (only needed when several people play the police)

I welcome support from any developers who wish to continue working on this browser based version of my favorite board game.

## Donate

Bitcoin: [13D3A8PP91MLF5VTBQMH5HG76F42RNRF28](https://blockchain.info/address/13D3A8PP91MLF5VTBQMH5HG76F42RNRF28)
