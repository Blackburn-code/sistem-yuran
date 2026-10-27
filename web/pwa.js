/* Daftar service worker & butang "Pasang App" */
(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register(document.querySelector('meta[name="sy-sw"]').content).catch(function () { });
    });
  }
  var deferred = null, buttons = [];
  var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  function show() {
    buttons.forEach(function (b) { if (b && document.body.contains(b)) b.classList.toggle('hidden', standalone || !(deferred || ios)); });
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; show(); });
  window.addEventListener('appinstalled', function () { deferred = null; standalone = true; show(); });
  window.SYInstall = {
    bind: function (btn) {
      if (!btn) return;
      buttons.push(btn);
      btn.addEventListener('click', function () {
        if (deferred) {
          deferred.prompt();
          deferred.userChoice.finally(function () { deferred = null; show(); });
        } else if (ios) {
          alert('Untuk pasang di iPhone: tekan butang Share (petak dengan anak panah), kemudian "Add to Home Screen".');
        }
      });
      show();
    }
  };
})();
