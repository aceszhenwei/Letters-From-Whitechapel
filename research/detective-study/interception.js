// Offline interception analysis (docs/detective-study.md, section 4), from Detective AI v3's last-night moves recorded
// by experiment.js. No game is played here.
//   node research/detective-study/interception.js <seed set, e.g. 590001-30> [jack ...]
// For each police move on the last night, with the REFEREE's knowledge of Jack's circle p and hideout h (never the
// police's), the question is: could the policemen, each moving at most two crossings and never two on one crossing, have
// stood so that no walk from p reaches h within the moves Jack has left? That is a "cut": he would then run out of moves
// unless he uses a coach or an alley, so the cut is reported with the tokens he still held. The search is exact for
// walks, limited to 20,000 assignments a move (a move that hits the limit is counted as "unknown").
// Each night Jack escaped is classified by its first move where a cut was possible:
//   unavoidable   no cut was possible on any move: no placement of the policemen could wall him off in time
//   inference     a cut was possible, but the police gave his true hideout a low rank (> 3) or his true circle < 20%
//   decision      a cut was possible and the police knew enough (hideout rank <= 3, his circle >= 20%), yet didn't cut
// Also reported: how often v3's own move made a cut, on nights it won and nights it lost.
const fs = require('fs');
const path = require('path');
const { WC, _ } = require('../detective-inference/lib');
const jacks = require('./jacks');

const board = WC.board;
const dir = path.join(__dirname, 'results');

function distance(from, to, blocked, limit) {
	// Fewest walks from circle `from` to circle `to`, never past a blocked crossing; Infinity beyond `limit`
	if (from === to) return 0;
	let frontier = [from];
	const seen = new Set([from]);
	for (let d = 1; d <= limit; d++) {
		const next = [];
		for (const c of frontier) {
			for (const n of board.walk(c, blocked)) {
				if (n === to) return d;
				if (!seen.has(n)) { seen.add(n); next.push(n); }
			}
		}
		frontier = next;
	}
	return Infinity;
}

function cuts(p, h, budget, positions) {
	return distance(p, h, positions, budget) > budget;
}

function findCut(p, h, budget, before, cap = 20000) {
	// Is there a placement of the policemen, each within his reach, that cuts every walk from p to h within the budget?
	// Only crossings beside a circle that some short-enough route passes can matter; the others go anywhere else
	const near = board.numbered().filter((c) => distance(p, c, [], budget) + distance(c, h, [], budget) <= budget);
	const useful = new Set(_.flatten(near.map((c) => board.neighbours(c).filter((x) => !board.isNumbered(x)))));
	const options = before.map((c) => _.uniq([c].concat(board.crossingsWithinTwo(c))).filter((x) => useful.has(x)).concat([null]));
	let checked = 0;
	let found = null;
	function place(i, chosen) {
		if (found || checked > cap) return;
		if (i === options.length) {
			checked++;
			const blocked = chosen.filter((x) => x !== null);
			if (cuts(p, h, budget, blocked)) found = blocked;
			return;
		}
		for (const c of options[i]) {
			if (c !== null && chosen.includes(c)) continue;
			place(i + 1, chosen.concat([c]));
		}
	}
	place(0, []);
	return found ? 'yes' : checked > cap ? 'unknown' : 'no';
}

function main() {
	const [set = '590001-30', ...only] = process.argv.slice(2);
	const list = only.length ? only : jacks.names;
	const lines = [`Last-night interception, Detective AI v3, seeds ${set}. REFEREE'S knowledge used for the analysis only.`, '',
		'| Jack | Last nights | Police won | v3\'s move cut (nights won / lost) | Nights lost | Unavoidable | Inference | Decision | Unknown | Lost nights where Jack still had a coach or alley |',
		'|---|---:|---:|---|---:|---:|---:|---:|---:|---:|'];
	const examples = [];
	for (const jack of list) {
		const file = path.join(dir, `${jack}__v3__${set}.json`);
		if (!fs.existsSync(file)) continue;
		const games = JSON.parse(fs.readFileSync(file, 'utf8')).games.filter((g) => g.lastTurns && g.lastTurns.length);
		const row = { nights: 0, won: 0, cutWon: 0, cutLost: 0, lost: 0, unavoidable: 0, inference: 0, decision: 0, unknown: 0, tokens: 0 };
		for (const g of games) {
			row.nights++;
			const lost = g.result === 'jackWins';
			if (lost) row.lost++; else row.won++;
			const ownCut = g.lastTurns.some((t) => t.after && cuts(t.position, g.home, t.remaining, t.after));
			if (ownCut) { if (lost) row.cutLost++; else row.cutWon++; }
			if (!lost) continue;
			if (g.lastTurns.some((t) => t.tokens.carriages + t.tokens.alleys > 0)) row.tokens++;
			let verdict = 'unavoidable';
			for (const t of g.lastTurns) {
				const possible = findCut(t.position, g.home, t.remaining, t.before);
				if (possible === 'unknown' && verdict === 'unavoidable') verdict = 'unknown';
				if (possible === 'yes') {
					verdict = t.homeRank > 3 || t.jackBelief < 0.2 ? 'inference' : 'decision';
					if (examples.length < 6) examples.push({ jack, seed: g.seed, verdict, remaining: t.remaining, homeRank: t.homeRank, homeBelief: +t.homeBelief.toFixed(3), jackBelief: +t.jackBelief.toFixed(3), candidates: t.homeCandidates });
					break;
				}
			}
			row[verdict]++;
		}
		lines.push(`| ${jack} | ${row.nights} | ${row.won} | ${row.cutWon} / ${row.cutLost} | ${row.lost} | ${row.unavoidable} | ${row.inference} | ${row.decision} | ${row.unknown} | ${row.tokens} |`);
	}
	lines.push('', 'First possible cut in some lost nights:', '', '```', ...examples.map((e) => JSON.stringify(e)), '```');
	const out = lines.join('\n') + '\n';
	fs.writeFileSync(path.join(dir, `interception-${set}.md`), out);
	console.log(out);
}

if (require.main === module) main();

module.exports = { distance, cuts, findCut };
