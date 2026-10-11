/* Playtest records manager (Developer Mode, docs/playtests.md): the games kept in this browser by WC.playtests, in a
   table, with exporting (one JSON file, or ZIP batches: new ones, selected ones, or all), importing (JSON files or batch
   ZIPs, each checked and replayed first), deleting and clearing.
   Exporting saves files on this device only; it never uploads anything. A record is marked as exported once its ZIP has
   been made and the browser's download started: whether the download finished, or the files reached GitHub, can't be
   known here. Records are never deleted by exporting. The Online column is each game's research submission status
   (js/ui/submission.js), independent of exporting; Submit sends one game on the player's request. */
var WC = WC || {};
WC.ui = WC.ui || {};

WC.ui.playtests = function (storePromise, options) {
	options = options || {};
	var dialog = $('.playtests-dialog');
	var opener = null;
	var store = null;
	var entries = [];
	var selected = {};
	var submitter = options.submitter || null;

	function save(name, data, type) {
		// Through a link to the file, as the browser downloads one. options.save replaces it (tests)
		if (options.save) {
			options.save(name, data);
			return;
		}
		var url = URL.createObjectURL(new Blob([data], { type: type }));
		var link = $('<a></a>').attr({ href: url, download: name }).appendTo('body');
		link[0].click();
		link.remove();
		setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
	}

	function inflateRaw(bytes) {
		// For ZIPs compressed by another tool, where the browser can decompress
		if (typeof DecompressionStream == 'undefined') {
			return Promise.reject(new Error('this browser cannot open compressed ZIP files: extract the JSON files and import them'));
		}
		var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
		return new Response(stream).arrayBuffer().then(function (buffer) { return new Uint8Array(buffer); });
	}

	function status(text, kind) {
		dialog.find('.playtests-status').text(text).attr('data-kind', kind || 'info');
	}

	var labels = {
		role: { jack: 'Jack', detectives: 'Detectives' },
		result: { jackWins: 'Jack escaped', arrested: 'Jack arrested', outOfMoves: 'Jack out of moves', trapped: 'Jack trapped' }
	};

	function outcome(entry) {
		var won = entry.winner === (entry.role == 'jack' ? 'jack' : 'police');
		return (labels.result[entry.result] || entry.result) + (entry.winner ? (won ? ' (player won)' : ' (player lost)') : '');
	}

	function render() {
		var body = dialog.find('.playtests-rows').empty();
		var unexported = entries.filter(function (e) { return !e.exportedAt; }).length;
		dialog.find('.playtests-count').text(entries.length + ' game' + (entries.length == 1 ? '' : 's') + ' kept in this browser, ' +
			unexported + ' not exported yet.');
		dialog.find('.playtests-empty').prop('hidden', entries.length > 0);
		dialog.find('.playtests-table').prop('hidden', entries.length == 0);
		_.each(entries, function (entry) {
			var row = $('<tr></tr>').attr('data-id', entry.id).appendTo(body);
			$('<td></td>').append($('<input type="checkbox" class="playtests-select">').attr('aria-label', 'Select ' + entry.id)
				.prop('checked', !!selected[entry.id]).change(function () {
					selected[entry.id] = $(this).prop('checked');
					buttons();
				})).appendTo(row);
			$('<td></td>').text(entry.date || entry.savedAt.slice(0, 10)).appendTo(row);
			$('<td></td>').text(labels.role[entry.role] || entry.role).appendTo(row);
			$('<td></td>').text(entry.opponent).appendTo(row);
			$('<td></td>').text(entry.level || '–').appendTo(row);
			$('<td></td>').text(outcome(entry)).appendTo(row);
			$('<td class="playtests-id"></td>').text(entry.id).appendTo(row);
			$('<td></td>').text(entry.exportedAt ? entry.exportedAt.slice(0, 10) : 'No').appendTo(row);
			$('<td class="playtests-online"></td>').text(WC.submission.label(entry.submission)).attr('title', (entry.submission && entry.submission.lastError) || '').appendTo(row);
			var actions = $('<td class="playtests-row-actions"></td>').appendTo(row);
			var s = entry.submission || {};
			if (submitter && submitter.configured() && (!s.status || s.status == 'not-submitted' || (s.status == 'retry' && !s.nextAttemptAt))) {
				actions.append($('<button type="button" class="button button-secondary playtests-submit"></button>').text('Submit')
					.attr('title', 'Submit ' + entry.id + ' for research now').click(function () {
						status('Submitting ' + entry.id + '…');
						submitter.submitNow(entry.id).then(function () {
							status('Submission of ' + entry.id + ' finished: see the Online column.');
							return refresh();
						}, failed);
					}));
			}
			actions.append(
				$('<button type="button" class="button button-secondary playtests-download"></button>').text('JSON').attr('title', 'Download ' + entry.id + '.json').click(function () {
					save(WC.playtests.fileName(entry.id), WC.record.stringify(entry.record), 'application/json');
					status('Saved ' + WC.playtests.fileName(entry.id) + ' on this device.');
				}),
				$('<button type="button" class="button button-secondary playtests-delete"></button>').text('Delete').attr('title', 'Delete ' + entry.id + ' from this browser').click(function () {
					if (!window.confirm || window.confirm('Delete game ' + entry.id + ' from this browser? An exported file is not affected.')) {
						store.remove(entry.id).then(refresh, failed);
					}
				})
			);
		});
		buttons();
	}

	function buttons() {
		var picked = _.filter(entries, function (e) { return selected[e.id]; }).length;
		var fresh = _.filter(entries, function (e) { return !e.exportedAt; }).length;
		var usable = !!store && store.available();
		dialog.find('.playtests-export-new').prop('disabled', !usable || fresh == 0).text('Export new playtests (' + fresh + ')');
		dialog.find('.playtests-export-selected').prop('disabled', !usable || picked == 0).text('Export selected (' + picked + ')');
		dialog.find('.playtests-export-all').prop('disabled', !usable || entries.length == 0);
		dialog.find('.playtests-import').prop('disabled', !usable);
		dialog.find('.playtests-clear').prop('disabled', !usable || entries.length == 0 || !dialog.find('.playtests-clear-confirm').prop('checked'));
	}

	function failed(error) {
		status('Something went wrong with this browser\'s storage: ' + (error && error.message ? error.message : error), 'error');
	}

	function refresh() {
		if (!store.available()) {
			entries = [];
			render();
			status(store.reason + '. Finished games can still be saved one at a time with Game log.', 'error');
			return Promise.resolve();
		}
		return store.list().then(function (list) {
			entries = list;
			selected = _.pick(selected, _.pluck(list, 'id'));
			render();
		}, failed);
	}

	function exportEntries(list, what) {
		if (!list.length) {
			return Promise.resolve();
		}
		var made;
		try {
			made = WC.playtests.batch(list, options.now ? options.now() : new Date());
			save(made.name, made.bytes, 'application/zip');
		} catch (error) {
			failed(error);
			return Promise.resolve();
		}
		// The ZIP was made and its download started: only now are its records marked as exported
		return store.markExported(_.pluck(list, 'id'), options.now ? options.now() : new Date()).then(function () {
			status('Saved ' + made.name + ' with ' + list.length + ' ' + what + ' record' + (list.length == 1 ? '' : 's') + ' on this device. ' +
				'Nothing has been uploaded: to add them to the research collection, upload the files in its records folder to GitHub (see docs/playtests.md).');
			return refresh();
		}, failed);
	}

	function open() {
		opener = document.activeElement;
		$('.overlay.open').not(dialog).addClass('was-open').removeClass('open');
		dialog.addClass('open');
		status('');
		refresh();
		dialog.find('.playtests-close').focus();
	}

	function close() {
		dialog.removeClass('open');
		$('.overlay.was-open').removeClass('was-open').addClass('open');
		if (opener && opener.focus) opener.focus();
	}

	$('.playtests-open').prop('hidden', !options.dev).off('click').on('click', open);
	dialog.find('.playtests-close').off('click').on('click', close);
	dialog.off('keydown').on('keydown', function (event) {
		if (event.key == 'Escape') close();
	});
	dialog.find('.playtests-export-new').off('click').on('click', function () {
		exportEntries(_.filter(entries, function (e) { return !e.exportedAt; }), 'new');
	});
	dialog.find('.playtests-export-selected').off('click').on('click', function () {
		exportEntries(_.filter(entries, function (e) { return selected[e.id]; }), 'selected');
	});
	dialog.find('.playtests-export-all').off('click').on('click', function () {
		exportEntries(entries.slice(), 'kept');
	});
	dialog.find('.playtests-clear-confirm').off('change').on('change', buttons);
	dialog.find('.playtests-clear').off('click').on('click', function () {
		if (!dialog.find('.playtests-clear-confirm').prop('checked')) {
			return;
		}
		store.clear().then(function () {
			dialog.find('.playtests-clear-confirm').prop('checked', false);
			status('Every playtest record in this browser was deleted. Files already exported are not affected.');
			return refresh();
		}, failed);
	});
	dialog.find('.playtests-import').off('click').on('click', function () {
		dialog.find('.playtests-file').val('').click();
	});
	dialog.find('.playtests-file').off('change').on('change', function () {
		var picked = Array.prototype.slice.call(this.files || []);
		importPicked(picked);
	});

	function importPicked(picked) {
		if (!picked.length) {
			return Promise.resolve();
		}
		status('Checking ' + picked.length + ' file' + (picked.length == 1 ? '' : 's') + '…');
		return Promise.all(picked.map(function (file) {
			return (file.arrayBuffer ? file.arrayBuffer() : new Response(file).arrayBuffer()).then(function (buffer) {
				return { name: file.name, bytes: new Uint8Array(buffer) };
			});
		})).then(function (files) {
			return WC.playtests.importFiles(store, files, inflateRaw);
		}).then(function (out) {
			var lines = ['Imported ' + out.added.length + ' new game' + (out.added.length == 1 ? '' : 's') + '.'];
			if (out.duplicates.length) lines.push(out.duplicates.length + ' already here, unchanged: skipped.');
			if (out.conflicts.length) lines.push('Conflicts, not imported (a different record with the same game id is already here): ' + _.pluck(out.conflicts, 'id').join(', ') + '.');
			_.each(out.rejected, function (r) { lines.push('Not imported: ' + r.file + ' (' + r.verdict + ': ' + r.problems.join('; ') + ').'); });
			status(lines.join(' '), out.conflicts.length || out.rejected.length ? 'error' : 'info');
			return refresh();
		}, failed);
	}

	if (submitter) {
		submitter.onChange(function () {
			if (dialog.hasClass('open') && store) refresh();
		});
	}

	return Promise.resolve(storePromise).then(function (s) {
		store = s;
		buttons();
		return { open: open, close: close, refresh: refresh, importFiles: importPicked, entries: function () { return entries; }, exportEntries: exportEntries };
	});
};

WC.ui.playtestSaved = function (result) {
	// A line in the ending dialog: was the finished game kept in this browser?
	var line = $('.playtest-saved');
	if (result.status == 'saved' || result.status == 'duplicate') {
		line.text('This game is kept in this browser\'s playtest records.');
	} else if (result.status == 'conflict') {
		line.text('A different game with the same id is already kept in this browser: this one was not kept. Save it with Export game log.');
	} else {
		line.text('This game could not be kept in this browser' + (result.error && result.error.message ? ' (' + result.error.message + ')' : '') +
			'. Save it with Export game log if you want it.');
	}
	line.prop('hidden', false);
};
