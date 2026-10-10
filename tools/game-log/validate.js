// Validates one exported game record (docs/game-records.md). A record is untrusted data: it is only parsed as JSON and
// read field by field, never run, and nothing in it is used as a file path.
//
// validate(text) -> {
//   verdict:  'verified'     a full record that replays exactly through the engine (legal and consistent)
//             'partial'      structurally valid and internally consistent, but not replayable: a public record (Jack's
//                            secrets are not in it), checked against the deduction instead
//             'invalid'      malformed, tampered, illegal, or a replay that doesn't match the record
//             'incompatible' another schema version or rule set: not checked against these rules
//   status:   'completed' | 'inProgress' | 'abandoned' (how the game stood; an unfinished game is not an error)
//   disclosure, role, errors, warnings, record (the parsed record, when it could be parsed)
// }
const { loadCore } = require('./core');

const maxBytes = 5 * 1024 * 1024;
const maxActions = 20000;
const supportedVersions = [1];

const topKeys = { public: ['format', 'schemaVersion', 'disclosure', 'role', 'app', 'ruleset', 'game', 'outcome', 'feedback', 'actions', 'interactions', 'nights', 'current'],
	full: ['format', 'schemaVersion', 'disclosure', 'role', 'app', 'ruleset', 'game', 'outcome', 'feedback', 'actions', 'interactions', 'nights', 'final'] };
const actionKeys = ['seq', 'side', 'type', 'night', 'phase', 'jackMove', 'timeOfCrime', 'remainingMoves', 'known', 'args', 'result'];
// What a public record may say about the other side's actions (anything more is a leak)
const publicJackArgs = { hideout: [], women: ['women', 'wretched'], wait: [], victims: ['scenes'], reveal: ['mapid'], move: ['type'] };
const publicJackResults = { reveal: ['fake'], move: ['escaped'] };
const policeNightKeys = ['night', 'crimeScenes', 'earlierCrimeScenes', 'murderMove', 'patrols', 'policeRoutes', 'clues', 'log', 'escaped'];
const policeCurrentKeys = ['phase', 'night', 'timeOfCrime', 'remainingMoves', 'jackTokens', 'crimeScenes', 'women', 'wretched'];
const results = ['arrested', 'trapped', 'outOfMoves', 'jackWins', 'abandoned'];

function isInt(value, low, high) {
	return Number.isInteger(value) && (low === undefined || value >= low) && (high === undefined || value <= high);
}

function plainTree(value, depth, problems, where) {
	// Only JSON data, no keys that could reach an object's prototype, and no deep nesting
	if (depth > 12) {
		problems.push(`${where}: nested too deeply`);
		return;
	}
	if (Array.isArray(value)) {
		value.forEach((item, i) => plainTree(item, depth + 1, problems, `${where}[${i}]`));
	} else if (value && typeof value === 'object') {
		for (const key of Object.keys(value)) {
			if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
				problems.push(`${where}: forbidden key "${key}"`);
			} else {
				plainTree(value[key], depth + 1, problems, `${where}.${key}`);
			}
		}
	}
}

