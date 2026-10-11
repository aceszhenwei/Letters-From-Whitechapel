// The playtest submission Worker (worker/src/index.js, docs/automatic-playtest-collection.md), run in Node against a
// local D1 (test/helpers/d1.js: node:sqlite with the Worker's real migrations). No request leaves this machine.
// Covers valid records, duplicates and conflicts (also when simultaneous), every refusal, rate limits, caps, the
// emergency pause, storage failures, the import endpoints, and that nothing about the sender is stored.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { database, rateLimiter } = require('../helpers/d1');
const { loadStore, firstRecord, firstId, root } = require('../helpers/playtests');

const WC = loadStore();
const origin = 'https://aceszhenwei.github.io';
const token = 'a'.repeat(24) + 'import-token-for-tests-only';
let worker;
let entry;

test.before(async () => {
	worker = await import('../../worker/src/app.js');
	entry = await import('../../worker/src/index.js');
});

function env(overrides = {}) {
	return Object.assign({
		DB: database(),
		RATE_LIMITER: rateLimiter(1000),
		ALLOWED_ORIGINS: origin,
		ACCEPTED_RULESETS: WC.record.ruleset.id,
		IMPORT_TOKEN: token
	}, overrides);
}

function post(body, headers = {}) {
	return new Request('https://intake.example/api/v1/playtests', {
		method: 'POST',
		headers: Object.assign({ 'Content-Type': 'application/json', 'Origin': origin, 'CF-Connecting-IP': '203.0.113.7', 'User-Agent': 'TestBrowser/1.0' }, headers),
		body: typeof body === 'string' ? body : WC.record.stringify(body)
	});
}

function get(url, auth = token) {
	return new Request('https://intake.example' + url, { headers: auth ? { Authorization: 'Bearer ' + auth } : {} });
}

async function send(e, request, now) {
	const response = await worker.handle(request, e, now ? { now: () => now } : {});
	const text = await response.text();
	let body = null;
	try { body = JSON.parse(text); } catch (error) { /* A record's body */ }
	return { status: response.status, body, text, headers: response.headers };
}

const rows = (e) => e.DB.sqlite.prepare('SELECT * FROM submissions ORDER BY seq').all();

test('a valid full record of a completed human game is accepted and stored exactly as sent', async () => {
	const e = env();
	const text = WC.record.stringify(firstRecord());
	const r = await send(e, post(text));
	assert.strictEqual(r.status, 201);
	assert.deepStrictEqual([r.body.ok, r.body.status, r.body.gameId], [true, 'accepted', firstId]);
	assert.strictEqual(r.headers.get('Access-Control-Allow-Origin'), origin);
	const stored = rows(e);
	assert.strictEqual(stored.length, 1);
	assert.strictEqual(stored[0].body, text, 'byte for byte');
	assert.deepStrictEqual([stored[0].game_id, stored[0].role, stored[0].opponent, stored[0].level, stored[0].result, stored[0].ruleset, stored[0].app_version],
		[firstId, 'jack', 'Detective AI v3', 'normal', 'jackWins', WC.record.ruleset.id, '1.0.0']);
	assert.match(stored[0].received_on, /^\d{4}-\d{2}-\d{2}$/, 'a date, no time of day');
	assert.strictEqual(stored[0].bytes, Buffer.byteLength(text));
	const crypto = require('crypto');
	assert.strictEqual(stored[0].body_sha256, crypto.createHash('sha256').update(text).digest('hex'));
	assert.strictEqual(e.DB.sqlite.prepare("SELECT value FROM counters WHERE name = 'stored'").get().value, 1);
});

test('nothing about the sender is stored: no IP address, user agent or origin anywhere in the database', async () => {
	const e = env();
	await send(e, post(firstRecord()));
	await send(e, post('{bad json'));
	const dump = JSON.stringify(['submissions', 'counters', 'daily_stats'].map((t) => e.DB.sqlite.prepare(`SELECT * FROM ${t}`).all()));
	for (const secret of ['203.0.113.7', 'TestBrowser', origin]) assert.ok(!dump.includes(secret), secret);
	const columns = e.DB.sqlite.prepare('PRAGMA table_info(submissions)').all().map((c) => c.name);
	assert.ok(!columns.some((c) => /ip|agent|origin|header/i.test(c)), columns.join(','));
});

