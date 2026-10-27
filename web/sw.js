/* Service worker: simpan kulit app supaya cepat dibuka. Data sentiasa diambil terus dari Google Sheet. */
var CACHE = 'sistem-yuran-v2';
var SHELL = ['./', './index.html', './admin/', './admin/index.html', './config.js', './pwa.js',
  './icons/icon-192.png', './icons/icon-512.png', './manifest.webmanifest', './admin/manifest.webmanifest'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // API & fon: terus ke rangkaian
  // Rangkaian dahulu (versi terkini), cache jika luar talian
  e.respondWith(fetch(e.request).then(function (res) {
    var copy = res.clone();
    caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
    return res;
  }).catch(function () {
    return caches.match(e.request, { ignoreSearch: true });
  }));
});
