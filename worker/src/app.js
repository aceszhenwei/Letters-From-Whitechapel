// The playtest submission Worker's logic (docs/automatic-playtest-collection.md); src/index.js is its entry point,
// which must export nothing else (the Workers runtime treats every export of it as an entry point). It receives the full records of completed games
// people played on the public site, checks them cheaply, and keeps the accepted ones privately in a D1 database.
//
//   POST /api/v1/playtests                one full game record (JSON) -> 201 accepted, 200 duplicate, 4xx refused, 429/503 later
//   GET  /api/v1/health                   is intake open? (no data)
//   GET  /api/v1/admin/submissions        list submissions' metadata, oldest first (?after=<seq>&limit=<n>)   } with the
//   GET  /api/v1/admin/submissions/<id>   one submission's record, byte for byte as received                } import
//   GET  /api/v1/admin/stats              daily counts of every outcome, for spotting abuse                  } token
//   anything else                         404
//
// Nothing about the sender is stored: no IP address, user agent or other header. The client's IP address is only the
// key of Cloudflare's rate limiter, which counts in memory and keeps nothing for us. Every record is untrusted: it is
// checked (src/validate.js), never run, and only its validated game id is used in keys. A stored record is not
// research evidence: the import workflow replays it (tools/playtests/intake.js) and a person reviews the pull request.
import { validateRecord, contentOf, gameIdPattern } from './validate.js';

export const intakeVersion = 1;
const json = 'application/json; charset=utf-8';

function config(env) {
	const list = (value, fallback) => String(value || fallback).split(',').map((s) => s.trim()).filter(Boolean);
	const int = (value, fallback) => {
		const n = Number.parseInt(value, 10);
		return Number.isFinite(n) && n > 0 ? n : fallback;
	};
	return {
		origins: list(env.ALLOWED_ORIGINS, 'https://aceszhenwei.github.io'),
		rulesets: list(env.ACCEPTED_RULESETS, ''),
		maxBytes: int(env.MAX_BODY_BYTES, 524288), // Real records are 100–200 KB; checking one costs ~2.5 ms of CPU per 160 KB (Free: 10 ms)
		dailyLimit: int(env.DAILY_LIMIT, 50),
		maxStored: int(env.MAX_STORED, 2000),
		maxStoredBytes: int(env.MAX_STORED_BYTES, 400000000), // D1 Free: 500 MB per database
		paused: String(env.INTAKE_PAUSED || '').toLowerCase() === 'true',
		token: typeof env.IMPORT_TOKEN === 'string' && env.IMPORT_TOKEN.length >= 32 ? env.IMPORT_TOKEN : null
	};
}

function today(now) {
	return now.toISOString().slice(0, 10);
}

function secondsToMidnight(now) {
	const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
	return Math.max(60, Math.ceil((next - now.getTime()) / 1000));
}

