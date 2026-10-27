/**
 * Simpanan data dalam Google Sheet. Setiap tab = satu jadual, baris 1 = tajuk kolum.
 * Semua nilai disimpan sebagai teks supaya No. IC dan tarikh tidak diubah oleh Sheets.
 */
var SheetStore = (function () {
  var cache = {};

  function ss() {
    var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (id) return SpreadsheetApp.openById(id);
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (!active) throw new Error('Spreadsheet belum disambung. Jalankan fungsi setup() dahulu.');
    return active;
  }

  function sheet(name) {
    var sh = ss().getSheetByName(name);
    if (!sh) throw new Error('Tab "' + name + '" tiada. Jalankan fungsi setup() dahulu.');
    return sh;
  }

  function toText(v) {
    if (v instanceof Date) return Core.isoDateTime(v).replace(' 00:00:00', '');
    return v == null ? '' : String(v);
  }

  // Elak teks dibaca sebagai formula oleh Sheets
  function safeCell(v) {
    var s = v == null ? '' : String(v);
    return /^[=+\-@]/.test(s) ? "'" + s : s;
  }

  function load(name) {
    if (cache[name]) return cache[name];
    var sh = sheet(name);
    var values = sh.getDataRange().getValues();
    var head = values[0].map(String);
    var rows = values.slice(1).filter(function (r) {
      return r.some(function (c) { return c !== '' && c != null; });
    }).map(function (r) {
      var o = {};
      head.forEach(function (h, i) { o[h] = toText(r[i]); });
      return o;
    });
    cache[name] = { sh: sh, head: head, rows: rows };
    return cache[name];
  }

  function rowIndex(t, id) {
    // Cari baris sebenar dalam sheet (bukan cache) supaya selamat jika ada baris kosong
    var col = t.head.indexOf('id') + 1;
    var last = t.sh.getLastRow();
    if (last < 2) return -1;
    var ids = t.sh.getRange(2, col, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return i + 2;
    return -1;
  }

  function clone(o) { return Object.assign({}, o); }

  return {
    all: function (name) { return load(name).rows.map(clone); },

    insert: function (name, obj) {
      var t = load(name);
      var row = t.head.map(function (h) { return safeCell(obj[h]); });
      t.sh.appendRow(row);
      var stored = {};
      t.head.forEach(function (h) { stored[h] = obj[h] == null ? '' : String(obj[h]); });
      t.rows.push(stored);
      return clone(stored);
    },

    update: function (name, id, patch) {
      var t = load(name);
      var r = rowIndex(t, id);
      if (r < 0) throw new Error('Rekod tidak dijumpai.');
      var current = t.rows.filter(function (x) { return x.id === id; })[0] || {};
      var merged = Object.assign({}, current, patch);
      merged.id = id;
      t.sh.getRange(r, 1, 1, t.head.length).setValues([t.head.map(function (h) { return safeCell(merged[h]); })]);
      t.head.forEach(function (h) { current[h] = merged[h] == null ? '' : String(merged[h]); });
      if (t.rows.indexOf(current) < 0) t.rows.push(current);
      return clone(current);
    },

    remove: function (name, id) {
      var t = load(name);
      var r = rowIndex(t, id);
      if (r < 0) return false;
      t.sh.deleteRow(r);
      t.rows = t.rows.filter(function (x) { return x.id !== id; });
      return true;
    },

    settingsAll: function () {
      var out = {};
      load('Tetapan').rows.forEach(function (r) { if (r.kunci) out[r.kunci] = r.nilai; });
      return out;
    },

    settingsSet: function (map) {
      var t = load('Tetapan');
      var last = t.sh.getLastRow();
      var keys = last >= 2 ? t.sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
      Object.keys(map).forEach(function (k) {
        var i = keys.indexOf(k);
        var v = map[k] == null ? '' : String(map[k]);
        if (i >= 0) {
          t.sh.getRange(i + 2, 2).setValue(safeCell(v));
        } else {
          t.sh.appendRow([k, safeCell(v)]);
          keys.push(k);
        }
        var row = t.rows.filter(function (x) { return x.kunci === k; })[0];
        if (row) row.nilai = v; else t.rows.push({ kunci: k, nilai: v });
      });
    },

    resetCache: function () { cache = {}; }
  };
})();