test('the same game again is a duplicate (also with another export date); a different record with its id is a conflict, never stored', async () => {
	const e = env();
	assert.strictEqual((await send(e, post(firstRecord()))).status, 201);
	const again = await send(e, post(firstRecord()));
	assert.deepStrictEqual([again.status, again.body.status, again.body.ok], [200, 'duplicate', true]);
	const redated = firstRecord();
	redated.game.exportedOn = '2026-12-25';
	assert.strictEqual((await send(e, post(redated))).body.status, 'duplicate');
	const changed = firstRecord();
	changed.actions[1].args.marked[0] = 8;
	const conflict = await send(e, post(changed));
	assert.deepStrictEqual([conflict.status, conflict.body.status, conflict.body.ok], [409, 'conflict', false]);
	assert.strictEqual(rows(e).length, 1);
	assert.strictEqual(rows(e)[0].body, WC.record.stringify(firstRecord()), 'the first record is kept unchanged');
});

test('simultaneous submissions of one game store it exactly once (the UNIQUE game id, not a read-then-write)', async () => {
	const e = env();
	const results = await Promise.all(Array.from({ length: 8 }, () => send(e, post(firstRecord()))));
	assert.deepStrictEqual(results.map((r) => r.status).sort(), [200, 200, 200, 200, 200, 200, 200, 201]);
	const changed = firstRecord();
	changed.actions[1].args.marked[0] = 8;
	const mixed = await Promise.all([send(e, post(changed)), send(e, post(firstRecord()))]);
	assert.deepStrictEqual(mixed.map((r) => r.status).sort(), [200, 409]);
	assert.strictEqual(rows(e).length, 1);
	assert.strictEqual(e.DB.sqlite.prepare("SELECT value FROM counters WHERE name = 'stored'").get().value, 1);
});

test('refused: malformed JSON, the wrong content type, oversized bodies (declared or streamed), invalid UTF-8', async () => {
	const e = env({ MAX_BODY_BYTES: '200000' });
	assert.deepStrictEqual(Object.values((await send(e, post('{"format": '))).body).slice(0, 2), [false, 'invalid_json']);
	assert.strictEqual((await send(e, post('{"format": ')).then((r) => r.status)), 400);
	const plain = await send(e, post(firstRecord(), { 'Content-Type': 'text/plain' }));
	assert.deepStrictEqual([plain.status, plain.body.status], [415, 'unsupported_media_type']);
	const big = 'x'.repeat(200001);
	assert.deepStrictEqual([(await send(e, post(big))).status], [413]);
	// No Content-Length: the body is streamed, and reading stops past the limit
	const stream = new ReadableStream({
		start(controller) {
			for (let i = 0; i < 50; i++) controller.enqueue(new TextEncoder().encode('y'.repeat(10000)));
			controller.close();
		}
	});
	const streamed = new Request('https://intake.example/api/v1/playtests', { method: 'POST', body: stream, duplex: 'half',
		headers: { 'Content-Type': 'application/json', 'Origin': origin } });
	assert.strictEqual((await send(e, streamed)).status, 413);
	const bad = new Request('https://intake.example/api/v1/playtests', { method: 'POST', body: new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]),
		headers: { 'Content-Type': 'application/json', 'Origin': origin } });
	assert.strictEqual((await send(e, bad)).status, 400);
	assert.strictEqual(rows(e).length, 0);
});

