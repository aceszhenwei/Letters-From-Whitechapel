// Playtest records in the browser (js/ui/playtest-store.js, js/ui/zip.js), without a page: IndexedDB (fake-indexeddb,
// which behaves as the browser's), checking records before they are kept, duplicates and conflicts, failures of
// storage, and ZIP batches.
const test = require('node:test');
const assert = require('node:assert');
const zlib = require('zlib');
const { IDBFactory } = require('fake-indexeddb');
const { loadStore, firstRecord, firstId, humanJackRecord } = require('../helpers/playtests');

const plain = (value) => JSON.parse(JSON.stringify(value));
const inflate = (bytes) => zlib.inflateRawSync(bytes);

test('the first real Human Jack game passes the browser\'s import check: full, completed, a person played, replays exactly', () => {
	const WC = loadStore();
	const record = firstRecord();
	assert.deepStrictEqual(plain(WC.playtests.check(record)), { ok: true, verdict: 'verified', problems: [] });
	assert.strictEqual(WC.playtests.role(record), 'jack');
	assert.deepStrictEqual(plain(WC.playtests.opponent(record)), { ai: 'Detective AI v3', level: 'normal' });
});

test('the import check refuses changed actions, public records, other rules, unfinished games and games no person played', () => {
	const WC = loadStore();
	const changed = firstRecord();
	changed.actions[1].args.marked[0] = 8; // A decision the game never made
	assert.strictEqual(WC.playtests.check(changed).verdict, 'invalid');
	const other = firstRecord();
	other.ruleset.id = 'whitechapel-000000000000';
	assert.strictEqual(WC.playtests.check(other).verdict, 'incompatible');
	const newer = firstRecord();
	newer.schemaVersion = 2;
	assert.strictEqual(WC.playtests.check(newer).verdict, 'incompatible');
	const pub = firstRecord();
	pub.disclosure = 'public';
	assert.strictEqual(WC.playtests.check(pub).verdict, 'ineligible');
	const unfinished = firstRecord();
	unfinished.game.status = 'abandoned';
	assert.strictEqual(WC.playtests.check(unfinished).verdict, 'ineligible');
	const computer = firstRecord();
	computer.game.players.jack = { type: 'ai', level: 'normal', ai: 'Strategic Jack' };
	assert.strictEqual(WC.playtests.check(computer).verdict, 'ineligible');
	assert.strictEqual(WC.playtests.check('{"not":"a record"}').verdict, 'invalid');
	assert.strictEqual(WC.playtests.check(null).verdict, 'invalid');
});

test('a game is kept once: the same game again is a duplicate, even re-exported another day with a note; a different record with its id is a conflict', async () => {
	const WC = loadStore();
	const store = await WC.playtests.open({ indexedDB: new IDBFactory() });
	assert.ok(store.available());
	const record = firstRecord();
	assert.strictEqual((await store.add(record)).status, 'saved');
	assert.strictEqual((await store.add(record)).status, 'duplicate');
	const again = firstRecord();
	again.game.exportedOn = '2027-01-01';
	again.feedback = { label: 'me' };
	assert.strictEqual((await store.add(again)).status, 'duplicate');
	const different = firstRecord();
	different.outcome.jackMove = 3;
	const conflict = await store.add(different);
	assert.strictEqual(conflict.status, 'conflict');
	const kept = await store.list();
	assert.strictEqual(kept.length, 1);
	assert.strictEqual(JSON.stringify(kept[0].record), JSON.stringify(record), 'never overwritten');
	const e = kept[0];
	assert.deepStrictEqual([e.id, e.role, e.opponent, e.level, e.result, e.winner, e.date, e.appVersion, e.exportedAt, e.exportCount, e.source],
		[firstId, 'jack', 'Detective AI v3', 'normal', 'jackWins', 'jack', '2026-10-10', '1.0.0', null, 0, 'auto']);
});

test('records survive closing the page: a new connection to the same browser storage finds them', async () => {
	const WC = loadStore();
	const browser = new IDBFactory();
	const first = await WC.playtests.open({ indexedDB: browser });
	await first.add(firstRecord());
	const other = loadStore(); // Another page, another session
	const second = await other.playtests.open({ indexedDB: browser });
	const kept = await second.list();
	assert.deepStrictEqual(kept.map((e) => e.id), [firstId]);
	assert.strictEqual(JSON.stringify(kept[0].record), JSON.stringify(firstRecord()));
	await second.markExported([firstId], new Date('2026-10-11T08:00:00Z'));
	const third = await loadStore().playtests.open({ indexedDB: browser });
	const entry = await third.get(firstId);
	assert.strictEqual(entry.exportedAt, '2026-10-11T08:00:00.000Z');
	assert.strictEqual(entry.exportCount, 1);
	await third.remove(firstId);
	assert.deepStrictEqual(await third.list(), []);
	await third.add(firstRecord());
	await third.clear();
	assert.strictEqual((await third.list()).length, 0);
});

