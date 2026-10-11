-- The playtest intake database (docs/automatic-playtest-collection.md#storage). Applied by worker/scripts/deploy.mjs
-- (wrangler d1 migrations apply). Holds no IP address, user agent or other detail of who sent a record.

-- One row per game: the record exactly as received (body), and metadata the import workflow lists without the body.
-- game_id is UNIQUE, so a game is stored once and never replaced; seq orders submissions for incremental listing.
CREATE TABLE IF NOT EXISTS submissions (
	seq INTEGER PRIMARY KEY AUTOINCREMENT,
	game_id TEXT NOT NULL UNIQUE,
	received_on TEXT NOT NULL,          -- the UTC date only, no time of day
	body_sha256 TEXT NOT NULL,          -- integrity: SHA-256 of the body's bytes
	content_hash TEXT NOT NULL,         -- SHA-256 of the record without its export date: tells duplicates from conflicts
	bytes INTEGER NOT NULL,
	schema_version INTEGER NOT NULL,
	ruleset TEXT NOT NULL,
	app_version TEXT NOT NULL,
	role TEXT NOT NULL,                 -- what the person played: 'jack' or 'detectives'
	opponent TEXT NOT NULL,
	level TEXT,
	result TEXT NOT NULL,
	intake_version INTEGER NOT NULL,
	body TEXT NOT NULL
);

-- Running totals kept by triggers, so the storage cap needs no full count
CREATE TABLE IF NOT EXISTS counters (
	name TEXT PRIMARY KEY,
	value INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO counters (name, value) VALUES ('stored', 0);
INSERT OR IGNORE INTO counters (name, value) VALUES ('stored_bytes', 0);

CREATE TRIGGER IF NOT EXISTS submissions_added AFTER INSERT ON submissions BEGIN
	UPDATE counters SET value = value + 1 WHERE name = 'stored';
	UPDATE counters SET value = value + NEW.bytes WHERE name = 'stored_bytes';
END;

CREATE TRIGGER IF NOT EXISTS submissions_removed AFTER DELETE ON submissions BEGIN
	UPDATE counters SET value = value - 1 WHERE name = 'stored';
	UPDATE counters SET value = value - OLD.bytes WHERE name = 'stored_bytes';
END;

-- Daily counts of each outcome (accepted, duplicate, conflict, invalid_json, too_large, ...): monitoring and the daily cap
CREATE TABLE IF NOT EXISTS daily_stats (
	day TEXT NOT NULL,
	outcome TEXT NOT NULL,
	count INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (day, outcome)
);
