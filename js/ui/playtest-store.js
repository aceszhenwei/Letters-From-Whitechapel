/* Playtest records in the browser (docs/playtests.md): every completed game a person played is kept, as its full game
   record (js/core/record.js, unchanged), in this browser's IndexedDB, so it survives closing the page and can be exported
   later in batches.
   - open({ indexedDB }) -> a store: list, get, add, markExported, remove, clear. Every call returns a promise. When the
     browser has no IndexedDB, or refuses it (private browsing, blocked storage, full disk), the store says so
     (available() is false, calls reject) and the game goes on unaffected.
   - Each entry: { id (the game's id), savedAt, date, role ('jack' or 'detectives'), opponent, level, result, winner,
     appVersion, ruleset, actions, fingerprint, source ('auto' or 'import'), exportedAt (null until exported), exportCount,
     record (the full record exactly as exported) }.
   - A game is kept once: adding the same game again is a 'duplicate' (skipped), and a different record with the same
     id is a 'conflict' (reported, never overwritten). The fingerprint is a hash of the record without its export date
     and the player's note, which change between two exports of the same game.
   - check(record) is what an import must pass: a full record of a completed game a person played, in this version's
     format and rule set, that replays exactly through the engine.
   - autoSave(game, recorder, store, onSaved) saves a game when it ends by a rule (never one ended by hand or unfinished).
   Nothing here sends anything anywhere. */
var WC = WC || {};

