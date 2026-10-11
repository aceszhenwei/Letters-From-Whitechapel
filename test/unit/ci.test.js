// The CI tooling (tools/ci/, .github/workflows/test.yml; docs/testing.md#continuous-integration): the test groups
// split the whole suite without dropping a file, the golden traces are all still checked, the scope of a change is
// decided conservatively, and the workflows keep their safeguards.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const tests = require('../../tools/ci/tests');
const scope = require('../../tools/ci/scope');

const root = path.join(__dirname, '..', '..');

function everyTestFile(dir = path.join(root, 'test')) {
	// What `npm test` ("test/**/*.test.js") runs
	let out = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) out = out.concat(everyTestFile(full));
		else if (entry.name.endsWith('.test.js')) out.push(path.relative(root, full).split(path.sep).join('/'));
	}
	return out.sort();
}

test('the three CI groups run every test file exactly once: together they are npm test', () => {
	const g = tests.groups();
	const all = everyTestFile();
	const ci = [...g.golden, ...g.browser, ...g.core];
	assert.deepStrictEqual(ci.slice().sort(), all, 'every file in exactly one group');
	assert.strictEqual(new Set(ci).size, ci.length);
	assert.deepStrictEqual(g.golden.slice().sort(), tests.golden.slice().sort(), 'the golden group names files that exist');
	assert.deepStrictEqual(g.fast, g.core, 'test:fast is the headless group');
	assert.deepStrictEqual([...g.page, ...g.fast].sort(), all);
});

