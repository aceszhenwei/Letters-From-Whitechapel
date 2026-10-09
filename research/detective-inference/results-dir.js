// Where the research scripts write their results: results/ next to them, or the folder in RESEARCH_RESULTS (the
// medium test tier uses this to keep its smaller runs apart from the full study's; tools/tiers/tiers.js).
const path = require('path');
const fs = require('fs');

const dir = process.env.RESEARCH_RESULTS ? path.resolve(process.env.RESEARCH_RESULTS) : path.join(__dirname, 'results');
fs.mkdirSync(dir, { recursive: true });
module.exports = dir;
