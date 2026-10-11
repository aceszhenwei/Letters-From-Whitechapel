// The playtest submission Worker's entry point (docs/automatic-playtest-collection.md). Only the default export: the
// Workers runtime treats every export of this module as an entry point. The logic is in src/app.js.
import { handle, retain, reply } from './app.js';

export default {
	async scheduled(event, env, ctx) {
		ctx.waitUntil(retain(env));
	},
	async fetch(request, env) {
		try {
			return await handle(request, env);
		} catch (error) {
			// Never echo internals; the client keeps its record and retries
			return reply(500, { ok: false, status: 'error', message: 'Something went wrong; try again later.' }, { 'Retry-After': '600' });
		}
	}
};
