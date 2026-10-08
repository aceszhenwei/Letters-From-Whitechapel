/* Engine: the game state, the phases of a night, and every change to the state.
   - It asks the rules (WC.rules) what is legal, and Jack's AI (game.ai) what Jack decides.
   - The police act through its methods (togglePatrol, moveWretched, movePoliceman, search, arrest ...),
     which check the rules and return false for an illegal action.
   - It never touches the page: it reports what happened as events (game.on), which the interface displays.

   Phases (state.phase), as in the rulebook. The engine runs Jack's phases straight away and waits in the police's.
     Hell:    0 Prepare the scene, 1 The targets are identified, 2 Patrolling the streets (police),
              3 The victims are chosen, 4 Blood on the streets, 5 Suspense grows (police), 6 Ready to kill,
              (7 A corpse on the sidewalk is part of the murder), 8 Alarm whistles
     Hunting: 9 Escape in the night, 10 Hunting the monster (police), 11 Clues and suspicion (police) */
var WC = WC || {};

WC.engine = (function (rules, _) {

	var config = rules.config;

	function createState() {
		return {
			phase: 0,
			base: undefined, // Jack's hideout: secret
			over: false,
			result: null, // How the game ended: { type: 'arrested', 'trapped', 'outOfMoves' or 'jackWins', mapid }
			timeOfCrime: 1, // The Roman numeral the Time of the Crime token is on (1 to 5)
			remainingMoves: config.trackLength - 5, // Move-track spaces left to the right of Jack's pawn
			womenMarked: new Array(), // Where the Wretched are
			womenUnmarked: new Array(),
			crimeScenes: new Array(), // Crime scene markers stay on the map for the whole game
			jack: new Array(), // One record for each night (see newJackNight)
			police: new Array(), // One record for each night (see newPoliceNight)
			turn: {} // Progress through the current police phase
		};
	}

	function newJackNight(night) {
		return {
			route: new Array(), // Every circle on Jack's sheet tonight, starting with the crime scene(s)
			moves: new Array(), // Each move: { mapid, type: 'walk', 'alley' or 'carriage', via }
			murder: new Array(), // Tonight's crime scenes
			murderMove: new Array(), // Their move-track spaces
			trackPosition: 0, // Move-track space of Jack's pawn (1 is V, 5 is I, 6 is 1 and 20 is 15)
			carriages: config.carriages[night],
			alleys: config.alleys[night]
		};
	}

	function newPoliceNight() {
		return {
			start: new Array(), // Real patrol tokens
			fake: new Array(),
			revealed: new Array(),
			now: new Array(), // Where each policeman is (index i is always the same policeman)
			route: new Array(), // Every crossing each policeman has stood on tonight
			search: new Array(), // In Clues and suspicion: circles each policeman can still search
			arrest: new Array(), // ... and arrest at
			clue: new Array()
		};
	}

	function create(options) {
		options = options || {};
		var listeners = [];
		var game = {
			state: createState(),
			ai: options.ai, // Jack's decisions: replace it to change his strategy
			debug: !!options.debug
		};

		function emit(type, data) {
			_.each(listeners, function (listener) {
				listener(type, data || {});
			});
		}

		function check(legal, message) {
			if (!legal) {
				throw new Error('Jack\'s AI broke the rules: ' + message);
			}
		}

		function view() {
			return rules.jackView(game.state, { debug: game.debug });
		}

		game.on = function (listener) {
			listeners.push(listener);
		};

		game.start = function () {
			var hideout = game.ai.chooseHideout(rules.hideoutChoices());
			check(rules.isLegalHideout(hideout), 'hideout ' + hideout);
			game.state.base = hideout;
			emit('started');
			game.enter(0);
		};

		game.enter = function (phase) {
			var state = game.state;
			if (state.over) {
				return; // The game has ended
			}
			state.phase = phase;
			state.turn = {};
			emit('phase', { phase: phase });
			if (phases[phase]) {
				phases[phase]();
			}
		};

		/* The phases
		   ---------- */
		var phases = {};

		phases[0] = function preparingTheScene() {
			var state = game.state;
			var night = state.jack.length;
			state.remainingMoves = config.trackLength - 5;
			state.timeOfCrime = 1;
			state.womenMarked = new Array();
			state.womenUnmarked = new Array();
			state.jack.push(newJackNight(night));
			state.police.push(newPoliceNight());
			emit('nightStarted', { night: night });
			game.enter(1);
		};

		phases[1] = function theTargetsAreIdentified() {
			var state = game.state;
			var women = game.ai.placeWomen(view());
			check(rules.isLegalWomen(state, women.marked, women.unmarked), 'women ' + women.marked + ' / ' + women.unmarked);
			state.womenMarked = women.marked.slice();
			state.womenUnmarked = women.unmarked.slice();
			game.enter(2);
		};

		phases[2] = function patrollingTheStreets() {
			emit('policeTurn', { phase: 2 }); // Waits for togglePatrol
		};

		phases[3] = function theVictimsAreChosen() {
			// The marked women become Wretched, the others are removed. The Time of the Crime token goes on I
			game.state.timeOfCrime = 1;
			emit('timeOfCrime');
			game.enter(4);
		};

		phases[4] = function bloodOnTheStreets() {
			var state = game.state;
			if (rules.jackNight(state).murder.length > 0) {
				console.log('Error: Multiple murders attempted.');
				return;
			}
			if (!rules.mustKill(state) && game.ai.wantsToWait(view())) {
				game.enter(5);
			} else {
				var scenes = game.ai.chooseVictims(view());
				check(rules.isLegalVictims(state, scenes), 'victims ' + scenes);
				game.murder(scenes);
				game.enter(8);
			}
		};

		phases[5] = function suspenseGrows() {
			var state = game.state;
			state.timeOfCrime++; // Move the Time of the Crime token on to the next Roman numeral
			emit('jackWaited', { timeOfCrime: state.timeOfCrime });
			// Every Wretched with a legal move must move, the others stay where they are
			var pending = _.filter(_.range(state.womenMarked.length), function (index) {
				return rules.wretchedMoves(state, state.womenMarked[index]).length > 0;
			});
			state.turn = { pending: pending, total: pending.length };
			if (pending.length == 0) {
				emit('noWretchedCanMove');
				game.enter(6);
				return;
			}
			emit('policeTurn', { phase: 5 }); // Waits for moveWretched and keepWretched
		};

		phases[6] = function readyToKill() {
			var state = game.state;
			var hidden = rules.hiddenPatrols(state);
			if (hidden.length > 0) {
				var mapid = game.ai.choosePatrolToReveal(view(), hidden);
				check(_.contains(hidden, mapid), 'reveal ' + mapid);
				game.reveal(mapid);
			}
			game.enter(4);
		};

		phases[8] = function alarmWhistles() {
			var police = rules.policeNight(game.state);
			police.route = _.map(police.start, function (mapid) { // Real patrols become policemen
				police.now.push(mapid);
				return [mapid];
			});
			if (rules.jackNight(game.state).murder.length > 1) {
				game.enter(10); // Double event: the second crime scene was Jack's first move, so the police go first
			} else {
				game.enter(9);
			}
		};

		phases[9] = function escapeInTheNight() {
			var state = game.state;
			if (!rules.jackCanMove(state)) {
				game.end('trapped');
				return;
			}
			var move = game.ai.chooseMove(view());
			check(rules.isLegalJackMove(state, move), 'move ' + JSON.stringify(move));
			game.moveJack(move);

			if (rules.escapes(state, move)) {
				emit('jackEscaped');
				if (state.jack.length >= config.nights) {
					game.end('jackWins');
				} else {
					game.enter(0); // Start a new night
				}
				return;
			}
			if (state.remainingMoves <= 0) {
				game.end('outOfMoves');
				return;
			}
			game.enter(10);
		};

		phases[10] = function huntingTheMonster() {
			game.state.turn = { moved: [] };
			emit('policeTurn', { phase: 10 }); // Waits for movePoliceman
		};

		phases[11] = function cluesAndSuspicion() {
			var state = game.state;
			var police = rules.policeNight(state);
			police.search = _.map(police.now, function (mapid) {
				return rules.searchable(state, mapid);
			});
			police.arrest = _.map(police.now, function (mapid) {
				return rules.arrestable(mapid);
			});
			// Policemen with no numbered circles next to them can't act
			var canAct = _.filter(_.range(police.now.length), function (index) {
				return police.search[index].length > 0 || police.arrest[index].length > 0;
			}).length;
			state.turn = { acted: police.now.length - canAct, done: [], choice: {}, missed: {} };
			if (canAct == 0) {
				game.enter(9);
				return;
			}
			emit('policeTurn', { phase: 11 }); // Waits for chooseAction, search and arrest
		};

		/* Effects: changes to the state, each reported as an event
		   -------------------------------------------------------- */
		game.murder = function (scenes) {
			var state = game.state;
			var night = rules.jackNight(state);
			// Jack's pawn starts on the Time of the Crime token (the second crime scene of the double event uses his first move)
			var position = rules.timeOfCrimeSpace(state.timeOfCrime);
			_.each(scenes, function (mapid, index) {
				night.route.push(mapid); // Put Jack at the scene of the crime
				night.murder.push(mapid);
				night.murderMove.push(position + index);
				state.crimeScenes.push(mapid);
				state.womenMarked = _.without(state.womenMarked, mapid);
			});
			night.trackPosition = position + scenes.length - 1;
			state.remainingMoves = config.trackLength - night.trackPosition;
			emit('murder', { scenes: scenes.slice() });
		};

		game.reveal = function (mapid) {
			rules.policeNight(game.state).revealed.push(mapid);
			emit('patrolRevealed', { mapid: mapid, fake: rules.isFakePatrol(game.state, mapid) });
		};

		game.moveJack = function (move) {
			var state = game.state;
			var night = rules.jackNight(state);
			var recorded = { mapid: move.mapid, type: move.type };
			if (move.type == 'carriage') {
				recorded.via = move.via;
				night.route.push(move.via); // Both stops are on Jack's sheet, so police can find clues at either
				night.carriages--;
			}
			if (move.type == 'alley') {
				night.alleys--;
			}
			night.route.push(move.mapid);
			night.moves.push(recorded);
			night.trackPosition += rules.moveCost(move);
			state.remainingMoves -= rules.moveCost(move);
			emit('jackMoved', { move: recorded });
		};

		game.end = function (type, data) {
			var state = game.state;
			state.over = true;
			state.result = _.extend({ type: type }, data);
			emit('gameOver', state.result);
		};

		/* Police actions: each checks the rules, and returns false (changing nothing) if it isn't allowed
		   ----------------------------------------------------------------------------------------------- */
		game.togglePatrol = function (mapid, kind) {
			// Place a real (kind 'real') or fake ('fake') patrol token on a crossing, or take it back
			var state = game.state;
			if (state.phase != 2) {
				return false;
			}
			var police = rules.policeNight(state);
			var mine = kind == 'real' ? 'start' : 'fake';
			var other = kind == 'real' ? 'fake' : 'start';
			if (_.contains(police[mine], mapid)) {
				police[mine] = _.without(police[mine], mapid);
			} else if (rules.canPlacePatrol(state, mapid, kind)) {
				police[mine].push(mapid);
				police[other] = _.without(police[other], mapid);
			} else {
				return false;
			}
			emit('patrolChanged', { mapid: mapid });
			if (rules.patrolsPlaced(state)) {
				emit('patrolsPlaced');
				game.enter(3);
			}
			return true;
		};

		function wretchedDone(index) {
			var turn = game.state.turn;
			turn.pending = _.without(turn.pending, index);
			if (turn.pending.length == 0) {
				game.enter(6);
			}
		}

		function pendingWretched(mapid) {
			var state = game.state;
			var index = state.womenMarked.indexOf(mapid);
			return state.phase == 5 && index !== -1 && _.contains(state.turn.pending, index) ? index : -1;
		}

		game.moveWretched = function (from, to) {
			var state = game.state;
			var index = pendingWretched(from);
			if (index === -1 || !_.contains(rules.wretchedMoves(state, from), to)) {
				return false;
			}
			state.womenMarked[index] = to;
			emit('wretchedMoved', { from: from, to: to, moved: state.turn.total - state.turn.pending.length + 1, total: state.turn.total });
			wretchedDone(index);
			return true;
		};

		game.keepWretched = function (mapid) {
			// A Wretched with no legal move (another Wretched moved into its way) stays where it is
			var state = game.state;
			var index = pendingWretched(mapid);
			if (index === -1 || rules.wretchedMoves(state, mapid).length > 0) {
				return false;
			}
			emit('wretchedStays', { mapid: mapid, moved: state.turn.total - state.turn.pending.length + 1, total: state.turn.total });
			wretchedDone(index);
			return true;
		};

		game.movePoliceman = function (index, to) {
			// Move a policeman up to two crossings, or keep him where he is (to is his own crossing)
			var state = game.state;
			if (state.phase != 10 || _.contains(state.turn.moved, index) || !rules.canMovePoliceman(state, index, to)) {
				return false;
			}
			var police = rules.policeNight(state);
			var from = police.now[index];
			police.route[index].push(to);
			police.now[index] = to;
			state.turn.moved.push(index);
			emit('policemanMoved', { index: index, from: from, to: to, moved: state.turn.moved.length, total: police.now.length });
			if (state.turn.moved.length >= police.now.length) {
				game.enter(11);
			}
			return true;
		};

		game.chooseAction = function (index, action) {
			// A policeman either searches ('search') or arrests ('arrest'), not both
			var state = game.state;
			var police = rules.policeNight(state);
			var list = action == 'search' ? police.search[index] : police.arrest[index];
			if (state.phase != 11 || _.contains(state.turn.done, index) || state.turn.choice[index] || !list || list.length == 0) {
				return false;
			}
			state.turn.choice[index] = action;
			return true;
		};

		function actionDone(index) {
			var state = game.state;
			var total = rules.policeNight(state).now.length;
			state.turn.done.push(index);
			state.turn.acted++;
			emit('policemanActed', { index: index, acted: state.turn.acted, total: total });
			if (state.turn.acted >= total) {
				game.enter(9);
			}
		}

		game.search = function (index, mapid) {
			// Search one circle. Returns 'clue', 'miss' (keep searching) or 'none' (nothing left to search)
			var state = game.state;
			var police = rules.policeNight(state);
			var list = police.search[index];
			if (state.phase != 11 || state.turn.choice[index] != 'search' || _.contains(state.turn.done, index) || !_.contains(list, mapid)) {
				return false;
			}
			var missed = state.turn.missed[index] = state.turn.missed[index] || new Array();
			if (_.contains(rules.jackNight(state).route, mapid)) {
				police.clue.push(mapid);
				emit('searchFinished', { index: index, mapid: mapid, clue: true, missed: missed.slice() });
				actionDone(index); // Finding a clue ends the search
				return 'clue';
			}
			list[_.indexOf(list, mapid)] = undefined;
			missed.push(mapid);
			if (_.isEmpty(_.reject(list, _.isUndefined))) {
				emit('searchFinished', { index: index, mapid: mapid, clue: false, missed: missed.slice() });
				actionDone(index); // Nothing left to search
				return 'none';
			}
			emit('searchMissed', { index: index, mapid: mapid });
			return 'miss';
		};

		game.arrest = function (index, mapid) {
			// Arrest at one circle. Returns 'arrested' or 'missed'
			var state = game.state;
			var police = rules.policeNight(state);
			if (state.phase != 11 || state.turn.choice[index] != 'arrest' || _.contains(state.turn.done, index) || !_.contains(police.arrest[index], mapid)) {
				return false;
			}
			if (mapid == rules.jackPosition(state)) {
				game.end('arrested', { mapid: mapid });
				return 'arrested';
			}
			emit('arrestFailed', { index: index, mapid: mapid });
			actionDone(index);
			return 'missed';
		};

		return game;
	}

	return { create: create, createState: createState };
})(WC.rules, _);