test('refused: other formats and schema versions, other rule sets, public or unfinished games, games no person played', async () => {
	const e = env();
	const cases = [
		[(r) => { r.format = 'something-else'; }, 400, 'not_a_record'],
		[(r) => { r.schemaVersion = 2; }, 422, 'unsupported_schema'],
		[(r) => { r.ruleset.id = 'whitechapel-000000000000'; }, 422, 'unsupported_ruleset'],
		[(r) => { r.disclosure = 'public'; }, 422, 'not_full'],
		[(r) => { r.game.status = 'abandoned'; }, 422, 'not_completed'],
		[(r) => { r.game.status = 'inProgress'; r.outcome = null; }, 422, 'not_completed'],
		[(r) => { r.game.players.jack = { type: 'ai', ai: 'Strategic Jack', level: 'normal' }; }, 422, 'not_human'],
		[(r) => { r.game.players.police = { type: 'human' }; }, 422, 'not_human'],
		[(r) => { r.outcome.winner = 'police'; }, 422, 'bad_outcome'],
		[(r) => { r.actions = []; }, 422, 'bad_actions'],
		[(r) => { r.actions[3].seq = 99; }, 422, 'bad_actions'],
		[(r) => { r.actions[3].type = 'teleport'; }, 422, 'bad_actions'],
		[(r) => { r.nights.pop(); }, 422, 'bad_record']
	];
	for (const [change, status, code] of cases) {
		const r = firstRecord();
		change(r);
		const got = await send(e, post(r));
		assert.deepStrictEqual([got.status, got.body.status], [status, code], code);
	}
	assert.strictEqual((await send(e, post('[1, 2]'))).status, 400);
	assert.strictEqual((await send(e, post('null'))).status, 400);
	assert.strictEqual(rows(e).length, 0);
});

test('refused: unsafe game ids, written notes, extra fields and odd player labels; messages never echo the input', async () => {
	const e = env();
	const evil = ['../../.github/workflows/x', 'g91d4014f17ae09e6/../../a', 'G91D4014F17AE09E6', 'g91d4014f17ae09e', '<script>', ''];
	for (const id of evil) {
		const r = firstRecord();
		r.game.id = id;
		const got = await send(e, post(r));
		assert.deepStrictEqual([got.status, got.body.status], [422, 'bad_game_id'], id);
		if (id) assert.ok(!got.text.includes(id), 'not echoed');
	}
	const noted = firstRecord();
	noted.feedback = { label: 'Alice from Bedok', comments: 'email me at alice@example.com' };
	const n = await send(e, post(noted));
	assert.deepStrictEqual([n.status, n.body.status], [422, 'has_note']);
	assert.ok(!n.text.includes('alice'));
	const extra = firstRecord();
	extra.tracking = { device: 'x' };
	assert.strictEqual((await send(e, post(extra))).body.status, 'unexpected_field');
	const extraGame = firstRecord();
	extraGame.game.player = 'Alice';
	assert.strictEqual((await send(e, post(extraGame))).body.status, 'unexpected_field');
	const label = firstRecord();
	label.game.players.police.ai = '<img src=x onerror=alert(1)>';
	assert.strictEqual((await send(e, post(label))).body.status, 'bad_players');
	assert.strictEqual(rows(e).length, 0);
});

test('methods, paths and origins: preflight for the site, 403 for other sites, 405 and 404 otherwise', async () => {
	const e = env();
	const pre = await worker.handle(new Request('https://intake.example/api/v1/playtests', { method: 'OPTIONS', headers: { Origin: origin } }), e);
	assert.strictEqual(pre.status, 204);
	assert.strictEqual(pre.headers.get('Access-Control-Allow-Origin'), origin);
	assert.match(pre.headers.get('Access-Control-Allow-Methods'), /POST/);
	const other = await send(e, post(firstRecord(), { Origin: 'https://evil.example' }));
	assert.deepStrictEqual([other.status, other.body.status], [403, 'origin_not_allowed']);
	assert.strictEqual(other.headers.get('Access-Control-Allow-Origin'), null);
	const got = await send(e, new Request('https://intake.example/api/v1/playtests', { headers: { Origin: origin } }));
	assert.strictEqual(got.status, 405);
	assert.strictEqual((await send(e, new Request('https://intake.example/'))).status, 404);
	assert.strictEqual((await send(e, new Request('https://intake.example/api/v1/playtests/../admin/stats'))).status, 401, 'normalised, then refused');
	const health = await send(e, new Request('https://intake.example/api/v1/health'));
	assert.deepStrictEqual([health.status, health.body.intake, health.body.importEnabled], [200, 'open', true]);
	// Scripts without an Origin header reach the checks (CORS is not a security measure); they are still checked
	assert.strictEqual((await send(e, post(firstRecord(), { Origin: '' }))).status, 201);
});

