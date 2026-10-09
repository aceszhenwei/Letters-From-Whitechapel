// Smoke tests: a minute or so of small simulations that catch a broken AI, police, deduction or research harness
// before anything expensive runs. Seeds 800001 and up are kept for this (tools/tiers/tiers.js).
//   node tools/tiers/smoke.js
const { loadCore, runGame } = require('../sim/run-game');
const { WC, _, play, publicPrefixes, enumerate, registerJack } = require('../../research/detective-inference/lib');
const jackV2 = require('../../research/jack-v2/policies/jack-v2'); // Loads js/ai/jack-v2.js into the research core

registerJack('jack-v2', jackV2.policies['jack-v2']);

const results = new Set(['jackWins', 'arrested', 'outOfMoves', 'trapped']);
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };
const timed = (label, fn) => {
	const t = Date.now();
	fn();
	console.log(`  ${label}: ${((Date.now() - t) / 1000).toFixed(1)} s`);
};

const core = loadCore();
const seeds = [800001, 800002, 800003, 800004];

timed('every Jack against every police, 4 games each', () => {
	for (const jack of ['baseline', 'strategic']) {
		for (const police of ['deductive', 'random']) {
			for (const seed of seeds) {
				const game = runGame(core, { jack, police, seed });
				check(results.has(game.result), `${jack} vs ${police}, seed ${seed}: ended "${game.result}"`);
				check(game.decisions.length > 0, `${jack} vs ${police}, seed ${seed}: Jack never moved`);
			}
		}
	}
});

timed('the same seed plays the same game', () => {
	for (const jack of ['baseline', 'strategic']) {
		const a = runGame(core, { jack, police: 'deductive', seed: seeds[0] });
		const b = runGame(core, { jack, police: 'deductive', seed: seeds[0] });
		const key = (g) => JSON.stringify([g.result, g.nights, g.decisions.map((d) => [d.type, d.mapid])]);
		check(key(a) === key(b), `${jack}: seed ${seeds[0]} played two different games`);
	}
});

timed('the deduction never loses Jack, and matches the exhaustive reference', () => {
	for (const seed of seeds.slice(0, 2)) {
		const state = play({ jack: 'strategic', police: 'deductive', seed });
		for (const item of publicPrefixes(state)) {
			const known = WC.deduction.track(item.prefix, {});
			check(known.current[item.truth] > 0, `seed ${seed}, night ${item.night + 1}, step ${item.steps}: true circle ruled out`);
			if (item.steps > 5) continue;
			const reference = enumerate(item.prefix, 1e5);
			if (reference) {
				check(Object.keys(reference.circles).every((c) => known.current[c] > 0), `seed ${seed}, step ${item.steps}: deduction misses a possible circle`);
			}
		}
	}
});

timed('Detective AI v2 and the study\'s improved police play whole games', () => {
	for (const jack of ['baseline', 'strategic']) {
		for (const seed of seeds.slice(0, 2)) {
			for (const [label, policeOptions] of [['v2', WC.policeVariants.v2], ['improved', { blockWeight: 1, uniformHideouts: true }]]) {
				const state = play({ jack, police: 'deductive', seed, policeOptions });
				check(state.over && results.has(state.result.type), `${jack}, ${label} police, seed ${seed}: did not finish`);
			}
		}
	}
});

timed('Jack AI v2 plays whole games against both police, the same way twice', () => {
	for (const policeOptions of [WC.policeVariants.v2, WC.policeVariants.original]) {
		for (const seed of seeds.slice(0, 2)) {
			const a = play({ jack: 'jack-v2', police: 'deductive', seed, policeOptions });
			const b = play({ jack: 'jack-v2', police: 'deductive', seed, policeOptions });
			check(a.over && results.has(a.result.type), `jack-v2, seed ${seed}: did not finish`);
			const key = (s) => JSON.stringify([s.result, s.jack.map((n) => n.route)]);
			check(key(a) === key(b), `jack-v2, seed ${seed}: played two different games`);
		}
	}
});

timed('Detective AI v3 plays whole games against every Jack, and stops the hideout-134 scheme', () => {
	const shortReturn = require('../../research/detective-v3/jacks');
	const bgg = require('../../research/human-strategy/policies');
	registerJack('short-return', shortReturn['short-return']);
	registerJack('bgg-134', bgg['bgg-134']);
	for (const jack of ['baseline', 'strategic', 'jack-v2', 'short-return']) {
		const state = play({ jack, police: 'deductive', seed: seeds[0], policeOptions: WC.policeVariants.v3 });
		check(state.over && results.has(state.result.type), `${jack} vs Detective AI v3: did not finish`);
	}
	const scheme = play({ jack: 'bgg-134', police: 'deductive', seed: seeds[0], policeOptions: WC.policeVariants.v3 });
	check(scheme.result.type !== 'jackWins', 'Detective AI v3 no longer stops the hideout-134 scheme');
});

timed('Strategic waiting plays whole games against Detective AI v3, the same way twice', () => {
	require('../../research/jack-waiting/jacks'); // Loads js/ai/jack-waiting.js into the research core
	registerJack('jack-v2-waiting', (random) => WC.createWaitingJack(WC.board, jackV2.policies['jack-v2'](random), _, { table: 'jack-v2' }));
	for (const seed of seeds.slice(0, 2)) {
		const a = play({ jack: 'jack-v2-waiting', police: 'deductive', seed, policeOptions: WC.policeVariants.v3 });
		const b = play({ jack: 'jack-v2-waiting', police: 'deductive', seed, policeOptions: WC.policeVariants.v3 });
		check(a.over && results.has(a.result.type), `jack-v2-waiting, seed ${seed}: did not finish`);
		const key = (s) => JSON.stringify([s.result, s.jack.map((n) => [n.murderMove, n.route])]);
		check(key(a) === key(b), `jack-v2-waiting, seed ${seed}: played two different games`);
	}
});

if (failures.length) {
	console.error(`Smoke tests FAILED:\n  ${failures.join('\n  ')}`);
	process.exit(1);
}
console.log('Smoke tests passed');
