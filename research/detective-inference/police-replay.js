// Replays one game from the police's side: for each round, what they could know (their belief, from the public
// record) and what they did, with Jack's true circle shown alongside for the reader only.
//   node research/detective-inference/police-replay.js <seed> [jack, default strategic] [police, default deductive] [night, default all]
//   [--blockWeight x] [--uniformHideouts]
const { WC, _, play } = require('./lib');

const argv = process.argv.slice(2);
const valued = ['--blockWeight'];
const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && valued.includes(argv[i - 1])));
const [seedText, jack = 'strategic', police = 'deductive', nightText] = positional;
const seed = Number(seedText);
const only = nightText ? Number(nightText) - 1 : null;
const policeOptions = {};
const bw = argv.indexOf('--blockWeight');
if (bw !== -1) policeOptions.blockWeight = Number(argv[bw + 1]);
if (argv.includes('--uniformHideouts')) policeOptions.uniformHideouts = true;
const hideoutChoices = WC.rules.hideoutChoices();

const rounds = [];
let last = null;
const state = play({
	jack, police, seed, policeOptions,
	onPolice(st, view) {
		if (st.phase === 11 && (!st.turn.done || st.turn.done.length === 0) && last !== st.police[st.police.length - 1].log.length) {
			last = st.police[st.police.length - 1].log.length;
			const night = st.police.length - 1;
			const hideouts = WC.deduction.hideouts(view.pastLogs(), hideoutChoices);
			const belief = WC.deduction.track(view.publicLog(), { remaining: view.remainingMoves, hideouts: Object.keys(hideouts).map(Number), alleysLeft: view.jackTokens ? view.jackTokens.alleys : 0 });
			const truth = WC.rules.jackPosition(st);
			const arrestable = _.uniq(_.flatten(WC.rules.policeNight(st).arrest));
			const share = (c) => belief.current[c] || 0;
			const top = _.sortBy(Object.keys(belief.current).map(Number), (c) => -share(c)).slice(0, 3);
			rounds.push({
				night, logAt: last, remaining: view.remainingMoves, police: view.police.now.slice(), truth,
				candidates: belief.size, shareTruth: share(truth), top: top.map((c) => `${c} ${(100 * share(c)).toFixed(0)}%`),
				arrestable: arrestable.length, opportunity: arrestable.includes(truth),
				bestArrestable: arrestable.length ? Math.max(...arrestable.map(share)) : 0,
				hideouts: _.size(hideouts), pHideout: hideouts[st.base] || 0,
				policeToHideout: Math.min(...view.police.now.map((c) => Math.min(...WC.board.adjacentNumbers(c).map((n) => WC.board.distance(n, st.base)))))
			});
		}
	}
});

console.log(`seed ${seed}: ${jack} Jack against ${police} police${Object.keys(policeOptions).length ? ' ' + JSON.stringify(policeOptions) : ''}: ${state.result.type} on night ${state.jack.length}; hideout ${state.base} (for the reader; the police never see it)`);
state.police.forEach((night, index) => {
	if (only !== null && index !== only) return;
	const log = WC.rules.publicLog(state, index);
	const crime = log.find((e) => e.type === 'crime');
	const mine = rounds.filter((r) => r.night === index);
	if (!crime) return;
	console.log(`\nnight ${index + 1}: crime at ${crime.scenes.join(' and ')}; possible hideouts from earlier nights ${mine.length ? mine[0].hideouts : '-'}, P(true hideout) ${mine.length ? mine[0].pHideout.toFixed(3) : '-'}`);
	mine.forEach((r, i) => {
		const next = mine[i + 1] ? mine[i + 1].logAt : log.length;
		const actions = log.slice(r.logAt, next).filter((e) => e.type === 'search' || e.type === 'arrest');
		const searches = actions.filter((e) => e.type === 'search');
		const summary = [
			searches.length ? `searched ${searches.length} (${searches.filter((e) => e.clue).map((e) => 'clue at ' + e.mapid).join(', ') || 'no clue'})` : '',
			...actions.filter((e) => e.type === 'arrest').map((e) => `failed arrest at ${e.mapid}`)
		].filter(Boolean).join('; ');
		const caught = state.result.type === 'arrested' && state.jack.length - 1 === index && i === mine.length - 1;
		console.log(`  ${String(r.remaining).padStart(2)} left | police ${r.police.join(',')} (nearest ${r.policeToHideout} from his hideout) | believe ${r.candidates} circles, top ${r.top.join(', ')} | ` +
			`Jack at ${r.truth} (${(100 * r.shareTruth).toFixed(1)}%)${r.opportunity ? ' NEXT TO A POLICEMAN' : ''} | best arrestable ${(100 * r.bestArrestable).toFixed(0)}% | ${caught ? 'ARRESTED HIM' : summary || 'nothing to do'}`);
	});
	if (log.some((e) => e.type === 'escaped')) console.log('  Jack reached his hideout');
});
