// Compares simulation runs side by side (files written by tools/simulate.js --out), and tests whether the first
// two differ, pairing games by seed (McNemar's test: only seeds where one wins and the other loses count).
//
//   node tools/sim/compare.js experiments/baseline-deductive.json experiments/strategic-deductive.json [...]
const fs = require('fs');
const path = require('path');

const files = process.argv.slice(2);
if (files.length < 2) {
	console.error('Usage: node tools/sim/compare.js a.json b.json [...]');
	process.exit(1);
}
const runs = files.map((file) => Object.assign(JSON.parse(fs.readFileSync(file, 'utf8')), { name: path.basename(file, '.json') }));

const pct = (x) => (100 * x).toFixed(1) + '%';
const rows = [
	['Jack win rate', (s) => pct(s.jackWinRate)],
	['95% interval', (s) => `${pct(s.jackWinInterval[0])}-${pct(s.jackWinInterval[1])}`],
	['Police win rate', (s) => pct(s.policeWins / s.games)],
	['Lost: arrested', (s) => pct(s.losses.arrested / s.games)],
	['Lost: out of moves', (s) => pct(s.losses.outOfMoves / s.games)],
	['Lost: trapped', (s) => pct(s.losses.trapped / s.games)],
	['Nights escaped per game', (s) => s.nightsEscaped.toFixed(2)],
	['Lost games end on night', (s) => s.endNight.toFixed(2)],
	['... after move', (s) => s.endMove.toFixed(1)],
	['Moves to hideout (escaped nights)', (s) => s.movesToHideout.toFixed(1)],
	['Shortest possible', (s) => s.shortestPossible.toFixed(1)],
	['Distance to hideout per move', (s) => s.distanceToHideout.toFixed(2)],
	['Coaches per game', (s) => s.coachesPerGame.toFixed(2)],
	['Alleys per game', (s) => s.alleysPerGame.toFixed(2)],
	['Moves with every option in reach', (s) => pct(s.forcedDanger)],
	['Moves onto a circle in reach', (s) => pct(s.chosenDanger)],
	['Police candidates for his circle', (s) => s.policeCandidates.toFixed(1)],
	['Possible hideouts after the game', (s) => s.hideoutCandidates.toFixed(1)],
	['Decision time mean / p95 / max (ms)', (s) => `${s.decisionMs.mean.toFixed(1)} / ${s.decisionMs.p95.toFixed(1)} / ${s.decisionMs.max.toFixed(0)}`]
];

console.log('| Metric | ' + runs.map((r) => r.name).join(' | ') + ' |');
console.log('|---|' + runs.map(() => '---:').join('|') + '|');
for (const [label, get] of rows) {
	console.log(`| ${label} | ${runs.map((r) => get(r.summary)).join(' | ')} |`);
}

// McNemar's test on the first two runs, paired by seed
const [a, b] = runs;
const wins = (run) => new Map(run.games.map((g) => [g[0], g[1] === 'jackWins']));
const winsA = wins(a);
const winsB = wins(b);
let onlyA = 0;
let onlyB = 0;
let paired = 0;
for (const [seed, wonA] of winsA) {
	if (!winsB.has(seed)) continue;
	paired++;
	if (wonA && !winsB.get(seed)) onlyA++;
	if (!wonA && winsB.get(seed)) onlyB++;
}
// Exact two-sided binomial test of onlyA against onlyB (in logs, to stay accurate with thousands of games)
const n = onlyA + onlyB;
const logChoose = (n, k) => { let s = 0; for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i); return s; };
let tail = 0;
for (let k = 0; k <= Math.min(onlyA, onlyB); k++) tail += Math.exp(logChoose(n, k) - n * Math.log(2));
const p = Math.min(1, 2 * tail);
console.log(`\nPaired by seed (${paired} seeds): only ${a.name} won ${onlyA}, only ${b.name} won ${onlyB}; ` +
	`McNemar exact p = ${p < 1e-12 ? '< 1e-12' : p.toPrecision(3)}`);
