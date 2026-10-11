/* Anonymous Gameplay Research (docs/automatic-playtest-collection.md): sends the full record of each game a person
   finishes to the research intake (a Cloudflare Worker), unless the player has turned it off. The game never waits
   for it: the record is kept in this browser first (js/ui/playtest-store.js), and sending happens afterwards, one game
   at a time, with bounded retries.
   - The site sends nothing unless it was built with an intake address (WC.config.playtestApiUrl, js/config.js, filled
     in by tools/site/build.js from the PLAYTEST_API_URL repository variable). Without one, this module is inactive.
   - The setting: on by default, off if the player turns it off (remembered in localStorage, never asked again), and
     off by default for browsers that send Global Privacy Control or Do Not Track.
   - Each kept game carries a submission status, apart from its export status:
       not-submitted  never sent: the setting was off, the game was kept before this existed, or sending was cancelled
       pending        waiting to be sent
       submitting     being sent now
       submitted      the intake acknowledged it (a duplicate acknowledgement counts: it was received before)
       retry          a try failed; another follows at nextAttemptAt, or, once the tries are used up, when the
                      player asks (Submit in the playtest records)
       rejected       the intake refused it for good (an invalid record, or a conflict); never sent again
   - Turning the setting off stops the request in flight, cancels every waiting game and stops retries. Games played
     while it was off are never sent later, unless the player sends one on purpose from the playtest records.
   - Nothing but the record is sent: no cookie, no referrer, no identifier. Random jitter comes from crypto, never
     Math.random, which seeded games share. */
var WC = WC || {};

