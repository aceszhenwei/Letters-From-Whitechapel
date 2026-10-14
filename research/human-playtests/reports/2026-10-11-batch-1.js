// Batch 1 triage, 2026-10-11 (docs/playtests.md#batch-triage-every-5-games): the night summaries of the five games it
// covers, read from the records' own `nights` and `actions`, and the earlier investigation's belief measurements
// (2026-10-11-investigation-arrests.js, reused unchanged) on these games, to recheck its pattern to watch.
//   node research/human-playtests/reports/2026-10-11-batch-1.js [--json] [--games id,id,...]
// Read-only: it changes no record and no AI. Circle numbers are the printed ones, as players see them.
const path = require('path');
const { loadCore, loadWithAI } = require('../../../tools/game-log/core');
const { study, summarise } = require('./2026-10-11-investigation-arrests');

// Batch 1's games, unless game IDs are given (later batch triages reuse this script: --games id,id,...)
const listed = process.argv.indexOf('--games');
const games = listed > 0 ? process.argv[listed + 1].split(',') : ['g98c41370f7344474', 'gcdf6409ed736eaf5', 'g2358629abcf5b51d', 'g4e86b6b6af7cc2e1', 'g6b7af2a30b071ae6'];
const records = path.join(__dirname, '..', 'records');
const core = loadCore();
const WC = core.WC;
const number = (id) => core.map[id].number;
const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

function nights(full) {
	const hideout = full.actions.find((a) => a.type === 'hideout').args.mapid;
	return full.nights.map((n, i) => {
		const jack = n.jack;
		const police = n.police;
		const moves = jack.moves || [];
		const count = (type) => moves.filter((m) => m.type === type).length;
		const scene = jack.murder[jack.murder.length - 1];
		const arrests = full.actions.filter((a) => a.type === 'arrest' && a.night === i);
		return {
			night: i + 1,
			waits: full.actions.filter((a) => a.type === 'wait' && a.night === i).length,
			scenes: jack.murder.map(number),
			hideoutWalks: WC.board.distance(scene, hideout), // From the (last) crime scene to the hideout, walking
			moves: moves.length,
			walks: count('walk'),
			alleys: count('alley'),
			coaches: count('carriage'),
			searches: police.log.filter((e) => e.type === 'search').length,
			clues: (police.clues || []).length,
			arrests: arrests.map((a) => ({ at: number(a.args.mapid), jackMove: a.jackMove, right: a.result === 'arrested' })),
			ending: police.escaped ? 'escaped' : arrests.some((a) => a.result === 'arrested') ? 'arrested' : full.outcome.result
		};
	});
}

function arrestsExplained(full) {
	// Each arrest: v3's threshold rule (belief >= arrestAt at the best arrestable circle), or the forced arrest of a
	// policeman with nothing left to search (js/ai/police.js, clues()). Replays to each one
	const ctx = loadWithAI(() => 0.5);
	const W = ctx.WC;
	const police = W.createPolice(W.board, W.rules, W.deduction, ctx._, W.policeVariants.v3);
	return full.actions.map((a, i) => ({ a, i })).filter(({ a }) => a.type === 'arrest').map(({ a, i }) => {
		const choose = full.actions.findIndex((b, j) => j < i && b.type === 'choose' && b.args.index === a.args.index && b.night === a.night && b.jackMove === a.jackMove);
		const view = W.rules.policeView(W.record.replay(full, { upto: choose }).game.state);
		const belief = (police.belief(view, true).jack || {}).current || {};
		const searchable = (view.police.search[a.args.index] || []).filter((c) => c !== undefined && c !== null).length;
		return { night: a.night + 1, jackMove: a.jackMove, at: number(a.args.mapid), belief: +(belief[a.args.mapid] || 0).toFixed(3),
			why: searchable === 0 ? 'forced (nothing to search)' : 'belief >= ' + police.options.arrestAt, jackThere: a.result === 'arrested' };
	});
}

