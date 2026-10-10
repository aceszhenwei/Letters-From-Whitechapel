// Game records (js/core/record.js, tools/game-log/): what is recorded, what each export may show, replaying a record,
// and rejecting bad ones. Games are synthetic: the computer plays both sides, seeded (docs/game-records.md).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { play } = require('../../tools/game-log/make-examples');
const { validate } = require('../../tools/game-log/validate');
const { summarise } = require('../../tools/game-log/summary');
const importer = require('../../tools/game-log/import');

const root = path.join(__dirname, '..', '..');
const date = '2026-10-10';
const text = (record, WC) => WC.record.stringify(record);
const plain = (value) => JSON.parse(JSON.stringify(value)); // Values from the game's own context, compared as data

// Easy Jack against the easy police, seed 11: four nights, Jack waits, uses alleys and coaches, the police search and arrest
const fourNights = play({ seed: 11, jack: 'easy', police: 'easy' });
// Seed 2: Jack waits and is arrested on night 3
const arrested = play({ seed: 2, jack: 'easy', police: 'easy' });

function types(actions) {
	const all = {};
	for (const a of actions) all[a.type + (a.type === 'move' ? ':' + a.args.type : '')] = true;
	return all;
}

test('a finished game: every kind of action is recorded, and the full record replays exactly', () => {
	const { WC, game, recorder } = fourNights;
	assert.strictEqual(game.state.result.type, 'jackWins');
	assert.strictEqual(recorder.status(), 'completed');
	const full = recorder.exportFull({ date });
	const seen = types(full.actions);
	for (const kind of ['hideout', 'women', 'patrol', 'wait', 'wretched', 'reveal', 'victims', 'move:walk', 'move:alley', 'move:carriage',
		'policeman', 'finishMoves', 'choose', 'search', 'arrest', 'beginNight']) {
		assert.ok(seen[kind], `records ${kind}`);
	}
	assert.strictEqual(full.game.nightsPlayed, 4);
	assert.strictEqual(full.nights.length, 4);
	assert.deepStrictEqual(plain(full.outcome), { result: 'jackWins', winner: 'jack', night: 4, jackMove: full.outcome.jackMove });
	assert.strictEqual(full.actions.filter((a) => a.type === 'beginNight').length, 3, 'one night review after each of nights 1-3');
	full.actions.forEach((a, i) => assert.strictEqual(a.seq, i + 1));

	const replayed = WC.record.replay(JSON.parse(text(full, WC)));
	assert.ok(replayed.ok, replayed.problems.join('\n'));
	assert.deepStrictEqual(plain(replayed.game.state), plain(full.final.state));
	const report = validate(text(full, WC));
	assert.strictEqual(report.verdict, 'verified', report.errors.join('\n'));
	assert.strictEqual(report.status, 'completed');
});

test('an arrest after waiting: replayed and verified, the arrest ends the record', () => {
	const { WC, recorder } = arrested;
	const full = recorder.exportFull({ date });
	assert.strictEqual(full.outcome.result, 'arrested');
	assert.strictEqual(full.outcome.winner, 'police');
	const last = full.actions[full.actions.length - 1];
	assert.deepStrictEqual([last.type, last.result, last.args.mapid], ['arrest', 'arrested', full.outcome.mapid]);
	assert.ok(full.actions.some((a) => a.type === 'wait'));
	// Waiting delays the murder: the time of the crime has moved on by the time Jack kills
	const kills = full.actions.filter((a) => a.type === 'victims');
	assert.ok(kills.some((k) => k.timeOfCrime > 1));
	assert.strictEqual(validate(text(full, WC)).verdict, 'verified');
});

