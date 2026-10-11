// The Pages build (tools/site/build.js): the playtest intake's address goes into the staged js/config.js only when
// PLAYTEST_API_URL is set, and only if it is a plain https address; the committed js/config.js stays empty.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..', '..');

function build(url) {
	const out = fs.mkdtempSync(path.join(os.tmpdir(), 'site-'));
	const env = Object.assign({}, process.env);
	delete env.PLAYTEST_API_URL;
	if (url !== undefined) env.PLAYTEST_API_URL = url;
	const r = spawnSync(process.execPath, [path.join(root, 'tools', 'site', 'build.js'), out], { env, encoding: 'utf8' });
	const config = path.join(out, 'js', 'config.js');
	return { code: r.status, out: r.stdout + r.stderr, config: fs.existsSync(config) ? fs.readFileSync(config, 'utf8') : null };
}

test('the committed configuration sends nothing; the build fills in only a valid https address', () => {
	assert.match(fs.readFileSync(path.join(root, 'js', 'config.js'), 'utf8'), /playtestApiUrl: ''/);
	const plain = build();
	assert.strictEqual(plain.code, 0, plain.out);
	assert.match(plain.config, /playtestApiUrl: ''/);
	assert.match(plain.out, /the site sends nothing/);
	const on = build('https://whitechapel-playtests.example.workers.dev/');
	assert.strictEqual(on.code, 0, on.out);
	assert.match(on.config, /playtestApiUrl: "https:\/\/whitechapel-playtests\.example\.workers\.dev"/);
	for (const bad of ['http://insecure.example', 'https://x.example/"; alert(1); "', 'javascript:alert(1)']) {
		const r = build(bad);
		assert.strictEqual(r.code, 1, bad);
	}
	assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /<script src="js\/config\.js"><\/script>/);
});
