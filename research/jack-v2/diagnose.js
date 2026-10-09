// Phase 1 diagnosis (docs/jack-ai-v2.md): why Strategic Jack loses to Detective AI v2, from the stored records of
// run.js. Compares Strategic Jack with Detour Jack on the same seeds, and classifies every lost night.
//   node research/jack-v2/diagnose.js [police, default v2] [jacks, default strategic,detour] [games] [first seed]
const fs = require('fs');
const path = require('path');
const { run } = require('./run');

const [police = 'v2', jackList = 'strategic,detour', gamesText = '200', fromText = '1'] = process.argv.slice(2);
const jacks = jackList.split(',');
const games = Number(gamesText);
const from = Number(fromText);
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '-');
const mean = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN);
const fmt = (x, d = 2) => (isNaN(x) ? '-' : x.toFixed(d));
const lines = [];
const say = (s = '') => lines.push(s);

// The main cause of a lost night, from the referee's record (in this order; the first that applies)
function classify(n, g) {
	if (n.outcome === 'arrested') {
		const last = g.decisions.filter((d) => d.night === n.night).pop();
		if (last && last.distAfter <= 1) return 'arrest: next to home';
		return last && last.share >= 0.275 ? 'arrest: exposed (police share >= 0.275)' : 'arrest: low police share';
	}
	if (n.outcome === 'trapped') return 'trapped';
	const startSlack = n.movesAvailable - n.startDistance;
	if (startSlack <= 1) return 'out of moves: no slack from the start (<= 1)';
	if (n.minBlockedSlack !== null && n.minBlockedSlack < 0) {
		return n.finalDistance <= 2 ? 'out of moves: walled off, ended next to home (<= 2)' : 'out of moves: walled off, ended far from home';
	}
	return 'out of moves: route open, ran out (wasted moves)';
}