WC.submission = (function (record) {

	var statuses = { notSubmitted: 'not-submitted', pending: 'pending', submitting: 'submitting', submitted: 'submitted', retry: 'retry', rejected: 'rejected' };
	var settingKey = 'whitechapel.research.submit';
	var path = '/api/v1/playtests';
	var labels = {
		'not-submitted': 'Not submitted', pending: 'Pending', submitting: 'Submitting', submitted: 'Submitted',
		retry: 'Will retry', rejected: 'Permanently rejected'
	};

	function label(submission) {
		var s = submission || { status: statuses.notSubmitted };
		if (s.status == statuses.retry && !s.nextAttemptAt) return 'Retry required';
		return labels[s.status] || s.status;
	}

	function privacySignal(nav) {
		// Global Privacy Control or Do Not Track: research submission starts off for these browsers
		try {
			return !!nav && (nav.globalPrivacyControl === true || nav.doNotTrack === '1' || nav.doNotTrack === 'yes');
		} catch (e) {
			return false;
		}
	}

	function endpointOf(base) {
		// Only an https address (or http on this computer, for testing) is used; anything else leaves submission off
		if (typeof base != 'string' || !base) return null;
		var trimmed = base.replace(/\/+$/, '');
		if (!/^https:\/\/[A-Za-z0-9.-]+(:\d+)?(\/[A-Za-z0-9._~\/-]*)?$/.test(trimmed) &&
			!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/[A-Za-z0-9._~\/-]*)?$/.test(trimmed)) {
			return null;
		}
		return trimmed + path;
	}

	function retryAfter(value, now) {
		// Seconds, or an HTTP date -> milliseconds to wait (null if absent or unreadable), at most a week
		if (value === null || value === undefined || value === '') return null;
		var seconds = Number(value);
		var ms = isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
		if (!isFinite(ms) || ms < 0) return null;
		return Math.min(ms, 7 * 24 * 3600 * 1000);
	}

	function jitter(ms) {
		// Up to 20% more, so many browsers don't retry at the same moment
		var fraction = 0;
		try {
			if (typeof crypto != 'undefined' && crypto && crypto.getRandomValues) {
				fraction = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
			}
		} catch (e) { /* No jitter */ }
		return Math.round(ms * (1 + 0.2 * fraction));
	}

	function create(options) {
		options = options || {};
		var endpoint = endpointOf(options.endpoint);
		var storage = options.storage !== undefined ? options.storage : (function () {
			try { return window.localStorage; } catch (e) { return null; }
		})();
		var nav = options.navigator !== undefined ? options.navigator : (typeof navigator != 'undefined' ? navigator : null);
		var fetcher = options.fetch !== undefined ? options.fetch : (typeof fetch == 'function' ? function (url, init) { return fetch(url, init); } : null);
		var now = options.now || function () { return Date.now(); };
		var timers = { set: options.setTimeout || function (f, ms) { return setTimeout(f, ms); }, clear: options.clearTimeout || function (t) { clearTimeout(t); } };
		var maxAttempts = options.maxAttempts || 8;
		var baseDelay = options.baseDelay || 60 * 1000;
		var maxDelay = options.maxDelay || 12 * 3600 * 1000;
		var timeout = options.timeout || 30 * 1000;
		var storePromise = Promise.resolve(options.store);
		var listeners = [];
		var running = null;
		var again = false;
		var timer = null;
		var inFlight = null;

		function saved() {
			try { return storage ? storage.getItem(settingKey) : null; } catch (e) { return null; }
		}

		function enabled() {
			if (!endpoint) return false;
			var choice = saved();
			if (choice === 'on') return true;
			if (choice === 'off') return false;
			return !privacySignal(nav);
		}

		function notify(id, submission) {
			_.each(listeners, function (f) {
				try { f(id, submission); } catch (e) { /* A listener's problem is not the queue's */ }
			});
		}

		function initial() {
			// The submission status a game gets when it is kept
			if (!endpoint) return { status: statuses.notSubmitted, reason: 'not-configured', attempts: 0 };
			if (!enabled()) return { status: statuses.notSubmitted, reason: 'opted-out', attempts: 0 };
			return { status: statuses.pending, attempts: 0, nextAttemptAt: null };
		}

		function update(store, id, submission) {
			return store.setSubmission(id, submission).then(function () {
				notify(id, submission);
				return submission;
			});
		}

		function due(entry, at) {
			var s = entry.submission;
			if (!s) return false;
			if (s.status == statuses.pending || s.status == statuses.submitting) return true; // 'submitting' left by a closed page
			return s.status == statuses.retry && !!s.nextAttemptAt && Date.parse(s.nextAttemptAt) <= at;
		}

		function afterFailure(s, error, wait, at) {
			var attempts = s.attempts;
			var out = { status: statuses.retry, attempts: attempts, lastAttemptAt: s.lastAttemptAt, lastError: error, explicit: s.explicit };
			if (attempts >= maxAttempts) {
				out.nextAttemptAt = null; // Retry required: only when the player asks
				return out;
			}
			var backoff = Math.min(maxDelay, baseDelay * Math.pow(2, attempts - 1));
			out.nextAttemptAt = new Date(at + jitter(Math.max(backoff, wait || 0))).toISOString();
			return out;
		}

		function send(store, entry) {
			var at = now();
			var s = { status: statuses.submitting, attempts: ((entry.submission && entry.submission.attempts) || 0) + 1,
				lastAttemptAt: new Date(at).toISOString(), explicit: !!(entry.submission && entry.submission.explicit) };
			return update(store, entry.id, s).then(function () {
				var controller = typeof AbortController != 'undefined' ? new AbortController() : null;
				var abort = timers.set(function () { if (controller) controller.abort(); }, timeout);
				inFlight = controller;
				var init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: record.stringify(entry.record),
					credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', mode: 'cors' };
				if (controller) init.signal = controller.signal;
				return Promise.resolve().then(function () { return fetcher(endpoint, init); }).then(function (response) {
					timers.clear(abort);
					return response.text().then(function (text) {
						var body = null;
						try { body = JSON.parse(text); } catch (e) { /* Not JSON: judged by the status alone */ }
						return { response: response, body: body };
					});
				}).then(function (r) {
					inFlight = null;
					var code = r.body && typeof r.body.status == 'string' ? r.body.status.slice(0, 40) : 'http-' + r.response.status;
					if (r.response.status == 200 || r.response.status == 201) {
						return { status: statuses.submitted, attempts: s.attempts, submittedAt: new Date(now()).toISOString(), result: code };
					}
					if (r.response.status == 429 || r.response.status == 408 || r.response.status >= 500) {
						return afterFailure(s, code, retryAfter(r.response.headers.get('Retry-After'), now()), now());
					}
					return { status: statuses.rejected, attempts: s.attempts, lastAttemptAt: s.lastAttemptAt, lastError: code };
				}, function (error) {
					timers.clear(abort);
					inFlight = null;
					return afterFailure(s, error && error.name == 'AbortError' ? 'timeout-or-cancelled' : 'network', null, now());
				}).then(function (next) {
					// Turned off while it was being sent: the game stays not submitted (it may have arrived)
					if (!enabled() && !s.explicit) {
						next = next.status == statuses.submitted ? next : { status: statuses.notSubmitted, reason: 'cancelled', attempts: s.attempts };
					}
					return update(store, entry.id, next);
				});
			});
		}

		function schedule(entries) {
			if (timer) {
				timers.clear(timer);
				timer = null;
			}
			var next = _.chain(entries).filter(function (e) { return e.submission && e.submission.status == statuses.retry && e.submission.nextAttemptAt; })
				.map(function (e) { return Date.parse(e.submission.nextAttemptAt); }).min().value();
			if (isFinite(next)) {
				timer = timers.set(function () { timer = null; process(); }, Math.max(1000, Math.min(next - now(), 3600 * 1000)));
			}
		}

		function process() {
			// Sends every game that is due, one at a time. Never rejects
			if (!endpoint || !fetcher) return Promise.resolve();
			if (running) {
				again = true;
				return running;
			}
			running = storePromise.then(function (store) {
				if (!store || !store.available || !store.available()) return null;
				return store.list().then(function (entries) {
					var at = now();
					var queue = _.filter(entries, function (e) { return due(e, at) && (enabled() || (e.submission && e.submission.explicit)); })
						.sort(function (a, b) { return a.savedAt < b.savedAt ? -1 : a.savedAt > b.savedAt ? 1 : 0; });
					return _.reduce(queue, function (chain, entry) {
						return chain.then(function () {
							if (!enabled() && !entry.submission.explicit) return null;
							return send(store, entry);
						});
					}, Promise.resolve()).then(function () { return store.list(); }).then(schedule);
				});
			}).then(null, function () { /* Storage failed: the next game or page load tries again */ }).then(function () {
				running = null;
				if (again) {
					again = false;
					return process();
				}
			});
			return running;
		}

		function setEnabled(on) {
			try { if (storage) storage.setItem(settingKey, on ? 'on' : 'off'); } catch (e) { /* Applies to this page only */ }
			if (on) {
				return process();
			}
			// Off: stop what is in flight and cancel every waiting game
			if (inFlight) {
				try { inFlight.abort(); } catch (e) { /* Already finished */ }
			}
			if (timer) {
				timers.clear(timer);
				timer = null;
			}
			return storePromise.then(function (store) {
				if (!store || !store.available || !store.available()) return null;
				return store.list().then(function (entries) {
					var waiting = _.filter(entries, function (e) {
						var s = e.submission && e.submission.status;
						return s == statuses.pending || s == statuses.retry || s == statuses.submitting;
					});
					return Promise.all(_.map(waiting, function (e) {
						return update(store, e.id, { status: statuses.notSubmitted, reason: 'opted-out', attempts: e.submission.attempts || 0 });
					}));
				});
			}).then(null, function () {});
		}

		function submitNow(id) {
			// The player asks for one game to be sent (the playtest records): also a game played while the setting was off
			if (!endpoint) return Promise.reject(new Error('online submission is not set up on this site'));
			return storePromise.then(function (store) {
				return store.get(id).then(function (entry) {
					if (!entry) throw new Error('no such game');
					var s = entry.submission || {};
					if (s.status == statuses.submitted || s.status == statuses.rejected) return s;
					return update(store, id, { status: statuses.pending, attempts: 0, explicit: true });
				});
			}).then(function () { return process(); });
		}

		if (endpoint && typeof window != 'undefined' && window.addEventListener && !options.noEvents) {
			window.addEventListener('online', function () { process(); });
		}

		return {
			configured: function () { return !!endpoint; },
			endpoint: function () { return endpoint; },
			enabled: enabled,
			chosen: function () { var c = saved(); return c === 'on' || c === 'off'; },
			privacySignal: function () { return privacySignal(nav); },
			setEnabled: setEnabled,
			initial: initial,
			process: process,
			kick: function () { return process(); },
			submitNow: submitNow,
			onChange: function (f) { listeners.push(f); },
			idle: function () { return running || Promise.resolve(); }
		};
	}

	return { create: create, statuses: statuses, label: label, endpointOf: endpointOf, retryAfter: retryAfter, settingKey: settingKey };
})(WC.record);
