// Offline scoring of the police's hideout belief (docs/detective-study.md, section 3), from the public records of the
// games experiment.js played against Detective AI v3. No game is played here.
//   node research/detective-study/calibration.js <seed set, e.g. 590001-30> [jack ...]
// At the start of nights 2, 3 and 4 (after 1, 2 and 3 escapes), each model's belief over the possible hideouts is
// scored against Jack's true hideout:
//   P(true)   the weight on the true hideout          rank      its place among the candidates (1 = likeliest)
//   log loss  -ln P(true) (lower is better)           Brier     sum over candidates of (p - truth)^2 (lower is better)
// The candidate set is the deduction's exact set (deduction.hideouts): every model weights the same set, so a low P(true)
// is a weighting failure, never a deduction error. Models:
//   hybrid        Detective AI v2 and v3's weighting (w 0.9, rho 0.5)
//   conservative  the same with half the weight (w 0.45)
//   gentle        the same with a slower decline (rho 0.75)
//   uniform       every candidate alike
//   walk          the original police's weighting (as if Jack wandered)
//   adaptive      a small mixture over three route styles (direct, loose, uniform), each a proper likelihood of the
//                 night's move count given the hideout, whose weights are learnt from the earlier nights of the same
//                 game. Uses only the public record. The test of whether learning a Jack's style is feasible
//   oracle-style  ORACLE, NOT A POLICY: for each Jack, the fixed model that scored best on that Jack (it knows which
//                 Jack it faces). The most any choice of fixed weighting could gain
const fs = require('fs');
const path = require('path');
const { WC, _ } = require('../detective-inference/lib');
const jacks = require('./jacks');

const dir = path.join(__dirname, 'results');
const [set = '590001-30', ...only] = process.argv.slice(2);
const choices = WC.rules.hideoutChoices();
const maxMoves = 19; // At most 19 moves after a murder (killing on V)

const fixed = {
	hybrid: { weighting: 'hybrid', w: 0.9, rho: 0.5 },
	conservative: { weighting: 'hybrid', w: 0.45, rho: 0.5 },
	gentle: { weighting: 'hybrid', w: 0.9, rho: 0.75 },
	uniform: { weighting: 'uniform' },
	walk: { weighting: 'walk' }
};

function nightMoves(log) {
	// The night's scenes and how many move-track spaces Jack used (a coach two), from the public record
	const night = WC.deduction.readLog(log);
	return { scenes: night.scenes, moves: night.steps.length };
}

// Route styles for the adaptive model: the chance of using n moves to reach a hideout at walking distance d.
// A proper distribution over n (from d to maxMoves), so styles can be compared on the same evidence
const styles = {
	direct: (n, d) => mixture(n, d, 0.9, 0.5),
	loose: (n, d) => mixture(n, d, 0.9, 0.85),
	uniform: (n, d) => (n >= d && n <= maxMoves ? 1 / (maxMoves - d + 1) : 0)
};
function mixture(n, d, w, rho) {
	if (n < d || n > maxMoves) return 0;
	const span = maxMoves - d + 1;
	const geometric = (1 - rho) * Math.pow(rho, n - d) / (1 - Math.pow(rho, span));
	return (1 - w) / span + w * geometric;
}

function adaptive(pastLogs) {
	// Joint posterior over (style, hideout), from a uniform prior over both, then the hideout marginal
	const possible = Object.keys(WC.deduction.hideouts(pastLogs, choices, { weighting: 'uniform' })).map(Number);
	const nights = pastLogs.filter((log) => _.findWhere(log, { type: 'escaped' })).map(nightMoves);
	const post = {};
	let total = 0;
	for (const h of possible) {
		let mass = 0;
		for (const style of Object.values(styles)) {
			let l = 1;
			for (const night of nights) {
				const d = _.min(night.scenes.map((s) => WC.board.distance(s, h)));
				l *= style(night.moves, d);
			}
			mass += l / Object.keys(styles).length;
		}
		post[h] = mass;
		total += mass;
	}
	if (total === 0) return _.object(possible, possible.map(() => 1 / possible.length));
	_.each(post, (v, h) => { post[h] = v / total; });
	return post;
}

