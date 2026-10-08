# User interface

The page aims to feel like the board game on a table: a parchment board in a dark Victorian frame, with tokens modelled on the physical pieces.

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Top bar: title                         Night · date           │
├───────────────────────────────────────────┬──────────────────┤
│ Board (scaled to fit)                     │ Phase card        │
│                                           │  part, title,     │
│                                           │  instructions,    │
│                                           │  progress, phases │
├───────────────────────────────────────────┤ Jack the Ripper   │
│ Move track  V IV III II I 1 … 15          │  coaches, alleys, │
├───────────────────────────────────────────┤  moves, victims   │
│ Legend                                    │ Case log          │
└───────────────────────────────────────────┴──────────────────┘
```

Below 1100 pixels wide the page becomes one column, in this order: the phase card (what to do now), the board, the move track, Jack and the case log, then the legend. Below 600 pixels the move track wraps onto two rows and the list of phases is hidden. The board always scales to the width available (`WC.ui.draw.fit`), so there is no horizontal scrolling.

## How the interface works

The interface is `js/ui/renderer.js` (`WC.ui`). It displays the game; it doesn't run it (see [Architecture](architecture.md)):

- **It listens to the engine's events** (`game.on`) and draws what changed. For example, `murder` draws the crime scene markers, moves the track and writes the case log entry. `policeTurn` draws the police's choices for that phase.
- **It shows only legal choices, taken from the rules.** These include `rules.patrolPositions`, `rules.wretchedMoves`, `rules.policeDestinations`, and each policeman's `search` and `arrest` lists.
- **It sends clicks to the engine's police actions:** `togglePatrol`, `moveWretched`, `keepWretched`, `movePoliceman`, `chooseAction`, `search` and `arrest`. The engine checks the rules again and reports what happened.
- **It owns all the wording:** instructions, progress lines, case log entries and the endings.

## Components

| Component | Element | Drawn by (`WC.ui.draw`) | On |
|---|---|---|---|
| Night and date | `.night-name`, `.night-date` | `updateTitle` | `phase`, `nightStarted` |
| Phase card | `.phase-part`, `.phase-title`, `.phase-description`, `.phase-steps` | `updateTitle` | `phase` |
| Instructions | `.state.<phase-name>` | `phaseText(name, text)` | `policeTurn`, and phase 4 |
| Progress | `.phase-progress` | `progress(text)` | Police actions' events |
| Jack's status | `.jack-log` | `jackLog` | `nightStarted`, `murder`, `jackMoved` |
| Case log | `.event-log` | `log(text, kind)`, where `kind` is `night`, `crime`, `clue`, `jack`, `police` or `end` | Most events |
| Board | `.board` > `.map` | `streets`, `map`, `createElement` | `started` |
| Move track | `.move-tracker p span` (20 spans) | `tracker` | `timeOfCrime`, `jackWaited`, `murder`, `jackMoved` |
| Dialogs | `.overlay.intro`, `.overlay.ending` (shown with the `open` class) | Start-up code in `main.js`, the `gameOver` event | |

## Tokens on the board

| Looks like | Classes | Meaning |
|---|---|---|
| White circle with a number | `location-number` | Numbered circle |
| Red circle with a number | `location-number location-murder` | Red numbered circle |
| Small dark square | `location` | Crossing |
| Square with a brass outline | `location location-station` | Yellow-bordered crossing |
| "Real" / "Fake" pills | `token-police marked` / `unmarked` (`selected`, `required`) | Choosing patrols |
| Black disc with "?" | `token-police` | Face-down patrol |
| Coloured disc with a shield | `token-police police-N`, `token-pawn police-N` | Policeman N (blue, yellow, brown, red, green) |
| White disc with a woman | `token-woman`, `token-wretched` | Woman token or Wretched |
| Green ring | `token-move-police`, `token-move-wretched` | Where a piece can move |
| "Search" / "Arrest" pills | `token-search-adjacent`, `token-arrest-adjacent` | A policeman's choice of action |
| Disc with a magnifier or gavel | `token-search`, `token-arrest` | A circle to search or arrest at |
| Translucent yellow disc | `token-clue` | Clue marker |
| Translucent red disc | `token-murder crime-scene` | Crime scene marker |

Pieces that can be clicked have the `selectable` class, which gives them a pointer, a hover ring and (for pieces still to move) a gentle pulse.

## The class contract

The game code and the tests find elements by class name, so keep these classes when restyling: `token`, `selectable`, `token-police`, `marked`, `unmarked`, `selected`, `required`, `token-woman`, `token-wretched`, `token-move-wretched`, `token-move-police`, `token-pawn`, `token-search-adjacent`, `token-arrest-adjacent`, `token-search`, `token-arrest`, `token-clue`, `token-murder`, `location`, `location-number`, `state`, `game-over`, `jack-log`, `move-tracker`, and the `carriage`, `alley`, `murder` and `active` classes on track spaces.

Two of these behave in a way that matters:

- `$('.token').remove()` clears the board at the end of a phase or night, so crime scene markers deliberately don't have the `token` class.
- The Real and Fake pills for a crossing are adjacent siblings, and the code uses `.next()` and `.prev()` to switch between them.

## Design tokens

Colours, radius, shadow and fonts are CSS variables at the top of `css/style.css`:

| Token | Use |
|---|---|
| `--ink`, `--ink-raised`, `--ink-line` | Page background, cards, borders |
| `--paper`, `--paper-dim` | The board and dialogs |
| `--text`, `--text-dim`, `--text-on-paper` | Text |
| `--blood`, `--blood-bright` | Murders, Hell, primary buttons |
| `--brass` | Highlights: current move, progress, required patrols |
| `--clue`, `--coach`, `--alley` | Markers and move-track colours |
| `--police-blue`, `--police-yellow`, `--police-brown`, `--police-red`, `--police-green` | The five policemen |
| `--font-display`, `--font-body` | IM Fell English for headings, Source Sans 3 for text (from Google Fonts, falling back to Georgia and system fonts offline) |

## Accessibility

- Every place and token has a `title` naming what it is and its number, for example "Search here (number 82)".
- The phase progress and the case log are `aria-live` regions, so screen readers announce changes.
- The dialogs use `role="dialog"` and `aria-modal`, and the start button takes focus.
- The pulsing animation is switched off when the system asks for reduced motion.
- Colour is never the only signal: track spaces keep their numerals, and tokens have icons and labels.

## Adding to the UI

- **New phase instructions:** in `renderer.js`, call `draw.phaseText('<state-class>', text)` in that phase's `turns` function, and add the `.state` div to the phase card in `index.html` if it is new.
- **Something the police learn:** have the engine report an event with the facts. Then add a handler in `renderer.js`'s `events` that calls `draw.log(text, kind)`.
- **A new token:** create it with `draw.createElement(mapid, label, 'token token-<name> ...')`, then style `.map .token-<name>` in `style.css`. Size it in board pixels; the board scales as a whole.
- **A new police action:** add the action to the engine (it checks a rule from `rules.js`), then a click in `renderer.js` that calls it. Don't decide in the interface whether the action is legal.
- **Selecting elements:** prefer simple class selectors and filter functions over jQuery's `:not()`, `.not(selector)` and similar. Some of those make jQuery draw on `Math.random`, which shifts Jack's random choices in seeded games (see [Testing](testing.md#golden-traces)).