test('without storage the store says so and every call rejects: no IndexedDB, IndexedDB throwing, or refusing to open', async () => {
	const WC = loadStore();
	const none = await WC.playtests.open({ indexedDB: null });
	assert.strictEqual(none.available(), false);
	await assert.rejects(none.add(firstRecord()), /not available/);
	await assert.rejects(none.list(), /not available/);
	const throwing = await WC.playtests.open({ indexedDB: { open: () => { throw new Error('SecurityError'); } } });
	assert.strictEqual(throwing.available(), false);
	assert.match(throwing.reason, /SecurityError/);
	const refusing = await WC.playtests.open({ indexedDB: { open: () => {
		const request = {};
		setTimeout(() => { request.error = new Error('QuotaExceededError'); request.onerror(); }, 0);
		return request;
	} } });
	assert.strictEqual(refusing.available(), false);
	assert.match(refusing.reason, /QuotaExceededError/);
});

test('a batch ZIP: manifest.json and records/<game id>.json, each record unchanged; it reads back and restores into another browser', async () => {
	const WC = loadStore();
	const store = await WC.playtests.open({ indexedDB: new IDBFactory() });
	const second = humanJackRecord(3);
	await store.add(firstRecord());
	await store.add(second);
	const entries = await store.list();
	const made = WC.playtests.batch(entries, new Date('2026-10-10T19:30:00Z'));
	assert.strictEqual(made.name, 'whitechapel-playtests-20261010-1930.zip');
	const files = await WC.zip.read(made.bytes, inflate);
	assert.deepStrictEqual(files.map((f) => f.name).sort(), ['manifest.json', 'records/' + firstId + '.json', 'records/' + second.game.id + '.json'].sort());
	const manifest = JSON.parse(files.find((f) => f.name == 'manifest.json').text);
	assert.strictEqual(manifest.format, 'whitechapel-playtest-batch');
	assert.strictEqual(manifest.count, 2);
	assert.strictEqual(manifest.exportedAt, '2026-10-10T19:30:00.000Z');
	assert.deepStrictEqual(plain(manifest.schema), { format: 'whitechapel-game-log', schemaVersion: 1, ruleset: WC.record.ruleset.id, appVersion: '1.0.0' });
	assert.deepStrictEqual(manifest.games.map((g) => g.id).sort(), [firstId, second.game.id].sort());
	assert.match(manifest.upload, /does not upload/);
	const inZip = JSON.parse(files.find((f) => f.name == 'records/' + firstId + '.json').text);
	assert.strictEqual(JSON.stringify(inZip), JSON.stringify(firstRecord()), 'the record exactly as kept');
	// Into another browser: both added; again: both skipped as duplicates
	const other = await WC.playtests.open({ indexedDB: new IDBFactory() });
	const once = await WC.playtests.importFiles(other, [{ name: made.name, bytes: made.bytes }], inflate);
	assert.deepStrictEqual([once.added.length, once.duplicates.length, once.conflicts.length, once.rejected.length], [2, 0, 0, 0]);
	const twice = await WC.playtests.importFiles(other, [{ name: made.name, bytes: made.bytes }], inflate);
	assert.deepStrictEqual([twice.added.length, twice.duplicates.length], [0, 2]);
	assert.strictEqual((await other.list()).every((e) => e.source === 'import'), true);
});

test('importing JSON files: valid ones kept, conflicts and invalid ones reported and not kept', async () => {
	const WC = loadStore();
	const store = await WC.playtests.open({ indexedDB: new IDBFactory() });
	const enc = (value) => new TextEncoder().encode(typeof value == 'string' ? value : JSON.stringify(value));
	const changed = firstRecord();
	changed.outcome.jackMove = 3; // Same id, different record, and no longer consistent
	const out = await WC.playtests.importFiles(store, [
		{ name: firstId + '.json', bytes: enc(firstRecord()) },
		{ name: 'broken.json', bytes: enc('{ not json') },
		{ name: 'changed.json', bytes: enc(changed) }
	], inflate);
	assert.deepStrictEqual(plain(out.added.map((a) => a.id)), [firstId]);
	assert.deepStrictEqual(plain(out.rejected.map((r) => r.file).sort()), ['broken.json', 'changed.json']);
	// A record that is valid but differs from the one kept (a hand-made clash of ids) is a conflict, not an overwrite
	const second = humanJackRecord(5);
	second.game.id = firstId;
	const clash = await WC.playtests.importFiles(store, [{ name: 'clash.json', bytes: enc(second) }], inflate);
	assert.deepStrictEqual(plain(clash.conflicts.map((c) => c.id)), [firstId]);
	assert.strictEqual(JSON.stringify((await store.get(firstId)).record), JSON.stringify(firstRecord()));
});

