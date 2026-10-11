// Imports submitted playtests from the intake Worker into the research collection, for review in a pull request
// (docs/automatic-playtest-collection.md#the-import-workflow). It reuses the collection's own checks
// (tools/playtests/dataset.js -> tools/game-log/validate.js, with the full replay): no second validator.
//
//   PLAYTEST_IMPORT_TOKEN=… node tools/playtests/intake.js --api <url> [--max 200] [--summary file.md] [--dry-run]
//                                  fetch new submissions, replay them, write the eligible ones to records/<id>.json
//                                  and update intake.json; --dry-run writes nothing
//   node tools/playtests/intake.js --from <folder of .json files>    the same from files (a manual export, or tests)
//   PLAYTEST_IMPORT_TOKEN=… node tools/playtests/intake.js --check-config --api <url>
//                                  is the Worker reachable, intake open, and the token accepted?
//   node tools/playtests/intake.js --exclude <game id> --reason "…"  never propose this submission again (the owner's
//                                  decision, recorded in intake.json)
//
// Trust: a submission is untrusted until a person merges the pull request. Stages: received by the Worker
// (structurally accepted) -> replay-verified here (proposed in the pull request) -> reviewed and merged (in the
// collection, "collected") -> analysed by a report. Importing never marks a game as analysed.
// Safety: only records/<game id>.json (the id matching /^g[0-9a-f]{16}$/), intake.json and analysis-state.json's
// snapshot (the dated list of games awaiting review) are ever written; files
// are created, never overwritten; nothing in a record is run; text from records reaches the summary only through
// strict patterns.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dataset = require('./dataset');

const root = path.join(__dirname, '..', '..');
const defaultDir = path.join(root, 'research', 'human-playtests');
const ledgerFormat = 'whitechapel-playtest-intake';
const idPattern = /^g[0-9a-f]{16}$/;
const hexPattern = /^[0-9a-f]{64}$/;
// Verdicts that end a submission's story: it is not downloaded again
const settled = new Set(['imported', 'duplicate', 'conflict', 'invalid', 'incompatible', 'ineligible', 'integrity', 'excluded']);

class ConfigError extends Error {}

