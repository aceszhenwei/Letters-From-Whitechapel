// Makes the example game records in docs/examples/game-records/ (docs/game-records.md): synthetic games between the
// computer Jack and the computer police, seeded, so the files are the same every time.
//   node tools/game-log/make-examples.js [output folder]
// The computer police stand in for a human player; the records say so (players.police.type 'ai').
const fs = require('fs');
const path = require('path');
const { loadWithAI } = require('./core');

function seeded(seed) {
	// mulberry32, as in the tests
	return function () {
		seed |= 0;
		seed = (seed + 0x6D2B79F5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function play({ seed, jack = 'hard', police = 'hard', stopAt }) {
	// stopAt(game): stop before the police act when it returns true (a game left unfinished)
	const context = loadWithAI(seeded(seed));
	const { WC } = context;
	const game = WC.engine.create({ ai: WC.difficulty.create(WC, jack), confirmPoliceMoves: true, reviewNights: true });
	const recorder = WC.record.attach(game, {
		gameId: `example-${seed}`,
		players: {
			jack: { type: 'ai', level: jack, ai: WC.difficulty.level(jack).ai },
			police: { type: 'ai', level: police, ai: WC.policeLevels.level(police).ai }
		},
		randomness: { source: 'seeded', seed }
	});
	const ai = WC.policeLevels.create(WC, police);
	const random = seeded(seed + 1);
	game.start();
	for (let i = 0; i < 5000 && !game.state.over; i++) {
		if (stopAt && stopAt(game)) break;
		const state = game.state;
		if (state.phase === 12) {
			game.beginNextNight();
		} else if (state.phase === 10 && state.turn.moved.length === WC.rules.policeNight(state).now.length) {
			game.finishPoliceMoves();
		} else {
			ai.turn(game, WC.rules.policeView(state), random);
		}
	}
	return { WC, game, recorder };
}

function main(out) {
	fs.mkdirSync(out, { recursive: true });
	const date = '2026-10-10';
	// A finished game: its full record and the police's public record
	const done = play({ seed: 211001 });
	const write = (name, record) => fs.writeFileSync(path.join(out, name), done.WC.record.stringify(record));
	write('completed-full.json', done.recorder.exportFull({ date }));
	write('completed-public.json', done.recorder.exportPublic('police', { date }));

	// A game in progress (night 2, police to move): only the public record is available
	const open = play({ seed: 211002, stopAt: (game) => game.state.jack.length === 2 && game.state.phase === 10 });
	write('in-progress-public.json', open.recorder.exportPublic('police', { date, feedback: { label: 'example tester', comments: 'Synthetic game, no human player.' } }));

	// A game the player ended on night 3: after confirming, its full record
	const ended = play({ seed: 211003, stopAt: (game) => game.state.jack.length === 3 && game.state.phase === 11 });
	ended.recorder.abandon({ confirmed: true });
	write('abandoned-full.json', ended.recorder.exportFull({ date }));
	return ['completed-full.json', 'completed-public.json', 'in-progress-public.json', 'abandoned-full.json'];
}

if (require.main === module) {
	const out = process.argv[2] || path.join(__dirname, '..', '..', 'docs', 'examples', 'game-records');
	console.log(main(out).map((name) => path.join(out, name)).join('\n'));
}

module.exports = { play, seeded, main };
