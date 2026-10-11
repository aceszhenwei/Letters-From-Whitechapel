// Investigation 2026-10-11 (docs/playtests.md#investigations-targeted): Detective AI v3 searched at every clue decision
// in the first two human games and never arrested. This replays each game to every one of those decisions and asks
// the v3 police what they believed then: where they thought Jack was, against where he was.
//   node research/human-playtests/reports/2026-10-11-investigation-arrests.js [--json | --baseline]
// Read-only: it changes no record and no AI. The AI only reads the police's view (rules.policeView), as in play.
const path = require('path');
const { loadWithAI } = require('../../../tools/game-log/core');

const games = ['g91d4014f17ae09e6', 'ga36125530c4b4076'];
const records = path.join(__dirname, '..', 'records');

function study(id, record) {
	const full = record || require(path.join(records, id + '.json'));
	const ctx = loadWithAI(() => 0.5);
	const { WC } = ctx;
	const police = WC.createPolice(WC.board, WC.rules, WC.deduction, ctx._, WC.policeVariants.v3);
	const decisions = [];
	full.actions.forEach((action, i) => {
		if (action.side !== 'police' || action.type !== 'choose') return;
		const replay = WC.record.replay(full, { upto: i });
		if (!replay.ok) throw new Error(id + ': replay failed before action ' + action.seq + ': ' + replay.problems[0]);
		const state = replay.game.state;
		const view = WC.rules.policeView(state);
		const known = police.belief(view, true);
		const where = (known.jack && known.jack.current) || {};
		const jack = WC.rules.jackPosition(state);
		const index = action.args.index;
		const arrestable = view.police.arrest[index] || [];
		const searchable = (view.police.search[index] || []).filter((c) => c !== undefined && c !== null);
		const best = arrestable.reduce((b, c) => ((where[c] || 0) > (where[b] || 0) ? c : b), arrestable[0]);
		// How close the police were: Jack's walks from the nearest circle any policeman stands next to
		const reach = Math.min(...view.police.now.map((c) => Math.min(...WC.board.adjacentNumbers(c).map((n) => WC.board.distance(n, jack)))));
		const ranked = Object.keys(where).filter((c) => where[c] > 0).sort((a, b) => where[b] - where[a]);
		decisions.push({
			seq: action.seq,
			night: action.night + 1,
			jackMove: action.jackMove,
			policeman: index,
			chose: action.args.action,
			jack,
			possible: ranked.length,
			beliefAtJack: where[jack] || 0,
			rankOfJack: ranked.indexOf(String(jack)) + 1,
			reach,
			jackArrestable: arrestable.includes(jack),
			jackSearchable: searchable.includes(jack),
			bestArrest: best === undefined ? null : { circle: best, belief: where[best] || 0 },
			wouldArrest: arrestable.length > 0 && (where[best] || 0) >= police.options.arrestAt
		});
	});
	return { id, outcome: full.outcome, arrestAt: police.options.arrestAt, decisions };
}

const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

function summarise(g) {
	const d = g.decisions;
	const nights = [...new Set(d.map((x) => x.night))].map((n) => {
		const here = d.filter((x) => x.night === n);
		const turns = [...new Set(here.map((x) => x.jackMove))];
		return { night: n, clueTurns: turns.length, decisions: here.length, nearestWalks: Math.min(...here.map((x) => x.reach)),
			medianWalks: median(here.map((x) => x.reach)), medianPossible: median(here.map((x) => x.possible)),
			medianRankOfJack: median(here.map((x) => x.rankOfJack)), maxArrestBelief: +Math.max(0, ...here.map((x) => (x.bestArrest ? x.bestArrest.belief : 0))).toFixed(3) };
	});
	const chances = d.filter((x) => x.jackArrestable);
	return {
		id: g.id,
		decisions: d.length,
		arrests: d.filter((x) => x.chose === 'arrest').length,
		v3WouldArrest: d.filter((x) => x.wouldArrest).length,
		disagreements: d.filter((x) => x.wouldArrest !== (x.chose === 'arrest')).length,
		jackNeverPossible: d.filter((x) => x.beliefAtJack === 0).length,
		maxArrestBelief: Math.max(0, ...d.map((x) => (x.bestArrest ? x.bestArrest.belief : 0))),
		medianPossible: median(d.map((x) => x.possible)),
		nights,
		jackArrestable: chances.map((x) => ({ seq: x.seq, night: x.night, jackMove: x.jackMove, policeman: x.policeman, jack: x.jack,
			beliefAtJack: +x.beliefAtJack.toFixed(3), rankOfJack: x.rankOfJack, possible: x.possible, bestArrest: x.bestArrest && { circle: x.bestArrest.circle, belief: +x.bestArrest.belief.toFixed(3) } }))
	};
}