function validate(text, options = {}) {
	const core = options.core || loadCore();
	const { WC } = core;
	const errors = [];
	const warnings = [];
	const report = (verdict, record) => ({
		verdict,
		status: record && record.game && typeof record.game.status === 'string' ? record.game.status : 'unknown',
		disclosure: record && typeof record.disclosure === 'string' ? record.disclosure : 'unknown',
		role: record ? record.role : null,
		errors,
		warnings,
		record: verdict === 'invalid' && !record ? null : record
	});

	// 1. JSON
	if (typeof text !== 'string') text = String(text);
	if (Buffer.byteLength(text, 'utf8') > maxBytes) {
		errors.push(`larger than ${maxBytes / 1024 / 1024} MB`);
		return report('invalid', null);
	}
	let record;
	try {
		record = JSON.parse(text);
	} catch (error) {
		errors.push(`not valid JSON (${error.message})`);
		return report('invalid', null);
	}
	if (!record || typeof record !== 'object' || Array.isArray(record)) {
		errors.push('not a game record (not a JSON object)');
		return report('invalid', null);
	}
	plainTree(record, 0, errors, 'record');
	if (errors.length) return report('invalid', null);

	// 2. Format, version and rule set: an incompatible record is reported, not checked against these rules
	if (record.format !== WC.record.format) {
		errors.push(`not a Letters From Whitechapel game record (format ${JSON.stringify(record.format)})`);
		return report('invalid', null);
	}
	if (!isInt(record.schemaVersion, 1)) {
		errors.push('schemaVersion missing or not a whole number');
		return report('invalid', record);
	}
	if (!supportedVersions.includes(record.schemaVersion)) {
		errors.push(`schema version ${record.schemaVersion} is not supported (this tool reads ${supportedVersions.join(', ')})`);
		return report('incompatible', record);
	}
	if (!record.ruleset || typeof record.ruleset.id !== 'string') {
		errors.push('ruleset.id missing');
		return report('invalid', record);
	}
	if (record.ruleset.id !== WC.record.ruleset.id) {
		errors.push(`rule set ${record.ruleset.id} differs from this version's ${WC.record.ruleset.id} (rules or map changed)`);
		return report('incompatible', record);
	}
	if (record.app && record.app.version !== WC.record.appVersion) {
		warnings.push(`recorded by version ${record.app.version}; this is ${WC.record.appVersion} (same rules and map)`);
	}

	// 3. Structure
	const structural = checkStructure(record, WC, errors, warnings);
	if (!structural) return report('invalid', record);

	// 4. Consistency: the actions against the public record of each night, and against the outcome
	checkConsistency(record, WC, errors);
	if (errors.length) return report('invalid', record);

	// 5. A public record: what can be checked without Jack's secrets
	if (record.disclosure === 'public') {
		checkDeduction(record, WC, errors);
		return report(errors.length ? 'invalid' : 'partial', record);
	}

	// 6. A full record: replay it
	const replayed = WC.record.replay(record);
	if (!replayed.ok) {
		errors.push(...replayed.problems);
		return report('invalid', record);
	}
	const normal = (value) => JSON.stringify(WC.record.normalise(JSON.parse(JSON.stringify(value))));
	if (normal(replayed.game.state) !== normal(record.final.state)) {
		errors.push('the replayed final state differs from the recorded one');
	}
	record.nights.forEach((night, i) => {
		if (normal(WC.rules.publicLog(replayed.game.state, i)) !== normal(night.police.log)) {
			errors.push(`night ${i + 1}: the replayed public record differs from the recorded one`);
		}
	});
	if (replayed.game.state.jack.length !== record.nights.length) {
		errors.push(`the replay has ${replayed.game.state.jack.length} nights; the record has ${record.nights.length}`);
	}
	const finished = replayed.game.state.over;
	if (record.game.status === 'completed') {
		if (!finished || replayed.game.state.result.type !== record.outcome.result) {
			errors.push(`the record says ${record.outcome.result}; the replay ${finished ? 'ends ' + replayed.game.state.result.type : 'does not end'}`);
		}
	} else if (finished) {
		errors.push(`the record says the game was ${record.game.status}, but the replay ends it (${replayed.game.state.result.type})`);
	}
	return report(errors.length ? 'invalid' : 'verified', record);
}

