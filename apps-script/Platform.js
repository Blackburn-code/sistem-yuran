/**
 * Sambungan kepada servis Google Apps Script.
 * (Preview tempatan menggunakan versi lain dalam dev/mock-platform.js)
 */
var Platform = {
  store: function () { return SheetStore; },

  hash: function (text) {
    var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
    return bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
  },

  uuid: function () { return Utilities.getUuid(); },

  randomToken: function () {
    return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  },

  now: function () { return new Date(); },

  /** Folder Google Drive untuk resit yang dimuat naik oleh ibu bapa */
  resitFolder: function () {
    var props = PropertiesService.getScriptProperties();
    var id = props.getProperty('RESIT_FOLDER_ID');
    if (id) {
      try { return DriveApp.getFolderById(id); } catch (e) { /* folder dipadam: cipta semula */ }
    }
    var folder = DriveApp.createFolder('Sistem Yuran - Resit');
    props.setProperty('RESIT_FOLDER_ID', folder.getId());
    return folder;
  },

  saveFile: function (name, mimeType, base64) {
    var blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, name);
    return this.resitFolder().createFile(blob).getUrl();
  },

  cacheGet: function (key) { return CacheService.getScriptCache().get(key); },
  cachePut: function (key, value, seconds) { CacheService.getScriptCache().put(key, value, seconds); },
  cacheRemove: function (key) { CacheService.getScriptCache().remove(key); },

  withLock: function (fn) {
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    SheetStore.resetCache(); // baca data terkini selepas dapat kunci
    try {
      return fn();
    } finally {
      SpreadsheetApp.flush();
      lock.releaseLock();
    }
  }
};
