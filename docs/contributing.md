# Contributing

Contributions are welcome, especially toward the items in the [roadmap](roadmap.md).

## Set up

```
git clone https://github.com/aceszhenwei/Letters-From-Whitechapel.git
cd Letters-From-Whitechapel
npm install
npm test
```

Open `index.html` in a browser to play. There is no build step: edit a file and reload.

## Code conventions

Match the existing code:

- **JavaScript:** ES5 that runs directly in the browser (`var`, `function`, no modules or arrow functions in `js/`). Tests can use modern JavaScript.
- **Indentation:** tabs in JavaScript, four spaces in CSS and HTML.
- **Libraries:** jQuery 1.11 for the DOM and Underscore 1.8 for collections. `_.last(jack)` and `_.last(police)` are the current night.
- **Variables:** declare every variable with `var`. Loop counters used to leak as globals and caused bugs.
- **Map ids and numbers:** code works with map ids. Convert with `map[id].number` only for text the player sees.
- **Rules:** cite the rulebook phase in a comment when code enforces a rule, and keep [Game rules](game-rules.md) up to date.
- **Comments:** short, and they explain why.

## Pull requests

1. Branch from `master`.
2. Make the change, with tests:
   - a rules change gets a test in `test/unit/rules.test.js`;
   - a bug fix gets a regression test in `test/regression/bugs.test.js` that fails without the fix;
   - a UI change keeps the [class contract](ui.md#the-class-contract) or updates the code and tests that use it.
3. Run `npm test`.
4. For visual changes, check the page at desktop and phone widths, and attach a screenshot to the pull request.
5. Update the relevant document in `docs/` and add a line to the [changelog](changelog.md).
6. Open a pull request against `master`. GitHub Actions runs the tests.