WC.playtests = (function (record) {

	var dbName = 'whitechapel-playtests';
	var storeName = 'records';

	function players(full) {
		var p = (full && full.game && full.game.players) || {};
		return { jack: p.jack || {}, police: p.police || {} };
	}

	function role(full) {
		// Who the person played: 'jack', 'detectives', or null for a game the computer played alone
		var p = players(full);
		if (p.jack.type === 'human') return 'jack';
		if (p.police.type === 'human') return 'detectives';
		return null;
	}

	function opponent(full) {
		var p = players(full);
		var ai = role(full) === 'jack' ? p.police : p.jack;
		return { ai: ai.ai || (ai.type === 'human' ? 'human' : 'unknown'), level: ai.level || null };
	}

	function fingerprint(full) {
		// The same game exported twice has the same fingerprint; any other difference changes it
		var copy = JSON.parse(JSON.stringify(full));
		if (copy.game) delete copy.game.exportedOn;
		delete copy.feedback;
		return record.hash(JSON.stringify(record.normalise(copy)));
	}

	function describe(full, source, now) {
		var who = opponent(full);
		return {
			id: full.game.id,
			savedAt: (now || new Date()).toISOString(),
			date: full.game.exportedOn,
			role: role(full),
			opponent: who.ai,
			level: who.level,
			result: full.outcome ? full.outcome.result : null,
			winner: full.outcome ? full.outcome.winner : null,
			appVersion: full.app ? full.app.version : null,
			ruleset: full.ruleset ? full.ruleset.id : null,
			actions: full.actions ? full.actions.length : 0,
			fingerprint: fingerprint(full),
			source: source || 'auto',
			exportedAt: null,
			exportCount: 0,
			record: full
		};
	}

	function check(full) {
		// -> { ok, verdict: 'verified' | 'invalid' | 'incompatible' | 'ineligible', problems }
		var problems = [];
		var verdict = function (v) { return { ok: v === 'verified', verdict: v, problems: problems }; };
		if (!full || typeof full != 'object' || Array.isArray(full)) {
			problems.push('not a game record');
			return verdict('invalid');
		}
		if (full.format !== record.format) {
			problems.push('not a Letters From Whitechapel game record');
			return verdict('invalid');
		}
		if (full.schemaVersion !== record.schemaVersion) {
			problems.push('schema version ' + full.schemaVersion + ' (this version reads ' + record.schemaVersion + ')');
			return verdict('incompatible');
		}
		if (!full.ruleset || full.ruleset.id !== record.ruleset.id) {
			problems.push('made under other rules or another map (' + (full.ruleset && full.ruleset.id) + ')');
			return verdict('incompatible');
		}
		if (full.disclosure !== 'full' || !Array.isArray(full.actions) || !full.game) {
			problems.push('not a full record (only full records can be replayed and kept)');
			return verdict('ineligible');
		}
		if (typeof full.game.id != 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(full.game.id)) {
			problems.push('no valid game id');
			return verdict('invalid');
		}
		if (full.game.status !== 'completed' || !full.outcome) {
			problems.push('the game was not completed');
			return verdict('ineligible');
		}
		if (!role(full)) {
			problems.push('no person played in this game');
			return verdict('ineligible');
		}
		var replayed;
		try {
			replayed = record.replay(full);
		} catch (error) {
			problems.push('the replay failed: ' + error.message);
			return verdict('invalid');
		}
		if (!replayed.ok) {
			problems = problems.concat(replayed.problems.slice(0, 5));
			return verdict('invalid');
		}
		var state = replayed.game.state;
		var result = state.result;
		var lastNight = state.jack.length ? state.jack[state.jack.length - 1] : null;
		var winner = result ? (result.type == 'jackWins' ? 'jack' : 'police') : null;
		if (!result || result.type !== full.outcome.result || full.outcome.night !== state.jack.length ||
			full.outcome.winner !== winner || !lastNight || full.outcome.jackMove !== lastNight.moves.length) {
			problems.push('the replay ends differently from the recorded outcome');
			return verdict('invalid');
		}
		return verdict('verified');
	}

	function unavailable(reason) {
		var error = new Error('Playtest storage is not available in this browser' + (reason ? ' (' + reason + ')' : ''));
		var fail = function () { return Promise.reject(error); };
		return { available: function () { return false; }, reason: error.message, list: fail, get: fail, add: fail, markExported: fail, remove: fail, clear: fail };
	}

	function open(options) {
		// -> Promise of a store (an unavailable one if IndexedDB can't be used: never rejects)
		options = options || {};
		var idb;
		try {
			idb = options.indexedDB !== undefined ? options.indexedDB : (typeof indexedDB != 'undefined' ? indexedDB : null);
		} catch (e) {
			idb = null; // Some browsers throw on merely reading indexedDB when storage is blocked
		}
		if (!idb) {
			return Promise.resolve(unavailable('no IndexedDB'));
		}
		return new Promise(function (resolve) {
			var request;
			try {
				request = idb.open(options.name || dbName, 1);
			} catch (error) {
				resolve(unavailable(error.message));
				return;
			}
			request.onupgradeneeded = function () {
				var db = request.result;
				if (!db.objectStoreNames.contains(storeName)) {
					db.createObjectStore(storeName, { keyPath: 'id' });
				}
			};
			request.onsuccess = function () { resolve(store(request.result)); };
			request.onerror = function () { resolve(unavailable(request.error && request.error.message)); };
			request.onblocked = function () { resolve(unavailable('blocked by another tab')); };
		});
	}

	function store(db) {
		function run(mode, work) {
			return new Promise(function (resolve, reject) {
				var tx;
				try {
					tx = db.transaction(storeName, mode);
				} catch (error) {
					reject(error);
					return;
				}
				var out;
				tx.oncomplete = function () { resolve(out); };
				tx.onerror = function () { reject(tx.error || new Error('storage error')); };
				tx.onabort = function () { reject(tx.error || new Error('storage was aborted')); };
				try {
					work(tx.objectStore(storeName), function (value) { out = value; });
				} catch (error) {
					try { tx.abort(); } catch (e) { /* Already finished */ }
					reject(error);
				}
			});
		}

		function getAll(objects, done) {
			var request = objects.getAll();
			request.onsuccess = function () { done(request.result || []); };
		}

		return {
			available: function () { return true; },
			list: function () {
				return run('readonly', getAll).then(function (entries) {
					return entries.sort(function (a, b) { return a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0; });
				});
			},
			get: function (id) {
				return run('readonly', function (objects, done) {
					var request = objects.get(id);
					request.onsuccess = function () { done(request.result || null); };
				});
			},
			add: function (full, opts) {
				// -> { status: 'saved' | 'duplicate' | 'conflict', entry }
				opts = opts || {};
				var entry = describe(full, opts.source, opts.now);
				return run('readwrite', function (objects, done) {
					var request = objects.get(entry.id);
					request.onsuccess = function () {
						var existing = request.result;
						if (existing) {
							done({ status: existing.fingerprint === entry.fingerprint ? 'duplicate' : 'conflict', entry: existing });
							return;
						}
						objects.add(entry);
						done({ status: 'saved', entry: entry });
					};
				});
			},
			markExported: function (ids, when) {
				var at = (when || new Date()).toISOString();
				return run('readwrite', function (objects, done) {
					var marked = 0;
					ids.forEach(function (id) {
						var request = objects.get(id);
						request.onsuccess = function () {
							if (request.result) {
								request.result.exportedAt = at;
								request.result.exportCount = (request.result.exportCount || 0) + 1;
								objects.put(request.result);
								done(++marked);
							}
						};
					});
					done(0);
				});
			},
			remove: function (id) {
				return run('readwrite', function (objects) { objects.delete(id); });
			},
			clear: function () {
				return run('readwrite', function (objects) { objects.clear(); });
			}
		};
	}

	/* Saving finished games
	   --------------------- */
	function autoSave(game, recorder, storePromise, onSaved) {
		// When a game a person played ends by a rule, keep its full record. A failure is reported, never thrown: the
		// game has ended normally whatever happens here
		onSaved = onSaved || function () {};
		game.on(function (type) {
			if (type != 'gameOver') {
				return;
			}
			var full;
			try {
				if (recorder.status() != 'completed') return;
				full = recorder.exportFull();
			} catch (error) {
				onSaved({ status: 'failed', error: error });
				return;
			}
			if (!role(full)) {
				return; // The computer played both sides (Developer Mode's watching): not a playtest
			}
			Promise.resolve(storePromise).then(function (store) {
				return store.add(full, { source: 'auto' });
			}).then(function (result) {
				onSaved(result);
			}, function (error) {
				onSaved({ status: 'failed', error: error });
			});
		});
	}

	/* Exporting
	   --------- */
	function fileName(id) {
		return id + '.json';
	}

	function manifest(entries, now) {
		return {
			format: 'whitechapel-playtest-batch',
			version: 1,
			exportedAt: (now || new Date()).toISOString(),
			count: entries.length,
			schema: { format: record.format, schemaVersion: record.schemaVersion, ruleset: record.ruleset.id, appVersion: record.appVersion },
			upload: 'Upload the files in records/ to research/human-playtests/records/ in the GitHub repository (docs/playtests.md). Exporting does not upload anything.',
			games: entries.map(function (e) {
				return { id: e.id, file: 'records/' + fileName(e.id), date: e.date, role: e.role, opponent: e.opponent, level: e.level,
					result: e.result, appVersion: e.appVersion, ruleset: e.ruleset, fingerprint: e.fingerprint };
			})
		};
	}

	function batch(entries, now) {
		// -> { name, bytes, manifest }: one ZIP with manifest.json and records/<game id>.json, each record unchanged
		now = now || new Date();
		var made = manifest(entries, now);
		var files = [{ name: 'manifest.json', text: JSON.stringify(made, null, 2) + '\n' }];
		entries.forEach(function (e) {
			files.push({ name: 'records/' + fileName(e.id), text: record.stringify(e.record) });
		});
		var stamp = now.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
		return { name: 'whitechapel-playtests-' + stamp + '.zip', bytes: WC.zip.create(files, now), manifest: made };
	}

	/* Importing
	   --------- */
	function recordsIn(name, bytes, inflateRaw) {
		// The records in a file: a JSON record, or a batch ZIP's records/*.json (its manifest is only a list).
		// -> Promise of [{ file, record | error }]
		if (/\.zip$/i.test(name)) {
			return WC.zip.read(bytes, inflateRaw).then(function (files) {
				return files.filter(function (f) {
					return /\.json$/i.test(f.name) && !/(^|\/)manifest\.json$/i.test(f.name) && !/(^|\/)(__MACOSX|\.)/.test(f.name);
				}).map(function (f) {
					return parsed(name + ': ' + f.name, f.text);
				});
			}, function (error) {
				return [{ file: name, error: error.message }];
			});
		}
		var text = typeof bytes == 'string' ? bytes : new TextDecoder().decode(bytes);
		return Promise.resolve([parsed(name, text)]);
	}

	function parsed(file, text) {
		try {
			return { file: file, record: JSON.parse(text) };
		} catch (error) {
			return { file: file, error: 'not valid JSON' };
		}
	}

	function importFiles(store, files, inflateRaw) {
		// files: [{ name, bytes }] -> Promise of { added: [], duplicates: [], conflicts: [], rejected: [] }
		var out = { added: [], duplicates: [], conflicts: [], rejected: [] };
		return Promise.all(files.map(function (f) { return recordsIn(f.name, f.bytes, inflateRaw); })).then(function (lists) {
			var items = [].concat.apply([], lists);
			return items.reduce(function (chain, item) {
				return chain.then(function () {
					if (item.error) {
						out.rejected.push({ file: item.file, verdict: 'invalid', problems: [item.error] });
						return;
					}
					var checked = check(item.record);
					if (!checked.ok) {
						out.rejected.push({ file: item.file, id: item.record && item.record.game && item.record.game.id, verdict: checked.verdict, problems: checked.problems });
						return;
					}
					return store.add(item.record, { source: 'import' }).then(function (result) {
						var line = { file: item.file, id: item.record.game.id };
						if (result.status == 'saved') out.added.push(line);
						else if (result.status == 'duplicate') out.duplicates.push(line);
						else out.conflicts.push(line);
					});
				});
			}, Promise.resolve());
		}).then(function () { return out; });
	}

	return {
		open: open,
		check: check,
		describe: describe,
		fingerprint: fingerprint,
		role: role,
		opponent: opponent,
		autoSave: autoSave,
		manifest: manifest,
		batch: batch,
		fileName: fileName,
		recordsIn: recordsIn,
		importFiles: importFiles
	};
})(WC.record);