test('the public record shows only what the police could see', () => {
	const { WC, recorder } = fourNights;
	const pub = recorder.exportPublic('police', { date });
	const json = text(pub, WC);
	assert.ok(!('final' in pub));
	assert.doesNotMatch(json, /"(base|hideout|marked|unmarked|via|route|position)":/, 'no hideout, route or marking');
	for (const a of pub.actions.filter((x) => x.side === 'jack')) {
		const allowed = { hideout: [], women: ['women', 'wretched'], wait: [], victims: ['scenes'], reveal: ['mapid'], move: ['type'] }[a.type];
		assert.deepStrictEqual(Object.keys(a.args).filter((k) => !allowed.includes(k)), [], `Jack's ${a.type}`);
	}
	// The double event's crime scenes are in number order, not the order he killed in
	for (const a of pub.actions.filter((x) => x.type === 'victims')) {
		assert.deepStrictEqual(a.args.scenes, a.args.scenes.slice().sort((x, y) => x - y));
	}
	const report = validate(json);
	assert.strictEqual(report.verdict, 'partial', report.errors.join('\n'));
	assert.strictEqual(report.role, 'police');
});

test('before the victims are chosen, the public record doesn\'t say which women are marked', () => {
	const { recorder, game } = play({ seed: 5, jack: 'easy', police: 'easy', stopAt: (g) => g.state.phase === 2 });
	assert.strictEqual(game.state.phase, 2);
	const women = recorder.exportPublic('police', { date }).actions.find((a) => a.type === 'women');
	assert.ok(women.args.women.length > 0);
	assert.ok(!('wretched' in women.args), 'face down while the patrols are placed');
	assert.throws(() => recorder.exportFull({ date }), /only available once the game is over/);
	const later = play({ seed: 5, jack: 'easy', police: 'easy', stopAt: (g) => g.state.phase === 10 });
	const turned = later.recorder.exportPublic('police', { date }).actions.find((a) => a.type === 'women');
	assert.deepStrictEqual(turned.args.wretched, later.recorder.actions().find((a) => a.type === 'women').args.marked);
});

test('a game in progress: a safe public record, then the full one only after ending it on purpose', () => {
	const { WC, recorder, game } = play({ seed: 4, jack: 'easy', police: 'easy', stopAt: (g) => g.state.jack.length === 2 && g.state.phase === 10 });
	assert.strictEqual(recorder.status(), 'inProgress');
	const pub = recorder.exportPublic('police', { date });
	assert.strictEqual(pub.outcome, null);
	assert.strictEqual(validate(text(pub, WC)).verdict, 'partial');
	assert.strictEqual(validate(text(pub, WC)).status, 'inProgress');
	assert.ok(!recorder.canExportFull());
	assert.strictEqual(recorder.abandon(), false, 'not without confirming');
	assert.strictEqual(recorder.abandon({ confirmed: 'yes' }), false);
	assert.strictEqual(recorder.abandon({ confirmed: true }), true);
	assert.strictEqual(recorder.status(), 'abandoned');
	const full = recorder.exportFull({ date });
	assert.deepStrictEqual([full.outcome.result, full.outcome.winner], ['abandoned', null]);
	assert.strictEqual(full.final.state.base, game.state.base, 'Jack\'s secrets, now that the game is over');
	// Later actions are not part of an ended game
	const count = recorder.actions().length;
	game.movePoliceman(0, WC.rules.policeNight(game.state).now[0]);
	assert.strictEqual(recorder.actions().length, count);
	const report = validate(text(full, WC));
	assert.strictEqual(report.verdict, 'verified', report.errors.join('\n'));
	assert.strictEqual(report.status, 'abandoned');
});

