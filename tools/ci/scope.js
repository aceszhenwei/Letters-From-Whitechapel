// Decides how much of the test suite a change needs (docs/testing.md#ci-scopes). Run by .github/workflows/test.yml.
//
//   node tools/ci/scope.js --base <commit> --head <commit>    prints the scope, and writes scope=… to $GITHUB_OUTPUT
//
// Scopes:
//   docs       only Markdown (.md) files and docs/images/, outside research/human-playtests/: no code changed, so the
//              headless tests run as a sanity check (about half a minute)
//   playtests  only research/human-playtests/ (records, ledger, state, reports), possibly with docs: the headless
//              tests, which include every playtest test, plus dataset.js --ci, which enforces the collection's
//              consistency rules (the snapshot check that caught PR #34 among them)
//   full       anything else (code, tests, tools, data, dependencies, workflows, the site): the whole suite, smoke
//              included
// When in doubt it says full: no base commit, a git error, an empty or unreadable diff, an unknown file.
const { execFileSync } = require('child_process');
const fs = require('fs');

const playtests = /^research\/human-playtests\//;
const docs = [/^[^/]+\.md$/i, /^docs\/(?!examples\/).*\.md$/i, /^docs\/images\//, /^research\/(?!human-playtests\/).*\.md$/i];

function classify(files) {
	// -> { scope, reason }
	if (!Array.isArray(files) || !files.length) return { scope: 'full', reason: 'no changed files could be listed' };
	const other = files.filter((f) => !playtests.test(f) && !docs.some((re) => re.test(f)));
	if (other.length) return { scope: 'full', reason: `code or configuration changed: ${other.slice(0, 5).join(', ')}${other.length > 5 ? ', …' : ''}` };
	if (files.some((f) => playtests.test(f))) return { scope: 'playtests', reason: 'only the human playtest collection (and documentation) changed' };
	return { scope: 'docs', reason: 'only documentation changed' };
}

function changedFiles(base, head, exec) {
	// Files that differ between the base and the head (renames list both names). Throws if git can't tell
	if (!/^[0-9a-f]{7,40}$/i.test(base || '') || /^0+$/.test(base) || !/^[0-9a-f]{7,40}$|^HEAD$/i.test(head || '')) {
		throw new Error('no base commit to compare with');
	}
	const out = exec('git', ['diff', '--name-only', '--no-renames', '-z', `${base}...${head}`]);
	return out.split('\0').filter(Boolean);
}

function main(argv, deps = {}) {
	const exec = deps.exec || ((cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
	const log = deps.log || console.log;
	const env = deps.env || process.env;
	const option = (name) => {
		const i = argv.indexOf(name);
		return i === -1 ? '' : argv[i + 1] || '';
	};
	let result;
	try {
		result = classify(changedFiles(option('--base'), option('--head'), exec));
	} catch (error) {
		result = { scope: 'full', reason: `the whole suite, because ${error.message.split('\n')[0]}` };
	}
	log(`Scope: ${result.scope} (${result.reason})`);
	if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, `scope=${result.scope}\n`);
	if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, `**Test scope: ${result.scope}.** ${result.reason}.\n`);
	return result;
}

if (require.main === module) {
	main(process.argv.slice(2));
}

module.exports = { classify, changedFiles, main };
