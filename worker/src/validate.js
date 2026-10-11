// Intake checks for a submitted game record (docs/automatic-playtest-collection.md#intake-checks).
// Cheap structural checks only: the record's shape, its format and versions, a completed game a person played, and
// nothing that isn't game data. They run in well under a millisecond, so they can run on every public request. They
// do NOT replay the game: the research pipeline's importer does that later (tools/playtests/intake.js), and only a
// replay-verified record can enter the research collection. Everything here treats the record as untrusted data.

export const recordFormat = 'whitechapel-game-log';
export const schemaVersions = [1];
export const gameIdPattern = /^g[0-9a-f]{16}$/;

// The keys a full record has (js/core/record.js). Anything else, the player's free-text note (`feedback`) included,
// is refused: automatic submission never sends one, and free text could hold personal data
const topLevelKeys = ['format', 'schemaVersion', 'disclosure', 'role', 'app', 'ruleset', 'game', 'outcome', 'actions', 'interactions', 'nights', 'final'];
const gameKeys = ['id', 'exportedOn', 'status', 'nightsPlayed', 'players', 'settings', 'randomness'];
const winners = { arrested: 'police', trapped: 'police', outOfMoves: 'police', jackWins: 'jack' };
const actionTypes = {
	jack: ['hideout', 'women', 'wait', 'victims', 'reveal', 'move'],
	police: ['patrol', 'wretched', 'keepWretched', 'policeman', 'finishMoves', 'beginNight', 'choose', 'search', 'arrest']
};
const maxActions = 5000;
const maxNights = 4;

function isObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isInt(value, min, max) {
	return Number.isInteger(value) && value >= min && value <= max;
}

function fail(code, message, status = 422) {
	return { ok: false, status, code, message };
}

function player(p) {
	// { type: 'human' } or { type: 'ai', ai: 'Detective AI v3', level: 'normal' }: short, plain labels only
	if (!isObject(p) || (p.type !== 'human' && p.type !== 'ai')) return false;
	for (const key of Object.keys(p)) if (!['type', 'ai', 'level'].includes(key)) return false;
	if (p.ai !== undefined && (typeof p.ai !== 'string' || !/^[A-Za-z0-9 .()+_-]{1,60}$/.test(p.ai))) return false;
	if (p.level !== undefined && p.level !== null && (typeof p.level !== 'string' || !/^[a-z0-9-]{1,20}$/.test(p.level))) return false;
	return true;
}

export function validateRecord(record, options = {}) {
	// -> { ok: true, meta } or { ok: false, status, code, message }. The message is safe to return to the client: it
	// never echoes the submitted content
	const rulesets = options.rulesets || [];
	if (!isObject(record)) return fail('not_a_record', 'The body is not a game record.', 400);
	if (record.format !== recordFormat) return fail('not_a_record', 'The body is not a Letters From Whitechapel game record.', 400);
	if (!schemaVersions.includes(record.schemaVersion)) return fail('unsupported_schema', 'This schema version is not accepted.');
	for (const key of Object.keys(record)) {
		if (key === 'feedback') return fail('has_note', 'Records with a written note are not accepted online.');
		if (!topLevelKeys.includes(key)) return fail('unexpected_field', 'The record has a field a game record does not have.');
	}
	if (record.disclosure !== 'full' || record.role !== null) return fail('not_full', 'Only full records are accepted.');
	const app = record.app;
	if (!isObject(app) || app.name !== 'letters-from-whitechapel' || typeof app.version !== 'string' ||
		!/^\d{1,3}\.\d{1,3}\.\d{1,3}(-[0-9A-Za-z.-]{1,20})?$/.test(app.version) ||
		!(app.commit === null || (typeof app.commit === 'string' && /^[0-9a-f]{7,40}$/.test(app.commit)))) {
		return fail('bad_app', 'The record does not name a version of this game.');
	}
	if (!isObject(record.ruleset) || typeof record.ruleset.id !== 'string' || !rulesets.includes(record.ruleset.id)) {
		return fail('unsupported_ruleset', 'This rule set is not accepted.');
	}

	const game = record.game;
	if (!isObject(game)) return fail('bad_game', 'The record has no game description.');
	for (const key of Object.keys(game)) if (!gameKeys.includes(key)) return fail('unexpected_field', 'The game description has an unexpected field.');
	if (typeof game.id !== 'string' || !gameIdPattern.test(game.id)) return fail('bad_game_id', 'The game id is not valid.');
	if (typeof game.exportedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(game.exportedOn)) return fail('bad_game', 'The game date is not valid.');
	if (game.status !== 'completed') return fail('not_completed', 'Only completed games are accepted.');
	if (!isInt(game.nightsPlayed, 1, maxNights)) return fail('bad_game', 'The number of nights is not valid.');
	const players = game.players;
	if (!isObject(players) || !player(players.jack) || !player(players.police)) return fail('bad_players', 'The players are not described correctly.');
	const humans = (players.jack.type === 'human' ? 1 : 0) + (players.police.type === 'human' ? 1 : 0);
	if (humans !== 1) return fail('not_human', 'Only games one person played against the computer are accepted.');
	if (!isObject(game.settings) || !isObject(game.randomness)) return fail('bad_game', 'The game settings are not valid.');

	const outcome = record.outcome;
	if (!isObject(outcome) || !Object.prototype.hasOwnProperty.call(winners, outcome.result) || outcome.winner !== winners[outcome.result] ||
		!isInt(outcome.night, 1, maxNights) || outcome.night !== game.nightsPlayed || !isInt(outcome.jackMove, 0, 40)) {
		return fail('bad_outcome', 'The outcome is not valid.');
	}

	const actions = record.actions;
	if (!Array.isArray(actions) || actions.length < 2 || actions.length > maxActions) return fail('bad_actions', 'The actions are not valid.');
	for (let i = 0; i < actions.length; i++) {
		const a = actions[i];
		if (!isObject(a) || a.seq !== i + 1 || !actionTypes[a.side] || !actionTypes[a.side].includes(a.type) || !isObject(a.args)) {
			return fail('bad_actions', 'The actions are not valid.');
		}
	}
	if (!Array.isArray(record.interactions) || record.interactions.length > maxActions) return fail('bad_record', 'The record is not valid.');
	if (!Array.isArray(record.nights) || record.nights.length !== game.nightsPlayed || !isObject(record.final)) {
		return fail('bad_record', 'The record is not valid.');
	}

	const human = players.jack.type === 'human' ? 'jack' : 'detectives';
	const ai = human === 'jack' ? players.police : players.jack;
	return {
		ok: true,
		meta: {
			gameId: game.id,
			schemaVersion: record.schemaVersion,
			ruleset: record.ruleset.id,
			appVersion: app.version,
			role: human,
			opponent: ai.ai || 'unknown',
			level: ai.level || null,
			result: outcome.result
		}
	};
}

export function contentOf(record) {
	// What identifies a game's content for duplicates: the record without its export date, which changes when the same
	// game is exported twice (as js/ui/playtest-store.js's fingerprint; the importer compares with that one)
	return JSON.stringify(Object.assign({}, record, { game: Object.assign({}, record.game, { exportedOn: undefined }) }));
}
