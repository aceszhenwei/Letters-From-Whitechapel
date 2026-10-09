// The cost of the coach fix: times the deduction before the fix (git revision given) and now on the same public
// records, every prefix of every night of 20 seeded games (strategic Jack, deductive police).
//   node research/detective-v2/deduction-benchmark.js [revision before the fix, default 5992649]
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');
const resultsDir = require('../detective-inference/results-dir');
const { play, publicPrefixes } = require('../detective-inference/lib');

const root = path.join(__dirname, '..', '..');
const revision = process.argv[2] || '5992649';
function core(deductionSource) {
	const context = vm.createContext({ console });
	for (const file of ['js/vendor/underscore-min.js', 'js/data/map.js', 'js/core/board.js']) {
		vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
	}
	vm.runInContext(deductionSource, context);
	return context.WC.deduction;
}
const before = core(execSync(`git show ${revision}:js/core/deduction.js`, { cwd: root, encoding: 'utf8' }));
const after = core(fs.readFileSync(path.join(root, 'js/core/deduction.js'), 'utf8'));

const prefixes = [];
for (let seed = 700001; seed <= 700020; seed++) prefixes.push(...publicPrefixes(play({ jack: 'strategic', police: 'deductive', seed })).map((p) => p.prefix));
const time = (deduction) => {
	for (const p of prefixes.slice(0, 200)) deduction.track(p, {}); // Warm up
	const t = process.hrtime.bigint();
	let circles = 0;
	for (const p of prefixes) circles += deduction.track(p, {}).size;
	return { ms: Number(process.hrtime.bigint() - t) / 1e6, circles };
};
const a = time(before);
const b = time(after);
const lines = [
	`${prefixes.length} public records from 20 games (strategic Jack, seeds 700001-700020)`,
	`  before the fix (${revision}): ${a.ms.toFixed(0)} ms in all, ${(a.ms / prefixes.length).toFixed(3)} ms a record, ${(a.circles / prefixes.length).toFixed(1)} possible circles on average`,
	`  after the fix: ${b.ms.toFixed(0)} ms in all, ${(b.ms / prefixes.length).toFixed(3)} ms a record, ${(b.circles / prefixes.length).toFixed(1)} possible circles on average`
];
console.log(lines.join('\n'));
fs.writeFileSync(path.join(resultsDir, 'deduction-benchmark.txt'), lines.join('\n') + '\n');
