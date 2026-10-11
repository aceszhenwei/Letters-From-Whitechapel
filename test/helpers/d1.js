// A local stand-in for Cloudflare D1, on Node's own SQLite (node:sqlite), running the Worker's real migrations, so the
// playtest Worker (worker/src/index.js) can be tested without Cloudflare: the same SQL, the same UNIQUE constraint and
// triggers. It follows D1's API as the Worker uses it: prepare(sql).bind(...).first() / all() / run().
// options.fail(sql) -> true makes that statement throw, as D1 does when it is unavailable or over its daily limits.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
let sqlite = null;

function database(options = {}) {
	if (!sqlite) {
		const warn = process.emitWarning;
		process.emitWarning = () => {}; // node:sqlite is marked experimental; that warning is noise in the tests
		try {
			sqlite = require('node:sqlite');
		} finally {
			process.emitWarning = warn;
		}
	}
	const db = new sqlite.DatabaseSync(options.file || ':memory:');
	const migrations = path.join(root, 'worker', 'migrations');
	for (const name of fs.readdirSync(migrations).filter((n) => n.endsWith('.sql')).sort()) {
		db.exec(fs.readFileSync(path.join(migrations, name), 'utf8'));
	}
	const fail = options.fail || (() => false);
	const statement = (sql, params) => ({
		bind: (...values) => statement(sql, values),
		async first(column) {
			if (fail(sql)) throw new Error('D1_ERROR: unavailable (test)');
			const row = db.prepare(sql).get(...params);
			if (!row) return null;
			const plain = Object.assign({}, row);
			return column ? plain[column] : plain;
		},
		async all() {
			if (fail(sql)) throw new Error('D1_ERROR: unavailable (test)');
			return { success: true, results: db.prepare(sql).all(...params).map((r) => Object.assign({}, r)), meta: {} };
		},
		async run() {
			if (fail(sql)) throw new Error('D1_ERROR: unavailable (test)');
			// As D1 reports it, changes include rows that triggers changed (unlike SQLite's own count)
			const before = db.prepare('SELECT total_changes() AS n').get().n;
			const r = db.prepare(sql).run(...params);
			const after = db.prepare('SELECT total_changes() AS n').get().n;
			return { success: true, meta: { changes: Number(after - before), last_row_id: Number(r.lastInsertRowid) } };
		}
	});
	return {
		prepare: (sql) => statement(sql, []),
		sqlite: db
	};
}

function rateLimiter(limit) {
	// Counts calls per key, as Cloudflare's rate limiting binding does within one period
	const seen = new Map();
	return {
		async limit({ key }) {
			const n = (seen.get(key) || 0) + 1;
			seen.set(key, n);
			return { success: n <= limit };
		}
	};
}

module.exports = { database, rateLimiter };
