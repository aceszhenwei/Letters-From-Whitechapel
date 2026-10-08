// Regenerates test/fixtures/golden-traces.json. Only run this when a change to the game's behaviour is intended:
// node test/fixtures/generate-golden-traces.js
const fs = require('fs');
const path = require('path');
const { traceGame } = require('../helpers/trace');

const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const traces = seeds.map((seed) => {
	const trace = traceGame(seed);
	delete trace.snapshot; // The hash of it is kept; the readable parts are the log and Jack's routes
	console.log(`seed ${seed}: ${trace.actions} actions, ${trace.ending}`);
	return trace;
});
fs.writeFileSync(path.join(__dirname, 'golden-traces.json'), JSON.stringify(traces, null, '\t') + '\n');