function checkStructure(record, WC, errors, warnings) {
	const { board, record: rec } = WC;
	const isPlace = (id) => isInt(id, 0, board.size - 1);
	const before = errors.length;

	if (!['public', 'full'].includes(record.disclosure)) errors.push('disclosure must be "public" or "full"');
	if (record.disclosure === 'public' && !['police', 'jack'].includes(record.role)) errors.push('a public record needs role "police" or "jack"');
	if (record.disclosure === 'full' && record.role !== null) errors.push('a full record has role null');
	if (errors.length > before) return false;
	for (const key of Object.keys(record)) {
		if (!topKeys[record.disclosure].includes(key)) errors.push(`unexpected field "${key}" in a ${record.disclosure} record`);
	}
	const game = record.game;
	if (!game || typeof game !== 'object') {
		errors.push('game metadata missing');
		return false;
	}
	if (typeof game.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(game.id)) errors.push('game.id missing or malformed');
	if (typeof game.exportedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(game.exportedOn)) errors.push('game.exportedOn must be a date (YYYY-MM-DD)');
	if (!['completed', 'inProgress', 'abandoned'].includes(game.status)) errors.push('game.status must be completed, inProgress or abandoned');
	if (!isInt(game.nightsPlayed, 0, WC.rules.config.nights)) errors.push('game.nightsPlayed must be 0 to 4');
	for (const side of ['jack', 'police']) {
		const player = game.players && game.players[side];
		if (!player || !['human', 'ai'].includes(player.type)) errors.push(`game.players.${side}.type must be human or ai`);
	}
	const settings = game.settings;
	if (!settings || typeof settings.confirmPoliceMoves !== 'boolean' || typeof settings.reviewNights !== 'boolean') {
		errors.push('game.settings must give confirmPoliceMoves and reviewNights');
	}
	if (!game.randomness || !(game.randomness.seed === null || Number.isInteger(game.randomness.seed))) errors.push('game.randomness.seed must be a whole number or null');
	if (record.disclosure === 'full' && game.status === 'inProgress') errors.push('a full record of a game in progress: Jack\'s secrets of a game still being played');
	if (record.feedback !== undefined) {
		const f = record.feedback;
		if (!f || typeof f !== 'object' || Object.keys(f).some((k) => !['label', 'comments'].includes(k)) ||
			(f.label !== undefined && (typeof f.label !== 'string' || f.label.length > 60)) ||
			(f.comments !== undefined && (typeof f.comments !== 'string' || f.comments.length > 2000))) {
			errors.push('feedback may only hold a label (60 characters) and comments (2000)');
		}
	}

	// Outcome against status
	const outcome = record.outcome;
	if (game.status === 'inProgress' && outcome !== null) errors.push('a game in progress has no outcome');
	if (game.status !== 'inProgress') {
		if (!outcome || !results.includes(outcome.result)) {
			errors.push('outcome.result missing or unknown');
		} else if (game.status === 'abandoned' ? outcome.result !== 'abandoned' : outcome.result === 'abandoned') {
			errors.push(`status ${game.status} with outcome ${outcome.result}`);
		} else if (outcome.result !== 'abandoned' && outcome.winner !== rec.winners[outcome.result]) {
			errors.push(`outcome ${outcome.result} is a win for ${rec.winners[outcome.result]}, not ${outcome.winner}`);
		}
	}

	// Actions: order, phases and arguments
	if (!Array.isArray(record.actions) || record.actions.length > maxActions) {
		errors.push('actions must be a list (at most 20000)');
		return false;
	}
	if (!Array.isArray(record.nights) || record.nights.length !== game.nightsPlayed) errors.push('nights must list each night played');
	if (!Array.isArray(record.interactions)) errors.push('interactions must be a list');
	let lastNight = null;
	let lastMove = 0;
	record.actions.forEach((a, i) => {
		const at = `action ${i + 1}`;
		if (!a || typeof a !== 'object' || Array.isArray(a)) {
			errors.push(`${at}: not an object`);
			return;
		}
		for (const key of Object.keys(a)) if (!actionKeys.includes(key)) errors.push(`${at}: unexpected field "${key}"`);
		if (a.seq !== i + 1) errors.push(`${at}: seq ${a.seq}, expected ${i + 1} (out of order or missing actions)`);
		const types = a.side === 'jack' ? rec.jackTypes : a.side === 'police' ? rec.policeTypes : null;
		if (!types || !types.includes(a.type)) {
			errors.push(`${at}: unknown action ${a.side} ${a.type}`);
			return;
		}
		if (a.phase !== rec.phaseOf[a.type]) errors.push(`${at}: ${a.type} in phase ${a.phase}; it belongs to phase ${rec.phaseOf[a.type]}`);
		if (a.type === 'hideout' ? (a.night !== null || i !== 0) : !isInt(a.night, 0, WC.rules.config.nights - 1)) {
			errors.push(`${at}: night ${a.night} (only the hideout, first, has no night)`);
		} else if (a.night !== null) {
			if (lastNight !== null && a.night < lastNight) errors.push(`${at}: night ${a.night} after night ${lastNight}`);
			if (a.night !== lastNight) lastMove = 0;
			if (!isInt(a.jackMove, lastMove)) errors.push(`${at}: Jack's move count goes back`);
			lastMove = a.jackMove;
			lastNight = a.night;
		}
		for (const key of ['timeOfCrime', 'remainingMoves', 'known']) {
			if (!isInt(a[key], key === 'remainingMoves' ? -1 : 0, 10000)) errors.push(`${at}: ${key} must be a whole number`);
		}
		if (!a.args || typeof a.args !== 'object' || Array.isArray(a.args)) {
			errors.push(`${at}: args missing`);
			return;
		}
		checkArgs(record, a, at, isPlace, errors);
	});
	if (record.actions.length === 0 || record.actions[0].type !== 'hideout') errors.push('the first action must be Jack\'s hideout');

	// Hidden information: a public record must say no more than its role could know
	if (record.disclosure === 'public') {
		checkPublicDisclosure(record, errors);
	} else {
		if (!record.final || !record.final.state || typeof record.final.state !== 'object') errors.push('a full record needs final.state');
		if (!record.nights.every((n) => n && n.police && Array.isArray(n.police.log) && n.jack)) errors.push('a full record\'s nights need police and jack records');
	}
	return errors.length === before;
}

