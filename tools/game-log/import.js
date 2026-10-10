// Imports exported game records (docs/game-records.md): validates each, replays the full ones, and summarises them.
//
//   npm run research:import -- <file or folder> ...           a verdict for each file, then a summary
//   npm run research:import -- --json <files>                  the same, as JSON
//   npm run research:import -- --fixture <out.json> --upto <n> <full record>
//                                                              the record's first n actions, as a test fixture
//
// Files are read, never run. Folders are read one level deep, .json files only. Paths come only from the command line,
// never from inside a record, and a fixture never overwrites an existing file.
const fs = require('fs');
const path = require('path');
const { validate } = require('./validate');
const { summarise } = require('./summary');
const { loadCore } = require('./core');

function files(args) {
	const list = [];
	for (const arg of args) {
		const stat = fs.statSync(arg, { throwIfNoEntry: false });
		if (!stat) {
			list.push({ file: arg, missing: true });
		} else if (stat.isDirectory()) {
			for (const name of fs.readdirSync(arg).sort()) {
				const file = path.join(arg, name);
				if (name.endsWith('.json') && fs.statSync(file).isFile()) list.push({ file });
			}
		} else {
			list.push({ file: arg });
		}
	}
	return list;
}

function fixture(record, upto, source) {
	// A deterministic test position: the first `upto` actions of a full record, replayed to check they still play
	const { WC } = loadCore();
	while (upto < record.actions.length && record.actions[upto].side === 'jack') {
		upto++; // Jack's decisions that follow the last police action belong to it: the position is the police's turn
	}
	const out = {
		format: 'whitechapel-game-fixture',
		schemaVersion: 1,
		ruleset: record.ruleset.id,
		source: { gameId: record.game.id, file: path.basename(source) },
		game: { settings: record.game.settings },
		actions: record.actions.slice(0, upto)
	};
	const replayed = WC.record.replay(out);
	if (!replayed.ok) throw new Error(replayed.problems.join('; '));
	return out;
}

function main(argv) {
	const args = argv.slice();
	const json = args.includes('--json');
	const fixtureAt = args.indexOf('--fixture');
	const uptoAt = args.indexOf('--upto');
	let fixtureFile = null;
	let upto = null;
	if (fixtureAt !== -1) {
		fixtureFile = args[fixtureAt + 1];
		upto = Number(args[uptoAt + 1]);
		if (!fixtureFile || uptoAt === -1 || !Number.isInteger(upto) || upto < 1) {
			console.error('Usage: --fixture <out.json> --upto <number of actions> <full record>');
			return 2;
		}
	}
	const values = [fixtureAt, uptoAt].filter((i) => i !== -1).map((i) => i + 1); // The options' own values
	const paths = args.filter((a, i) => !a.startsWith('--') && !values.includes(i));
	if (!paths.length) {
		console.error('Usage: npm run research:import -- [--json] <game record or folder> ...');
		return 2;
	}

	const reports = files(paths).map(({ file, missing }) => {
		if (missing) return { file, verdict: 'invalid', status: 'unknown', errors: ['file not found'], warnings: [] };
		const r = validate(fs.readFileSync(file, 'utf8'));
		return Object.assign({ file }, r);
	});

	if (fixtureFile) {
		const r = reports[0];
		if (reports.length !== 1 || r.verdict !== 'verified') {
			console.error('A fixture needs one full record that replays (verdict "verified")');
			return 1;
		}
		if (fs.existsSync(fixtureFile)) {
			console.error(`${fixtureFile} exists: not overwritten`);
			return 1;
		}
		const made = fixture(r.record, Math.min(upto, r.record.actions.length), r.file);
		fs.writeFileSync(fixtureFile, loadCore().WC.record.stringify(made), { flag: 'wx' });
		console.log(`Wrote ${fixtureFile}: the first ${made.actions.length} actions of ${r.file}`);
		return 0;
	}

	const summary = summarise(reports);
	if (json) {
		console.log(JSON.stringify({ files: reports.map((r) => ({ file: r.file, verdict: r.verdict, status: r.status, disclosure: r.disclosure, role: r.role, errors: r.errors, warnings: r.warnings })), summary }, null, 2));
	} else {
		for (const r of reports) {
			console.log(`${r.file}: ${r.verdict} (${r.disclosure || 'unknown'} record, game ${r.status})`);
			for (const e of r.errors.slice(0, 10)) console.log(`  error: ${e}`);
			if (r.errors.length > 10) console.log(`  ... and ${r.errors.length - 10} more errors`);
			for (const w of r.warnings) console.log(`  warning: ${w}`);
		}
		console.log('');
		console.log(summary.text);
	}
	return reports.some((r) => r.verdict === 'invalid') ? 1 : 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { main, fixture, files };
