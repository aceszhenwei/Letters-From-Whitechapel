// Opens or updates the one import pull request after tools/playtests/intake.js has written new records into the
// working tree (docs/automatic-playtest-collection.md#the-import-workflow). Run by .github/workflows/playtest-import.yml.
//
//   node tools/playtests/import-pr.js --summary <file.md> [--date YYYY-MM-DD] [--base master] [--branch playtest-import]
//
// - Refuses to commit anything but research/human-playtests/records/<game id>.json and research/human-playtests/intake.json.
// - The branch is rebuilt from the base branch on every run (the Worker keeps every submission, so the same records
//   come back while they are not merged): the result is the same whether a previous run finished, failed half-way
//   or ran twice. A push happens only when the content changed; the push is --force-with-lease on the bot's branch.
// - One pull request: an open one for the branch is updated (title and description); otherwise one is created. When
//   nothing is left to import, an open import pull request is closed with a comment (its games reached the base).
// - Never merges anything: a person reviews and merges.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const allowed = [/^research\/human-playtests\/records\/g[0-9a-f]{16}\.json$/, /^research\/human-playtests\/intake\.json$/];

function option(args, name, fallback) {
	const i = args.indexOf(name);
	return i === -1 ? fallback : args[i + 1];
}

function defaultExec(cmd, args, options = {}) {
	return execFileSync(cmd, args, Object.assign({ encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }, options)).trim();
}

function changedPaths(exec) {
	// Every change in the working tree, untracked files included (porcelain v1, -z: no quoting)
	const out = exec('git', ['status', '--porcelain', '-z', '--untracked-files=all']);
	return out.split('\0').filter(Boolean).map((line) => line.slice(3));
}

function main(argv, deps = {}) {
	const exec = deps.exec || defaultExec;
	const log = deps.log || console.log;
	const args = argv.slice();
	const base = option(args, '--base', 'master');
	const branch = option(args, '--branch', 'playtest-import');
	const date = option(args, '--date', new Date().toISOString().slice(0, 10));
	const summaryFile = option(args, '--summary', null);
	const title = `Import human playtests — ${date}`;
	if (!/^[A-Za-z0-9._/-]+$/.test(base) || !/^[A-Za-z0-9._/-]+$/.test(branch)) throw new Error('bad branch name');

	const changed = changedPaths(exec);
	const outside = changed.filter((p) => !allowed.some((re) => re.test(p)));
	if (outside.length) {
		log(`::error title=Playtest import::refusing to commit files outside the collection's records: ${outside.slice(0, 5).join(', ')}`);
		return 1;
	}
	const records = changed.filter((p) => allowed[0].test(p));
	const remote = (() => {
		try {
			return exec('git', ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${branch}`]);
		} catch (error) {
			return '';
		}
	})();
	const open = JSON.parse(exec('gh', ['pr', 'list', '--head', branch, '--base', base, '--state', 'open', '--json', 'number', '--limit', '1']) || '[]');
	const number = open.length ? open[0].number : null;

	if (!records.length) {
		log('No new records to import.');
		if (number) {
			exec('gh', ['pr', 'close', String(number), '--comment', 'Closed by the import workflow: nothing is left to import (its games are already in the collection, or were excluded).']);
			log(`Closed the obsolete import pull request #${number}.`);
		}
		return 0;
	}

	exec('git', ['checkout', '-B', branch]);
	exec('git', ['add', '--', ...changed]);
	exec('git', ['-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com',
		'commit', '--quiet', '-m', `${title}\n\n${records.length} replay-verified record${records.length === 1 ? '' : 's'} submitted online, for review.`]);
	const tree = exec('git', ['rev-parse', 'HEAD^{tree}']);
	const remoteTree = remote ? exec('git', ['rev-parse', `${remote}^{tree}`]) : '';
	if (tree === remoteTree && number) {
		log(`The import branch already holds these ${records.length} records: nothing pushed.`);
	} else {
		exec('git', ['push', `--force-with-lease=refs/heads/${branch}:${remote}`, 'origin', `HEAD:refs/heads/${branch}`]);
		log(`Pushed ${records.length} record${records.length === 1 ? '' : 's'} to ${branch}.`);
	}
	const bodyArgs = summaryFile ? ['--body-file', summaryFile] : ['--body', 'Human playtests submitted online, replay-verified, for review.'];
	if (number) {
		exec('gh', ['pr', 'edit', String(number), '--title', title, ...bodyArgs]);
		log(`Updated pull request #${number}.`);
	} else {
		const url = exec('gh', ['pr', 'create', '--base', base, '--head', branch, '--title', title, ...bodyArgs]);
		log(`Opened ${url}`);
	}
	try {
		// Pull requests made with the workflow's token don't start other workflows: run the collection's check on it
		exec('gh', ['workflow', 'run', 'playtests.yml', '--ref', branch]);
	} catch (error) {
		log('::warning title=Playtest import::could not start the Human playtests check on the import branch; run it by hand from the Actions tab');
	}
	return 0;
}

if (require.main === module) {
	try {
		process.exitCode = main(process.argv.slice(2));
	} catch (error) {
		console.log(`::error title=Playtest import::${error.message}`);
		process.exitCode = 1;
	}
}

module.exports = { main, changedPaths, allowed };