function lastNightHome(full) {
	// A last-night murder within one walk of the hideout (the case v3's containment prepares for): how likely v3 thought
	// the true hideout was when the night began, and whether a policeman stood where he could block the walk home
	const last = full.nights.length - 1;
	const n = full.nights[last];
	if (last !== 3 || !n.jack.murder.length) return null;
	const hideout = full.actions.find((a) => a.type === 'hideout').args.mapid;
	const scene = n.jack.murder[n.jack.murder.length - 1];
	if (WC.board.distance(scene, hideout) > 1) return null;
	const ctx = loadWithAI(() => 0.5);
	const W = ctx.WC;
	const police = W.createPolice(W.board, W.rules, W.deduction, ctx._, W.policeVariants.v3);
	const start = full.actions.findIndex((a) => a.night === last);
	const hide = police.belief(W.rules.policeView(W.record.replay(full, { upto: start }).game.state), true).hideouts;
	const ranked = Object.keys(hide).sort((a, b) => hide[b] - hide[a]);
	const move = full.actions.findIndex((a) => a.night === last && a.type === 'move');
	const now = W.record.replay(full, { upto: move }).game.state.police[last].now || [];
	const blockers = Object.keys(core.map).map(Number).filter((c) => core.map[c] && !core.map[c].number && !W.board.walk(scene, [c]).includes(hideout));
	return { scene: number(scene), hideout: number(hideout), candidates: ranked.length, hideoutBelief: +(hide[hideout] || 0).toFixed(3),
		hideoutRank: ranked.indexOf(String(hideout)) + 1, blockingCrossings: blockers, policeOnThem: blockers.filter((c) => now.includes(c)).length,
		walkHomeOpen: W.board.walk(scene, now).includes(hideout) };
}

function main() {
	const out = games.map((id) => {
		const full = require(path.join(records, id + '.json'));
		const s = summarise(study(id, full));
		const pooled = study(id, full).decisions;
		return {
			id,
			outcome: full.outcome,
			hideout: number(full.actions.find((a) => a.type === 'hideout').args.mapid),
			nights: nights(full),
			arrests: arrestsExplained(full),
			lastNightHome: lastNightHome(full),
			belief: {
				decisions: s.decisions,
				arrests: s.arrests,
				disagreementsWithV3: s.disagreements,
				jackExcluded: s.jackNeverPossible,
				jackArrestable: s.jackArrestable.length,
				maxArrestBelief: +s.maxArrestBelief.toFixed(3),
				medianPossible: s.medianPossible,
				jackInTopTen: pooled.length ? +(pooled.filter((x) => x.rankOfJack > 0 && x.rankOfJack <= 10).length / pooled.length).toFixed(2) : null,
				medianWalks: median(pooled.map((x) => x.reach))
			}
		};
	});
	if (process.argv.includes('--json')) {
		console.log(JSON.stringify(out, null, 1));
		return;
	}
	for (const g of out) {
		console.log(`${g.id}: ${g.outcome.result} (night ${g.outcome.night}), hideout ${g.hideout}`);
		for (const n of g.nights) {
			console.log(`  night ${n.night}: waits ${n.waits}, crime at ${n.scenes.join(' and ')} (${n.hideoutWalks} walks from home), ` +
				`${n.moves} moves (${n.walks} walks, ${n.alleys} alleys, ${n.coaches} coaches), ${n.searches} searches, ${n.clues} clues` +
				`${n.arrests.map((a) => `, arrest at ${a.at} on move ${a.jackMove} (${a.right ? 'Jack was there' : 'missed'})`).join('')}: ${n.ending}`);
		}
		for (const a of g.arrests) console.log(`  arrest, night ${a.night} move ${a.jackMove} at ${a.at}: ${a.why}, belief there ${a.belief}${a.jackThere ? ', Jack was there' : ''}`);
		if (g.lastNightHome) console.log('  last-night murder next to home:', JSON.stringify(g.lastNightHome));
		console.log('  belief at clue decisions:', JSON.stringify(g.belief));
	}
	const all = [].concat(...games.map((id) => study(id, require(path.join(records, id + '.json'))).decisions));
	console.log('\nPooled over the batch:', JSON.stringify({
		decisions: all.length,
		jackArrestable: all.filter((x) => x.jackArrestable).length,
		arrestBeliefAtLeast02: all.filter((x) => x.bestArrest && x.bestArrest.belief >= 0.2).length,
		medianWalks: median(all.map((x) => x.reach)),
		medianPossible: median(all.map((x) => x.possible)),
		medianRankShare: +median(all.map((x) => x.rankOfJack / x.possible)).toFixed(2),
		jackInTopTen: +(all.filter((x) => x.rankOfJack > 0 && x.rankOfJack <= 10).length / all.length).toFixed(2)
	}));
}

main();
