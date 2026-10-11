// Seeded games must play exactly as they did when the traces were recorded (before the module refactor):
// the same police actions, Jack's moves, case log, screen text and final state, step by step.
// This file checks the odd seeds and golden-traces-even.test.js the even ones, so CI can run them in parallel
// (test/helpers/golden.js); together they check every recorded game.
require('../helpers/golden').goldenTests('odd');
