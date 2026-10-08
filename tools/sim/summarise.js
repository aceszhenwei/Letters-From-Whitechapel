// Turns a list of game records (tools/sim/run-game.js) into the metrics reported in docs/jack-ai.md.

function wilson(successes, n, z = 1.96) { // 95% confidence interval for a rate
	if (n === 0) return [0, 0];
	const p = successes / n;
	const centre = (p + z * z / (2 * n)) / (1 + z * z / n);
	const half = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / (1 + z * z / n);
	return [centre - half, centre + half];
}

const mean = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
const percentile = (values, q) => {
	if (!values.length) return 0;
	const sorted = values.slice().sort((a, b) => a - b);
	return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};

function summarise(games) {
	const n = games.length;
	const count = (type) => games.filter((g) => g.result === type).length;
	const nights = games.flatMap((g) => g.nightDetails);
	const escaped = nights.filter((night) => night.escaped);
	const decisions = games.flatMap((g) => g.decisions);
	const jackWins = count('jackWins');
	return {
		games: n,
		jackWins,
		jackWinRate: jackWins / n,
		jackWinInterval: wilson(jackWins, n),
		policeWins: n - jackWins - count('unfinished'),
		losses: { arrested: count('arrested'), outOfMoves: count('outOfMoves'), trapped: count('trapped') },
		unfinished: count('unfinished'),
		nightsEscaped: mean(games.map((g) => g.nightDetails.filter((night) => night.escaped).length)),
		endNight: mean(games.filter((g) => g.result !== 'jackWins').map((g) => g.nights)),
		endMove: mean(games.filter((g) => g.result !== 'jackWins').map((g) => g.endMove)),
		movesToHideout: mean(escaped.map((night) => night.moves)),
		shortestPossible: mean(escaped.map((night) => night.startDistance)),
		distanceToHideout: mean(decisions.map((d) => d.distance)),
		coachesPerGame: mean(games.map((g) => g.nightDetails.reduce((s, night) => s + night.carriages, 0))),
		alleysPerGame: mean(games.map((g) => g.nightDetails.reduce((s, night) => s + night.alleys, 0))),
		forcedDanger: mean(decisions.map((d) => d.forcedDanger ? 1 : 0)),
		chosenDanger: mean(decisions.map((d) => d.chosenDanger ? 1 : 0)),
		policeCandidates: mean(decisions.map((d) => d.candidates)),
		hideoutCandidates: mean(games.filter((g) => g.nights > 1).map((g) => g.hideoutCandidates)),
		decisionMs: { mean: mean(decisions.map((d) => d.ms)), p95: percentile(decisions.map((d) => d.ms), 0.95), max: Math.max(0, ...decisions.map((d) => d.ms)) }
	};
}

function format(s, title) {
	const pct = (x) => (100 * x).toFixed(1) + '%';
	return [
		title,
		`  games ${s.games}  Jack wins ${s.jackWins} (${pct(s.jackWinRate)}, 95% CI ${pct(s.jackWinInterval[0])}-${pct(s.jackWinInterval[1])})`,
		`  police wins ${s.policeWins}: arrested ${s.losses.arrested}, out of moves ${s.losses.outOfMoves}, trapped ${s.losses.trapped}${s.unfinished ? ', unfinished ' + s.unfinished : ''}`,
		`  nights escaped per game ${s.nightsEscaped.toFixed(2)}; lost games end on night ${s.endNight.toFixed(2)}, after move ${s.endMove.toFixed(1)}`,
		`  moves to hideout ${s.movesToHideout.toFixed(1)} (shortest possible ${s.shortestPossible.toFixed(1)}); distance to hideout per move ${s.distanceToHideout.toFixed(2)}`,
		`  coaches ${s.coachesPerGame.toFixed(2)}, alleys ${s.alleysPerGame.toFixed(2)} per game`,
		`  moves with every option in reach of police ${pct(s.forcedDanger)}; moves onto such a circle ${pct(s.chosenDanger)}`,
		`  police candidates for Jack's position ${s.policeCandidates.toFixed(1)}; possible hideouts after the game ${s.hideoutCandidates.toFixed(1)}`,
		`  decision time ${s.decisionMs.mean.toFixed(2)} ms mean, ${s.decisionMs.p95.toFixed(2)} ms p95, ${s.decisionMs.max.toFixed(1)} ms max${s.seconds ? `; ${s.seconds.toFixed(0)} s total` : ''}`
	].join('\n');
}

module.exports = { summarise, format, wilson };
