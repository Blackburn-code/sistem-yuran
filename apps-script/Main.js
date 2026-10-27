/**
 * Titik masuk web app dan fungsi pemasangan.
 *
 * Pautan:
 *   .../exec             -> halaman ibu bapa
 *   .../exec?page=admin  -> panel admin
 */
function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) || '';
  var file = page === 'admin' ? 'Admin' : 'Parent';
  var t = HtmlService.createTemplateFromFile(file);
  t.appUrl = ScriptApp.getService().getUrl();
  var nama = DEFAULT_SETTINGS.namaSistem;
  var logo = '';
  try {
    var s = Core.settings();
    nama = s.namaSistem || nama;
    logo = s.logoUrl || '';
  } catch (err) { /* belum setup */ }
  t.bootJson = JSON.stringify({ namaSistem: nama, logoUrl: logo }).replace(/</g, '\\u003c');
  return t.evaluate()
    .setTitle(page === 'admin' ? nama + ' · Admin' : nama)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/** Menu dalam Google Sheet */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Sistem Yuran')
    .addItem('1. Pasang / kemas kini struktur', 'setup')
    .addItem('2. Isi data demo', 'isiDataDemo')
    .addSeparator()
    .addItem('Reset kata laluan Super Admin', 'resetSuperAdmin')
    .addToUi();
}

/**
 * Jalankan sekali selepas salin kod. Cipta semua tab, tetapan lalai
 * dan akaun Super Admin pertama. Selamat dijalankan semula.
 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());

  Object.keys(SCHEMA).forEach(function (name) {
    var cols = SCHEMA[name];
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    var lastCol = Math.max(sh.getLastColumn(), 1);
    var existing = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String).filter(Boolean);
    // Tambah kolum baharu di hujung tanpa merosakkan data sedia ada
    var head = existing.slice();
    cols.forEach(function (c) { if (head.indexOf(c) < 0) head.push(c); });
    sh.getRange(1, 1, 1, head.length).setValues([head])
      .setFontWeight('bold').setBackground('#141416').setFontColor('#D4AF6A');
    sh.getRange(1, 1, sh.getMaxRows(), head.length).setNumberFormat('@');
    sh.setFrozenRows(1);
  });

  var sheet1 = ss.getSheetByName('Sheet1') || ss.getSheetByName('Helaian1');
  if (sheet1 && sheet1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sheet1);

  SheetStore.resetCache();
  var store = SheetStore;
  var current = store.settingsAll();
  var missing = {};
  Object.keys(DEFAULT_SETTINGS).forEach(function (k) { if (!(k in current)) missing[k] = DEFAULT_SETTINGS[k]; });
  if (!('tahunMula' in current)) missing.tahunMula = String(new Date().getFullYear());
  if (Object.keys(missing).length) store.settingsSet(missing);

  var message = 'Struktur Sistem Yuran sudah sedia.';
  if (!store.all('Admin').length) {
    var email = Session.getEffectiveUser().getEmail() || 'admin@sistemyuran.my';
    var password = Platform.randomToken().slice(0, 10);
    store.insert('Admin', Core.makeAdmin({
      email: email, nama: 'Super Admin', password: password, peranan: 'SuperAdmin', lalai: true
    }));
    message += '\n\nAkaun Super Admin dicipta:\nE-mel: ' + email + '\nKata laluan: ' + password +
      '\n\nSalin kata laluan ini sekarang dan tukar selepas log masuk.';
  }
  notify(message);
}

/** Isi pelajar, guru dan transaksi contoh untuk percubaan. */
function isiDataDemo() {
  SheetStore.resetCache();
  var n = Demo.seed(SheetStore);
  notify(n ? 'Data demo ditambah: ' + n + ' pelajar.' : 'Data pelajar sudah ada. Data demo tidak ditambah.');
}

/** Jika terlupa kata laluan: jana kata laluan baharu untuk Super Admin pertama. */
function resetSuperAdmin() {
  SheetStore.resetCache();
  var sa = SheetStore.all('Admin').filter(function (a) { return a.peranan === 'SuperAdmin'; })[0];
  if (!sa) { notify('Tiada Super Admin. Jalankan setup().'); return; }
  var password = Platform.randomToken().slice(0, 10);
  var salt = Platform.randomToken().slice(0, 24);
  SheetStore.update('Admin', sa.id, { salt: salt, hash: Core.hashPassword(password, salt), status: 'Aktif', lalai: 'YA' });
  notify('Kata laluan baharu untuk ' + sa.email + ':\n' + password);
}

function notify(message) {
  Logger.log(message);
  try { SpreadsheetApp.getUi().alert(message); } catch (e) { /* dijalankan dari editor: lihat Execution log */ }
}
