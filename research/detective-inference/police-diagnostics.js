// Why do the police lose? Splits each police turn into inference and decision, using the referee's view to score
// (never to play: the police AI only gets the police view).
//   - opportunity: after the police moved, a policeman could arrest on Jack's true circle;
//   - belief: the share of the police's own belief (js/core/deduction.js, as js/ai/police.js computes it) on that
//     circle, and whether it was the most likely circle a policeman could arrest on;
//   - decision: what they did with it (arrest there, arrest elsewhere, search).
// Also, at the start of each night from the second on, how much they know about the hideout.
//   node research/detective-inference/police-diagnostics.js <jack> <police> [games, default 200] [first seed, default 1]
//   [--arrestAt x] [--blockWeight x] [--uniformHideouts]   (variants of the deductive police, for the experiments;
//   --uniformHideouts gives every possible hideout the same weight, as whitechapelR does)
const fs = require('fs');
const path = require('path');
const resultsDir = require('./results-dir');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

if (!isMainThread) {
	const { WC, _, play } = require('./lib');
	const hideoutChoices = WC.rules.hideoutChoices();
	const records = [];
	for (const seed of workerData.seeds) {
		const game = { seed, turns: [], nights: [] };
		let lastPhase = null;
		let lastNight = -1;
		const state = play({
			jack: workerData.jack, police: workerData.police, seed, policeOptions: workerData.policeOptions,
			onPolice(st, view) {
				const night = st.police.length - 1;
				if (night !== lastNight && st.phase >= 9) {
					// A new hunt: what the police know about the hideout from earlier nights
					lastNight = night;
					const known = WC.deduction.hideouts(view.pastLogs(), hideoutChoices);
					const p = Object.values(known);
					const truth = known[st.base] || 0;
					game.nights.push({
						night, candidates: p.length, pTruth: truth,
						rank: 1 + p.filter((x) => x > truth).length,
						entropy: WC.deduction.entropy(known),
						uniformPTruth: p.length ? 1 / p.length : 0
					});
				}
				if (st.phase === 11 && lastPhase !== 11 && st.turn && (!st.turn.done || st.turn.done.length === 0)) {
					const truth = WC.rules.jackPosition(st);
					const police = WC.rules.policeNight(st);
					const known = WC.deduction.hideouts(view.pastLogs(), hideoutChoices);
					const belief = WC.deduction.track(view.publicLog(), {
						remaining: view.remainingMoves, hideouts: Object.keys(known).map(Number),
						alleysLeft: view.jackTokens ? view.jackTokens.alleys : 0
					});
					const share = (c) => belief ? (belief.current[c] || 0) : 0;
					const arrestable = _.uniq(_.flatten(police.arrest));
					const best = arrestable.length ? _.max(arrestable, share) : null;
					game.turns.push({
						night, steps: st.jack[night].route.length - st.jack[night].murder.length,
						remaining: st.remainingMoves,
						opportunity: arrestable.includes(truth),
						shareTruth: share(truth), bestShare: best === null ? 0 : share(best), bestIsTruth: best === truth,
						candidates: belief ? belief.size : 0,
						rankTruth: belief ? 1 + Object.values(belief.current).filter((x) => x > share(truth)).length : 0,
						logLength: view.publicLog().length
					});
				}
				lastPhase = st.phase;
			}
		});
		// What happened in each clue phase: read back from the public record
		game.result = state.result.type;
		game.nightsPlayed = state.jack.length;
		game.hideoutDistanceAtEnd = state.over ? WC.board.distance(WC.rules.jackPosition(state), state.base) : null;
		const logs = state.police.map((n, i) => WC.rules.publicLog(state, i));
		game.actions = logs.map((log) => ({
			searches: log.filter((e) => e.type === 'search').length,
			clues: log.filter((e) => e.type === 'search' && e.clue).length,
			failedArrests: log.filter((e) => e.type === 'arrest').length
		}));
		records.push(game);
	}
	parentPort.postMessage(records);
	return;
}