test('the Jack side\'s public record (for a future human Jack): his own secrets, not the fake patrols', () => {
	const { WC, recorder } = play({ seed: 4, jack: 'easy', police: 'easy', stopAt: (g) => g.state.phase === 4 || g.state.phase === 5 });
	const pub = recorder.exportPublic('jack', { date });
	const patrols = pub.actions.filter((a) => a.type === 'patrol');
	assert.ok(patrols.length >= 7);
	assert.ok(patrols.every((a) => a.args.kind === undefined), 'real or fake: unknown until the policemen take the board');
	assert.strictEqual(pub.current.hideout, recorder.actions()[0].args.mapid, 'his own hideout');
	assert.ok(!('real' in pub.nights[0].patrols) && !('fake' in pub.nights[0].patrols));
	assert.strictEqual(validate(text(pub, WC)).verdict, 'partial');
	const done = fourNights.recorder.exportPublic('jack', { date });
	assert.ok(done.actions.filter((a) => a.type === 'patrol').every((a) => a.args.kind));
});

test('undone moves and patrol tokens taken back are kept apart, and the history still replays', () => {
	const { WC, recorder, game } = play({ seed: 11, jack: 'easy', police: 'easy', stopAt: (g) => g.state.phase === 2 });
	const positions = WC.rules.patrolPositions(game.state).all;
	assert.ok(game.togglePatrol(positions[0], 'real'));
	assert.ok(game.togglePatrol(positions[0], 'real'), 'taken back');
	assert.ok(game.togglePatrol(positions[1], 'fake'));
	assert.ok(game.togglePatrol(positions[1], 'real'), 'switched from fake to real');
	assert.deepStrictEqual(plain(recorder.actions().filter((a) => a.type === 'patrol').map((a) => [a.args.mapid, a.args.kind])), [[positions[1], 'real']]);
	assert.strictEqual(recorder.status(), 'inProgress');
	// Play on to the hunt, then move, undo and move again
	const rest = play({ seed: 11, jack: 'easy', police: 'easy', stopAt: (g) => g.state.phase === 10 && g.state.turn.moved.length === 0 });
	const g = rest.game;
	const now = WC.rules.policeNight(g.state).now;
	const first = rest.WC.rules.policeDestinations(g.state, 0)[0];
	assert.ok(g.movePoliceman(0, first));
	assert.ok(g.undoPoliceMove());
	assert.ok(g.movePoliceman(0, now[0]), 'stays where he was');
	const moves = rest.recorder.actions().filter((a) => a.type === 'policeman' && a.night === g.state.jack.length - 1 && a.jackMove === g.state.jack[g.state.jack.length - 1].moves.length);
	assert.deepStrictEqual(plain(moves.map((a) => a.args.to)), [now[0]], 'only the move that stands');
	rest.recorder.abandon({ confirmed: true });
	const full = rest.recorder.exportFull({ date });
	assert.deepStrictEqual(plain(full.interactions.map((x) => x.kind)), ['undone']);
	assert.deepStrictEqual(plain(full.interactions[0].args), { index: 0, to: first });
	assert.strictEqual(validate(text(full, rest.WC)).verdict, 'verified');
	// The interactions are never replayed: the same record without them replays the same
	assert.ok(rest.WC.record.replay(Object.assign({}, full, { interactions: [] })).ok);
});

test('each action says how much of the night\'s public record had been seen when it was taken', () => {
	const full = fourNights.recorder.exportFull({ date });
	const night = full.nights[1].police.log;
	for (const a of full.actions.filter((x) => x.night === 1 && x.type === 'search')) {
		assert.deepStrictEqual(plain(night[a.known]), { type: 'search', mapid: a.args.mapid, clue: a.result === 'clue' }, 'its own result comes next');
	}
	// A search's evidence: the moves Jack had made before it, not after
	const search = full.actions.find((a) => a.type === 'search' && a.night === 1);
	assert.strictEqual(night.slice(0, search.known).filter((e) => e.type === 'move').length, search.jackMove);
});

