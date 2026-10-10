// Stages the website for GitHub Pages (docs/deployment.md): only what the game loads, nothing else.
//   node tools/site/build.js [output folder, default _site]
// Copies index.html, css/, js/, images/ and fonts/ (no research, tests, tools, docs or data sets), then checks that
// every local file index.html and the stylesheets refer to is in the site, and that none is referred to from the root
// ("/..."), which would break under https://aceszhenwei.github.io/Letters-From-Whitechapel/. Exits 1 on a problem.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const out = path.resolve(process.argv[2] || path.join(root, '_site'));
const include = ['index.html', 'css', 'js', 'images', 'fonts'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const item of include) {
	fs.cpSync(path.join(root, item), path.join(out, item), { recursive: true });
}
fs.writeFileSync(path.join(out, '.nojekyll'), ''); // Serve the files as they are

const problems = [];
const local = (ref) => !/^(https?:|data:|#|mailto:)/.test(ref);
function check(file, refs) {
	for (const ref of refs.filter(local)) {
		if (ref.startsWith('/')) {
			problems.push(`${file}: "${ref}" starts at the site root, which breaks under a project path`);
			continue;
		}
		const target = path.resolve(path.dirname(path.join(out, file)), ref.replace(/[?#].*$/, ''));
		if (!fs.existsSync(target)) problems.push(`${file}: "${ref}" is not in the site`);
	}
}
const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
check('index.html', [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]));
for (const css of fs.readdirSync(path.join(out, 'css')).filter((f) => f.endsWith('.css'))) {
	const text = fs.readFileSync(path.join(out, 'css', css), 'utf8');
	check(path.join('css', css), [...text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((m) => m[1]));
}

const size = (dir) => fs.readdirSync(dir, { withFileTypes: true })
	.reduce((n, e) => n + (e.isDirectory() ? size(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);
if (problems.length) {
	console.error(problems.join('\n'));
	process.exit(1);
}
console.log(`Site staged in ${out}: ${include.join(', ')} (${(size(out) / 1024 / 1024).toFixed(1)} MB); every local reference resolves`);