async function main() {
	const data = {};
	for (const jack of jacks) data[jack] = (await run({ jack, police, games, from, quiet: true })).games;
	say(`# Diagnosis: ${jacks.join(' vs ')} against police "${police}", seeds ${from}-${from + games - 1}`);
	say();
	say('## Outcomes');
	say();
	say('| Jack | Wins | Arrested (night 1/2/3/4) | Out of moves (1/2/3/4) | Trapped |');
	say('|---|---:|---:|---:|---:|');
	for (const jack of jacks) {
		const g = data[jack];
		const by = (type) => [0, 1, 2, 3].map((k) => g.filter((x) => x.result === type && x.night === k + 1).length).join('/');
		say(`| ${jack} | ${pct(g.filter((x) => x.result === 'jackWins').length, g.length)} | ${g.filter((x) => x.result === 'arrested').length} (${by('arrested')}) | ${g.filter((x) => x.result === 'outOfMoves').length} (${by('outOfMoves')}) | ${g.filter((x) => x.result === 'trapped').length} |`);
	}
	say();
	say('## Each night: survival, how predictable the hideout was, and how the police stood');
	say();
	say('Hideout candidates and belief: Detective AI v2\'s view (hybrid weights) at the start of the night. Entry guarded: share of police turns ending with a policeman on a crossing next to the hideout. Detour: moves used beyond the walking distance from the crime scene, on nights he escaped.');
	say();
	say('| Jack | Night | Reached | Survived | Hideout candidates (median) | v2 belief on true hideout (mean) | Rank 1 | Entry guarded | Slack at start (mean) | Detour when escaped (mean) | Coaches / alleys used (of held) |');
	say('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
	for (const jack of jacks) {
		for (let k = 0; k < 4; k++) {
			const nights = data[jack].flatMap((g) => g.nights.filter((n) => n.night === k));
			if (!nights.length) continue;
			const median = (v) => { const s = v.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
			const esc = nights.filter((n) => n.escaped);
			const held = nights.reduce((s, n) => s + n.tokens.carriages, 0);
			const heldA = nights.reduce((s, n) => s + n.tokens.alleys, 0);
			say(`| ${jack} | ${k + 1} | ${nights.length} | ${pct(esc.length, nights.length)} | ${median(nights.map((n) => n.hideoutCandidates))} | ${fmt(mean(nights.map((n) => n.hideoutBelief)))} | ${pct(nights.filter((n) => n.hideoutRank === 1).length, nights.length)} | ${pct(mean(nights.map((n) => n.entryGuarded)), 1)} | ${fmt(mean(nights.map((n) => n.movesAvailable - n.startDistance)), 1)} | ${fmt(mean(esc.map((n) => n.detour)), 1)} | ${pct(nights.reduce((s, n) => s + n.carriages, 0), held)} / ${pct(nights.reduce((s, n) => s + n.alleys, 0), heldA)} |`);
		}
	}
	say();
	say('## Lost nights by main cause');
	say();
	for (const jack of jacks) {
		const lost = data[jack].map((g) => ({ g, n: g.nights[g.nights.length - 1] })).filter(({ g }) => g.result !== 'jackWins');
		const causes = {};
		for (const { g, n } of lost) (causes[classify(n, g)] = causes[classify(n, g)] || []).push(g.seed);
		say(`**${jack}** (${lost.length} lost games)`);
		say();
		for (const [cause, seeds] of Object.entries(causes).sort((a, b) => b[1].length - a[1].length)) say(`- ${cause}: ${seeds.length} (e.g. seeds ${seeds.slice(0, 5).join(', ')})`);
		const walled = lost.filter(({ n }) => n.outcome === 'outOfMoves' && n.minBlockedSlack !== null && n.minBlockedSlack < 0);
		if (walled.length) {
			say(`- When walled-off nights lost their last open route: after ${fmt(mean(walled.map(({ n }) => n.firstNoRoute)), 1)} moves on average, of ${fmt(mean(walled.map(({ n }) => n.movesAvailable)), 1)} available; unused coaches at the end ${fmt(mean(walled.map(({ n }) => n.tokens.carriages - n.carriages)), 2)}, alleys ${fmt(mean(walled.map(({ n }) => n.tokens.alleys - n.alleys)), 2)}`);
		}
		say();
	}
	say('## Arrest risk: Strategic Jack\'s measured table against what happened');
	say();
	say('Each of Jack\'s moves, by the arrest chance his table predicts (fitted against the original police), and how often the police arrested him straight after it.');
	say();
	say('| Jack | Predicted risk | Moves | Predicted (mean) | Arrested next |');
	say('|---|---|---:|---:|---:|');
	for (const jack of jacks) {
		const ds = data[jack].flatMap((g) => g.decisions);
		for (const [lo, hi] of [[0, 0.01], [0.01, 0.05], [0.05, 0.2], [0.2, 0.5], [0.5, 1.01]]) {
			const bin = ds.filter((d) => d.predictedRisk >= lo && d.predictedRisk < hi);
			say(`| ${jack} | ${lo}–${Math.min(1, hi)} | ${bin.length} | ${fmt(mean(bin.map((d) => d.predictedRisk)), 3)} | ${pct(bin.filter((d) => d.arrestedNext).length, bin.length)} |`);
		}
	}
	say();
	say('## The night before the loss: did the hideout give itself away?');
	say();
	say('| Jack | Lost on night | Games | v2 belief on true hideout at the start | Hideout candidates (mean) |');
	say('|---|---:|---:|---:|---:|');
	for (const jack of jacks) {
		for (const k of [1, 2, 3]) {
			const lost = data[jack].filter((g) => g.result !== 'jackWins' && g.night === k + 1).map((g) => g.nights[g.nights.length - 1]);
			const won = data[jack].flatMap((g) => g.nights.filter((n) => n.night === k && n.escaped));
			say(`| ${jack} | ${k + 1} | ${lost.length} lost / ${won.length} survived | ${fmt(mean(lost.map((n) => n.hideoutBelief)))} / ${fmt(mean(won.map((n) => n.hideoutBelief)))} | ${fmt(mean(lost.map((n) => n.hideoutCandidates)), 1)} / ${fmt(mean(won.map((n) => n.hideoutCandidates)), 1)} |`);
		}
	}
	say();
	say('## Hideouts');
	say();
	for (const jack of jacks) {
		const by = {};
		for (const g of data[jack]) (by[g.hideout] = by[g.hideout] || []).push(g.result === 'jackWins' ? 1 : 0);
		const list = Object.entries(by).filter(([, v]) => v.length >= 3).sort((a, b) => mean(a[1]) - mean(b[1]));
		say(`**${jack}**: ${Object.keys(by).length} different hideouts over ${data[jack].length} games; with 3 or more games, the worst: ${list.slice(0, 5).map(([h, v]) => `${h} (${v.reduce((a, b) => a + b, 0)}/${v.length})`).join(', ')}; the best: ${list.slice(-5).map(([h, v]) => `${h} (${v.reduce((a, b) => a + b, 0)}/${v.length})`).join(', ')}`);
		say();
	}
	const ms = jacks.map((jack) => { const v = data[jack].flatMap((g) => g.decisions.map((d) => d.ms)).sort((a, b) => a - b); return `${jack} mean ${fmt(mean(v))} ms, p99 ${fmt(v[Math.floor(0.99 * v.length)])} ms, max ${fmt(v[v.length - 1])} ms`; });
	say(`Decision times: ${ms.join('; ')}`);
	const out = path.join(__dirname, 'results', `diagnosis-${police}-${from}-${games}.md`);
	fs.writeFileSync(out, lines.join('\n') + '\n');
	console.log(lines.join('\n'));
}
main();
