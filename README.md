# Letters From Whitechapel

Get ready to enter the poor and dreary Whitechapel district in London 1888 – the scene of the mysterious Jack the Ripper murders – with its crowded and smelly alleys, hawkers, shouting merchants, dirty children covered in rags who run through the crowd and beg for money, and prostitutes – called "the wretched" – on every street corner.

The board game Letters from Whitechapel, which plays in 90-150 minutes, takes the players right there. One player plays Jack the Ripper, and his goal is to take five victims before being caught. The other players are police detectives who must cooperate to catch Jack the Ripper before the end of the game. The game board represents the Whitechapel area at the time of Jack the Ripper and is marked with 199 numbered circles linked together by dotted lines. During play, Jack the Ripper, the Policemen, and the Wretched are moved along the dotted lines that represent Whitechapel's streets. Jack the Ripper moves stealthily between numbered circles, while policemen move on their patrols between crossings, and the Wretched wander alone between the numbered circles.

Read about [Letters From Whitechapel at boardgamegeek.com](https://boardgamegeek.com/boardgame/59959/letters-whitechapel)

## Web Development

Play as the five police charaters on the hunt for an artificially intelegent serial killer in the web browser based version.

## Special Movement

Jack has carriages and alleys to help him escape. Each night he gets fewer of them (3, 2, 2 and 1 carriages; 2, 2, 1 and 1 alleys).

- **Carriage:** Jack moves two numbers in one turn, even past police. It uses two spaces on the move track.
- **Alley:** Jack cuts through a block to any number around the same block, even past police.

The police see on the move track and below the title when Jack uses one. Alleys are worked out from the map itself: the streets form a planar graph, and every block is one of its faces (see `map.computeAlleys` in `js/map.js`).

## Tests

The tests run the game in a simulated browser ([jsdom](https://github.com/jsdom/jsdom)) with Node.js 22 or later:

```
npm install
npm test
```

- `test/unit` checks the map data, random numbers, movement and Jack's special moves.
- `test/regression` has a test for each bug that has been fixed, and plays whole seeded games checking the rules after every action.

## In Development

- Different numbers of women and wretched for each night

I welcome support from any developers who wish to continue working on this browser based version of my favorite board game.

## Donate

Bitcoin: [13D3A8PP91MLF5VTBQMH5HG76F42RNRF28](https://blockchain.info/address/13D3A8PP91MLF5VTBQMH5HG76F42RNRF28)