function checkArgs(record, a, at, isPlace, errors) {
	const g = a.args;
	const full = record.disclosure === 'full' || (record.role === 'jack' && a.side === 'jack') || (record.role === 'police' && a.side === 'police');
	const places = (list) => Array.isArray(list) && list.length <= 20 && list.every(isPlace);
	const bad = (what) => errors.push(`${at} (${a.side} ${a.type}): ${what}`);
	switch (a.type) {
		case 'hideout': if (full && !isPlace(g.mapid)) bad('mapid'); break;
		case 'women':
			if (full && (!places(g.marked) || !places(g.unmarked))) bad('marked and unmarked must list places');
			if (!full && (!places(g.women) || (g.wretched !== undefined && !places(g.wretched)))) bad('women must list places');
			break;
		case 'victims': if (!places(g.scenes) || g.scenes.length < 1 || g.scenes.length > 2) bad('scenes'); break;
		case 'reveal': if (!isPlace(g.mapid) || !a.result || typeof a.result.fake !== 'boolean') bad('mapid and result.fake'); break;
		case 'move':
			if (!['walk', 'alley', 'carriage'].includes(g.type)) bad('type');
			if (full && (!isPlace(g.mapid) || (g.type === 'carriage' && !isPlace(g.via)))) bad('mapid (and via for a coach)');
			if (!a.result || typeof a.result.escaped !== 'boolean') bad('result.escaped');
			break;
		case 'patrol':
			if (!isPlace(g.mapid) || (g.kind !== undefined && !['real', 'fake'].includes(g.kind)) || (full && g.kind === undefined)) bad('mapid and kind');
			break;
		case 'wretched': if (!isPlace(g.from) || !isPlace(g.to)) bad('from and to'); break;
		case 'keepWretched': if (!isPlace(g.mapid)) bad('mapid'); break;
		case 'policeman': if (!isInt(g.index, 0, 4) || !isPlace(g.to) || !a.result || !isPlace(a.result.from)) bad('index, to and result.from'); break;
		case 'choose': if (!isInt(g.index, 0, 4) || !['search', 'arrest'].includes(g.action)) bad('index and action'); break;
		case 'search': if (!isInt(g.index, 0, 4) || !isPlace(g.mapid) || !['clue', 'miss', 'none'].includes(a.result)) bad('index, mapid and result'); break;
		case 'arrest': if (!isInt(g.index, 0, 4) || !isPlace(g.mapid) || !['arrested', 'missed'].includes(a.result)) bad('index, mapid and result'); break;
		default: break; // wait, finishMoves, beginNight: no arguments
	}
}

function checkPublicDisclosure(record, errors) {
	const leak = (what) => errors.push(`public record discloses hidden information: ${what}`);
	const lastNight = record.nights.length - 1;
	// Phases each night reached, from the actions: what had become public by the export
	const reachedEight = new Set();
	record.actions.forEach((a) => { if (a.night !== null && a.phase >= 8) reachedEight.add(a.night); });
	for (const a of record.actions) {
		if (!a || !a.args) continue;
		if (record.role === 'police' && a.side === 'jack') {
			const extra = Object.keys(a.args).filter((k) => !publicJackArgs[a.type].includes(k));
			const extraResult = a.result === undefined ? [] : Object.keys(a.result).filter((k) => !(publicJackResults[a.type] || []).includes(k));
			if (extra.length || extraResult.length) leak(`action ${a.seq} (Jack ${a.type}) has ${extra.concat(extraResult).join(', ')}`);
			if (a.type === 'victims' && Array.isArray(a.args.scenes) && a.args.scenes.join() !== a.args.scenes.slice().sort((x, y) => x - y).join()) {
				leak(`action ${a.seq}: the order of the double event's crime scenes`);
			}
		}
		if (record.role === 'jack' && a.side === 'police' && a.type === 'patrol') {
			if (Object.keys(a.args).some((k) => !['mapid', 'kind'].includes(k))) leak(`action ${a.seq}: patrol fields`);
			if (a.args.kind !== undefined && !(a.night < lastNight || reachedEight.has(a.night) || record.game.status !== 'inProgress')) {
				leak(`action ${a.seq}: which patrol token is real, before the policemen are on the board`);
			}
		}
	}
	if (record.role === 'police') {
		record.nights.forEach((n, i) => {
			if (!n || typeof n !== 'object' || Object.keys(n).some((k) => !policeNightKeys.includes(k))) leak(`night ${i + 1} holds more than the police's record`);
		});
		if (!record.current || Object.keys(record.current).some((k) => !policeCurrentKeys.includes(k))) leak('the current position holds more than the police see');
		if (record.interactions.some((x) => x && x.side !== 'police')) leak('Jack\'s interactions');
	}
}