test('ZIP: stored archives round-trip; deflated ones from other tools read with an inflater; damaged ones are refused', async () => {
	const WC = loadStore();
	const files = [{ name: 'a.json', text: '{"a":1}' }, { name: 'records/é.json', text: 'ünïcödé' }];
	const zip = WC.zip.create(files, new Date('2026-10-10T12:00:00Z'));
	assert.deepStrictEqual(plain(await WC.zip.read(zip)), files);
	// A deflated archive, as another tool writes it
	const data = new TextEncoder().encode('{"deflated":true}');
	const deflated = zlib.deflateRawSync(data);
	const name = Buffer.from('records/x.json');
	const local = Buffer.alloc(30);
	local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
	local.writeUInt32LE(WC.zip.crc32(data), 14); local.writeUInt32LE(deflated.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
	const central = Buffer.alloc(46);
	central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(WC.zip.crc32(data), 16);
	central.writeUInt32LE(deflated.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28);
	const body = Buffer.concat([local, name, deflated]);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(46 + name.length, 12); end.writeUInt32LE(body.length, 16);
	const archive = new Uint8Array(Buffer.concat([body, central, name, end]));
	assert.deepStrictEqual(plain(await WC.zip.read(archive, inflate)), [{ name: 'records/x.json', text: '{"deflated":true}' }]);
	await assert.rejects(WC.zip.read(archive), /not supported/);
	const damaged = zip.slice();
	damaged[40] ^= 0xFF; // Inside the first file's data
	await assert.rejects(WC.zip.read(damaged), /damaged/);
	await assert.rejects(WC.zip.read(new Uint8Array([1, 2, 3])), /not a ZIP/);
});

test('automatic saving: a game a person finishes is kept once; unfinished games and games the computer played alone are not; failures are reported', async () => {
	const WC = loadStore();
	const listeners = [];
	const game = { on: (f) => listeners.push(f) };
	const emit = (type) => listeners.forEach((f) => f(type, {}));
	const record = firstRecord();
	let status = 'completed';
	let full = record;
	const recorder = { status: () => status, exportFull: () => full };
	const store = await WC.playtests.open({ indexedDB: new IDBFactory() });
	const results = [];
	const settle = (list, n) => new Promise((resolve) => {
		const started = Date.now();
		const poll = () => (list.length >= n || Date.now() - started > 3000 ? resolve() : setTimeout(poll, 10));
		poll();
	});
	const done = () => new Promise((resolve) => setTimeout(resolve, 300));
	WC.playtests.autoSave(game, recorder, Promise.resolve(store), (r) => results.push(r.status));
	emit('phase');
	emit('gameOver');
	await settle(results, 1);
	emit('gameOver'); // Never twice
	await settle(results, 2);
	assert.deepStrictEqual(results, ['saved', 'duplicate']);
	assert.strictEqual((await store.list()).length, 1);
	status = 'abandoned'; // Ended by hand: not saved
	full = humanJackRecord(4);
	emit('gameOver');
	await done();
	assert.strictEqual((await store.list()).length, 1);
	status = 'completed';
	full = JSON.parse(JSON.stringify(record));
	full.game.id = 'gcomputeronly';
	full.game.players = { jack: { type: 'ai' }, police: { type: 'ai' } };
	emit('gameOver');
	await done();
	assert.strictEqual((await store.list()).length, 1, 'the computer playing both sides is not a playtest');
	// Storage failing: reported, and nothing thrown into the game
	const broken = await WC.playtests.open({ indexedDB: null });
	const failures = [];
	const listeners2 = [];
	WC.playtests.autoSave({ on: (f) => listeners2.push(f) }, { status: () => 'completed', exportFull: () => record }, Promise.resolve(broken), (r) => failures.push(r));
	assert.doesNotThrow(() => listeners2.forEach((f) => f('gameOver', {})));
	await settle(failures, 1);
	assert.strictEqual(failures[0].status, 'failed');
	assert.match(failures[0].error.message, /not available/);
});