function score(belief, home) {
	const p = belief[home] || 0;
	const ranked = _.sortBy(Object.keys(belief), (h) => -belief[h]);
	const sumSq = _.reduce(belief, (s, q) => s + q * q, 0);
	return { p, rank: ranked.indexOf(String(home)) + 1, size: ranked.length, log: -Math.log(Math.max(p, 1e-9)), brier: 1 - 2 * p + sumSq };
}

function main() {
	const list = only.length ? only : jacks.names;
	const rows = {}; // jack -> night -> model -> [scores]
	for (const jack of list) {
		const file = path.join(dir, `${jack}__v3__${set}.json`);
		if (!fs.existsSync(file)) continue;
		for (const game of JSON.parse(fs.readFileSync(file, 'utf8')).games) {
			for (let night = 1; night <= 3; night++) {
				if (game.logs.length <= night) break; // The game ended before this night began
				const past = game.logs.slice(0, night);
				const models = _.mapObject(fixed, (options) => WC.deduction.hideouts(past, choices, options));
				models.adaptive = adaptive(past);
				for (const [name, belief] of Object.entries(models)) {
					const s = score(belief, game.home);
					((((rows[jack] = rows[jack] || {})[night + 1] = rows[jack][night + 1] || {})[name] = rows[jack][night + 1][name] || [])).push(s);
				}
			}
		}
	}

	const mean = (list, key) => list.reduce((s, x) => s + x[key], 0) / list.length;
	const median = (list, key) => _.sortBy(list.map((x) => x[key]), _.identity)[Math.floor(list.length / 2)];
	const lines = [`Hideout belief at the start of each night, games against Detective AI v3 on seeds ${set}.`, '',
		'| Jack | Night | Games | Candidates (median) | Model | P(true), mean | Rank, median | Log loss | Brier |', '|---|---:|---:|---:|---|---:|---:|---:|---:|'];
	const totals = {}; // model -> [scores], over every Jack and night
	for (const [jack, nights] of Object.entries(rows)) {
		for (const [night, models] of Object.entries(nights)) {
			for (const [name, scores] of Object.entries(models)) {
				(totals[name] = totals[name] || []).push(...scores);
				lines.push(`| ${jack} | ${night} | ${scores.length} | ${median(scores, 'size')} | ${name} | ${(100 * mean(scores, 'p')).toFixed(1)}% | ${median(scores, 'rank')} | ${mean(scores, 'log').toFixed(2)} | ${mean(scores, 'brier').toFixed(3)} |`);
			}
		}
	}
	// The oracle choice of fixed model per Jack, by mean log loss over that Jack's nights
	lines.push('', '| Model | Nights scored | P(true), mean | Log loss | Brier |', '|---|---:|---:|---:|---:|');
	for (const [name, scores] of Object.entries(totals)) {
		lines.push(`| ${name} | ${scores.length} | ${(100 * mean(scores, 'p')).toFixed(1)}% | ${mean(scores, 'log').toFixed(3)} | ${mean(scores, 'brier').toFixed(4)} |`);
	}
	const oracle = [];
	const picks = [];
	for (const [jack, nights] of Object.entries(rows)) {
		const all = (name) => Object.values(nights).flatMap((m) => m[name]);
		const best = _.min(Object.keys(fixed), (name) => mean(all(name), 'log'));
		picks.push(`${jack}: ${best}`);
		oracle.push(...all(best));
	}
	lines.push(`| oracle-style (ORACLE: best fixed model per Jack: ${picks.join(', ')}) | ${oracle.length} | ${(100 * mean(oracle, 'p')).toFixed(1)}% | ${mean(oracle, 'log').toFixed(3)} | ${mean(oracle, 'brier').toFixed(4)} |`);
	const out = lines.join('\n') + '\n';
	fs.writeFileSync(path.join(dir, `calibration-${set}.md`), out);
	console.log(out);
}

if (require.main === module) main();

module.exports = { mixture, styles, adaptive, score, fixed };
