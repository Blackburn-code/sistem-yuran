/** Preview: sediakan data demo & tiru google.script.run */
(function () {
  window.Platform = MockPlatform.makePlatform();
  var store = Platform.store();
  var defaults = Object.assign({}, DEFAULT_SETTINGS, { tahunMula: String(new Date().getFullYear()) });
  store.settingsSet(defaults);
  store.insert('Admin', Core.makeAdmin({ email: 'admin@demo.my', nama: 'Super Admin', password: 'demo1234', peranan: 'SuperAdmin' }));
  store.insert('Admin', Core.makeAdmin({ email: 'timur@demo.my', nama: 'Admin Timur', password: 'demo1234', peranan: 'Admin', cawangan: 'Cawangan Timur' }));
  Demo.seed(store);
  // Pelajar contoh untuk cuba app ibu bapa: IC 200415101234 atau tel 0123456789 (2 adik-beradik)
  var demo = store.all('Pelajar').filter(function (p) { return p.status === 'Aktif'; });
  store.update('Pelajar', demo[2].id, { ic: '200415101234', telWaris: '0123456789' });
  store.update('Pelajar', demo[7].id, { telWaris: '0123456789' });

  function runner(success, failure) {
    var target = {};
    return new Proxy(target, {
      get: function (_, name) {
        if (name === 'withSuccessHandler') return function (fn) { return runner(fn, failure); };
        if (name === 'withFailureHandler') return function (fn) { return runner(success, fn); };
        return function () {
          var args = JSON.parse(JSON.stringify(Array.prototype.slice.call(arguments)));
          setTimeout(function () {
            try {
              var r = window[name].apply(null, args);
              if (success) success(r === undefined ? r : JSON.parse(JSON.stringify(r)));
            } catch (e) {
              if (failure) failure(e); else console.error(e);
            }
          }, 120);
        };
      }
    });
  }
  window.google = { script: { get run() { return runner(null, null); } } };
})();
