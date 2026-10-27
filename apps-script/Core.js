/**
 * Logik utama sistem yuran (bahagian admin).
 * Tidak bergantung terus pada servis Google: semua akses data melalui `Platform`,
 * supaya logik yang sama boleh diuji dan dipreview di luar Apps Script.
 */
var Core = (function () {
  var BULAN = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
  var BULAN_PENUH = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
  var SESSION_SECONDS = 6 * 60 * 60;
  var MAX_FAILED = 5;
  var LOCK_MINUTES = 15;
  var HASH_ROUNDS = 300;

  // ---------- Utiliti ----------
  function str(v) { return v == null ? '' : String(v).trim(); }
  function num(v) {
    var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? 0 : n;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function isoDateTime(d) { return isoDate(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
  function monthKey(y, m) { return y + '-' + pad(m); }
  function fail(msg) { throw new Error(msg); }
  function store() { return Platform.store(); }
  function now() { return Platform.now(); }
  function list(csv) { return str(csv).split(',').map(function (s) { return s.trim(); }).filter(Boolean); }
  function byId(rows) { var m = {}; rows.forEach(function (r) { m[r.id] = r; }); return m; }
  function normIc(v) { return str(v).replace(/[^0-9A-Za-z]/g, ''); }
  function normEmail(v) { return str(v).toLowerCase(); }

  function perkaraLabel(tx, lainMap) {
    if (tx.jenis === 'Bulanan') {
      var p = str(tx.perkara).split('-');
      var m = parseInt(p[1], 10);
      return (BULAN_PENUH[m - 1] || tx.perkara) + ' ' + p[0];
    }
    var yl = lainMap && lainMap[tx.perkara];
    return yl ? yl.nama : (tx.perkara || 'Yuran Lain');
  }

  // ---------- Tetapan ----------
  function settings() {
    var raw = store().settingsAll();
    var out = {};
    Object.keys(DEFAULT_SETTINGS).forEach(function (k) {
      out[k] = (k in raw) ? str(raw[k]) : DEFAULT_SETTINGS[k];
    });
    if (!out.tahunMula) out.tahunMula = String(now().getFullYear());
    return out;
  }
  function publicSettings(s) {
    var o = {};
    Object.keys(s).forEach(function (k) { if (k !== 'kiraanResit') o[k] = s[k]; });
    return o;
  }

  // ---------- Kata laluan & sesi ----------
  function hashPassword(password, salt) {
    var h = salt + ':' + password;
    for (var i = 0; i < HASH_ROUNDS; i++) h = Platform.hash(salt + h);
    return h;
  }
  function makeAdmin(data) {
    var salt = Platform.randomToken().slice(0, 24);
    return {
      id: Platform.uuid(),
      email: normEmail(data.email),
      nama: str(data.nama),
      salt: salt,
      hash: hashPassword(data.password, salt),
      peranan: data.peranan === 'SuperAdmin' ? 'SuperAdmin' : 'Admin',
      cawangan: str(data.cawangan),
      status: 'Aktif',
      dicipta: isoDateTime(now()),
      logMasukTerakhir: '',
      lalai: data.lalai ? 'YA' : ''
    };
  }
  function validatePassword(pw) {
    if (str(pw).length < 8) fail('Kata laluan mesti sekurang-kurangnya 8 aksara.');
  }

  function recentFailures(email) {
    var since = new Date(now().getTime() - LOCK_MINUTES * 60000);
    var sinceStr = isoDateTime(since);
    return store().all('LogMasuk').filter(function (l) {
      return l.email === email && l.status === 'Gagal' && l.masa >= sinceStr;
    }).length;
  }

  function logLogin(email, status, admin, catatan) {
    store().insert('LogMasuk', {
      id: Platform.uuid(),
      masa: isoDateTime(now()),
      email: email,
      status: status,
      peranan: admin ? admin.peranan : '',
      cawangan: admin ? (admin.cawangan || 'Semua') : '',
      catatan: catatan || ''
    });
  }

  function login(email, password) {
    email = normEmail(email);
    if (!email || !password) fail('Sila isi e-mel dan kata laluan.');
    return Platform.withLock(function () {
      if (recentFailures(email) >= MAX_FAILED) {
        logLogin(email, 'Gagal', null, 'Disekat sementara');
        fail('Terlalu banyak cubaan gagal. Cuba lagi dalam ' + LOCK_MINUTES + ' minit.');
      }
      var admin = store().all('Admin').filter(function (a) { return a.email === email; })[0];
      if (!admin || admin.status !== 'Aktif' || hashPassword(password, admin.salt) !== admin.hash) {
        logLogin(email, 'Gagal', admin, admin && admin.status !== 'Aktif' ? 'Akaun tidak aktif' : 'Kata laluan salah');
        fail('E-mel atau kata laluan tidak sah.');
      }
      var token = Platform.randomToken();
      Platform.cachePut('sess_' + token, admin.id, SESSION_SECONDS);
      store().update('Admin', admin.id, { logMasukTerakhir: isoDateTime(now()) });
      logLogin(email, 'Berjaya', admin, '');
      return { token: token };
    });
  }

  function logout(token) {
    if (token) Platform.cacheRemove('sess_' + token);
    return true;
  }

  function authenticate(token) {
    var id = token ? Platform.cacheGet('sess_' + token) : null;
    if (!id) fail('SESI_TAMAT');
    var admin = store().all('Admin').filter(function (a) { return a.id === id; })[0];
    if (!admin || admin.status !== 'Aktif') fail('SESI_TAMAT');
    Platform.cachePut('sess_' + token, admin.id, SESSION_SECONDS);
    return admin;
  }

  function safeAdmin(a) {
    return {
      id: a.id, email: a.email, nama: a.nama, peranan: a.peranan,
      cawangan: a.cawangan, status: a.status, dicipta: a.dicipta,
      logMasukTerakhir: a.logMasukTerakhir, lalai: a.lalai === 'YA'
    };
  }

  // ---------- Skop cawangan ----------
  function inScope(admin, cawangan) {
    return !admin.cawangan || admin.cawangan === cawangan;
  }
  function scopedPelajar(admin) {
    return store().all('Pelajar').filter(function (p) { return inScope(admin, p.cawangan); });
  }
  function requireSuper(admin) {
    if (admin.peranan !== 'SuperAdmin') fail('Hanya Super Admin dibenarkan.');
  }
  function getPelajarInScope(admin, id) {
    var p = store().all('Pelajar').filter(function (x) { return x.id === id; })[0];
    if (!p || !inScope(admin, p.cawangan)) fail('Pelajar tidak dijumpai.');
    return p;
  }

  // ---------- Kiraan yuran ----------
  function txIndex(txs) {
    // pelajarId -> perkara -> { verified, pending }
    var idx = {};
    txs.forEach(function (t) {
      if (t.status !== 'VERIFIED' && t.status !== 'PENDING') return;
      var a = idx[t.pelajarId] || (idx[t.pelajarId] = {});
      var key = t.jenis + '|' + t.perkara;
      var e = a[key] || (a[key] = { verified: null, pending: null });
      if (t.status === 'VERIFIED') e.verified = t; else if (!e.pending) e.pending = t;
    });
    return idx;
  }

  function monthStatuses(p, idx, s, year) {
    var charged = list(s.bulanDikenakan).map(Number);
    var reg = str(p.tarikhDaftar).slice(0, 7);
    var d = now();
    var nowKey = monthKey(d.getFullYear(), d.getMonth() + 1);
    var mine = idx[p.id] || {};
    var out = [];
    for (var m = 1; m <= 12; m++) {
      var key = monthKey(year, m);
      var e = mine['Bulanan|' + key];
      var st;
      if (e && e.verified) st = 'SUDAH';
      else if (e && e.pending) st = 'PENDING';
      else if (charged.indexOf(m) < 0) st = 'TIADA';
      else if (reg && key < reg) st = 'TIADA';
      else if (p.status === 'Berhenti') st = 'TIADA';
      else if (key <= nowKey) st = 'BELUM';
      else st = 'AKAN';
      out.push({ bulan: m, key: key, label: BULAN[m - 1], status: st, txId: e ? ((e.verified || e.pending).id) : '' });
    }
    return out;
  }

  function lainStatuses(p, idx, lainRows) {
    var mine = idx[p.id] || {};
    return lainRows.filter(function (yl) {
      return list(yl.pelajarIds).indexOf(p.id) >= 0;
    }).map(function (yl) {
      var e = mine['Lain|' + yl.id];
      return {
        id: yl.id, nama: yl.nama, jumlah: num(yl.jumlah), tarikhAkhir: yl.tarikhAkhir,
        status: e && e.verified ? 'SUDAH' : (e && e.pending ? 'PENDING' : 'BELUM'),
        txId: e ? ((e.verified || e.pending).id) : ''
      };
    });
  }

  function studentSummary(p, idx, s, lainRows) {
    var y0 = parseInt(s.tahunMula, 10) || now().getFullYear();
    var y1 = now().getFullYear();
    var belum = 0, pending = 0;
    for (var y = y0; y <= y1; y++) {
      monthStatuses(p, idx, s, y).forEach(function (ms) {
        if (ms.status === 'BELUM') belum++;
        if (ms.status === 'PENDING') pending++;
      });
    }
    var lain = lainStatuses(p, idx, lainRows);
    var hutangLain = lain.filter(function (l) { return l.status === 'BELUM'; })
      .reduce(function (a, l) { return a + l.jumlah; }, 0);
    var hutangBulanan = belum * num(s.yuranBulanan);
    return {
      bulanBelum: belum,
      bulanPending: pending,
      hutangBulanan: hutangBulanan,
      hutangLain: hutangLain,
      baki: hutangBulanan + hutangLain
    };
  }

  function nextReceipt(s) {
    var n = (parseInt(s.kiraanResit, 10) || 0) + 1;
    s.kiraanResit = String(n);
    store().settingsSet({ kiraanResit: String(n) });
    return 'R' + now().getFullYear() + '-' + ('00000' + n).slice(-5);
  }

  // ---------- Tindakan API ----------
  var actions = {};

  actions['session'] = function (admin) {
    return { admin: safeAdmin(admin), settings: publicSettings(settings()) };
  };

  actions['dashboard'] = function (admin) {
    var s = settings();
    var pelajar = scopedPelajar(admin);
    var ids = byId(pelajar);
    var txs = store().all('Transaksi').filter(function (t) { return ids[t.pelajarId]; });
    var idx = txIndex(txs);
    var lainRows = store().all('YuranLain');
    var d = now();
    var year = d.getFullYear();
    var thisMonth = monthKey(year, d.getMonth() + 1);

    var trend = BULAN.map(function (b, i) { return { label: b, jumlah: 0 }; });
    var kutipanTahun = 0, kutipanBulan = 0;
    txs.forEach(function (t) {
      if (t.status !== 'VERIFIED') return;
      var tk = str(t.tarikh).slice(0, 7);
      if (tk.slice(0, 4) === String(year)) {
        var amt = num(t.jumlah);
        kutipanTahun += amt;
        trend[parseInt(tk.slice(5, 7), 10) - 1].jumlah += amt;
        if (tk === thisMonth) kutipanBulan += amt;
      }
    });

    var aktif = pelajar.filter(function (p) { return p.status !== 'Berhenti'; });
    var baki = 0, pelajarBerhutang = 0, sudahBulanIni = 0, kenaBulanIni = 0;
    aktif.forEach(function (p) {
      var sum = studentSummary(p, idx, s, lainRows);
      baki += sum.baki;
      if (sum.baki > 0) pelajarBerhutang++;
      var ms = monthStatuses(p, idx, s, year)[d.getMonth()];
      if (ms.status !== 'TIADA') {
        kenaBulanIni++;
        if (ms.status === 'SUDAH') sudahBulanIni++;
      }
    });

    var pending = txs.filter(function (t) { return t.status === 'PENDING'; });
    var recent = txs.slice().sort(function (a, b) { return a.dicipta < b.dicipta ? 1 : -1; }).slice(0, 6)
      .map(function (t) { return decorateTx(t, ids, byId(lainRows)); });

    return {
      tahun: year,
      bulanIni: BULAN_PENUH[d.getMonth()] + ' ' + year,
      jumlahPelajar: aktif.length,
      kutipanTahun: kutipanTahun,
      kutipanBulan: kutipanBulan,
      bakiHutang: baki,
      pelajarBerhutang: pelajarBerhutang,
      pendingCount: pending.length,
      kadarBulanIni: kenaBulanIni ? Math.round(sudahBulanIni / kenaBulanIni * 100) : 0,
      sudahBulanIni: sudahBulanIni,
      kenaBulanIni: kenaBulanIni,
      trend: trend,
      terkini: recent
    };
  };

  // --- Pelajar ---
  actions['pelajar.list'] = function (admin) {
    var s = settings();
    var pelajar = scopedPelajar(admin);
    var idx = txIndex(store().all('Transaksi'));
    var lainRows = store().all('YuranLain');
    return pelajar.map(function (p) {
      var o = Object.assign({}, p);
      var sum = studentSummary(p, idx, s, lainRows);
      o.baki = sum.baki;
      o.bulanBelum = sum.bulanBelum;
      o.bulanPending = sum.bulanPending;
      return o;
    }).sort(function (a, b) { return a.nama.localeCompare(b.nama); });
  };

  actions['pelajar.detail'] = function (admin, payload) {
    var s = settings();
    var p = getPelajarInScope(admin, payload.id);
    var allTx = store().all('Transaksi');
    var idx = txIndex(allTx);
    var lainRows = store().all('YuranLain');
    var lainMap = byId(lainRows);
    var year = parseInt(payload.tahun, 10) || now().getFullYear();
    var ids = {}; ids[p.id] = p;
    var txs = allTx.filter(function (t) { return t.pelajarId === p.id; })
      .sort(function (a, b) { return a.dicipta < b.dicipta ? 1 : -1; })
      .map(function (t) { return decorateTx(t, ids, lainMap); });
    var guru = store().all('Guru').filter(function (g) { return g.kelas === p.kelas && g.cawangan === p.cawangan; });
    return {
      pelajar: p,
      tahun: year,
      bulan: monthStatuses(p, idx, s, year),
      lain: lainStatuses(p, idx, lainRows),
      ringkasan: studentSummary(p, idx, s, lainRows),
      transaksi: txs,
      guru: guru.map(function (g) { return g.nama; })
    };
  };

  function cleanRecord(table, data) {
    var o = {};
    SCHEMA[table].forEach(function (k) { if (k in data) o[k] = str(data[k]); });
    return o;
  }

  actions['pelajar.save'] = function (admin, payload) {
    var d = cleanRecord('Pelajar', payload);
    if (!d.nama) fail('Nama pelajar diperlukan.');
    d.ic = normIc(d.ic);
    if (!d.ic) fail('No. MyKid / IC diperlukan.');
    if (admin.cawangan) d.cawangan = admin.cawangan;
    return Platform.withLock(function () {
      var all = store().all('Pelajar');
      var dup = all.filter(function (p) { return p.ic === d.ic && p.id !== payload.id; })[0];
      if (dup) fail('No. IC ini telah didaftarkan untuk ' + dup.nama + '.');
      if (payload.id) {
        getPelajarInScope(admin, payload.id);
        delete d.id; delete d.dicipta;
        return store().update('Pelajar', payload.id, d);
      }
      d.id = Platform.uuid();
      d.status = d.status || 'Aktif';
      d.tarikhDaftar = d.tarikhDaftar || isoDate(now());
      d.dicipta = isoDateTime(now());
      return store().insert('Pelajar', d);
    });
  };

  actions['pelajar.delete'] = function (admin, payload) {
    getPelajarInScope(admin, payload.id);
    var hasTx = store().all('Transaksi').some(function (t) { return t.pelajarId === payload.id && t.status === 'VERIFIED'; });
    if (hasTx) fail('Pelajar ini ada rekod bayaran. Tukar status kepada "Berhenti" sahaja.');
    store().remove('Pelajar', payload.id);
    return true;
  };

  // --- Guru ---
  actions['guru.list'] = function (admin) {
    return store().all('Guru').filter(function (g) { return inScope(admin, g.cawangan); })
      .sort(function (a, b) { return a.nama.localeCompare(b.nama); });
  };
  actions['guru.save'] = function (admin, payload) {
    var d = cleanRecord('Guru', payload);
    if (!d.nama) fail('Nama guru diperlukan.');
    if (admin.cawangan) d.cawangan = admin.cawangan;
    if (payload.id) {
      var g = store().all('Guru').filter(function (x) { return x.id === payload.id; })[0];
      if (!g || !inScope(admin, g.cawangan)) fail('Guru tidak dijumpai.');
      delete d.id; delete d.dicipta;
      return store().update('Guru', payload.id, d);
    }
    d.id = Platform.uuid();
    d.status = d.status || 'Aktif';
    d.dicipta = isoDateTime(now());
    return store().insert('Guru', d);
  };
  actions['guru.delete'] = function (admin, payload) {
    var g = store().all('Guru').filter(function (x) { return x.id === payload.id; })[0];
    if (!g || !inScope(admin, g.cawangan)) fail('Guru tidak dijumpai.');
    store().remove('Guru', payload.id);
    return true;
  };

  // --- Transaksi ---
  function decorateTx(t, pelajarMap, lainMap) {
    var p = pelajarMap[t.pelajarId] || {};
    var o = Object.assign({}, t);
    o.jumlah = num(t.jumlah);
    o.namaPelajar = p.nama || '(dipadam)';
    o.ic = p.ic || '';
    o.kelas = p.kelas || '';
    o.cawangan = p.cawangan || '';
    o.perkaraLabel = perkaraLabel(t, lainMap);
    return o;
  }

  actions['transaksi.list'] = function (admin) {
    var ids = byId(scopedPelajar(admin));
    var lainMap = byId(store().all('YuranLain'));
    return store().all('Transaksi').filter(function (t) { return ids[t.pelajarId]; })
      .sort(function (a, b) { return a.dicipta < b.dicipta ? 1 : -1; })
      .map(function (t) { return decorateTx(t, ids, lainMap); });
  };

  function getTxInScope(admin, id) {
    var t = store().all('Transaksi').filter(function (x) { return x.id === id; })[0];
    if (!t) fail('Transaksi tidak dijumpai.');
    getPelajarInScope(admin, t.pelajarId);
    return t;
  }

  actions['transaksi.verify'] = function (admin, payload) {
    return Platform.withLock(function () {
      var t = getTxInScope(admin, payload.id);
      if (t.status === 'VERIFIED') fail('Transaksi ini sudah disahkan.');
      var dup = store().all('Transaksi').some(function (x) {
        return x.id !== t.id && x.pelajarId === t.pelajarId && x.jenis === t.jenis && x.perkara === t.perkara && x.status === 'VERIFIED';
      });
      if (dup) fail('Bayaran untuk perkara ini sudah disahkan sebelum ini.');
      var s = settings();
      return store().update('Transaksi', t.id, {
        status: 'VERIFIED',
        noResit: nextReceipt(s),
        disahkanOleh: admin.nama || admin.email,
        tarikhSah: isoDateTime(now())
      });
    });
  };

  actions['transaksi.reject'] = function (admin, payload) {
    var t = getTxInScope(admin, payload.id);
    if (t.status === 'VERIFIED') fail('Transaksi yang sudah disahkan tidak boleh ditolak.');
    return store().update('Transaksi', t.id, {
      status: 'REJECTED',
      disahkanOleh: admin.nama || admin.email,
      tarikhSah: isoDateTime(now()),
      catatan: str(payload.sebab) || t.catatan
    });
  };

  actions['transaksi.delete'] = function (admin, payload) {
    requireSuper(admin);
    getTxInScope(admin, payload.id);
    store().remove('Transaksi', payload.id);
    return true;
  };

  actions['transaksi.add'] = function (admin, payload) {
    var p = getPelajarInScope(admin, payload.pelajarId);
    var jenis = payload.jenis === 'Lain' ? 'Lain' : 'Bulanan';
    var perkara = jenis === 'Bulanan' ? (payload.bulan || []) : [str(payload.yuranLainId)];
    perkara = perkara.map(str).filter(Boolean);
    if (!perkara.length) fail(jenis === 'Bulanan' ? 'Pilih sekurang-kurangnya satu bulan.' : 'Pilih yuran.');
    var jumlah = num(payload.jumlah);
    if (jumlah <= 0) fail('Jumlah mesti lebih daripada RM0.');
    var tarikh = str(payload.tarikh) || isoDate(now());
    return Platform.withLock(function () {
      var s = settings();
      var existing = store().all('Transaksi').filter(function (t) {
        return t.pelajarId === p.id && t.jenis === jenis && (t.status === 'VERIFIED' || t.status === 'PENDING');
      });
      perkara.forEach(function (k) {
        var e = existing.filter(function (t) { return t.perkara === k; })[0];
        if (e) fail((jenis === 'Bulanan' ? perkaraLabel(e) : 'Yuran ini') + (e.status === 'PENDING' ? ' sedang menunggu pengesahan. Sahkan di Rekod Transaksi.' : ' sudah dibayar.'));
      });
      return perkara.map(function (k) {
        return store().insert('Transaksi', {
          id: Platform.uuid(),
          tarikh: tarikh,
          pelajarId: p.id,
          jenis: jenis,
          perkara: k,
          jumlah: String(jumlah),
          kaedah: str(payload.kaedah) || 'Tunai',
          buktiUrl: '',
          status: 'VERIFIED',
          noResit: nextReceipt(s),
          disahkanOleh: admin.nama || admin.email,
          tarikhSah: isoDateTime(now()),
          catatan: str(payload.catatan) || 'Direkod oleh admin',
          dicipta: isoDateTime(now())
        });
      });
    });
  };

  actions['transaksi.receipt'] = function (admin, payload) {
    var t = getTxInScope(admin, payload.id);
    if (t.status !== 'VERIFIED') fail('Resit hanya untuk bayaran yang telah disahkan.');
    var p = getPelajarInScope(admin, t.pelajarId);
    var ids = {}; ids[p.id] = p;
    return { tx: decorateTx(t, ids, byId(store().all('YuranLain'))), pelajar: p, settings: publicSettings(settings()) };
  };

  // --- Matrix ---
  actions['matrix'] = function (admin, payload) {
    var s = settings();
    var year = parseInt(payload.tahun, 10) || now().getFullYear();
    var idx = txIndex(store().all('Transaksi'));
    return {
      tahun: year,
      yuran: num(s.yuranBulanan),
      rows: scopedPelajar(admin).filter(function (p) { return payload.semua || p.status !== 'Berhenti'; })
        .sort(function (a, b) { return a.nama.localeCompare(b.nama); })
        .map(function (p) {
          return {
            id: p.id, nama: p.nama, ic: p.ic, kelas: p.kelas, cawangan: p.cawangan, tahun: p.tahun,
            bulan: monthStatuses(p, idx, s, year).map(function (m) { return m.status; })
          };
        })
    };
  };

  // --- Yuran Lain-Lain ---
  actions['lain.list'] = function (admin) {
    var ids = byId(scopedPelajar(admin));
    var idx = txIndex(store().all('Transaksi'));
    return store().all('YuranLain').map(function (yl) {
      var pids = list(yl.pelajarIds).filter(function (id) { return ids[id]; });
      var ahli = pids.map(function (id) {
        var p = ids[id];
        var e = (idx[id] || {})['Lain|' + yl.id];
        return {
          id: id, nama: p.nama, kelas: p.kelas, cawangan: p.cawangan,
          status: e && e.verified ? 'SUDAH' : (e && e.pending ? 'PENDING' : 'BELUM')
        };
      }).sort(function (a, b) { return a.nama.localeCompare(b.nama); });
      return {
        id: yl.id, nama: yl.nama, jumlah: num(yl.jumlah), tarikhAkhir: yl.tarikhAkhir, catatan: yl.catatan,
        dicipta: yl.dicipta, ahli: ahli,
        sudah: ahli.filter(function (a) { return a.status === 'SUDAH'; }).length
      };
    }).filter(function (yl) { return !admin.cawangan || yl.ahli.length; })
      .sort(function (a, b) { return a.dicipta < b.dicipta ? 1 : -1; });
  };

  actions['lain.save'] = function (admin, payload) {
    var nama = str(payload.nama);
    var jumlah = num(payload.jumlah);
    if (!nama) fail('Nama yuran diperlukan.');
    if (jumlah <= 0) fail('Jumlah mesti lebih daripada RM0.');
    var scope = byId(scopedPelajar(admin));
    var chosen = (payload.pelajarIds || []).filter(function (id) { return scope[id]; });
    if (!chosen.length) fail('Pilih sekurang-kurangnya seorang pelajar.');
    return Platform.withLock(function () {
      if (payload.id) {
        var yl = store().all('YuranLain').filter(function (x) { return x.id === payload.id; })[0];
        if (!yl) fail('Yuran tidak dijumpai.');
        // Kekalkan pelajar di luar skop admin ini
        var others = list(yl.pelajarIds).filter(function (id) { return !scope[id]; });
        return store().update('YuranLain', yl.id, {
          nama: nama, jumlah: String(jumlah), tarikhAkhir: str(payload.tarikhAkhir),
          catatan: str(payload.catatan), pelajarIds: others.concat(chosen).join(',')
        });
      }
      return store().insert('YuranLain', {
        id: Platform.uuid(), nama: nama, jumlah: String(jumlah), tarikhAkhir: str(payload.tarikhAkhir),
        pelajarIds: chosen.join(','), catatan: str(payload.catatan), dicipta: isoDateTime(now())
      });
    });
  };

  actions['lain.delete'] = function (admin, payload) {
    requireSuper(admin);
    var paid = store().all('Transaksi').some(function (t) { return t.jenis === 'Lain' && t.perkara === payload.id && t.status === 'VERIFIED'; });
    if (paid) fail('Yuran ini sudah ada bayaran yang disahkan dan tidak boleh dipadam.');
    store().remove('YuranLain', payload.id);
    return true;
  };

  // --- Urus Admin ---
  actions['admin.list'] = function (admin) {
    requireSuper(admin);
    return store().all('Admin').map(safeAdmin).sort(function (a, b) { return a.email.localeCompare(b.email); });
  };

  actions['admin.save'] = function (admin, payload) {
    requireSuper(admin);
    var email = normEmail(payload.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('E-mel tidak sah.');
    return Platform.withLock(function () {
      var all = store().all('Admin');
      var dup = all.filter(function (a) { return a.email === email && a.id !== payload.id; })[0];
      if (dup) fail('E-mel ini sudah digunakan.');
      var peranan = payload.peranan === 'SuperAdmin' ? 'SuperAdmin' : 'Admin';
      if (payload.id) {
        var target = all.filter(function (a) { return a.id === payload.id; })[0];
        if (!target) fail('Admin tidak dijumpai.');
        var status = payload.status === 'Tidak Aktif' ? 'Tidak Aktif' : 'Aktif';
        var losingSuper = target.peranan === 'SuperAdmin' && (peranan !== 'SuperAdmin' || status !== 'Aktif');
        if (losingSuper) {
          var supers = all.filter(function (a) { return a.peranan === 'SuperAdmin' && a.status === 'Aktif'; });
          if (supers.length <= 1) fail('Mesti ada sekurang-kurangnya seorang Super Admin yang aktif.');
        }
        var patch = { email: email, nama: str(payload.nama), peranan: peranan, cawangan: str(payload.cawangan), status: status };
        if (payload.password) {
          validatePassword(payload.password);
          patch.salt = Platform.randomToken().slice(0, 24);
          patch.hash = hashPassword(payload.password, patch.salt);
          patch.lalai = '';
        }
        return safeAdmin(store().update('Admin', target.id, patch));
      }
      validatePassword(payload.password);
      return safeAdmin(store().insert('Admin', makeAdmin({
        email: email, nama: payload.nama, password: payload.password, peranan: peranan, cawangan: payload.cawangan
      })));
    });
  };

  actions['admin.delete'] = function (admin, payload) {
    requireSuper(admin);
    if (payload.id === admin.id) fail('Anda tidak boleh memadam akaun sendiri.');
    var all = store().all('Admin');
    var target = all.filter(function (a) { return a.id === payload.id; })[0];
    if (!target) fail('Admin tidak dijumpai.');
    if (target.peranan === 'SuperAdmin') {
      var supers = all.filter(function (a) { return a.peranan === 'SuperAdmin' && a.status === 'Aktif'; });
      if (supers.length <= 1) fail('Mesti ada sekurang-kurangnya seorang Super Admin yang aktif.');
    }
    store().remove('Admin', payload.id);
    return true;
  };

  actions['akaun.password'] = function (admin, payload) {
    if (hashPassword(str(payload.lama), admin.salt) !== admin.hash) fail('Kata laluan semasa tidak betul.');
    validatePassword(payload.baru);
    var salt = Platform.randomToken().slice(0, 24);
    store().update('Admin', admin.id, { salt: salt, hash: hashPassword(payload.baru, salt), lalai: '' });
    return true;
  };

  // --- Log masuk ---
  actions['log.list'] = function (admin) {
    requireSuper(admin);
    return store().all('LogMasuk').sort(function (a, b) { return a.masa < b.masa ? 1 : -1; }).slice(0, 500);
  };

  // --- Tetapan ---
  actions['tetapan.get'] = function (admin) {
    return publicSettings(settings());
  };
  actions['tetapan.save'] = function (admin, payload) {
    requireSuper(admin);
    var patch = {};
    Object.keys(payload || {}).forEach(function (k) {
      if (k in DEFAULT_SETTINGS && k !== 'kiraanResit') patch[k] = str(payload[k]);
    });
    if ('yuranBulanan' in patch && num(patch.yuranBulanan) <= 0) fail('Yuran bulanan mesti lebih daripada RM0.');
    if ('tahunMula' in patch && !/^\d{4}$/.test(patch.tahunMula)) fail('Tahun mula tidak sah.');
    if ('bulanDikenakan' in patch) {
      patch.bulanDikenakan = list(patch.bulanDikenakan).map(Number)
        .filter(function (m) { return m >= 1 && m <= 12; }).join(',');
    }
    store().settingsSet(patch);
    return publicSettings(settings());
  };

  function call(token, action, payload) {
    var admin = authenticate(token);
    var fn = actions[action];
    if (!fn) fail('Tindakan tidak dikenali: ' + action);
    return fn(admin, payload || {});
  }

  return {
    BULAN: BULAN,
    BULAN_PENUH: BULAN_PENUH,
    login: login,
    logout: logout,
    call: call,
    makeAdmin: makeAdmin,
    hashPassword: hashPassword,
    settings: settings,
    isoDate: isoDate,
    isoDateTime: isoDateTime,
    monthKey: monthKey
  };
})();

// Fungsi yang dipanggil oleh google.script.run dari pelayar
function apiLogin(email, password) { return Core.login(email, password); }
function apiLogout(token) { return Core.logout(token); }
function apiCall(token, action, payload) { return Core.call(token, action, payload); }