function nightLog(record, n) {
	const night = record.nights[n];
	if (!night) return null;
	return record.disclosure === 'full' ? night.police && night.police.log : night.log;
}

function checkConsistency(record, WC, errors) {
	// Rebuild each night's public record from the actions, and compare it with the record's own. Each action's `known`
	// (how much of tonight's public record had been seen when it was taken) must match too
	const expected = [];
	for (const a of record.actions) {
		if (a.night === null) continue;
		const log = expected[a.night] = expected[a.night] || [];
		if (a.known !== log.length) errors.push(`action ${a.seq}: known ${a.known}, but ${log.length} entries of tonight's public record came before it`);
		if (a.type === 'victims') log.push({ type: 'crime', scenes: a.args.scenes.slice().sort((x, y) => x - y) });
		if (a.type === 'move') {
			log.push({ type: 'move', move: a.args.type });
			if (a.result.escaped) log.push({ type: 'escaped' });
		}
		if (a.type === 'search') log.push({ type: 'search', mapid: a.args.mapid, clue: a.result === 'clue' });
		if (a.type === 'arrest' && a.result === 'missed') log.push({ type: 'arrest', mapid: a.args.mapid });
	}
	record.nights.forEach((night, n) => {
		const log = nightLog(record, n);
		if (!Array.isArray(log)) {
			errors.push(`night ${n + 1}: no public record`);
			return;
		}
		const shown = log.map((e) => (e && e.type === 'move' ? { type: 'move', move: e.move } : e));
		if (JSON.stringify(WC.record.normalise(shown)) !== JSON.stringify(WC.record.normalise(expected[n] || []))) {
			errors.push(`night ${n + 1}: the public record doesn't match the actions`);
		}
	});
	const outcome = record.outcome;
	const last = record.actions[record.actions.length - 1];
	if (record.game.status === 'completed' && outcome && last) {
		if (outcome.result === 'jackWins' && !(last.type === 'move' && last.result.escaped && record.nights.length === WC.rules.config.nights)) {
			errors.push('Jack wins, but the record doesn\'t end with his escape on the last night');
		}
		if (outcome.result === 'arrested' && !(last.type === 'arrest' && last.result === 'arrested' && last.args.mapid === outcome.mapid)) {
			errors.push('an arrest, but the record doesn\'t end with it');
		}
	}
	if (record.actions.some((a) => a.type === 'arrest' && a.result === 'arrested' && a !== last)) {
		errors.push('actions after a successful arrest');
	}
}

function checkDeduction(record, WC, errors) {
	// Is there a route for Jack that fits every night's public record? (The deduction is exact: docs/detective-inference-study.md)
	const logs = record.nights.map((n, i) => nightLog(record, i));
	const escaped = logs.filter((log) => log.some((e) => e.type === 'escaped'));
	try {
		logs.forEach((log, i) => {
			const tracked = WC.deduction.track(log);
			if (tracked && tracked.size === 0) errors.push(`night ${i + 1}: no route for Jack fits the public record`);
		});
		if (escaped.length) {
			const homes = WC.deduction.hideouts(escaped, WC.rules.hideoutChoices(), { weighting: 'uniform' });
			if (Object.keys(homes).length === 0) errors.push('no hideout fits every night Jack escaped');
		}
	} catch (error) {
		errors.push(`the public record can't be read by the deduction (${error.message})`);
	}
}

module.exports = { validate, supportedVersions, maxBytes };