test('rate limits: 429 with Retry-After once a client sends too many, before any storage is touched', async () => {
	const e = env({ RATE_LIMITER: rateLimiter(2) });
	assert.strictEqual((await send(e, post('{}'))).status, 400);
	assert.strictEqual((await send(e, post('{}'))).status, 400);
	const third = await send(e, post(firstRecord()));
	assert.deepStrictEqual([third.status, third.body.status, third.headers.get('Retry-After')], [429, 'rate_limited', '60']);
	assert.strictEqual(rows(e).length, 0);
	const other = await send(e, post(firstRecord(), { 'CF-Connecting-IP': '198.51.100.1' }));
	assert.strictEqual(other.status, 201, 'another client is not affected');
	// A failing limiter doesn't stop genuine games
	const broken = env({ RATE_LIMITER: { limit: async () => { throw new Error('down'); } } });
	assert.strictEqual((await send(broken, post(firstRecord()))).status, 201);
});

test('caps and the emergency pause: 503 with Retry-After, and a game already received is still acknowledged', async () => {
	const now = new Date('2026-10-11T22:00:00Z');
	const e = env({ DAILY_LIMIT: '1' });
	assert.strictEqual((await send(e, post(firstRecord()), now)).status, 201);
	const second = JSON.parse(fs.readFileSync(path.join(root, 'research', 'human-playtests', 'records', 'ga36125530c4b4076.json'), 'utf8'));
	const full = await send(e, post(second), now);
	assert.deepStrictEqual([full.status, full.body.status, full.headers.get('Retry-After')], [503, 'daily_limit', String(2 * 3600)]);
	assert.strictEqual((await send(e, post(firstRecord()), now)).body.status, 'duplicate', 'a retry still ends');
	assert.strictEqual((await send(e, post(second), new Date('2026-10-12T00:01:00Z'))).status, 201, 'a new day');
	const store = env({ MAX_STORED: '1' });
	await send(store, post(firstRecord()));
	assert.deepStrictEqual([(await send(store, post(second))).status, (await send(store, post(second))).body.status], [503, 'storage_full']);
	const bytes = env({ MAX_STORED_BYTES: '150000' });
	assert.strictEqual((await send(bytes, post(firstRecord()))).status, 201);
	assert.strictEqual((await send(bytes, post(second))).body.status, 'storage_full', 'the total size is capped too');
	const paused = env({ INTAKE_PAUSED: 'true' });
	const p = await send(paused, post(firstRecord()));
	assert.deepStrictEqual([p.status, p.body.status, p.headers.get('Retry-After')], [503, 'paused', '21600']);
	assert.strictEqual(rows(paused).length, 0);
	assert.strictEqual((await send(paused, new Request('https://intake.example/api/v1/health'))).body.intake, 'paused');
});

test('storage failures: 503 and nothing half-written; the same record succeeds once storage is back (an interrupted write)', async () => {
	let down = true;
	const db = database({ fail: (sql) => down && /INSERT INTO submissions/.test(sql) });
	const e = env({ DB: db });
	const r = await send(e, post(firstRecord()));
	assert.deepStrictEqual([r.status, r.body.status, r.headers.get('Retry-After')], [503, 'storage_unavailable', '600']);
	assert.strictEqual(rows(e).length, 0);
	assert.strictEqual(e.DB.sqlite.prepare("SELECT value FROM counters WHERE name = 'stored'").get().value, 0);
	down = false;
	assert.strictEqual((await send(e, post(firstRecord()))).status, 201);
	const dead = env({ DB: database({ fail: () => true }) });
	assert.strictEqual((await send(dead, post(firstRecord()))).status, 503);
	// Anything unexpected: a generic 500, nothing internal in the message
	const broken = await entry.default.fetch(post(firstRecord()), { DB: database(), get ALLOWED_ORIGINS() { throw new Error('secret internals'); } });
	assert.strictEqual(broken.status, 500);
	assert.ok(!(await broken.text()).includes('secret internals'));
});

