/* Site configuration, filled in when the site is built for GitHub Pages (tools/site/build.js, docs/deployment.md).
   playtestApiUrl: the address of the playtest intake Worker (docs/automatic-playtest-collection.md), from the
   repository variable PLAYTEST_API_URL. Empty, as committed here: the game sends nothing anywhere, and Anonymous
   Gameplay Research is not offered. Never put a secret here: everything in this file is public. */
var WC = WC || {};

WC.config = {
	playtestApiUrl: ''
};
