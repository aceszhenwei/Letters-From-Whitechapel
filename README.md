# Letters From Whitechapel

Get ready to enter the poor and dreary Whitechapel district in London 1888 – the scene of the mysterious Jack the Ripper murders – with its crowded and smelly alleys, hawkers, shouting merchants, dirty children covered in rags who run through the crowd and beg for money, and prostitutes – called "the wretched" – on every street corner.

The board game Letters from Whitechapel, which plays in 90-150 minutes, takes the players right there. One player plays Jack the Ripper, and his goal is to take five victims before being caught. The other players are police detectives who must cooperate to catch Jack the Ripper before the end of the game. The game board represents the Whitechapel area at the time of Jack the Ripper and is marked with 195 numbered circles linked together by dotted lines. During play, Jack the Ripper, the Policemen, and the Wretched are moved along the dotted lines that represent Whitechapel's streets. Jack the Ripper moves stealthily between numbered circles, while policemen move on their patrols between crossings, and the Wretched wander alone between the numbered circles.

Read about [Letters From Whitechapel at boardgamegeek.com](https://boardgamegeek.com/boardgame/59959/letters-whitechapel)

## Play in your browser

Play as the five police detectives hunting an artificially intelligent Jack the Ripper. Open `index.html` in a browser; there is nothing to install or build.

![The game during Clues and suspicion: the board with policemen, search and arrest choices, and the sidebar with the current phase, Jack's status and the case log](docs/images/screenshot.jpg)

The game follows the revised edition rulebook: four nights (including the double event), patrol and fake patrol tokens, the Time of the Crime, Jack's coaches and alleys, and searching for clues or making an arrest. See [Game rules](docs/game-rules.md) for the details and what isn't implemented yet.

## Documentation

Everything about how the game works and how to change it is in [`docs/`](docs/README.md):

- [Architecture](docs/architecture.md): files, data model and the phase state machine
- [Game rules](docs/game-rules.md): the rules as implemented
- [Map data](docs/map-data.md): the board graph and how alleys are worked out
- [Jack's AI](docs/jack-ai.md): how the computer plays Jack
- [User interface](docs/ui.md): layout, components and design tokens
- [Testing](docs/testing.md): running and writing tests (`npm install && npm test`)
- [Contributing](docs/contributing.md), [Roadmap](docs/roadmap.md) and [Changelog](docs/changelog.md)

I welcome support from any developers who wish to continue working on this browser based version of my favorite board game.

## Donate

Bitcoin: [13D3A8PP91MLF5VTBQMH5HG76F42RNRF28](https://blockchain.info/address/13D3A8PP91MLF5VTBQMH5HG76F42RNRF28)