test('the import endpoints: off without a token, 401 for a wrong one; list metadata, fetch a record byte for byte, daily stats', async () => {
	const e = env();
	await send(e, post(firstRecord()));
	await send(e, post('{oops'));
	assert.strictEqual((await send(env({ IMPORT_TOKEN: '' }), get('/api/v1/admin/submissions'))).status, 404);
	assert.strictEqual((await send(env({ IMPORT_TOKEN: 'short' }), get('/api/v1/admin/submissions', 'short'))).status, 404, 'a weak token is no token');
	assert.strictEqual((await send(e, get('/api/v1/admin/submissions', null))).status, 401);
	assert.strictEqual((await send(e, get('/api/v1/admin/submissions', token + 'x'))).status, 401);
	const list = await send(e, get('/api/v1/admin/submissions'));
	assert.strictEqual(list.status, 200);
	assert.strictEqual(list.body.submissions.length, 1);
	assert.strictEqual(list.body.submissions[0].game_id, firstId);
	assert.ok(!('body' in list.body.submissions[0]), 'metadata only');
	assert.strictEqual(list.body.next, null);
	assert.deepStrictEqual((await send(e, get('/api/v1/admin/submissions?after=1'))).body.submissions, []);
	const one = await send(e, get('/api/v1/admin/submissions/' + firstId));
	assert.strictEqual(one.text, WC.record.stringify(firstRecord()));
	assert.strictEqual(one.headers.get('X-Body-SHA256'), list.body.submissions[0].body_sha256);
	assert.strictEqual((await send(e, get('/api/v1/admin/submissions/..%2F..%2Fetc'))).status, 400);
	assert.strictEqual((await send(e, get('/api/v1/admin/submissions/g0000000000000000'))).status, 404);
	const stats = await send(e, get('/api/v1/admin/stats'));
	const outcomes = Object.fromEntries(stats.body.days.map((d) => [d.outcome, d.count]));
	assert.deepStrictEqual(outcomes, { accepted: 1, invalid_json: 1 });
	const del = await send(e, new Request('https://intake.example/api/v1/admin/submissions/' + firstId, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } }));
	assert.strictEqual(del.status, 405, 'read-only');
	assert.strictEqual(rows(e).length, 1);
});

test('the Worker\'s configuration accepts the game\'s current rule set and keeps logs off', () => {
	const toml = fs.readFileSync(path.join(root, 'worker', 'wrangler.toml'), 'utf8');
	const accepted = toml.match(/^ACCEPTED_RULESETS = "([^"]+)"/m)[1].split(',');
	assert.strictEqual(accepted[0], WC.record.ruleset.id, 'update ACCEPTED_RULESETS in worker/wrangler.toml when the rules or map change');
	assert.match(toml, /\[observability\]\s*\nenabled = false/);
	assert.match(toml, /ALLOWED_ORIGINS = "https:\/\/aceszhenwei\.github\.io"/);
	assert.ok(!/IMPORT_TOKEN\s*=/.test(toml), 'no secret in the file');
});

test('retention: the daily cron deletes submissions older than RETENTION_DAYS and statistics older than 90 days', async () => {
	const e = env();
	await send(e, post(firstRecord()), new Date('2025-10-01T12:00:00Z'));
	const second = JSON.parse(fs.readFileSync(path.join(root, 'research', 'human-playtests', 'records', 'ga36125530c4b4076.json'), 'utf8'));
	await send(e, post(second), new Date('2026-10-01T12:00:00Z'));
	assert.strictEqual(await worker.retain(e, new Date('2026-10-11T04:23:00Z')), 1);
	assert.deepStrictEqual(rows(e).map((r) => r.game_id), ['ga36125530c4b4076']);
	assert.strictEqual(e.DB.sqlite.prepare("SELECT value FROM counters WHERE name = 'stored'").get().value, 1, 'the trigger counts deletions');
	assert.deepStrictEqual(e.DB.sqlite.prepare('SELECT day FROM daily_stats').all().map((r) => r.day), ['2026-10-01']);
	assert.match(fs.readFileSync(path.join(root, 'worker', 'wrangler.toml'), 'utf8'), /crons = \["23 4 \* \* \*"\]/);
});

test('the entry point exports only its handlers: the Workers runtime refuses any other export of the main module', () => {
	assert.deepStrictEqual(Object.keys(entry), ['default']);
	assert.deepStrictEqual(Object.keys(entry.default).sort(), ['fetch', 'scheduled']);
});