const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf('--' + name); return i === -1 ? undefined : Number(argv[i + 1]); };
const valued = ['--arrestAt', '--blockWeight'];
const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && valued.includes(argv[i - 1])));
const [jack = 'strategic', police = 'deductive'] = positional;
const games = Number(positional[2] || 200);
const from = Number(positional[3] || 1);
const policeOptions = {};
if (flag('arrestAt') !== undefined) policeOptions.arrestAt = flag('arrestAt');
if (flag('blockWeight') !== undefined) policeOptions.blockWeight = flag('blockWeight');
if (argv.includes('--uniformHideouts')) policeOptions.uniformHideouts = true;
const workers = require('os').cpus().length;
const seeds = Array.from({ length: games }, (x, i) => from + i);

Promise.all(Array.from({ length: workers }, (x, w) => new Promise((resolve, reject) => {
	const worker = new Worker(__filename, { workerData: { seeds: seeds.filter((s, i) => i % workers === w), jack, police, policeOptions } });
	worker.on('message', resolve);
	worker.on('error', reject);
}))).then((parts) => {
	const all = parts.flat().sort((a, b) => a.seed - b.seed);
	const mean = (v) => v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
	const pct = (x) => (100 * x).toFixed(1) + '%';
	const turns = all.flatMap((g) => g.turns);
	const opp = turns.filter((t) => t.opportunity);
	const wins = all.filter((g) => g.result === 'jackWins').length;
	const arrests = all.filter((g) => g.result === 'arrested').length;
	const label = `${jack} vs ${police}${Object.keys(policeOptions).length ? ' ' + JSON.stringify(policeOptions) : ''}, seeds ${from}-${from + games - 1}`;
	const lines = [label,
		`  Jack wins ${wins}/${games} (${pct(wins / games)}); arrested ${arrests}, out of moves ${all.filter((g) => g.result === 'outOfMoves').length}`,
		`  clue phases ${turns.length}; with an opportunity (a policeman next to Jack's circle) ${opp.length} (${pct(opp.length / turns.length)}); games with at least one: ${pct(all.filter((g) => g.turns.some((t) => t.opportunity)).length / games)}`,
		`  belief at those opportunities: mean share on his circle ${mean(opp.map((t) => t.shareTruth)).toFixed(3)}; his circle was the likeliest arrestable one ${pct(mean(opp.map((t) => t.bestIsTruth ? 1 : 0)))}; best arrestable share >= 0.2 ${pct(mean(opp.map((t) => t.bestShare >= 0.2 ? 1 : 0)))}`,
		`  opportunities converted into an arrest: ${arrests} of ${opp.length} (${pct(arrests / Math.max(1, opp.length))})`,
		`  belief overall: mean candidates ${mean(turns.map((t) => t.candidates)).toFixed(1)}, mean share on his circle ${mean(turns.map((t) => t.shareTruth)).toFixed(3)}, his circle ranked ${mean(turns.map((t) => t.rankTruth)).toFixed(1)} on average`,
		`  per game: searches ${mean(all.map((g) => g.actions.reduce((s, a) => s + a.searches, 0))).toFixed(1)}, clues ${mean(all.map((g) => g.actions.reduce((s, a) => s + a.clues, 0))).toFixed(1)}, failed arrests ${mean(all.map((g) => g.actions.reduce((s, a) => s + a.failedArrests, 0))).toFixed(2)}`
	];
	for (let n = 1; n <= 3; n++) {
		const nights = all.flatMap((g) => g.nights.filter((x) => x.night === n));
		if (!nights.length) continue;
		lines.push(`  hideout at the start of night ${n + 1} (${nights.length} games): candidates ${mean(nights.map((x) => x.candidates)).toFixed(1)}, P(true hideout) ${mean(nights.map((x) => x.pTruth)).toFixed(3)} (uniform over candidates would give ${mean(nights.map((x) => x.uniformPTruth)).toFixed(3)}), rank ${mean(nights.map((x) => x.rank)).toFixed(1)}, entropy ${mean(nights.map((x) => x.entropy)).toFixed(2)} bits`);
	}
	console.log(lines.join('\n'));
	const name = `police-${jack}-${police}${policeOptions.arrestAt !== undefined ? '-arrest' + policeOptions.arrestAt : ''}${policeOptions.blockWeight !== undefined ? '-block' + policeOptions.blockWeight : ''}${policeOptions.uniformHideouts ? '-uniform' : ''}-${from}-${games}`;
	fs.writeFileSync(path.join(resultsDir, name + '.json'), JSON.stringify(all));
	fs.writeFileSync(path.join(resultsDir, name + '.txt'), lines.join('\n') + '\n');
});
