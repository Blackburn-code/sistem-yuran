/**
 * Struktur setiap tab dalam Google Sheet.
 * Fail ini dikongsi: digunakan oleh Apps Script dan juga preview tempatan.
 */
var SCHEMA = {
  Pelajar: ['id', 'nama', 'ic', 'jantina', 'tahun', 'kelas', 'cawangan', 'namaWaris', 'telWaris', 'emailWaris', 'alamat', 'tarikhDaftar', 'status', 'dicipta'],
  Guru: ['id', 'nama', 'ic', 'tel', 'email', 'jawatan', 'kelas', 'cawangan', 'status', 'dicipta'],
  Transaksi: ['id', 'tarikh', 'pelajarId', 'jenis', 'perkara', 'jumlah', 'kaedah', 'buktiUrl', 'status', 'noResit', 'disahkanOleh', 'tarikhSah', 'catatan', 'dicipta'],
  YuranLain: ['id', 'nama', 'jumlah', 'tarikhAkhir', 'pelajarIds', 'catatan', 'dicipta'],
  Admin: ['id', 'email', 'nama', 'hash', 'salt', 'peranan', 'cawangan', 'status', 'dicipta', 'logMasukTerakhir', 'lalai'],
  LogMasuk: ['id', 'masa', 'email', 'status', 'peranan', 'cawangan', 'catatan'],
  Tetapan: ['kunci', 'nilai']
};

var DEFAULT_SETTINGS = {
  namaSistem: 'Sistem Yuran',
  namaSekolah: 'Sistem Yuran',
  alamatSekolah: '',
  telSekolah: '',
  yuranBulanan: '60',
  tahunMula: '',
  bulanDikenakan: '1,2,3,4,5,6,7,8,9,10,11,12',
  senaraiKelas: 'Kelas A,Kelas B,Kelas C',
  senaraiCawangan: 'Cawangan Utama',
  senaraiTahun: '4 Tahun,5 Tahun,6 Tahun',
  namaBank: 'Bank Islam',
  namaAkaun: 'Sistem Yuran',
  noAkaun: '',
  logoUrl: '',
  kiraanResit: '0'
};
