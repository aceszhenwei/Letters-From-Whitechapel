/* ZIP archives, small and dependency-free: for batches of playtest records (docs/playtests.md).
   - create(files, date) writes a ZIP of text files, stored without compression (records are small, and a stored ZIP
     opens everywhere), with each file's CRC-32.
   - read(bytes, inflateRaw) reads one back: the files stored (method 0), and the compressed ones (method 8, deflate)
     through the inflateRaw(bytes) function it is given (in the browser, DecompressionStream; in Node, zlib), so an archive
     re-zipped by another tool still opens. Returns a promise of [{ name, text }].
   It works the same in the page and in Node (tools/playtests/). Archives are data: nothing in them is run. */
var WC = WC || {};

WC.zip = (function () {

	var table = (function () {
		var t = [];
		for (var n = 0; n < 256; n++) {
			var c = n;
			for (var k = 0; k < 8; k++) {
				c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
			}
			t[n] = c >>> 0;
		}
		return t;
	})();

	function crc32(bytes) {
		var c = 0xFFFFFFFF;
		for (var i = 0; i < bytes.length; i++) {
			c = table[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
		}
		return (c ^ 0xFFFFFFFF) >>> 0;
	}

	function utf8(text) {
		return new TextEncoder().encode(text);
	}

	function dosTime(date) {
		return ((date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2)) & 0xFFFF;
	}

	function dosDate(date) {
		return (((date.getUTCFullYear() - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate()) & 0xFFFF;
	}

	function create(files, date) {
		// files: [{ name, text }] -> Uint8Array
		date = date || new Date();
		var parts = [];
		var central = [];
		var offset = 0;
		files.forEach(function (file) {
			var name = utf8(file.name);
			var data = utf8(file.text);
			var crc = crc32(data);
			var local = new DataView(new ArrayBuffer(30));
			local.setUint32(0, 0x04034b50, true);
			local.setUint16(4, 20, true); // Version needed
			local.setUint16(6, 0x0800, true); // UTF-8 names
			local.setUint16(8, 0, true); // Stored
			local.setUint16(10, dosTime(date), true);
			local.setUint16(12, dosDate(date), true);
			local.setUint32(14, crc, true);
			local.setUint32(18, data.length, true);
			local.setUint32(22, data.length, true);
			local.setUint16(26, name.length, true);
			local.setUint16(28, 0, true);
			parts.push(new Uint8Array(local.buffer), name, data);
			var entry = new DataView(new ArrayBuffer(46));
			entry.setUint32(0, 0x02014b50, true);
			entry.setUint16(4, 20, true);
			entry.setUint16(6, 20, true);
			entry.setUint16(8, 0x0800, true);
			entry.setUint16(10, 0, true);
			entry.setUint16(12, dosTime(date), true);
			entry.setUint16(14, dosDate(date), true);
			entry.setUint32(16, crc, true);
			entry.setUint32(20, data.length, true);
			entry.setUint32(24, data.length, true);
			entry.setUint16(28, name.length, true);
			entry.setUint32(42, offset, true);
			central.push(new Uint8Array(entry.buffer), name);
			offset += 30 + name.length + data.length;
		});
		var centralSize = central.reduce(function (sum, part) { return sum + part.length; }, 0);
		var end = new DataView(new ArrayBuffer(22));
		end.setUint32(0, 0x06054b50, true);
		end.setUint16(8, files.length, true);
		end.setUint16(10, files.length, true);
		end.setUint32(12, centralSize, true);
		end.setUint32(16, offset, true);
		var all = parts.concat(central, [new Uint8Array(end.buffer)]);
		var out = new Uint8Array(all.reduce(function (sum, part) { return sum + part.length; }, 0));
		var at = 0;
		all.forEach(function (part) {
			out.set(part, at);
			at += part.length;
		});
		return out;
	}

	function read(bytes, inflateRaw) {
		// -> Promise of [{ name, text }]. Rejects an archive it can't read rather than guessing
		return new Promise(function (resolve, reject) {
			bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
			var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
			var endAt = -1;
			for (var i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
				if (view.getUint32(i, true) === 0x06054b50) {
					endAt = i;
					break;
				}
			}
			if (endAt < 0) {
				reject(new Error('not a ZIP archive'));
				return;
			}
			var count = view.getUint16(endAt + 10, true);
			var at = view.getUint32(endAt + 16, true);
			var decoder = new TextDecoder('utf-8', { fatal: true });
			var pending = [];
			for (var n = 0; n < count; n++) {
				if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) {
					reject(new Error('the ZIP archive is damaged'));
					return;
				}
				var flags = view.getUint16(at + 8, true);
				var method = view.getUint16(at + 10, true);
				var crc = view.getUint32(at + 16, true);
				var compressed = view.getUint32(at + 20, true);
				var size = view.getUint32(at + 24, true);
				var nameLength = view.getUint16(at + 28, true);
				var extraLength = view.getUint16(at + 30, true);
				var commentLength = view.getUint16(at + 32, true);
				var local = view.getUint32(at + 42, true);
				var name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
				at += 46 + nameLength + extraLength + commentLength;
				if (flags & 1) {
					reject(new Error(name + ' is encrypted'));
					return;
				}
				if (name.slice(-1) === '/') {
					continue; // A folder
				}
				if (local + 30 > bytes.length || view.getUint32(local, true) !== 0x04034b50) {
					reject(new Error('the ZIP archive is damaged'));
					return;
				}
				var start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
				var data = bytes.subarray(start, start + compressed);
				pending.push(entry(name, method, data, size, crc, inflateRaw, decoder));
			}
			Promise.all(pending).then(resolve, reject);
		});
	}

	function entry(name, method, data, size, crc, inflateRaw, decoder) {
		var raw;
		if (method === 0) {
			raw = Promise.resolve(data);
		} else if (method === 8 && inflateRaw) {
			raw = Promise.resolve(inflateRaw(data));
		} else {
			return Promise.reject(new Error(name + ': compression method ' + method + ' is not supported'));
		}
		return raw.then(function (out) {
			out = out instanceof Uint8Array ? out : new Uint8Array(out);
			if (out.length !== size || crc32(out) !== crc) {
				throw new Error(name + ' is damaged (its checksum does not match)');
			}
			return { name: name, text: decoder.decode(out) };
		});
	}

	return { create: create, read: read, crc32: crc32 };
})();

if (typeof module !== 'undefined' && module.exports) {
	module.exports = WC.zip;
}
