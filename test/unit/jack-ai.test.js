// Jack's AI on its own: decisions from a view, with no access to the page or the engine.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadCore } = require('../helpers/core');
const { playHeadless } = require('../helpers/headless');
const { seededRandom } = require('../helpers/game');

// What jackView offers (see js/core/rules.js and docs/jack-ai.md)
const viewKeys = ['hideout', 'night', 'route', 'position', 'remainingMoves', 'timeOfCrime', 'tokens', 'targets', 'women',
	'wretched', 'victims', 'debug', 'walks', 'specialMoves', 'canMove', 'endsNight', 'distanceToHideout', 'threats', 'policeNow',
	'publicLog', 'pastLogs', 'patrols', 'wretchedMoves'];

// A game paused at Jack's first move, with the view he would get
function atFirstMove(seed) {
	const { WC } = loadCore({ seed });
	const game = WC.engine.create({ ai: WC.jackAI });
	let view;
	game.ai = Object.assign({}, WC.jackAI, {
		chooseMove: (v) => { view = v; throw new Error('paused'); }
	});
	try { playHeadless(WC, game, { seed }); } catch (error) { assert.strictEqual(error.message, 'paused'); }
	return { WC, game, view };
}

test('the view tells Jack what he knows, and not which patrols are real', () => {
	const { view } = atFirstMove(3);
	assert.deepStrictEqual(Object.keys(view).sort(), viewKeys.slice().sort());
	const text = JSON.stringify(view);
	assert.ok(!/"start"|"fake"|"revealed"/.test(text), 'no patrol identities');
	// The patrols he sees: real or fake only once revealed
	for (const patrol of view.patrols()) {
		assert.strictEqual(patrol.real === undefined, !patrol.revealed);
	}
	// The public record: no coach stops, crime scenes in no particular order, no hidden route
	const log = JSON.stringify(view.publicLog());
	assert.ok(!/"via"|"route"|"base"/.test(log));
});

test('Jack\'s decisions only read the view, and never change the game', () => {
	const { WC, game, view } = atFirstMove(4);
	const before = JSON.stringify(game.state);
	const used = new Set();
	const watched = new Proxy(view, { get: (target, key) => { used.add(key); return target[key]; } });
	WC.jackAI.chooseMove(watched);
	WC.jackAI.chooseVictims(Object.assign({}, view, { wretched: view.targets.slice(0, 3), victims: 1 }));
	WC.jackAI.placeWomen(Object.assign({}, view, { women: { women: 4, marked: 1 } }));
	assert.strictEqual(JSON.stringify(game.state), before);
	assert.ok([...used].every((key) => viewKeys.includes(key)), `used ${[...used]}`);
});

test('with its own random numbers, Jack\'s choices don\'t depend on anything else drawing Math.random', () => {
	const { WC, _ } = loadCore({ seed: 1 });
	const choices = WC.rules.hideoutChoices();
	const run = (interference) => {
		const ai = WC.createJackAI(WC.board, WC.random.create(seededRandom(77)), _);
		const picks = [];
		for (let i = 0; i < 20; i++) {
			if (interference) for (let n = 0; n < i; n++) Math.random(); // Something else using Math.random
			picks.push(ai.chooseHideout(choices));
		}
		return picks;
	};
	assert.deepStrictEqual(run(true), run(false));
});

test('the AI module never touches the page or the engine', () => {
	const source = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'ai', 'jack.js'), 'utf8');
	assert.ok(!/\$\(|jQuery|document|window|WC\.engine|WC\.ui|\.state\b/.test(source));
});
