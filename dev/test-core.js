/**
 * Ujian logik utama (tanpa Google). Guna: node dev/test-core.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const assert = require('assert');

function load() {
  const ctx = { console };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  const src = path.join(__dirname, '..', 'apps-script');
  for (const f of ['Schema.js', 'Core.js', 'Demo.js']) vm.runInContext(fs.readFileSync(path.join(src, f), 'utf8'), ctx, { filename: f });
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'mock-platform.js'), 'utf8'), ctx);
  ctx.Platform = ctx.MockPlatform.makePlatform({ hash: (s) => crypto.createHash('sha256').update(s).digest('hex') });
  ctx.Platform._now = new Date(2026, 9, 27, 10, 0, 0); // 27 Okt 2026
  const store = ctx.Platform.store();
  store.settingsSet(Object.assign({}, ctx.DEFAULT_SETTINGS, { tahunMula: '2026' }));
  store.insert('Admin', ctx.Core.makeAdmin({ email: 'super@x.my', nama: 'Super', password: 'rahsia123', peranan: 'SuperAdmin' }));
  store.insert('Admin', ctx.Core.makeAdmin({ email: 'timur@x.my', nama: 'Timur', password: 'rahsia123', peranan: 'Admin', cawangan: 'Cawangan Timur' }));
  return ctx;
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const throwsMsg = (fn, re) => assert.throws(fn, (e) => re.test(e.message));

test('login berjaya & gagal, sekatan selepas 5 cubaan', () => {
  const c = load();
  const ok = c.apiLogin('SUPER@x.my', 'rahsia123');
  assert.ok(ok.token);
  for (let i = 0; i < 5; i++) throwsMsg(() => c.apiLogin('super@x.my', 'salah'), /tidak sah/);
  throwsMsg(() => c.apiLogin('super@x.my', 'rahsia123'), /Terlalu banyak/);
  const logs = c.Platform.store().all('LogMasuk');
  assert.strictEqual(logs.filter((l) => l.status === 'Gagal').length, 6);
});

test('token tidak sah ditolak', () => {
  const c = load();
  throwsMsg(() => c.apiCall('palsu', 'dashboard', {}), /SESI_TAMAT/);
  const t = c.apiLogin('super@x.my', 'rahsia123').token;
  c.apiLogout(t);
  throwsMsg(() => c.apiCall(t, 'dashboard', {}), /SESI_TAMAT/);
});

test('status bulan & baki hutang RM60', () => {
  const c = load();
  const t = c.apiLogin('super@x.my', 'rahsia123').token;
  const p = c.apiCall(t, 'pelajar.save', { nama: 'Ali', ic: '200101-01-0001', kelas: 'Kelas A', cawangan: 'Cawangan Utama', tarikhDaftar: '2026-03-10' });
  assert.strictEqual(p.ic, '200101010001');
  let d = c.apiCall(t, 'pelajar.detail', { id: p.id, tahun: 2026 });
  const st = d.bulan.map((b) => b.status);
  assert.deepStrictEqual([...st.slice(0, 2)], ['TIADA', 'TIADA']); // sebelum daftar
  assert.strictEqual(st[2], 'BELUM'); // Mac
  assert.strictEqual(st[9], 'BELUM'); // Okt (bulan semasa)
  assert.strictEqual(st[10], 'AKAN');
  assert.strictEqual(d.ringkasan.bulanBelum, 8);
  assert.strictEqual(d.ringkasan.baki, 480);

  const res = c.apiCall(t, 'transaksi.add', { pelajarId: p.id, jenis: 'Bulanan', bulan: ['2026-03', '2026-04'], jumlah: 60, kaedah: 'Tunai' });
  assert.strictEqual(res.length, 2);
  assert.match(res[0].noResit, /^R2026-0000[12]$/);
  assert.notStrictEqual(res[0].noResit, res[1].noResit);
  d = c.apiCall(t, 'pelajar.detail', { id: p.id, tahun: 2026 });
  assert.strictEqual(d.ringkasan.baki, 360);
  throwsMsg(() => c.apiCall(t, 'transaksi.add', { pelajarId: p.id, jenis: 'Bulanan', bulan: ['2026-03'], jumlah: 60 }), /sudah dibayar/);
});

test('bulan dikecualikan tidak dikira', () => {
  const c = load();
  const t = c.apiLogin('super@x.my', 'rahsia123').token;
  const p = c.apiCall(t, 'pelajar.save', { nama: 'Abu', ic: '1', tarikhDaftar: '2026-01-01' });
  c.apiCall(t, 'tetapan.save', { bulanDikenakan: '1,2,3,4,5,7,8,9,10,11' }); // Jun & Dis cuti
  const d = c.apiCall(t, 'pelajar.detail', { id: p.id, tahun: 2026 });
  assert.strictEqual(d.bulan[5].status, 'TIADA');
  assert.strictEqual(d.ringkasan.bulanBelum, 9);
});

test('pengesahan bayaran ibu bapa (PENDING -> VERIFIED)', () => {
  const c = load();
  const t = c.apiLogin('super@x.my', 'rahsia123').token;
  const p = c.apiCall(t, 'pelajar.save', { nama: 'Siti', ic: '2', tarikhDaftar: '2026-10-01' });
  const tx = c.Platform.store().insert('Transaksi', { id: 'tx1', tarikh: '2026-10-05', pelajarId: p.id, jenis: 'Bulanan', perkara: '2026-10', jumlah: '60', kaedah: 'Pindahan Bank', status: 'PENDING', dicipta: '2026-10-05 09:00:00' });
  let d = c.apiCall(t, 'pelajar.detail', { id: p.id });
  assert.strictEqual(d.bulan[9].status, 'PENDING');
  assert.strictEqual(c.apiCall(t, 'dashboard').pendingCount, 1);
  const v = c.apiCall(t, 'transaksi.verify', { id: tx.id });
  assert.strictEqual(v.status, 'VERIFIED');
  assert.ok(v.noResit);
  throwsMsg(() => c.apiCall(t, 'transaksi.verify', { id: tx.id }), /sudah disahkan/);
  d = c.apiCall(t, 'pelajar.detail', { id: p.id });
  assert.strictEqual(d.bulan[9].status, 'SUDAH');
  const r = c.apiCall(t, 'transaksi.receipt', { id: tx.id });
  assert.strictEqual(r.tx.perkaraLabel, 'Oktober 2026');
  assert.ok(!('kiraanResit' in r.settings));
});

test('admin cawangan hanya nampak cawangan sendiri', () => {
  const c = load();
  const s = c.apiLogin('super@x.my', 'rahsia123').token;
  const a = c.apiCall(s, 'pelajar.save', { nama: 'A', ic: '10', cawangan: 'Cawangan Utama' });
  c.apiCall(s, 'pelajar.save', { nama: 'B', ic: '11', cawangan: 'Cawangan Timur' });
  const t = c.apiLogin('timur@x.my', 'rahsia123').token;
  const list = c.apiCall(t, 'pelajar.list');
  assert.deepStrictEqual([...list.map((p) => p.nama)], ['B']);
  throwsMsg(() => c.apiCall(t, 'pelajar.detail', { id: a.id }), /tidak dijumpai/);
  throwsMsg(() => c.apiCall(t, 'admin.list'), /Super Admin/);
  throwsMsg(() => c.apiCall(t, 'tetapan.save', { yuranBulanan: '1' }), /Super Admin/);
  const created = c.apiCall(t, 'pelajar.save', { nama: 'C', ic: '12', cawangan: 'Cawangan Utama' });
  assert.strictEqual(created.cawangan, 'Cawangan Timur');
});

test('IC berulang ditolak', () => {
  const c = load();
  const t = c.apiLogin('super@x.my', 'rahsia123').token;
  c.apiCall(t, 'pelajar.save', { nama: 'A', ic: '123' });
  throwsMsg(() => c.apiCall(t, 'pelajar.save', { nama: 'B', ic: '123' }), /telah didaftarkan/);
});

test('mesti kekal seorang super admin', () => {
  const c = load();
  const t = c.apiLogin('super@x.my', 'rahsia123').token;
  const me = c.apiCall(t, 'session').admin;
  throwsMsg(() => c.apiCall(t, 'admin.save', { id: me.id, email: me.email, peranan: 'Admin' }), /sekurang-kurangnya seorang/);
  throwsMsg(() => c.apiCall(t, 'admin.delete', { id: me.id }), /akaun sendiri/);
  const n = c.apiCall(t, 'admin.save', { email: 'baru@x.my', nama: 'Baru', password: 'abcdefgh' });
  assert.strictEqual(n.peranan, 'Admin');
  assert.ok(!('hash' in n));
  throwsMsg(() => c.apiCall(t, 'admin.save', { email: 'pendek@x.my', password: '123' }), /8 aksara/);
  assert.ok(c.apiLogin('baru@x.my', 'abcdefgh').token);
});

test('yuran lain-lain', () => {
  const c = load();
  const t = c.apiLogin('super@x.my', 'rahsia123').token;
  const p = c.apiCall(t, 'pelajar.save', { nama: 'A', ic: '5', tarikhDaftar: '2026-10-01' });
  const yl = c.apiCall(t, 'lain.save', { nama: 'Baju Sukan', jumlah: '25', pelajarIds: [p.id] });
  let d = c.apiCall(t, 'pelajar.detail', { id: p.id });
  assert.strictEqual(d.ringkasan.baki, 85);
  c.apiCall(t, 'transaksi.add', { pelajarId: p.id, jenis: 'Lain', yuranLainId: yl.id, jumlah: 25 });
  d = c.apiCall(t, 'pelajar.detail', { id: p.id });
  assert.strictEqual(d.ringkasan.baki, 60);
  assert.strictEqual(c.apiCall(t, 'lain.list')[0].sudah, 1);
  throwsMsg(() => c.apiCall(t, 'lain.delete', { id: yl.id }), /tidak boleh dipadam/);
});

test('data demo & dashboard', () => {
  const c = load();
  const n = c.Demo.seed(c.Platform.store());
  assert.strictEqual(n, 30);
  assert.strictEqual(c.Demo.seed(c.Platform.store()), 0);
  const t = c.apiLogin('super@x.my', 'rahsia123').token;
  const d = c.apiCall(t, 'dashboard');
  assert.strictEqual(d.jumlahPelajar, 29);
  assert.ok(d.kutipanTahun > 0 && d.bakiHutang > 0 && d.pendingCount > 0);
  assert.strictEqual(d.trend.length, 12);
  const m = c.apiCall(t, 'matrix', { tahun: 2026 });
  assert.strictEqual(m.rows.length, 29);
  const tx = c.apiCall(t, 'transaksi.list');
  const resits = tx.filter((x) => x.noResit).map((x) => x.noResit);
  assert.strictEqual(new Set(resits).size, resits.length);
  // resit seterusnya tidak bertindih dengan data demo
  const p = c.apiCall(t, 'pelajar.list').find((x) => x.bulanBelum > 0 && x.status === 'Aktif');
  const det = c.apiCall(t, 'pelajar.detail', { id: p.id });
  const due = det.bulan.find((b) => b.status === 'BELUM');
  const r = c.apiCall(t, 'transaksi.add', { pelajarId: p.id, jenis: 'Bulanan', bulan: [due.key], jumlah: 60 });
  assert.ok(!resits.includes(r[0].noResit));
});

let failed = 0;
for (const t of tests) {
  try { t.fn(); console.log('  ✓ ' + t.name); }
  catch (e) { failed++; console.log('  ✗ ' + t.name + '\n    ' + (e.stack || e).toString().split('\n').slice(0, 3).join('\n    ')); }
}
console.log(failed ? `\n${failed} gagal` : `\nSemua ${tests.length} ujian lulus`);
process.exit(failed ? 1 : 0);
