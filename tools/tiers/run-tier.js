// Runs a test tier (tools/tiers/tiers.js), times each step, and records it in experiments/tiers/manifest.json.
// An expensive step is skipped when its inputs (file contents and command) are unchanged since it last succeeded and
// its outputs are still there: its earlier results stand. Use --force to run it anyway.
//   node tools/tiers/run-tier.js <fast|smoke|medium|full> [--force] [--dry-run] [--record seconds] [--only step]
// --record marks the tier's cached steps as done with today's inputs, without running them, when their outputs were
// produced outside this runner (for example by running research/detective-inference/run-all.sh directly). The time
// given is recorded for each step it marks. --only limits the run (or the record) to one named step.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const tiers = require('./tiers');

const root = path.join(__dirname, '..', '..');
const manifestFile = path.join(root, 'experiments', 'tiers', 'manifest.json');
const argv = process.argv.slice(2);
const tierName = argv.find((a, i) => !a.startsWith('--') && !['--record', '--only'].includes(argv[i - 1]));
const force = argv.includes('--force');
const dryRun = argv.includes('--dry-run');
const recordAt = argv.indexOf('--record');
const recordSeconds = recordAt === -1 ? null : Number(argv[recordAt + 1]);
const onlyAt = argv.indexOf('--only');
const only = onlyAt === -1 ? null : argv[onlyAt + 1];
const tier = tiers[tierName];
if (!tier) {
	console.error(`Usage: node tools/tiers/run-tier.js <${Object.keys(tiers).join('|')}> [--force] [--dry-run]`);
	process.exit(1);
}

function files(entry) {
	const full = path.join(root, entry);
	if (!fs.existsSync(full)) return [];
	if (fs.statSync(full).isFile()) return [entry];
	return fs.readdirSync(full).sort().flatMap((name) => files(path.join(entry, name)));
}

function fingerprint(step) {
	// What a step's results depend on: its command, environment and every input file's contents
	const hash = crypto.createHash('sha256');
	hash.update(step.command + JSON.stringify(step.env || {}));
	for (const file of (step.inputs || []).flatMap(files).sort()) {
		hash.update(file);
		hash.update(fs.readFileSync(path.join(root, file)));
	}
	return hash.digest('hex').slice(0, 16);
}

const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {};
const save = () => {
	fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
	fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 1) + '\n');
};

console.log(`Tier "${tierName}": ${tier.description}`);
const started = Date.now();
let failed = false;
for (const step of tier.steps.filter((s) => !only || s.name === only)) {
	const id = fingerprint(step);
	const last = manifest[step.name];
	const outputsThere = (step.outputs || []).every((out) => fs.existsSync(path.join(root, out)));
	if (step.cache !== false && !force && last && last.inputs === id && last.ok && outputsThere) {
		console.log(`- ${step.name}: skipped, inputs unchanged since ${last.finished} (took ${last.seconds} s)`);
		continue;
	}
	if (recordSeconds !== null) {
		if (step.cache === false || !outputsThere) {
			console.log(`- ${step.name}: not recorded (${step.cache === false ? 'never cached' : 'outputs missing'})`);
			continue;
		}
		manifest[step.name] = { tier: tierName, inputs: id, ok: true, seconds: recordSeconds, finished: new Date().toISOString(), node: process.version, recorded: true };
		save();
		console.log(`- ${step.name}: recorded as done`);
		continue;
	}
	if (dryRun) {
		console.log(`- ${step.name}: would run (${last ? 'inputs changed or outputs missing' : 'never run'})`);
		continue;
	}
	console.log(`- ${step.name}: running`);
	for (const out of step.outputs || []) fs.mkdirSync(path.dirname(path.join(root, out)), { recursive: true });
	if (step.env && step.env.RESEARCH_RESULTS) fs.mkdirSync(path.join(root, step.env.RESEARCH_RESULTS), { recursive: true });
	const t = Date.now();
	let ok = true;
	try {
		execSync(step.command, { cwd: root, stdio: 'inherit', env: Object.assign({}, process.env, step.env || {}), shell: '/bin/bash' });
	} catch (error) {
		ok = false;
		failed = true;
	}
	const seconds = Math.round((Date.now() - t) / 100) / 10;
	manifest[step.name] = { tier: tierName, inputs: id, ok, seconds, finished: new Date().toISOString(), node: process.version };
	save();
	console.log(`  ${ok ? 'passed' : 'FAILED'} in ${seconds} s`);
	if (!ok) break;
}
console.log(`Tier "${tierName}" ${failed ? 'FAILED' : 'done'} in ${Math.round((Date.now() - started) / 1000)} s`);
process.exit(failed ? 1 : 0);
