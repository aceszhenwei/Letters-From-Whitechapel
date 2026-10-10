/* Record: the game's history as a versioned, replayable record (docs/game-records.md).
   It listens to the engine's 'action' events (js/core/engine.js): every decision the engine accepted, Jack's and the
   police's, in order, before it took effect. Nothing else is recorded: no AI's reasoning, no clicks the engine refused.

   The canonical history holds only actions that still stand:
   - a policeman's move that was undone is taken out (the engine undoes newest first, so the rest replays the same);
   - a patrol token taken back, or switched between real and fake, leaves only its final placement.
   What was taken back is kept apart, as interactions (for studying the interface, never replayed).

   Exports (plain JSON objects; never the state itself):
   - public: what one side could know (role 'police', or 'jack' for a future human Jack). Built field by field from
     what that side sees at the table, never by copying everything and deleting secrets. Available at any time.
   - full: everything, Jack's hideout and route included. Only once the game is over, or after the player ends the
     game on purpose (abandon), which a full export of an unfinished game requires.
   replay(record) plays a full record again through the engine, with Jack's recorded decisions in place of his AI.
   Works without a page, so the same code serves the browser, the tests and tools/game-log/. */
var WC = WC || {};

WC.record = (function (rules, engine, map, _) {

	var format = 'whitechapel-game-log';
	var schemaVersion = 1;
	var appVersion = '1.0.0'; // package.json's version (a test keeps them equal)

	// The phase each action is taken in
	var phaseOf = {
		hideout: 0, women: 1, wait: 4, victims: 4, reveal: 6, move: 9,
		patrol: 2, wretched: 5, keepWretched: 5, policeman: 10, finishMoves: 10, beginNight: 12, choose: 11, search: 11, arrest: 11
	};
	var jackTypes = ['hideout', 'women', 'wait', 'victims', 'reveal', 'move'];
	var policeTypes = ['patrol', 'wretched', 'keepWretched', 'policeman', 'finishMoves', 'beginNight', 'choose', 'search', 'arrest'];
	var winners = { arrested: 'police', trapped: 'police', outOfMoves: 'police', jackWins: 'jack' };

	function copy(value) {
		return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
	}

	function hash(text) {
		// Two 32-bit FNV-1a hashes: enough to tell rule sets and maps apart, not a security measure
		var a = 0x811c9dc5;
		var b = 0x01000193 ^ 0x5bd1e995;
		for (var i = 0; i < text.length; i++) {
			var c = text.charCodeAt(i);
			a = Math.imul(a ^ c, 0x01000193) >>> 0;
			b = Math.imul(b ^ c, 0x01000193 ^ 0x2f) >>> 0;
		}
		return ('0000000' + a.toString(16)).slice(-8) + ('0000000' + b.toString(16)).slice(-8);
	}

	// The rules and map this code plays: a record from other rules or another map is not replayed against these
	var ruleset = (function () {
		var config = copy(rules.config);
		var mapHash = hash(JSON.stringify(map));
		return { id: 'whitechapel-' + hash(JSON.stringify(config) + '/' + mapHash).slice(0, 12), config: config, map: mapHash };
	})();

	function gameId() {
		// One random identifier per game, to tell records of the same game apart from others. Not stored anywhere and
		// not linked to the player. Never drawn from Math.random, which seeded games and Jack's AI share
		var bytes = [];
		if (typeof crypto !== 'undefined' && crypto && typeof crypto.getRandomValues === 'function') {
			bytes = Array.prototype.slice.call(crypto.getRandomValues(new Uint8Array(8)));
		} else {
			var seed = hash(String(Date.now()) + '/' + String(typeof performance !== 'undefined' ? performance.now() : 0));
			return 'g' + seed;
		}
		return 'g' + _.map(bytes, function (n) { return ('0' + n.toString(16)).slice(-2); }).join('');
	}

	function nightIndex(state) {
		return state.jack.length > 0 ? state.jack.length - 1 : null;
	}

	function context(state) {
		// Where in the game an action was taken. All of it is public
		var night = nightIndex(state);
		var police = night === null ? null : state.police[night];
		return {
			night: night,
			phase: state.phase,
			jackMove: night === null ? 0 : state.jack[night].moves.length, // Jack's moves so far tonight
			timeOfCrime: state.timeOfCrime,
			remainingMoves: state.remainingMoves,
			known: police && police.log ? police.log.length : 0 // Entries in tonight's public record when it was taken
		};
	}

	function outcome(state, status) {
		if (status == 'completed' && state.result) {
			var result = { result: state.result.type, winner: winners[state.result.type] || null, night: state.jack.length,
				jackMove: state.jack.length ? state.jack[state.jack.length - 1].moves.length : 0 };
			if (state.result.mapid !== undefined) {
				result.mapid = state.result.mapid; // Where the arrest was made: on the table
			}
			return result;
		}
		if (status == 'abandoned') {
			return { result: 'abandoned', winner: null, night: state.jack.length,
				jackMove: state.jack.length ? state.jack[state.jack.length - 1].moves.length : 0 };
		}
		return null;
	}

	/* What each side can see
	   ---------------------- */
	function reached(state, night, phase) {
		// Has the game passed this phase of this night?
		var current = nightIndex(state);
		return night !== null && (night < current || (night === current && (state.over || state.phase >= phase)));
	}

	function entryBase(entry, seq) {
		return { seq: seq, side: entry.side, type: entry.type, night: entry.night, phase: entry.phase, jackMove: entry.jackMove,
			timeOfCrime: entry.timeOfCrime, remainingMoves: entry.remainingMoves, known: entry.known };
	}

	function seenByPolice(entry, seq, state) {
		var out = entryBase(entry, seq);
		var args = entry.args;
		if (entry.side == 'police') {
			out.args = copy(args);
			if (entry.result !== undefined) out.result = copy(entry.result);
			return out;
		}
		switch (entry.type) {
			case 'hideout':
				out.args = {}; // Jack chose his hideout; where is his secret
				break;
			case 'women':
				out.args = { women: _.sortBy(args.marked.concat(args.unmarked), _.identity) }; // Face down
				if (reached(state, entry.night, 3)) {
					out.args.wretched = args.marked.slice(); // Turned over when the victims are chosen
				}
				break;
			case 'victims':
				out.args = { scenes: _.sortBy(args.scenes, _.identity) }; // On the double event, not which came first
				break;
			case 'move':
				out.args = { type: args.type }; // The kind of move is on the move track; where he went is not
				out.result = { escaped: !!entry.result.escaped };
				break;
			case 'reveal':
				out.args = { mapid: args.mapid };
				out.result = { fake: !!entry.result.fake };
				break;
			default: // wait
				out.args = {};
		}
		return out;
	}

	function seenByJack(entry, seq, state) {
		var out = entryBase(entry, seq);
		if (entry.side == 'jack') {
			out.args = copy(entry.args);
			if (entry.result !== undefined) out.result = copy(entry.result);
			return out;
		}
		if (entry.type == 'patrol') {
			out.args = { mapid: entry.args.mapid }; // A token, face down
			if (reached(state, entry.night, 8)) {
				out.args.kind = entry.args.kind; // The real ones become policemen, the fakes leave the board
			}
			out.result = { placed: true };
			return out;
		}
		out.args = copy(entry.args); // Everything else the police do is on the table
		if (entry.result !== undefined) out.result = copy(entry.result);
		return out;
	}

	function jackNights(state) {
		// Each night as Jack saw it: his own sheet, and the police's tokens as far as he could tell them apart
		return _.map(_.range(state.jack.length), function (night) {
			var police = state.police[night];
			var known = reached(state, night, 8);
			var record = {
				night: night,
				jack: copy(state.jack[night]),
				log: rules.publicLog(state, night),
				clues: police.clue.slice(),
				patrols: {
					tokens: _.sortBy(police.start.concat(police.fake), _.identity),
					revealed: _.map(police.revealed, function (mapid) { return { mapid: mapid, fake: _.contains(police.fake, mapid) }; })
				}
			};
			if (known) {
				record.patrols.real = police.start.slice();
				record.patrols.fake = police.fake.slice();
				record.policeRoutes = copy(police.route);
			}
			return record;
		});
	}

	function currentFor(state, role) {
		if (role == 'police') {
			var view = rules.policeView(state);
			return { phase: view.phase, night: view.night, timeOfCrime: view.timeOfCrime, remainingMoves: view.remainingMoves,
				jackTokens: copy(view.jackTokens), crimeScenes: view.crimeScenes, women: view.women, wretched: view.wretched };
		}
		var jack = rules.jackView(state);
		return { phase: state.phase, night: jack.night, hideout: jack.hideout, route: jack.route, position: jack.position,
			remainingMoves: jack.remainingMoves, timeOfCrime: jack.timeOfCrime, tokens: copy(jack.tokens),
			crimeScenes: state.crimeScenes.slice(), wretched: jack.wretched, patrols: copy(jack.patrols()) };
	}

	/* Recording a game
	   ---------------- */
	function attach(game, options) {
		options = options || {};
		var entries = []; // The canonical history
		var interactions = []; // Taken back: undone moves, patrol tokens taken back or switched
		var status = 'inProgress';
		var frozen = null; // The state when the player ended the game
		var id = options.gameId || gameId();
		var players = copy(options.players) || { jack: { type: 'ai' }, police: { type: 'human' } };
		var randomness = copy(options.randomness) || { source: 'unseeded', seed: null };

		function takeBack(index, why, entry) {
			var removed = entries.splice(index, 1)[0];
			interactions.push({ kind: why, side: removed.side, type: removed.type, args: copy(removed.args), result: copy(removed.result),
				night: removed.night, phase: removed.phase, at: entries.length, by: entry ? copy(entry.args) : undefined });
		}

		game.on(function (type, data) {
			if (type == 'gameOver' && status == 'inProgress') {
				status = 'completed';
			}
			if (type != 'action' || status == 'abandoned') {
				return;
			}
			var entry = _.extend({ side: data.side, type: data.type, args: copy(data.args), result: copy(data.result) }, context(game.state));
			if (entry.type == 'undo') {
				var last = _.findLastIndex(entries, function (e) { return e.type == 'policeman' && e.args.index === data.result.index; });
				if (last !== -1) takeBack(last, 'undone');
				return;
			}
			if (entry.type == 'patrol') {
				var earlier = _.findLastIndex(entries, function (e) { return e.type == 'patrol' && e.night === entry.night && e.args.mapid === entry.args.mapid; });
				if (earlier !== -1) takeBack(earlier, data.result.placed ? 'replaced' : 'takenBack', entry);
				if (!data.result.placed) return;
			}
			entries.push(entry);
		});

		function state() {
			return frozen || game.state;
		}

		function header(disclosure, role, settings) {
			var s = state();
			var record = {
				format: format,
				schemaVersion: schemaVersion,
				disclosure: disclosure,
				role: role,
				app: { name: 'letters-from-whitechapel', version: appVersion, commit: null },
				ruleset: copy(ruleset),
				game: {
					id: id,
					exportedOn: (settings && settings.date) || new Date().toISOString().slice(0, 10),
					status: status,
					nightsPlayed: s.jack.length,
					players: copy(players),
					settings: { confirmPoliceMoves: !!game.settings.confirmPoliceMoves, reviewNights: !!game.settings.reviewNights },
					randomness: copy(randomness)
				},
				outcome: outcome(s, status)
			};
			var feedback = cleanFeedback(settings && settings.feedback);
			if (feedback) {
				record.feedback = feedback;
			}
			return record;
		}

		var recorder = {
			status: function () { return status; },
			canExportFull: function () { return status != 'inProgress'; },
			describePlayers: function (described) { players = copy(described); },
			setRandomness: function (described) { randomness = copy(described); },
			actions: function () { return copy(entries); },

			abandon: function (confirmation) {
				// Ending the game on purpose, so its full record may be shown: needs { confirmed: true }
				if (status != 'inProgress' || !confirmation || confirmation.confirmed !== true) {
					return false;
				}
				status = 'abandoned';
				frozen = copy(game.state);
				return true;
			},

			exportPublic: function (role, settings) {
				role = role || 'police';
				if (role != 'police' && role != 'jack') {
					throw new Error('Unknown role ' + role);
				}
				var s = state();
				var record = header('public', role, settings);
				var project = role == 'police' ? seenByPolice : seenByJack;
				record.actions = _.map(entries, function (entry, i) { return project(entry, i + 1, s); });
				record.interactions = role == 'police' ? copy(_.where(interactions, { side: 'police' })) : [];
				record.nights = role == 'police' ?
					_.map(_.range(s.police.length), function (night) { return copy(rules.nightRecord(s, night)); }) :
					jackNights(s);
				record.current = currentFor(s, role);
				return record;
			},

			exportFull: function (settings) {
				if (status == 'inProgress') {
					throw new Error('The full record is only available once the game is over or has been ended');
				}
				var s = state();
				var record = header('full', null, settings);
				record.actions = _.map(entries, function (entry, i) {
					var out = entryBase(entry, i + 1);
					out.args = copy(entry.args);
					if (entry.result !== undefined) out.result = copy(entry.result);
					return out;
				});
				record.interactions = copy(interactions);
				record.nights = _.map(_.range(s.police.length), function (night) {
					return { police: copy(rules.nightRecord(s, night)), jack: copy(s.jack[night]) };
				});
				record.final = { state: copy(s) };
				return record;
			}
		};
		return recorder;
	}

	function cleanFeedback(feedback) {
		// Optional, written by the player: an anonymous label and comments, nothing else
		if (!feedback) {
			return null;
		}
		var label = typeof feedback.label == 'string' ? feedback.label.trim().slice(0, 60) : '';
		var comments = typeof feedback.comments == 'string' ? feedback.comments.trim().slice(0, 2000) : '';
		if (!label && !comments) {
			return null;
		}
		var out = {};
		if (label) out.label = label;
		if (comments) out.comments = comments;
		return out;
	}

	function stringify(record) {
		// JSON with one action per line: small, and still easy to read and compare
		var lines = _.map(_.keys(record), function (key) {
			var value = record[key];
			var body = _.isArray(value) && value.length && (key == 'actions' || key == 'interactions') ?
				'[\n' + _.map(value, function (item) { return '  ' + JSON.stringify(item); }).join(',\n') + '\n ]' :
				JSON.stringify(value);
			return ' ' + JSON.stringify(key) + ': ' + body;
		});
		return '{\n' + lines.join(',\n') + '\n}\n';
	}

	function filename(record) {
		return 'whitechapel-game-' + record.game.exportedOn + '-' + record.disclosure + '.json';
	}

	/* Replaying a full record
	   ----------------------- */
	function replay(record, options) {
		// Plays the record's actions again through the engine. Jack's AI is replaced by his recorded decisions, so the
		// replay doesn't depend on any AI or random numbers. Returns { ok, problems, game, played }.
		// options.upto: stop once this many actions (by seq) have been played, for a position to study
		options = options || {};
		var actions = record.actions || [];
		var upto = options.upto !== undefined ? options.upto : actions.length;
		var cursor = 0;
		var problems = [];
		var emitted = [];

		function fail(message) {
			var error = new Error(message);
			error.replay = true;
			throw error;
		}

		function nextJack(type) {
			var entry = actions[cursor];
			if (!entry || entry.side != 'jack' || entry.type != type) {
				fail('The engine asked Jack for ' + type + ' before action ' + (cursor + 1) + ', but the record has ' +
					(entry ? entry.side + ' ' + entry.type : 'no more actions'));
			}
			cursor++;
			return entry.args;
		}

		var scripted = {
			chooseHideout: function () { return nextJack('hideout').mapid; },
			placeWomen: function () { var a = nextJack('women'); return { marked: a.marked.slice(), unmarked: a.unmarked.slice() }; },
			wantsToWait: function () {
				var entry = actions[cursor];
				if (entry && entry.side == 'jack' && entry.type == 'wait') {
					cursor++;
					return true;
				}
				return false; // The record goes on with his victims
			},
			chooseVictims: function () { return nextJack('victims').scenes.slice(); },
			choosePatrolToReveal: function () { return nextJack('reveal').mapid; },
			chooseMove: function () {
				var a = nextJack('move');
				return a.type == 'carriage' ? { type: a.type, mapid: a.mapid, via: a.via } : { type: a.type, mapid: a.mapid };
			}
		};

		var settings = (record.game && record.game.settings) || {};
		var game = engine.create({ ai: scripted, confirmPoliceMoves: !!settings.confirmPoliceMoves, reviewNights: !!settings.reviewNights });
		game.on(function (type, data) {
			if (type == 'action') {
				emitted.push(_.extend({ side: data.side, type: data.type, args: copy(data.args), result: copy(data.result) }, context(game.state)));
			}
		});

		var calls = {
			patrol: function (a) { return game.togglePatrol(a.mapid, a.kind); },
			wretched: function (a) { return game.moveWretched(a.from, a.to); },
			keepWretched: function (a) { return game.keepWretched(a.mapid); },
			policeman: function (a) { return game.movePoliceman(a.index, a.to); },
			finishMoves: function () { return game.finishPoliceMoves(); },
			beginNight: function () { return game.beginNextNight(); },
			choose: function (a) { return game.chooseAction(a.index, a.action); },
			search: function (a) { return game.search(a.index, a.mapid); },
			arrest: function (a) { return game.arrest(a.index, a.mapid); }
		};

		try {
			game.start();
			while (cursor < actions.length && cursor < upto) {
				var entry = actions[cursor];
				if (entry.side != 'police' || !_.has(calls, entry.type)) {
					if (entry.side == 'police') fail('Action ' + entry.seq + ' (police: ' + entry.type + ') is not an action the police can take');
					fail('Action ' + entry.seq + ' (Jack: ' + entry.type + ') was recorded where the engine did not ask Jack');
				}
				if (game.state.over) {
					fail('Action ' + entry.seq + ' comes after the game ended');
				}
				cursor++;
				var returned = calls[entry.type](entry.args || {});
				if (returned === false) {
					fail('Action ' + entry.seq + ' (police: ' + entry.type + ' ' + JSON.stringify(entry.args) + ') is not legal here');
				}
			}
		} catch (error) {
			problems.push(error.replay ? error.message : 'The engine refused the record: ' + error.message);
		}

		// Every action the engine accepted must be the one recorded, with the same result and the same context
		var fields = ['side', 'type', 'args', 'result', 'night', 'phase', 'jackMove', 'timeOfCrime', 'remainingMoves', 'known'];
		var compared = Math.min(emitted.length, cursor);
		for (var i = 0; i < compared && problems.length < 20; i++) {
			var recorded = _.pick(actions[i], fields);
			var played = _.pick(emitted[i], fields);
			if (JSON.stringify(normalise(recorded)) !== JSON.stringify(normalise(played))) {
				problems.push('Action ' + (i + 1) + ' differs on replay: recorded ' + JSON.stringify(recorded) + ', replayed ' + JSON.stringify(played));
			}
		}
		if (!problems.length && upto >= actions.length && emitted.length !== actions.length) {
			problems.push('The replay took ' + emitted.length + ' actions; the record has ' + actions.length);
		}
		return { ok: problems.length === 0, problems: problems, game: game, played: cursor };
	}

	function normalise(value) {
		// Same keys in the same order, so two equal records stringify alike
		if (_.isArray(value)) return _.map(value, normalise);
		if (value && typeof value == 'object') {
			var out = {};
			_.each(_.keys(value).sort(), function (key) { if (value[key] !== undefined) out[key] = normalise(value[key]); });
			return out;
		}
		return value;
	}

	return {
		format: format,
		schemaVersion: schemaVersion,
		appVersion: appVersion,
		ruleset: ruleset,
		phaseOf: phaseOf,
		jackTypes: jackTypes,
		policeTypes: policeTypes,
		winners: winners,
		attach: attach,
		replay: replay,
		filename: filename,
		stringify: stringify,
		normalise: normalise,
		hash: hash
	};
})(WC.rules, WC.engine, map, _);