function cors(request, settings) {
	// Browsers on the game's own site may call the submission endpoint. This is not a security measure: scripts can
	// send any Origin header. It stops other websites' pages from sending records through their visitors' browsers
	const origin = request.headers.get('Origin');
	if (origin && settings.origins.includes(origin)) {
		return { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' };
	}
	return { 'Vary': 'Origin' };
}

export function reply(status, body, headers = {}) {
	return new Response(JSON.stringify(body), {
		status,
		headers: Object.assign({ 'Content-Type': json, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, headers)
	});
}

function outcome(status, code, message, extra = {}, headers = {}) {
	return { status, body: Object.assign({ ok: status < 300, status: code, message }, extra), headers };
}

async function sha256(text) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sameSecret(given, expected) {
	// Compares digests, byte by byte without stopping early, so the time taken says nothing about the token
	const [a, b] = await Promise.all([sha256(given), sha256(expected)]);
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

async function readBody(request, maxBytes) {
	// -> the text, or null if it is longer than maxBytes (read no further than that)
	const declared = Number(request.headers.get('Content-Length'));
	if (Number.isFinite(declared) && declared > maxBytes) return null;
	if (!request.body) return '';
	const reader = request.body.getReader();
	const chunks = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > maxBytes) {
			await reader.cancel();
			return null;
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(size);
	let at = 0;
	for (const c of chunks) {
		bytes.set(c, at);
		at += c.byteLength;
	}
	return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

async function limited(env, key) {
	// Cloudflare's rate limiter (wrangler.toml [[ratelimits]]); without the binding, the daily caps still apply
	if (!env.RATE_LIMITER || typeof env.RATE_LIMITER.limit !== 'function') return false;
	try {
		const { success } = await env.RATE_LIMITER.limit({ key });
		return !success;
	} catch (error) {
		return false; // A failing limiter must not stop genuine games: the caps below still bound the storage
	}
}

async function count(env, day, what) {
	// Daily counts of outcomes, for monitoring (GET /api/v1/admin/stats). Never fails a request
	try {
		await env.DB.prepare('INSERT INTO daily_stats (day, outcome, count) VALUES (?1, ?2, 1) ON CONFLICT (day, outcome) DO UPDATE SET count = count + 1')
			.bind(day, what).run();
	} catch (error) {
		/* Statistics are best effort */
	}
}

async function submit(request, env, settings, now) {
	if (settings.paused) {
		return outcome(503, 'paused', 'Submissions are paused. The game keeps your record and will try again later.', {}, { 'Retry-After': '21600' });
	}
	const type = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
	if (type !== 'application/json') return outcome(415, 'unsupported_media_type', 'Send the record as application/json.');
	let text;
	try {
		text = await readBody(request, settings.maxBytes);
	} catch (error) {
		return outcome(400, 'invalid_body', 'The body could not be read as UTF-8 text.');
	}
	if (text === null) return outcome(413, 'too_large', `A record may be at most ${settings.maxBytes} bytes.`);
	let record;
	try {
		record = JSON.parse(text);
	} catch (error) {
		return outcome(400, 'invalid_json', 'The body is not valid JSON.');
	}
	const checked = validateRecord(record, { rulesets: settings.rulesets });
	if (!checked.ok) return outcome(checked.status, checked.code, checked.message);
	const meta = checked.meta;
	const day = today(now);

	let usage;
	try {
		usage = await env.DB.prepare("SELECT (SELECT value FROM counters WHERE name = 'stored') AS stored, " +
			"(SELECT value FROM counters WHERE name = 'stored_bytes') AS bytes, " +
			"(SELECT count FROM daily_stats WHERE day = ?1 AND outcome = 'accepted') AS today").bind(day).first();
	} catch (error) {
		return outcome(503, 'storage_unavailable', 'Storage is unavailable; try again later.', {}, { 'Retry-After': '600' });
	}
	const [bodyHash, contentHash] = await Promise.all([sha256(text), sha256(contentOf(record))]);
	const existing = async () => env.DB.prepare('SELECT seq, content_hash FROM submissions WHERE game_id = ?1').bind(meta.gameId).first();
	const known = (row) => row.content_hash === contentHash ?
		outcome(200, 'duplicate', 'This game was already received.', { gameId: meta.gameId }) :
		outcome(409, 'conflict', 'A different record with this game id was already received; it was not replaced.', { gameId: meta.gameId });
	try {
		// A game already received is answered as before, even when the caps are reached: a retry must not loop
		const before = await existing();
		if (before) return known(before);
	} catch (error) {
		return outcome(503, 'storage_unavailable', 'Storage is unavailable; try again later.', {}, { 'Retry-After': '600' });
	}
	if ((usage && usage.stored || 0) >= settings.maxStored || (usage && usage.bytes || 0) + text.length >= settings.maxStoredBytes) {
		return outcome(503, 'storage_full', 'The collection is full for now; the game keeps your record.', {}, { 'Retry-After': '604800' });
	}
	if ((usage && usage.today || 0) >= settings.dailyLimit) {
		return outcome(503, 'daily_limit', 'Today\'s submissions are full; the game will try again tomorrow.', {}, { 'Retry-After': String(secondsToMidnight(now)) });
	}

	let inserted;
	try {
		// Atomic: the game id is UNIQUE, so of two simultaneous submissions of one game exactly one is stored, and an
		// existing record is never replaced (no read-then-write race). RETURNING gives a row only when this request
		// stored it (D1's meta.changes also counts the counters' triggers, so it can't tell)
		inserted = await env.DB.prepare('INSERT INTO submissions (game_id, received_on, body_sha256, content_hash, bytes, schema_version, ruleset, ' +
			'app_version, role, opponent, level, result, intake_version, body) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14) ' +
			'ON CONFLICT (game_id) DO NOTHING RETURNING seq')
			.bind(meta.gameId, day, bodyHash, contentHash, new TextEncoder().encode(text).byteLength, meta.schemaVersion, meta.ruleset,
				meta.appVersion, meta.role, meta.opponent, meta.level, meta.result, intakeVersion, text)
			.first();
	} catch (error) {
		return outcome(503, 'storage_unavailable', 'Storage is unavailable; try again later.', {}, { 'Retry-After': '600' });
	}
	if (!inserted) {
		const row = await existing().catch(() => null);
		if (row) return known(row);
		return outcome(503, 'storage_unavailable', 'Storage is unavailable; try again later.', {}, { 'Retry-After': '600' });
	}
	return outcome(201, 'accepted', 'Thank you: the game was received.', { gameId: meta.gameId, receipt: bodyHash.slice(0, 16) });
}

async function admin(request, env, settings, path, url) {
	// Read-only, for the import workflow. Disabled (404) until IMPORT_TOKEN is set as a Worker secret
	if (!settings.token) return outcome(404, 'not_found', 'Not found.');
	const auth = request.headers.get('Authorization') || '';
	const given = auth.startsWith('Bearer ') ? auth.slice(7) : '';
	if (!given || !(await sameSecret(given, settings.token))) return outcome(401, 'unauthorized', 'A valid import token is required.');
	if (request.method !== 'GET') return outcome(405, 'method_not_allowed', 'Use GET.', {}, { 'Allow': 'GET' });

	if (path === '/api/v1/admin/submissions') {
		const after = Math.max(0, Number.parseInt(url.searchParams.get('after') || '0', 10) || 0);
		const limit = Math.min(500, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '200', 10) || 200));
		const rows = await env.DB.prepare('SELECT seq, game_id, received_on, body_sha256, content_hash, bytes, schema_version, ruleset, app_version, ' +
			'role, opponent, level, result, intake_version FROM submissions WHERE seq > ?1 ORDER BY seq LIMIT ?2').bind(after, limit).all();
		const list = rows.results || [];
		return outcome(200, 'ok', 'Submissions', { submissions: list, next: list.length === limit ? list[list.length - 1].seq : null });
	}
	const one = path.match(/^\/api\/v1\/admin\/submissions\/([^/]+)$/);
	if (one) {
		if (!gameIdPattern.test(one[1])) return outcome(400, 'bad_game_id', 'Not a game id.');
		const row = await env.DB.prepare('SELECT body, body_sha256 FROM submissions WHERE game_id = ?1').bind(one[1]).first();
		if (!row) return outcome(404, 'not_found', 'No such submission.');
		return { raw: row.body, headers: { 'X-Body-SHA256': row.body_sha256 } };
	}
	if (path === '/api/v1/admin/stats') {
		const days = await env.DB.prepare('SELECT day, outcome, count FROM daily_stats ORDER BY day DESC, outcome LIMIT 600').all();
		const totals = await env.DB.prepare('SELECT name, value FROM counters').all();
		return outcome(200, 'ok', 'Statistics', { days: days.results || [], counters: totals.results || [] });
	}
	return outcome(404, 'not_found', 'Not found.');
}

export async function handle(request, env, options = {}) {
	const now = options.now ? options.now() : new Date();
	const settings = config(env);
	const url = new URL(request.url);
	const path = url.pathname.replace(/\/+$/, '') || '/';
	const headers = cors(request, settings);
	const send = (o) => o.raw !== undefined ?
		new Response(o.raw, { status: 200, headers: Object.assign({ 'Content-Type': json, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, o.headers) }) :
		reply(o.status, o.body, Object.assign({}, headers, o.headers));

	if (path === '/api/v1/playtests') {
		const origin = request.headers.get('Origin');
		if (origin && !settings.origins.includes(origin)) {
			return send(outcome(403, 'origin_not_allowed', 'Submissions are accepted from the game\'s own site.'));
		}
		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: Object.assign({}, headers, {
				'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' }) });
		}
		if (request.method !== 'POST') return send(outcome(405, 'method_not_allowed', 'Use POST.', {}, { 'Allow': 'POST, OPTIONS' }));
		if (await limited(env, 'submit:' + (request.headers.get('CF-Connecting-IP') || 'unknown'))) {
			return send(outcome(429, 'rate_limited', 'Too many submissions; try again later.', {}, { 'Retry-After': '60' }));
		}
		const done = await submit(request, env, settings, now);
		await count(env, today(now), done.body.status);
		return send(done);
	}
	if (path === '/api/v1/health') {
		if (request.method !== 'GET') return send(outcome(405, 'method_not_allowed', 'Use GET.', {}, { 'Allow': 'GET' }));
		return send(outcome(200, 'ok', 'Letters From Whitechapel playtest intake', {
			intake: settings.paused ? 'paused' : 'open', intakeVersion, rulesets: settings.rulesets, importEnabled: !!settings.token }));
	}
	if (path.startsWith('/api/v1/admin/')) {
		// Not rate limited: requests without the 256-bit token are refused before any storage is touched
		try {
			return send(await admin(request, env, settings, path, url));
		} catch (error) {
			return send(outcome(503, 'storage_unavailable', 'Storage is unavailable; try again later.', {}, { 'Retry-After': '600' }));
		}
	}
	return send(outcome(404, 'not_found', 'Not found.'));
}

export async function retain(env, now = new Date()) {
	// The retention policy (docs/automatic-playtest-collection.md#retention), run daily by the cron trigger: a
	// submission stays in this private database for RETENTION_DAYS (365) after it was received, long enough for the
	// import workflow to propose it and the owner to review it; its imported copy lives on in the repository. Daily
	// statistics are kept for 90 days
	const days = Number.parseInt(env.RETENTION_DAYS, 10) > 0 ? Number.parseInt(env.RETENTION_DAYS, 10) : 365;
	const cutoff = (n) => new Date(now.getTime() - n * 86400000).toISOString().slice(0, 10);
	const removed = await env.DB.prepare('DELETE FROM submissions WHERE received_on < ?1 RETURNING seq').bind(cutoff(days)).all();
	await env.DB.prepare('DELETE FROM daily_stats WHERE day < ?1').bind(cutoff(90)).run();
	return (removed.results || []).length;
}