function baseline(jack, seeds) {
	// The same measurements for v3 against a computer Jack: synthetic games, seeded, for comparison only
	const { play } = require('../../../tools/game-log/make-examples');
	const pooled = [];
	let arrested = 0;
	for (const seed of seeds) {
		const { recorder, game } = play({ seed, jack, police: 'hard' }); // 'hard' detectives in Developer Mode = Detective AI v3
		if (game.state.result.type === 'arrested') arrested++;
		pooled.push(...study('baseline-' + seed, recorder.exportFull({ date: '2026-10-11' })).decisions);
	}
	return {
		jack, games: seeds.length, arrested, decisions: pooled.length,
		arrests: pooled.filter((x) => x.chose === 'arrest').length,
		jackArrestable: pooled.filter((x) => x.jackArrestable).length,
		arrestBeliefAtLeast: pooled.filter((x) => x.bestArrest && x.bestArrest.belief >= 0.2).length,
		medianWalks: median(pooled.map((x) => x.reach)),
		medianPossible: median(pooled.map((x) => x.possible)),
		medianRankOfJack: median(pooled.map((x) => x.rankOfJack)),
		medianRankShare: +median(pooled.map((x) => x.rankOfJack / x.possible)).toFixed(2),
		jackInTopTen: +(pooled.filter((x) => x.rankOfJack <= 10).length / pooled.length).toFixed(2)
	};
}

function human(results) {
	const pooled = [].concat(...results.map((r) => r.decisions));
	return {
		jack: 'human', games: results.length, arrested: 0, decisions: pooled.length,
		arrests: pooled.filter((x) => x.chose === 'arrest').length,
		jackArrestable: pooled.filter((x) => x.jackArrestable).length,
		arrestBeliefAtLeast: pooled.filter((x) => x.bestArrest && x.bestArrest.belief >= 0.2).length,
		medianWalks: median(pooled.map((x) => x.reach)),
		medianPossible: median(pooled.map((x) => x.possible)),
		medianRankOfJack: median(pooled.map((x) => x.rankOfJack)),
		medianRankShare: +median(pooled.map((x) => x.rankOfJack / x.possible)).toFixed(2),
		jackInTopTen: +(pooled.filter((x) => x.rankOfJack <= 10).length / pooled.length).toFixed(2)
	};
}

if (require.main === module) {
	const results = games.map((id) => study(id));
	const out = results.map(summarise);
	if (process.argv.includes('--baseline')) {
		const seeds = Array.from({ length: 20 }, (_, i) => 611001 + i);
		console.log(JSON.stringify([human(results), baseline('hard', seeds), baseline('normal', seeds)], null, 1));
		return;
	}
	if (process.argv.includes('--json')) console.log(JSON.stringify({ arrestAt: results[0].arrestAt, games: out, decisions: results.map((r) => ({ id: r.id, decisions: r.decisions })) }, null, 1));
	else console.log(JSON.stringify(out, null, 1));
}

module.exports = { study, summarise, games };
