// A summary of many validated game records (docs/game-records.md). Only records this version can read are counted
// ('verified' and 'partial'), each game once; the others are counted by verdict and listed, never mixed in. Everything
// counted is public (move kinds, waits, outcomes), so public and full records can be summarised together.

function count(map, key) {
	map[key] = (map[key] || 0) + 1;
}

function describe(player) {
	if (!player) return 'unknown';
	return player.type === 'human' ? 'human' : `ai${player.level ? ' ' + player.level : ''}${player.ai ? ' (' + player.ai + ')' : ''}`;
}

function summarise(reports) {
	const s = {
		files: reports.length,
		verdicts: {},
		status: {},
		disclosure: {},
		rulesets: {},
		players: {},
		opponents: {},
		results: {},
		winners: {},
		nightsPlayed: {},
		nightsEscaped: {},
		waits: { total: 0, gamesWithWaits: 0, nights: 0 },
		moves: { walk: 0, alley: 0, carriage: 0 },
		actions: 0,
		games: 0,
		duplicates: 0
	};
	// Several records of one game (a public record during play, the full one after) count once: the most complete
	const best = new Map();
	const rank = (r) => (r.record.disclosure === 'full' ? 2 : 0) + (r.record.game.status !== 'inProgress' ? 1 : 0) + r.record.actions.length / 1e6;
	for (const r of reports) {
		count(s.verdicts, r.verdict);
		if (r.verdict !== 'verified' && r.verdict !== 'partial') continue;
		const id = r.record.game.id;
		if (best.has(id)) s.duplicates++;
		if (!best.has(id) || rank(r) > rank(best.get(id))) best.set(id, r);
	}
	for (const r of best.values()) {
		const record = r.record;
		s.games++;
		count(s.status, record.game.status);
		count(s.disclosure, record.disclosure + (record.role ? ' (' + record.role + ')' : ''));
		count(s.rulesets, record.ruleset.id);
		const players = record.game.players;
		count(s.players, `Jack ${describe(players.jack)} against police ${describe(players.police)}`);
		if (players.police.type === 'human') count(s.opponents, describe(players.jack));
		if (record.outcome) {
			count(s.results, record.outcome.result);
			if (record.outcome.winner) count(s.winners, record.outcome.winner);
		}
		count(s.nightsPlayed, record.game.nightsPlayed);
		const escapes = record.actions.filter((a) => a.type === 'move' && a.result && a.result.escaped).length;
		count(s.nightsEscaped, escapes);
		const waits = record.actions.filter((a) => a.type === 'wait').length;
		s.waits.total += waits;
		s.waits.nights += new Set(record.actions.filter((a) => a.type === 'victims').map((a) => a.night)).size;
		if (waits) s.waits.gamesWithWaits++;
		for (const a of record.actions) if (a.type === 'move') s.moves[a.args.type]++;
		s.actions += record.actions.length;
	}
	s.averageActions = s.games ? +(s.actions / s.games).toFixed(1) : 0;
	s.averageJackMoves = s.games ? +((s.moves.walk + s.moves.alley + s.moves.carriage) / s.games).toFixed(1) : 0;
	s.waits.perNight = s.waits.nights ? +(s.waits.total / s.waits.nights).toFixed(2) : 0;

	const line = (label, map) => `${label}: ${Object.keys(map).length ? Object.entries(map).map(([k, v]) => `${k} ${v}`).join(', ') : 'none'}`;
	s.text = [
		`${s.files} files: ${Object.entries(s.verdicts).map(([k, v]) => `${v} ${k}`).join(', ')}. Counted: ${s.games} games (verified or partial${s.duplicates ? `; ${s.duplicates} more records of the same games` : ''}).`,
		line('Games', s.status),
		line('Records', s.disclosure),
		line('Players', s.players),
		line('Jack AI against human police', s.opponents),
		line('Results', s.results),
		line('Wins', s.winners),
		line('Nights played', s.nightsPlayed),
		line('Nights Jack escaped', s.nightsEscaped),
		`Waiting: ${s.waits.total} waits over ${s.waits.nights} nights with a murder (${s.waits.perNight} a night); ${s.waits.gamesWithWaits} games with a wait`,
		`Jack's moves: ${s.moves.walk} walks, ${s.moves.alley} alleys, ${s.moves.carriage} coaches`,
		`Average length: ${s.averageActions} actions, ${s.averageJackMoves} moves by Jack`,
		line('Rule sets', s.rulesets)
	].join('\n');
	return s;
}

module.exports = { summarise };
