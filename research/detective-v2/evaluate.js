// Plays seeded games between a Jack and a police configuration (configs.js) and records what happened: who won and
// how, arrests and their success, clues, and how well the police covered the likely hideouts. The referee's view
// (Jack's true circle and hideout) is used only to measure, never to play.
//   node research/detective-v2/evaluate.js <jack: baseline|strategic|detour> <config> [games, default 300] [first seed, default 300001]
// Writes results/v2-<jack>-<config>-<first seed>-<games>.json (per game) and .txt (summary).
const fs = require('fs');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

if (!isMainThread) {
	require('./jacks');
	const configs = require('./configs');
	const { WC, _, play } = require('../detective-inference/lib');
	const records = [];
	for (const seed of workerData.seeds) {
		const g = { seed, guarded: [], guardedTrue: [] };
		const onPolice = (st, view) => {
			// After the police have moved (the clue phase starts), how much of the hideouts' weight is guarded: a hideout
			// counts as guarded when a policeman stands on a crossing next to it
			if (st.phase !== 11 || (st.turn.done && st.turn.done.length)) return;
			const night = st.police.length - 1;
			if (night === 0) return;
			const homes = WC.deduction.hideouts(view.pastLogs(), WC.rules.hideoutChoices(), { weighting: 'uniform' });
			const now = WC.rules.policeNight(st).now;
			const near = (home) => now.some((x) => WC.board.neighbours(Number(home)).includes(x));
			g.guarded.push(_.reduce(homes, (sum, p, home) => sum + (near(home) ? p : 0), 0));
			g.guardedTrue.push(near(st.base) ? 1 : 0);
		};
		const state = play({ jack: workerData.jack, police: 'deductive', seed, policeOptions: configs[workerData.config], onPolice });
		const logs = state.police.map((n, i) => WC.rules.publicLog(state, i));
		g.result = state.result.type;
		g.night = state.jack.length;
		g.clues = logs.reduce((n, log) => n + log.filter((e) => e.type === 'search' && e.clue).length, 0);
		g.searches = logs.reduce((n, log) => n + log.filter((e) => e.type === 'search').length, 0);
		g.failedArrests = logs.reduce((n, log) => n + log.filter((e) => e.type === 'arrest').length, 0);
		g.arrests = g.failedArrests + (g.result === 'arrested' ? 1 : 0);
		// Kept from home: Jack ran out of moves; with a policeman on a crossing next to his hideout at the end
		g.blockedAtHome = g.result === 'outOfMoves' && WC.rules.policeNight(state).now.some((x) => WC.board.neighbours(state.base).includes(x));
		g.distanceHome = state.over ? WC.board.distance(WC.rules.jackPosition(state), state.base) : null;
		g.guarded = g.guarded.length ? g.guarded.reduce((a, b) => a + b, 0) / g.guarded.length : null;
		g.guardedTrue = g.guardedTrue.length ? g.guardedTrue.reduce((a, b) => a + b, 0) / g.guardedTrue.length : null;
		records.push(g);
	}
	parentPort.postMessage(records);
	return;
}

const resultsDir = require('../detective-inference/results-dir');
const { wilson } = require('../../tools/sim/summarise');
const [jack, config, gamesText, fromText] = process.argv.slice(2);
const configs = require('./configs');
if (!jack || !configs[config]) {
	console.error(`Usage: node research/detective-v2/evaluate.js <baseline|strategic|detour> <${Object.keys(configs).join('|')}> [games] [first seed]`);
	process.exit(1);
}
const games = Number(gamesText || 300);
const from = Number(fromText || 300001);
const workers = require('os').cpus().length;
const seeds = Array.from({ length: games }, (x, i) => from + i);
const started = Date.now();

Promise.all(Array.from({ length: workers }, (x, w) => new Promise((resolve, reject) => {
	const worker = new Worker(__filename, { workerData: { seeds: seeds.filter((s, i) => i % workers === w), jack, config } });
	worker.on('message', resolve);
	worker.on('error', reject);
}))).then((parts) => {
	const all = parts.flat().sort((a, b) => a.seed - b.seed);
	const mean = (v) => v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
	const pct = (x) => (100 * x).toFixed(1) + '%';
	const count = (f) => all.filter(f).length;
	const wins = count((g) => g.result === 'jackWins');
	const ci = wilson(wins, games);
	const byNight = [1, 2, 3, 4].map((n) => count((g) => g.result !== 'jackWins' && g.night === n));
	const lines = [
		`${jack} Jack vs police "${config}" ${JSON.stringify(configs[config])}, seeds ${from}-${from + games - 1}`,
		`  Jack wins ${wins}/${games} (${pct(wins / games)}, 95% CI ${pct(ci[0])}-${pct(ci[1])}); police win by arrest ${count((g) => g.result === 'arrested')}, Jack out of moves ${count((g) => g.result === 'outOfMoves')} (with a policeman next to his hideout ${count((g) => g.blockedAtHome)}), trapped ${count((g) => g.result === 'trapped')}`,
		`  police wins by night: ${byNight.join(' / ')}`,
		`  per game: clues ${mean(all.map((g) => g.clues)).toFixed(2)}, searches ${mean(all.map((g) => g.searches)).toFixed(1)}, arrest attempts ${mean(all.map((g) => g.arrests)).toFixed(2)} (successful ${pct(count((g) => g.result === 'arrested') / Math.max(1, all.reduce((n, g) => n + g.arrests, 0)))})`,
		`  from night 2: share of the possible hideouts with a policeman next to them ${pct(mean(all.filter((g) => g.guarded !== null).map((g) => g.guarded)))}; turns with one next to the true hideout ${pct(mean(all.filter((g) => g.guardedTrue !== null).map((g) => g.guardedTrue)))}`,
		`  ${((Date.now() - started) / 1000).toFixed(0)} s`
	];
	console.log(lines.join('\n'));
	const name = `v2-${jack}-${config}-${from}-${games}`;
	fs.writeFileSync(path.join(resultsDir, name + '.json'), JSON.stringify(all));
	fs.writeFileSync(path.join(resultsDir, name + '.txt'), lines.join('\n') + '\n');
});
