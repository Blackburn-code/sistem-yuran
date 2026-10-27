/**
 * Pengganti servis Google untuk preview tempatan & ujian.
 * Data disimpan dalam memori sahaja.
 */
(function (root) {
  function MemStore() {
    var t = {};
    Object.keys(SCHEMA).forEach(function (k) { t[k] = []; });
    function clone(o) { return Object.assign({}, o); }
    function norm(name, obj) {
      var o = {};
      SCHEMA[name].forEach(function (h) { o[h] = obj[h] == null ? '' : String(obj[h]); });
      return o;
    }
    return {
      tables: t,
      all: function (name) { return t[name].map(clone); },
      insert: function (name, obj) { var o = norm(name, obj); t[name].push(o); return clone(o); },
      update: function (name, id, patch) {
        var row = t[name].filter(function (r) { return r.id === id; })[0];
        if (!row) throw new Error('Rekod tidak dijumpai.');
        Object.keys(patch).forEach(function (k) { if (k !== 'id') row[k] = patch[k] == null ? '' : String(patch[k]); });
        return clone(row);
      },
      remove: function (name, id) { t[name] = t[name].filter(function (r) { return r.id !== id; }); return true; },
      settingsAll: function () { var o = {}; t.Tetapan.forEach(function (r) { o[r.kunci] = r.nilai; }); return o; },
      settingsSet: function (map) {
        Object.keys(map).forEach(function (k) {
          var r = t.Tetapan.filter(function (x) { return x.kunci === k; })[0];
          if (r) r.nilai = String(map[k]); else t.Tetapan.push({ kunci: k, nilai: String(map[k]) });
        });
      }
    };
  }

  // Hash ringkas untuk preview sahaja (Apps Script guna SHA-256 sebenar)
  function devHash(s) {
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < s.length; i++) {
      h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619) >>> 0;
      h2 = Math.imul(h2 + s.charCodeAt(i), 2246822519) >>> 0;
    }
    return ('0000000' + h1.toString(16)).slice(-8) + ('0000000' + h2.toString(16)).slice(-8);
  }

  function makePlatform(opts) {
    opts = opts || {};
    var store = MemStore();
    var cache = {};
    var n = 0;
    function uuid() {
      n++;
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    }
    return {
      _store: store,
      _now: null,
      store: function () { return store; },
      hash: opts.hash || devHash,
      uuid: uuid,
      randomToken: function () { return (uuid() + uuid()).replace(/-/g, ''); },
      now: function () { return this._now ? new Date(this._now.getTime()) : new Date(); },
      cacheGet: function (k) { var e = cache[k]; return e && e.exp > Date.now() ? e.v : null; },
      cachePut: function (k, v, s) { cache[k] = { v: v, exp: Date.now() + s * 1000 }; },
      cacheRemove: function (k) { delete cache[k]; },
      withLock: function (fn) { return fn(); }
    };
  }

  root.MockPlatform = { makePlatform: makePlatform, MemStore: MemStore };
})(typeof window !== 'undefined' ? window : globalThis);
