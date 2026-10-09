// What Jack AI v2 costs: the time of each of Jack's move decisions, on one thread (nothing else running), against
// Detective AI v2, compared with the strategic Jack and Detour Jack on the same seeds. Broken down by the situations
// most likely to be slow: late in the night, with coaches or alleys in hand, and with the hideout walled off.
//   node research/jack-v2/benchmark.js [games, default 40] [first seed, default 800301]
const fs = require('fs');
const path = require('path');
const { recordGame } = require('./record');

const games = Number(process.argv[2] || 40);
const from = Number(process.argv[3] || 800301);
const stats = (v) => {
	const s = v.slice().sort((a, b) => a - b);
	const at = (q) => (s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0);
	return `${String(s.length).padStart(5)} decisions, mean ${(s.reduce((a, b) => a + b, 0) / Math.max(1, s.length)).toFixed(1)} ms, p95 ${at(0.95).toFixed(1)}, p99 ${at(0.99).toFixed(1)}, max ${(s[s.length - 1] || 0).toFixed(1)}`;
};
const lines = [`Jack decision times (ms) against Detective AI v2, seeds ${from}-${from + games - 1}, one thread`];
const started = Date.now();
for (const jack of ['strategic', 'detour', 'jack-v2']) {
	const decisions = [];
	for (let seed = from; seed < from + games; seed++) decisions.push(...recordGame({ jack, police: 'v2', seed }).decisions);
	lines.push(`  ${jack}:`);
	lines.push(`    all                              ${stats(decisions.map((d) => d.ms))}`);
	lines.push(`    late in the night (3 or fewer left) ${stats(decisions.filter((d) => d.remaining <= 3).map((d) => d.ms))}`);
	lines.push(`    moving by coach or alley         ${stats(decisions.filter((d) => d.type !== 'walk').map((d) => d.ms))}`);
	lines.push(`    hideout walled off by policemen  ${stats(decisions.filter((d) => d.blockedSlack === -99).map((d) => d.ms))}`);
}
lines.push(`  ${((Date.now() - started) / 1000).toFixed(0)} s in all`);
console.log(lines.join('\n'));
fs.writeFileSync(path.join(__dirname, 'results', 'benchmark.txt'), lines.join('\n') + '\n');