test('test:fast holds no page test: nothing in it loads the simulated browser', () => {
	for (const file of tests.groups().fast.filter((f) => f !== 'test/unit/ci.test.js')) { // This file only names them
		const code = fs.readFileSync(path.join(root, file), 'utf8');
		assert.ok(!/\b(loadGame|startGame|setupJack|traceGame|playGame)\s*\(|JSDOM|helpers\/golden/.test(code), file);
	}
	for (const file of ['test/regression/full-game.test.js', 'test/regression/human-jack-ui.test.js', 'test/regression/golden-traces.test.js', 'test/unit/rules.test.js']) {
		assert.ok(tests.groups().page.includes(file), file);
	}
});

test('the two golden-trace files check every recorded game between them, each once', () => {
	const { parts, golden } = require('../helpers/golden');
	const seeds = golden.map((g) => g.seed);
	const odd = seeds.filter(parts.odd);
	const even = seeds.filter(parts.even);
	assert.deepStrictEqual([...odd, ...even].sort((a, b) => a - b), seeds.slice().sort((a, b) => a - b));
	assert.strictEqual(odd.filter((s) => even.includes(s)).length, 0);
	assert.ok(odd.length >= 1 && even.length >= 1);
	assert.match(fs.readFileSync(path.join(root, 'test/regression/golden-traces.test.js'), 'utf8'), /goldenTests\('odd'\)/);
	assert.match(fs.readFileSync(path.join(root, 'test/regression/golden-traces-even.test.js'), 'utf8'), /goldenTests\('even'\)/);
});

test('the scope of a change: documentation, the playtest collection, or the whole suite; anything else or any doubt is the whole suite', () => {
	const c = (files) => scope.classify(files).scope;
	assert.strictEqual(c(['README.md', 'CHANGELOG.md', 'CLAUDE.md', 'docs/testing.md', 'docs/images/board.png', 'research/jack-v2/README.md']), 'docs');
	assert.strictEqual(c(['research/human-playtests/records/g0123456789abcdef.json', 'research/human-playtests/intake.json', 'research/human-playtests/analysis-state.json']), 'playtests');
	assert.strictEqual(c(['research/human-playtests/reports/2026-10-12-batch-1.md', 'research/human-playtests/analysis-state.json', 'CHANGELOG.md']), 'playtests');
	for (const shared of ['js/core/engine.js', 'js/ui/renderer.js', 'index.html', 'css/style.css', 'package.json', 'package-lock.json',
		'.github/workflows/test.yml', '.github/workflows/pages.yml', 'tools/ci/scope.js', 'tools/playtests/dataset.js', 'test/unit/rules.test.js',
		'test/fixtures/golden-traces.json', 'worker/src/app.js', 'docs/examples/whitechapel-game-2026-10-10-full.json', 'docs/examples/README.md',
		'experiments/tiers/manifest.json', 'research/jack-v2/run.js', '.gitignore', '.github/pull_request_template.md']) {
		assert.strictEqual(c(['README.md', shared]), 'full', shared);
		assert.strictEqual(c([shared]), 'full', shared);
	}
	assert.strictEqual(c([]), 'full');
	assert.strictEqual(c(null), 'full');
	const lines = [];
	assert.strictEqual(scope.main(['--base', '', '--head', 'abc1234'], { log: (l) => lines.push(l), env: {}, exec: () => '' }).scope, 'full', 'no base');
	assert.strictEqual(scope.main(['--base', '0000000000000000000000000000000000000000', '--head', 'abc1234'], { log: () => {}, env: {}, exec: () => '' }).scope, 'full', 'a new branch');
	assert.strictEqual(scope.main(['--base', 'abc1234', '--head', 'def5678'], { log: () => {}, env: {}, exec: () => { throw new Error('bad object'); } }).scope, 'full', 'git failed');
	assert.strictEqual(scope.main(['--base', 'abc1234', '--head', 'def5678'], { log: () => {}, env: {}, exec: () => 'docs/ui.md\0' }).scope, 'docs');
	assert.match(lines[0], /^Scope: full/);
});

test('the scope from a real git history, as the workflow computes it, with its GitHub output', () => {
	const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-'));
	const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
	const commit = (files, message) => {
		for (const [name, text] of Object.entries(files)) {
			fs.mkdirSync(path.dirname(path.join(repo, name)), { recursive: true });
			fs.writeFileSync(path.join(repo, name), text);
		}
		git('add', '-A');
		git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', message);
		return git('rev-parse', 'HEAD');
	};
	git('init', '-q');
	const base = commit({ 'js/a.js': '1', 'docs/a.md': '1' }, 'base');
	const docsOnly = commit({ 'docs/a.md': '2' }, 'docs');
	const records = commit({ 'research/human-playtests/records/g0123456789abcdef.json': '{}' }, 'records');
	const code = commit({ 'js/a.js': '2' }, 'code');
	const output = path.join(repo, 'out.txt');
	const run = (b, h) => {
		const cwd = process.cwd();
		process.chdir(repo);
		try {
			return scope.main(['--base', b, '--head', h], { log: () => {}, env: { GITHUB_OUTPUT: output } }).scope;
		} finally {
			process.chdir(cwd);
		}
	};
	assert.strictEqual(run(base, docsOnly), 'docs');
	assert.strictEqual(run(docsOnly, records), 'playtests');
	assert.strictEqual(run(base, records), 'playtests');
	assert.strictEqual(run(records, code), 'full');
	assert.strictEqual(run(base, code), 'full');
	assert.match(fs.readFileSync(output, 'utf8'), /^scope=docs\n/);
});

test('the workflows: one test run per merge, Pages gated on the whole suite, the collection check in the quick scope, no Node 20 actions', () => {
	const read = (f) => fs.readFileSync(path.join(root, '.github', 'workflows', f), 'utf8');
	const testYml = read('test.yml');
	const pages = read('pages.yml');
	assert.match(testYml, /node tools\/ci\/scope\.js/);
	assert.match(testYml, /group: \[golden, browser, core\]/);
	assert.match(testYml, /node tools\/playtests\/dataset\.js --ci/, 'collection changes are held to the dataset check');
	assert.match(testYml, /npm run test:smoke/);
	assert.match(testYml, /needs: \[scope, suite\][\s\S]*uses: \.\/\.github\/workflows\/pages\.yml/, 'Pages only after the whole suite passed');
	assert.match(pages, /workflow_call:/);
	assert.ok(!/^\s+push:/m.test(pages), 'Pages no longer runs (and tests) on its own for every push');
	assert.match(pages, /if: github\.event_name == 'workflow_dispatch'\s*\n\s*run: npm test/, 'a deployment by hand still tests first');
	for (const file of fs.readdirSync(path.join(root, '.github', 'workflows'))) {
		const text = read(file);
		assert.ok(!/actions\/(checkout|setup-node)@v4\b|actions\/deploy-pages@v4\b|actions\/configure-pages@v5\b|actions\/upload-pages-artifact@v3\b/.test(text), file + ' uses a Node 20 action');
	}
	assert.match(read('playtests.yml'), /node tools\/playtests\/dataset\.js --ci/);
	assert.strictEqual(require('../../package.json').scripts['test:fast'], 'node tools/ci/tests.js fast');
});