function sha256(text) {
	return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function safe(value, pattern, fallback = '?') {
	// Text from a record or the Worker, only if it is plainly what it should be
	return typeof value === 'string' && pattern.test(value) ? value : fallback;
}

/* The ledger: research/human-playtests/intake.json
   ------------------------------------------------ */
function readLedger(dir) {
	const file = path.join(dir, 'intake.json');
	if (!fs.existsSync(file)) return { format: ledgerFormat, version: 1, submissions: {} };
	const ledger = JSON.parse(fs.readFileSync(file, 'utf8'));
	if (ledger.format !== ledgerFormat || typeof ledger.submissions !== 'object') throw new Error(`${file} is not a playtest intake ledger`);
	return ledger;
}

function writeLedger(dir, ledger) {
	const sorted = Object.fromEntries(Object.entries(ledger.submissions).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
	fs.writeFileSync(path.join(dir, 'intake.json'), JSON.stringify(Object.assign({}, ledger, { submissions: sorted }), null, '\t') + '\n');
}

/* The Worker's import endpoints
   ----------------------------- */
function client({ api, token, fetch: fetcher = globalThis.fetch, tries = 3, wait = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
	if (!api || !/^https?:\/\/[^\s]+$/.test(api)) throw new ConfigError('the intake address is missing: set the repository variable PLAYTEST_API_URL (or pass --api <url>)');
	if (!token || token.length < 32) throw new ConfigError('the import token is missing or too short: set the repository secret PLAYTEST_IMPORT_TOKEN (at least 32 characters, the same as the Worker\'s IMPORT_TOKEN)');
	const base = api.replace(/\/+$/, '');
	async function request(url) {
		let last;
		for (let attempt = 1; attempt <= tries; attempt++) {
			let response;
			try {
				response = await fetcher(base + url, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
			} catch (error) {
				last = new Error(`could not reach the intake (${error.name === 'TimeoutError' ? 'timed out' : error.message})`);
				if (attempt < tries) await wait(2000 * attempt);
				continue;
			}
			if (response.status === 401) throw new ConfigError('the intake refused the import token (401): PLAYTEST_IMPORT_TOKEN must equal the Worker\'s IMPORT_TOKEN secret');
			if (response.status === 404 && url.startsWith('/api/v1/admin/submissions?')) {
				throw new ConfigError('the intake\'s import endpoints are off (404): set the Worker secret IMPORT_TOKEN, or check PLAYTEST_API_URL');
			}
			if (response.status === 429 || response.status >= 500) {
				last = new Error(`the intake answered ${response.status}`);
				if (attempt < tries) await wait(2000 * attempt);
				continue;
			}
			return response;
		}
		throw last;
	}
	return {
		async list() {
			// Every submission's metadata (not the records), oldest first
			const out = [];
			let after = 0;
			for (let page = 0; page < 1000; page++) {
				const response = await request(`/api/v1/admin/submissions?after=${after}&limit=500`);
				if (response.status !== 200) throw new Error(`listing submissions failed: ${response.status}`);
				const body = await response.json();
				if (!body || !Array.isArray(body.submissions)) throw new Error('the intake\'s list is not in the expected form');
				out.push(...body.submissions);
				if (body.next === null || body.next === undefined || !body.submissions.length) return out;
				after = body.next;
			}
			throw new Error('too many pages of submissions');
		},
		async body(id) {
			if (!idPattern.test(id)) throw new Error('not a game id');
			const response = await request(`/api/v1/admin/submissions/${id}`);
			if (response.status !== 200) throw new Error(`downloading ${id} failed: ${response.status}`);
			return { text: await response.text(), sha256: response.headers.get('X-Body-SHA256') };
		},
		async health() {
			const response = await fetcher(base + '/api/v1/health', { signal: AbortSignal.timeout(30000) });
			return { status: response.status, body: await response.json().catch(() => null) };
		}
	};
}

function folderSource(folder) {
	// Submissions from a folder of record files (named anything): the same checks as from the Worker
	const files = fs.readdirSync(folder).filter((n) => n.endsWith('.json')).sort();
	const items = files.map((name, i) => {
		const text = fs.readFileSync(path.join(folder, name), 'utf8');
		let id = null;
		try { id = JSON.parse(text).game.id; } catch (error) { /* Checked below */ }
		return { seq: i + 1, game_id: typeof id === 'string' ? id : name.replace(/\.json$/, ''), received_on: null, body_sha256: sha256(text), text };
	});
	return {
		list: async () => items.map(({ text, ...meta }) => meta),
		body: async (id) => {
			const item = items.find((x) => x.game_id === id);
			return { text: item.text, sha256: item.body_sha256 };
		}
	};
}

/* Importing
   --------- */
async function run({ dir = defaultDir, source, max = 200, dryRun = false, today = new Date().toISOString().slice(0, 10), currentVersion }) {
	// -> { examined, results: [{ id, seq, verdict, reason, cohort? }], eligible: [ids], ledger, warnings, batch }
	const recordsDir = path.join(dir, 'records');
	const ledger = readLedger(dir);
	const listed = (await source.list()).slice().sort((a, b) => a.seq - b.seq);
	const results = [];
	const warnings = [];
	let downloads = 0;
	const seenIds = new Set();
	const eligible = [];
	const byDay = {};

	for (const meta of listed) {
		const id = meta && meta.game_id;
		if (typeof id !== 'string' || !idPattern.test(id)) {
			results.push({ id: '?', seq: meta && meta.seq, verdict: 'invalid', reason: 'the submission has no valid game id' });
			continue;
		}
		if (seenIds.has(id)) continue; // The Worker stores one per id; a repeat here would be a listing problem
		seenIds.add(id);
		const day = safe(meta.received_on, /^\d{4}-\d{2}-\d{2}$/, null);
		if (day) byDay[day] = (byDay[day] || 0) + 1;
		const known = ledger.submissions[id];
		const target = path.join(recordsDir, id + '.json');
		if (known && settled.has(known.verdict) && (!known.sha256 || known.sha256 === meta.body_sha256)) {
			// Already decided (in the ledger on the base branch): not downloaded again
			results.push({ id, seq: meta.seq, verdict: 'previously ' + known.verdict, previous: true });
			continue;
		}
		if (downloads >= max) {
			results.push({ id, seq: meta.seq, verdict: 'deferred', reason: `more than ${max} to examine: left for the next run` });
			continue;
		}
		downloads++;
		let got;
		try {
			got = await source.body(id);
		} catch (error) {
			results.push({ id, seq: meta.seq, verdict: 'failed', reason: `download failed (${String(error.message).slice(0, 80)}): retried next run` });
			continue;
		}
		const entry = { seq: meta.seq, receivedOn: day, sha256: sha256(got.text), bytes: Buffer.byteLength(got.text), examinedOn: today };
		const decide = (verdict, reason, extra = {}) => {
			Object.assign(entry, { verdict }, reason ? { reason } : {}, extra);
			ledger.submissions[id] = entry;
			results.push(Object.assign({ id, seq: meta.seq, verdict, reason }, extra));
		};
		if (!hexPattern.test(String(meta.body_sha256)) || entry.sha256 !== meta.body_sha256 || (got.sha256 && got.sha256 !== meta.body_sha256)) {
			decide('integrity', 'the downloaded record does not match its checksum');
			continue;
		}
		const checked = dataset.checkRecord(got.text);
		if (checked.verdict !== 'valid') {
			decide(checked.verdict, checked.problems.slice(0, 2).join('; ').slice(0, 300));
			continue;
		}
		const record = checked.record;
		if (record.game.id !== id) {
			decide('invalid', 'the record\'s game id differs from the submission\'s');
			continue;
		}
		const cohort = dataset.cohortOf(record).key;
		if (fs.existsSync(target)) {
			const existing = dataset.checkRecord(fs.readFileSync(target, 'utf8'));
			const same = existing.record && dataset.fingerprint(existing.record) === dataset.fingerprint(record);
			decide(same ? 'duplicate' : 'conflict', same ? `records/${id}.json is already in the collection` :
				`records/${id}.json holds a different record of this game: not overwritten`, { cohort });
			continue;
		}
		if (!dryRun) {
			fs.mkdirSync(recordsDir, { recursive: true });
			fs.writeFileSync(target, got.text, { flag: 'wx' }); // Created, never overwritten
		}
		eligible.push(id);
		decide('imported', null, { cohort });
	}

	// Signs worth a reviewer's attention: never proof of anything
	const fresh = results.filter((r) => r.verdict === 'imported');
	const actions = {};
	if (fresh.length) {
		for (const name of fs.existsSync(recordsDir) ? fs.readdirSync(recordsDir).filter((n) => n.endsWith('.json')) : []) {
			try {
				const r = JSON.parse(fs.readFileSync(path.join(recordsDir, name), 'utf8'));
				const key = sha256(JSON.stringify(r.actions));
				(actions[key] = actions[key] || []).push(name.replace(/\.json$/, ''));
			} catch (error) { /* Only well-formed records compare */ }
		}
		for (const ids of Object.values(actions)) {
			if (ids.length > 1 && ids.some((i) => eligible.includes(i))) warnings.push(`identical moves in different games: ${ids.join(', ')} (a copied or fabricated record?)`);
		}
	}
	for (const [day, n] of Object.entries(byDay)) if (n > 25) warnings.push(`${n} submissions received on ${day}: unusually many`);
	if (currentVersion) {
		const old = fresh.filter((r) => r.cohort && !r.cohort.startsWith(currentVersion + ' ')).length;
		if (old) warnings.push(`${old} imported game${old === 1 ? ' was' : 's were'} made with another app version than ${currentVersion}: a separate cohort`);
	}
	const failed = results.filter((r) => r.verdict === 'failed').length;
	if (failed) warnings.push(`${failed} download${failed === 1 ? '' : 's'} failed: retried next run`);

	if (!dryRun && results.some((r) => !r.previous && !['failed', 'deferred'].includes(r.verdict) && r.id !== '?')) writeLedger(dir, ledger);
	let after = dataset.scan(dir);
	if (!dryRun && eligible.length) {
		// New games change the list awaiting review: refresh analysis-state.json's snapshot, as --update-state does.
		// Only the snapshot changes; no game is marked as analysed
		dataset.writeState(dir, dataset.updateSnapshot(after, today));
		after = dataset.scan(dir);
	}
	return { examined: listed.length, results, eligible, ledger, warnings, batch: after.batch, problems: after.problems.length + after.stateProblems.length };
}

function summary(outcome, { date, runUrl } = {}) {
	// The import pull request's description. Every value from a submission went through a strict pattern
	const n = (verdicts) => outcome.results.filter((r) => verdicts.includes(r.verdict)).length;
	const newOnes = outcome.results.filter((r) => !r.previous);
	const md = [];
	md.push(`Automatic import of human playtests submitted online${date ? ', ' + date : ''} (docs/automatic-playtest-collection.md).`, '');
	md.push('| Examined | Replay-verified | Rejected | Duplicates | Conflicts | Eligible for import | Deferred or failed | Previously handled |');
	md.push('|---:|---:|---:|---:|---:|---:|---:|---:|');
	md.push(`| ${newOnes.length} | ${n(['imported', 'duplicate', 'conflict'])} | ${n(['invalid', 'incompatible', 'ineligible', 'integrity'])} | ${n(['duplicate'])} | ` +
		`${n(['conflict'])} | ${outcome.eligible.length} | ${n(['deferred', 'failed'])} | ${outcome.results.length - newOnes.length} |`, '');
	const cohorts = {};
	for (const r of outcome.results.filter((x) => x.verdict === 'imported')) {
		const key = safe(r.cohort, /^[A-Za-z0-9 .·()_+-]{1,200}$/);
		cohorts[key] = (cohorts[key] || 0) + 1;
	}
	if (Object.keys(cohorts).length) {
		md.push('**Cohorts of the games in this pull request** (app version · rule set · matchup):', '');
		for (const [k, v] of Object.entries(cohorts)) md.push(`- ${k}: ${v}`);
		md.push('');
	}
	const listed = newOnes.filter((r) => r.verdict !== 'deferred');
	if (listed.length) {
		md.push('| Game | Submission | Verdict | Note |', '|---|---:|---|---|');
		for (const r of listed.slice(0, 200)) {
			md.push(`| \`${safe(r.id, idPattern)}\` | ${Number.isInteger(r.seq) ? r.seq : '?'} | ${r.verdict} | ${String(r.reason || '').replace(/[|`<>\r\n]/g, ' ').slice(0, 160)} |`);
		}
		if (listed.length > 200) md.push(`| … | | | ${listed.length - 200} more in the run's log |`);
		md.push('');
	}
	md.push('**Provenance and trust.**', '');
	md.push('- These records were submitted anonymously from the public site. Each one passed the Worker\'s intake checks and then a full deterministic replay here (`tools/game-log/validate.js`: verified). A replay shows the moves are legal and consistent; it does **not** prove a person played them.');
	md.push('- Each file is byte for byte as received; `research/human-playtests/intake.json` records its submission number, date received and SHA-256.');
	md.push('- Merging adds them to the collection as **collected** (unanalysed). They count toward the next research batch; nothing is marked as analysed.');
	md.push('- To refuse a game for good: close this pull request, then run `npm run playtests:intake -- --exclude <game id> --reason "…"` and commit `intake.json`.');
	if (outcome.warnings.length) {
		md.push('', '**Warnings for the reviewer:**', '');
		for (const w of outcome.warnings) md.push(`- ⚠️ ${w}`);
	}
	md.push('', `**Research batch after merging:** ${outcome.batch.status} (${outcome.batch.outstanding.length} games awaiting review; a batch is ${outcome.batch.threshold}).`);
	if (runUrl) md.push('', `Made by the [Import human playtests run](${runUrl}).`);
	md.push('', 'This pull request was made by a workflow and is rebuilt on each run while it is open; don\'t push to its branch.');
	return md.join('\n') + '\n';
}

/* Command line
   ------------ */
function option(args, name) {
	const i = args.indexOf(name);
	return i === -1 ? null : args[i + 1];
}

async function main(argv, env = process.env, deps = {}) {
	const args = argv.slice();
	const dir = option(args, '--dir') ? path.resolve(option(args, '--dir')) : defaultDir;
	const log = deps.log || console.log;
	const api = option(args, '--api') || env.PLAYTEST_API_URL;
	try {
		if (args.includes('--exclude')) {
			const id = option(args, '--exclude');
			const reason = option(args, '--reason');
			if (!idPattern.test(id || '') || !reason) throw new ConfigError('usage: --exclude <game id> --reason "why"');
			const ledger = readLedger(dir);
			ledger.submissions[id] = Object.assign({}, ledger.submissions[id] || {}, { verdict: 'excluded', reason: reason.slice(0, 300), examinedOn: new Date().toISOString().slice(0, 10) });
			writeLedger(dir, ledger);
			log(`${id} is excluded: the import workflow will not propose it again. Commit research/human-playtests/intake.json.`);
			return 0;
		}
		if (args.includes('--check-config')) {
			const c = client({ api, token: env.PLAYTEST_IMPORT_TOKEN, fetch: deps.fetch });
			const health = await c.health();
			if (health.status !== 200 || !health.body || health.body.status !== 'ok') throw new ConfigError(`${api}/api/v1/health did not answer as the intake does (${health.status})`);
			log(`Intake reachable at ${api}: ${health.body.intake}; rule sets ${(health.body.rulesets || []).join(', ')}.`);
			if (!health.body.importEnabled) throw new ConfigError('the Worker has no IMPORT_TOKEN secret: its import endpoints are off');
			const list = await c.list();
			log(`Import token accepted: ${list.length} submission${list.length === 1 ? '' : 's'} stored.`);
			log('Configuration complete.');
			return 0;
		}
		const source = option(args, '--from') ? folderSource(path.resolve(option(args, '--from'))) :
			client({ api, token: env.PLAYTEST_IMPORT_TOKEN, fetch: deps.fetch, wait: deps.wait });
		const date = option(args, '--date') || new Date().toISOString().slice(0, 10);
		const outcome = await run({ dir, source, max: Number(option(args, '--max')) || 200, dryRun: args.includes('--dry-run'), today: date,
			currentVersion: require('../../package.json').version });
		const counts = {};
		for (const r of outcome.results) counts[r.verdict] = (counts[r.verdict] || 0) + 1;
		log(`Examined ${outcome.examined} submission${outcome.examined === 1 ? '' : 's'}: ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ') || 'none'}.`);
		for (const r of outcome.results.filter((x) => !x.previous)) log(`  ${r.id} (#${r.seq}): ${r.verdict}${r.reason ? ' — ' + r.reason : ''}`);
		for (const w of outcome.warnings) log(`::warning title=Playtest import::${w}`);
		log(`Eligible for import: ${outcome.eligible.length}${args.includes('--dry-run') ? ' (dry run: nothing written)' : ''}.`);
		if (option(args, '--summary')) fs.writeFileSync(option(args, '--summary'), summary(outcome, { date, runUrl: env.GITHUB_SERVER_URL && env.GITHUB_RUN_ID ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` : null }));
		if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, `eligible=${outcome.eligible.length}\n`);
		if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, '## Import human playtests\n\n' + summary(outcome, { date }));
		return 0;
	} catch (error) {
		if (error instanceof ConfigError) {
			log(`::error title=Playtest import configuration::${error.message}`);
			return 2;
		}
		log(`::error title=Playtest import::${error.message}`);
		return 1;
	}
}

if (require.main === module) {
	main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}

module.exports = { main, run, summary, client, folderSource, readLedger, writeLedger, ConfigError, idPattern };
