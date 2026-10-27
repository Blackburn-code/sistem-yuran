/**
 * Data contoh untuk percubaan. Hanya ditambah jika tab Pelajar masih kosong.
 */
var Demo = (function () {
  var LELAKI = ['Muhammad Adam', 'Ahmad Faiz', 'Umar Al-Faruq', 'Muhammad Aqil', 'Harith Iskandar', 'Muhammad Rayyan', 'Ammar Zikri', 'Yusuf Hakimi', 'Ilham Danish', 'Aiman Hafiy', 'Uwais Al-Qarni', 'Zayd Haziq', 'Fateh Arrayyan', 'Hud Ar-Rasyid', 'Luqman Hakim'];
  var PEREMPUAN = ['Aisyah Humaira', 'Nur Iman Saffiya', 'Hana Sofea', 'Khadijah Zahra', 'Maryam Qaisara', 'Nur Damia', 'Sumayyah Insyirah', 'Fatimah Az-Zahra', 'Nur Aleesya', 'Hafsah Medina', 'Alya Nur Humaira', 'Ruqayyah Adni', 'Safiyyah Irdina', 'Zulaikha Huda', 'Nusaibah Amni'];
  var BAPA = ['Rahman', 'Zulkifli', 'Hakim', 'Rosli', 'Azman', 'Faizal', 'Hisham', 'Kamarul', 'Shahrul', 'Ridzuan', 'Nazri', 'Syafiq', 'Iskandar', 'Amirul', 'Hafiz'];
  var GURU = ['Ustazah Nurul Ain', 'Ustazah Siti Hajar', 'Ustaz Mohd Firdaus', 'Ustazah Farhana', 'Ustazah Rabiatul Adawiyah'];

  function rng(seed) {
    return function () {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
  }
  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }

  function seed(store) {
    if (store.all('Pelajar').length) return 0;
    var r = rng(20261027);
    var pick = function (a) { return a[Math.floor(r() * a.length)]; };
    var s = Core.settings();
    var kelas = s.senaraiKelas.split(',');
    var caw = ['Cawangan Utama', 'Cawangan Timur', 'Cawangan Barat'];
    var tahunList = s.senaraiTahun.split(',');
    store.settingsSet({ senaraiCawangan: caw.join(','), tahunMula: String(Platform.now().getFullYear()) });

    var now = Platform.now();
    var year = now.getFullYear();
    var curMonth = now.getMonth() + 1;
    var stamp = Core.isoDateTime(now);
    var pelajar = [];

    for (var i = 0; i < 30; i++) {
      var lelaki = i % 2 === 0;
      var nama = (lelaki ? LELAKI : PEREMPUAN)[Math.floor(i / 2) % 15];
      var bapa = BAPA[(i * 7) % BAPA.length];
      var umur = 4 + (i % 3);
      var lahir = year - umur;
      var ic = String(lahir).slice(2) + pad(1 + Math.floor(r() * 12), 2) + pad(1 + Math.floor(r() * 28), 2) +
        pick(['10', '14', '08', '06']) + pad(Math.floor(r() * 9000) + 1000, 4);
      if (lelaki) ic = ic.slice(0, 11) + String((parseInt(ic.slice(11), 10) | 1) % 10);
      var lewat = i >= 27; // beberapa pelajar baru daftar
      var p = {
        id: Platform.uuid(),
        nama: nama + (lelaki ? ' bin ' : ' binti ') + bapa,
        ic: ic,
        jantina: lelaki ? 'Lelaki' : 'Perempuan',
        tahun: tahunList[umur - 4] || (umur + ' Tahun'),
        kelas: kelas[i % kelas.length],
        cawangan: caw[i % caw.length],
        namaWaris: bapa + ' bin ' + pick(BAPA),
        telWaris: '01' + pick(['2', '3', '7', '9']) + pad(Math.floor(r() * 10000000), 7),
        emailWaris: '',
        alamat: pick(['Taman Seri Murni', 'Kampung Baru', 'Taman Desa Jaya', 'Bandar Baru']) + ', ' + pick(['Kota Bharu', 'Shah Alam', 'Kuala Terengganu', 'Seremban']),
        tarikhDaftar: lewat ? Core.monthKey(year, Math.max(1, curMonth - 1)) + '-01' : year + '-01-05',
        status: i === 29 ? 'Berhenti' : 'Aktif',
        dicipta: stamp
      };
      store.insert('Pelajar', p);
      pelajar.push(p);
    }

    GURU.forEach(function (g, i) {
      store.insert('Guru', {
        id: Platform.uuid(), nama: g, ic: '', tel: '019' + pad(Math.floor(r() * 10000000), 7), email: '',
        jawatan: i === 0 ? 'Guru Besar' : 'Guru Kelas', kelas: kelas[i % kelas.length], cawangan: caw[i % caw.length],
        status: 'Aktif', dicipta: stamp
      });
    });

    var resit = parseInt(s.kiraanResit, 10) || 0;
    var yuran = s.yuranBulanan;
    var txCount = 0;
    function addTx(p, jenis, perkara, jumlah, tarikh, status, kaedah) {
      var verified = status === 'VERIFIED';
      if (verified) resit++;
      txCount++;
      store.insert('Transaksi', {
        id: Platform.uuid(), tarikh: tarikh, pelajarId: p.id, jenis: jenis, perkara: perkara, jumlah: String(jumlah),
        kaedah: kaedah || 'Pindahan Bank', buktiUrl: '', status: status,
        noResit: verified ? 'R' + year + '-' + pad(resit, 5) : '',
        disahkanOleh: verified ? 'Super Admin' : '', tarikhSah: verified ? tarikh + ' 10:00:00' : '',
        catatan: '', dicipta: tarikh + ' 09:' + pad(txCount % 60, 2) + ':00'
      });
    }

    pelajar.forEach(function (p, i) {
      if (p.status === 'Berhenti') return;
      var mula = parseInt(p.tarikhDaftar.slice(5, 7), 10);
      var lagging = i % 6 === 1 ? 2 : (i % 9 === 4 ? 3 : 0);
      for (var m = mula; m <= curMonth; m++) {
        var day = 3 + Math.floor(r() * 20);
        if (m === curMonth) day = Math.min(day, now.getDate());
        var tarikh = Core.monthKey(year, m) + '-' + pad(day, 2);
        if (m > curMonth - lagging) {
          if (m === curMonth && i % 5 === 0) addTx(p, 'Bulanan', Core.monthKey(year, m), yuran, tarikh, 'PENDING');
          continue;
        }
        addTx(p, 'Bulanan', Core.monthKey(year, m), yuran, tarikh, 'VERIFIED', r() < 0.2 ? 'Tunai' : 'Pindahan Bank');
      }
    });

    var aktif = pelajar.filter(function (p) { return p.status === 'Aktif'; });
    var lawatan = { id: Platform.uuid(), nama: 'Lawatan Sambil Belajar', jumlah: '35', tarikhAkhir: Core.monthKey(year, Math.min(12, curMonth + 1)) + '-15', pelajarIds: aktif.map(function (p) { return p.id; }).join(','), catatan: 'Lawatan ke Zoo Negara', dicipta: stamp };
    var baju = { id: Platform.uuid(), nama: 'Baju Sukan', jumlah: '25', tarikhAkhir: Core.monthKey(year, curMonth) + '-28', pelajarIds: aktif.slice(0, 12).map(function (p) { return p.id; }).join(','), catatan: '', dicipta: stamp };
    store.insert('YuranLain', lawatan);
    store.insert('YuranLain', baju);
    aktif.slice(0, 9).forEach(function (p) { addTx(p, 'Lain', lawatan.id, 35, Core.isoDate(now), 'VERIFIED'); });
    aktif.slice(9, 12).forEach(function (p) { addTx(p, 'Lain', lawatan.id, 35, Core.isoDate(now), 'PENDING'); });
    aktif.slice(0, 7).forEach(function (p) { addTx(p, 'Lain', baju.id, 25, Core.isoDate(now), 'VERIFIED', 'Tunai'); });

    store.settingsSet({ kiraanResit: String(resit) });
    return pelajar.length;
  }

  return { seed: seed };
})();
