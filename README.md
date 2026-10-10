# Letters From Whitechapel

**[▶ Play online](https://aceszhenwei.github.io/Letters-From-Whitechapel/)**: https://aceszhenwei.github.io/Letters-From-Whitechapel/ (nothing to install)

A browser version of the board game *Letters from Whitechapel*. You lead the five police detectives hunting Jack the Ripper through the streets of Whitechapel in 1888, and the computer plays Jack. Over four nights he kills, then tries to slip back to his secret hideout; you place patrols, follow his trail of clues and try to make the arrest.

![The game during Clues and suspicion: the board with policemen, search and arrest choices, and the sidebar with the current phase, Jack's status and the case log](docs/images/screenshot.jpg)

## Play

[Play online](https://aceszhenwei.github.io/Letters-From-Whitechapel/), on a computer or a phone. To run it yourself, open `index.html` from the folder on a computer, or serve the folder with any static web server (`npx serve .`). There is nothing to install or build. On a phone, use the online version: a single downloaded `index.html` can't load the files it needs. See [Deployment](docs/deployment.md) for how the online version is published.

You lead the five detectives; the computer plays Jack the Ripper. Before the first night, choose how hard Jack plays: **Normal** (the default) or **Hard**. The game remembers your choice for the next game. The difficulty only changes how Jack decides: the rules and what each side may know are the same.

For developers and researchers, **Developer Mode** (`index.html?dev=1`) also offers the Baseline Jack, an experimental Jack, and computer police to watch instead of playing. The [AI overview](docs/ai.md#difficulty-levels) says which AI each level plays; for testing, `index.html?difficulty=hard&police=normal` fixes both, with or without Developer Mode.

While you lead the detectives you can undo a policeman's move until you choose Done. After each night the board stays as it was, with the night's log in the case files, until you begin the next night. Any earlier night can be looked at again, with walking distances from its crime scenes and clues. The women and the Wretched are ringed on the board, and **Highlight** makes them stand out. See [User interface](docs/ui.md#the-detectives-tools).

The game follows the revised edition rulebook: four nights (including the double event), real and fake patrols, the Time of the Crime, Jack's coaches and alleys, and searching for clues or making an arrest. See [Game rules](docs/game-rules.md) for the details and what isn't implemented yet.

## Documentation

Start at the [documentation index](docs/README.md). The most used pages:

- [Game rules](docs/game-rules.md): the rules as implemented, and what isn't
- [Architecture](docs/architecture.md): the modules, the state and the phases
- [AI overview](docs/ai.md): every Jack and police AI, the levels, and the evidence behind each
- [Testing](docs/testing.md): running the tests, the test tiers and the seeds (`npm install && npm test`)
- [Research reports](docs/README.md#research-reports): the studies behind the AIs
- [Roadmap](docs/roadmap.md) and [Changelog](docs/changelog.md)

Contributions are welcome: see [Contributing](docs/contributing.md).

## Credits

This project is a fork of the original browser version by David Apple, who built the map data, the first game logic and the board design.

*Letters from Whitechapel* was designed by Gabriele Mari and Gianluca Santopietro and is a trademark of Tiopi srl, published in English by Fantasy Flight Games. This is an unofficial fan project and is not affiliated with or endorsed by them. Read about the board game on [BoardGameGeek](https://boardgamegeek.com/boardgame/59959/letters-whitechapel).