test('imports: the example files validate, a fixture can be cut from a full record, and a summary counts each game once', () => {
	const dir = path.join(root, 'docs', 'examples', 'game-records');
	const reports = fs.readdirSync(dir).map((name) => Object.assign({ file: name }, validate(fs.readFileSync(path.join(dir, name), 'utf8'))));
	assert.deepStrictEqual(reports.map((r) => [r.file, r.verdict]).sort(), [
		['abandoned-full.json', 'verified'], ['completed-full.json', 'verified'], ['completed-public.json', 'partial'], ['in-progress-public.json', 'partial']]);
	const summary = summarise(reports);
	assert.strictEqual(summary.games, 3, 'the completed game\'s two records count once');
	assert.strictEqual(summary.duplicates, 1);

	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wc-records-'));
	const out = path.join(tmp, 'fixture.json');
	const log = console.log;
	console.log = () => {};
	try {
		assert.strictEqual(importer.main(['--fixture', out, '--upto', '40', path.join(dir, 'completed-full.json')]), 0);
		assert.strictEqual(importer.main(['--fixture', out, '--upto', '40', path.join(dir, 'completed-full.json')]), 1, 'never overwrites');
		assert.strictEqual(importer.main([dir]), 0);
	} finally {
		console.log = log;
	}
	const fixture = JSON.parse(fs.readFileSync(out, 'utf8'));
	assert.ok(fixture.actions.length >= 40);
	assert.strictEqual(fixture.actions[fixture.actions.length - 1].side, 'police', 'the position is the police\'s turn');
	const position = fourNights.WC.record.replay(fixture);
	assert.ok(position.ok, position.problems.join('\n'));
	assert.ok([2, 5, 10, 11, 12].includes(position.game.state.phase));
	fs.rmSync(tmp, { recursive: true });
});

test('malformed, tampered and incompatible records are rejected', () => {
	const { WC, recorder } = arrested;
	const full = recorder.exportFull({ date });
	const pub = recorder.exportPublic('police', { date });
	const tamper = (record, change) => {
		const copy = JSON.parse(JSON.stringify(record));
		change(copy);
		return validate(JSON.stringify(copy));
	};
	assert.strictEqual(validate('{ not json').verdict, 'invalid');
	assert.strictEqual(validate('[1, 2]').verdict, 'invalid');
	assert.strictEqual(validate(JSON.stringify({ format: 'something else' })).verdict, 'invalid');
	assert.strictEqual(validate('{"format":"whitechapel-game-log","__proto__":{"polluted":1}}').verdict, 'invalid');
	assert.strictEqual(({}).polluted, undefined);
	assert.strictEqual(tamper(full, (r) => { r.schemaVersion = 2; }).verdict, 'incompatible');
	assert.strictEqual(tamper(full, (r) => { r.ruleset.id = 'whitechapel-000000000000'; }).verdict, 'incompatible');
	assert.strictEqual(tamper(full, (r) => { delete r.game; }).verdict, 'invalid');
	assert.strictEqual(tamper(full, (r) => { r.actions[3].type = 'teleport'; }).verdict, 'invalid');
	assert.strictEqual(tamper(full, (r) => { r.actions.splice(5, 1); }).verdict, 'invalid', 'a missing action');
	assert.strictEqual(tamper(full, (r) => { [r.actions[4], r.actions[5]] = [r.actions[5], r.actions[4]]; }).verdict, 'invalid', 'out of order');
	assert.strictEqual(tamper(full, (r) => { r.actions[0].args.mapid = 9999; }).verdict, 'invalid', 'off the map');
	assert.strictEqual(tamper(full, (r) => { r.actions[0].phase = 4; }).verdict, 'invalid', 'wrong phase');
	assert.strictEqual(tamper(full, (r) => { r.game.status = 'inProgress'; r.outcome = null; }).verdict, 'invalid', 'a full record of a game in progress');
	assert.strictEqual(tamper(full, (r) => { r.outcome.winner = 'jack'; }).verdict, 'invalid', 'the wrong winner');
	assert.strictEqual(tamper(full, (r) => { r.extra = 1; }).verdict, 'invalid', 'unexpected fields');
	// Replay mismatches: a different move for Jack, a different search result, a different final state
	const move = full.actions.findIndex((a) => a.type === 'move' && a.args.type === 'walk');
	const moved = tamper(full, (r) => {
		const from = r.actions.find((a) => a.type === 'victims').args.scenes[0];
		r.actions[move].args.mapid = WC.board.walk(from, []).find((id) => id !== r.actions[move].args.mapid);
	});
	assert.strictEqual(moved.verdict, 'invalid');
	const search = full.actions.findIndex((a) => a.type === 'search' && a.result === 'miss');
	const flipped = tamper(full, (r) => {
		r.actions[search].result = 'clue';
		const log = r.nights[r.actions[search].night].police.log.find((e) => e.type === 'search' && e.mapid === r.actions[search].args.mapid && !e.clue);
		log.clue = true;
	});
	assert.strictEqual(flipped.verdict, 'invalid');
	assert.ok(flipped.errors.some((e) => /differs on replay|differs/.test(e)), flipped.errors.join('\n'));
	const state = tamper(full, (r) => { r.final.state.base = (r.final.state.base + 1) % 100; });
	assert.strictEqual(state.verdict, 'invalid');
	assert.ok(state.errors.some((e) => /final state/.test(e)));
	// A public record that says too much, or whose actions don't match its nights
	const leak = tamper(pub, (r) => { r.actions.find((a) => a.type === 'move').args.mapid = 12; });
	assert.strictEqual(leak.verdict, 'invalid');
	assert.ok(leak.errors.some((e) => /discloses hidden information/.test(e)));
	assert.strictEqual(tamper(pub, (r) => { r.final = { state: {} }; }).verdict, 'invalid');
	assert.strictEqual(tamper(pub, (r) => { r.actions.find((a) => a.type === 'search').result = 'clue'; }).verdict, 'invalid');
	assert.strictEqual(tamper(pub, (r) => { r.actions.find((a) => a.type === 'victims').known = 3; }).verdict, 'invalid');
	assert.strictEqual(tamper(pub, (r) => { r.feedback = { name: 'A Person' }; }).verdict, 'invalid', 'nothing but a label and comments');
});

