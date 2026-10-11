// Runs a group of the test suite (docs/testing.md#test-groups). Every test file belongs to exactly one CI group, so the
// three CI jobs together run the whole suite, `npm test`, and nothing is dropped when files are added.
//
//   node tools/ci/tests.js fast        headless tests only (no simulated browser): the quick local check, ~30 s
//   node tools/ci/tests.js page        every test that loads the page in jsdom
//   node tools/ci/tests.js golden      CI group: golden traces and the full seeded games (the longest page tests)
//   node tools/ci/tests.js browser     CI group: every other page test
//   node tools/ci/tests.js core        CI group: every headless test (the same files as `fast`)
//   node tools/ci/tests.js --list <group>   print the files instead of running them
//
// A file is a page test if it loads the page (loadGame, startGame, setupJack, traceGame, playGame or a JSDOM of its
// own); otherwise it is headless. The golden group is named explicitly, because those files dominate the run time.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..', '..');
const golden = ['test/regression/golden-traces.test.js', 'test/regression/golden-traces-even.test.js', 'test/regression/full-game.test.js'];
const pagePattern = /\b(loadGame|startGame|setupJack|traceGame|playGame)\s*\(|new JSDOM\b/;

function allTests() {
	const out = [];
	for (const dir of ['test/unit', 'test/regression']) {
		for (const name of fs.readdirSync(path.join(root, dir)).sort()) {
			if (name.endsWith('.test.js')) out.push(dir + '/' + name);
		}
	}
	return out;
}

function isPage(file) {
	return pagePattern.test(fs.readFileSync(path.join(root, file), 'utf8'));
}

function groups() {
	const files = allTests();
	const page = files.filter((f) => golden.includes(f) || isPage(f));
	const headless = files.filter((f) => !page.includes(f));
	return {
		fast: headless,
		page,
		golden: files.filter((f) => golden.includes(f)),
		browser: page.filter((f) => !golden.includes(f)),
		core: headless
	};
}

function main(argv) {
	const list = argv.includes('--list');
	const name = argv.filter((a) => !a.startsWith('--'))[0];
	const all = groups();
	if (!all[name]) {
		console.error(`Usage: node tools/ci/tests.js [--list] <${Object.keys(all).join('|')}>`);
		return 2;
	}
	if (list) {
		console.log(all[name].join('\n'));
		return 0;
	}
	console.log(`Running the ${name} group: ${all[name].length} files`);
	const result = spawnSync(process.execPath, ['--test', ...all[name]], { cwd: root, stdio: 'inherit' });
	return result.status === null ? 1 : result.status;
}

if (require.main === module) {
	process.exitCode = main(process.argv.slice(2));
}

module.exports = { groups, allTests, isPage, golden };