test('the record holds game data only: no personal or device information, and the app version is package.json\'s', () => {
	const { WC, recorder } = fourNights;
	const full = recorder.exportFull({ date, feedback: { label: '  tester 7 ', comments: '', email: 'x@example.com' } });
	assert.deepStrictEqual(plain(Object.keys(full).sort()), ['actions', 'app', 'disclosure', 'feedback', 'final', 'format', 'game', 'interactions', 'nights', 'outcome', 'role', 'ruleset', 'schemaVersion']);
	assert.deepStrictEqual(plain(full.feedback), { label: 'tester 7' });
	assert.deepStrictEqual(plain(Object.keys(full.game).sort()), ['exportedOn', 'id', 'nightsPlayed', 'players', 'randomness', 'settings', 'status']);
	assert.doesNotMatch(text(full, WC), /userAgent|navigator|email|@example|ip"|location|cookie/i);
	assert.strictEqual(WC.record.appVersion, require('../../package.json').version);
	assert.strictEqual(WC.record.filename(full), 'whitechapel-game-2026-10-10-full.json');
	assert.strictEqual(recorder.exportPublic('police', { date }).feedback, undefined, 'no feedback unless written');
});

test('recording changes nothing about the game, and exports don\'t share the state', () => {
	// The same seed plays the same game with or without a recorder (it draws no random numbers)
	const again = play({ seed: 11, jack: 'easy', police: 'easy' });
	assert.deepStrictEqual(JSON.parse(JSON.stringify(again.game.state)), JSON.parse(JSON.stringify(fourNights.game.state)));
	const full = fourNights.recorder.exportFull({ date });
	full.final.state.jack[0].route.push(1);
	full.actions[0].args.mapid = 1;
	assert.notStrictEqual(fourNights.game.state.jack[0].route.slice(-1)[0], 1);
	assert.notStrictEqual(fourNights.recorder.actions()[0].args.mapid, 1);
});
