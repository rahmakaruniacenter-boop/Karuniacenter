/* Penghubung PWA: menjalankan aplikasi Apps Script di luar Apps Script (GitHub Pages).
 * Mengganti google.script.run dengan fetch (POST) ke Web App Apps Script, jadi Index.html tidak perlu diubah.
 * Server: fungsi doPost di Code.gs. */
(function () {
  'use strict';

  // Alamat Web App Apps Script diisi sekali di config.js (supaya tidak tertimpa saat shim.js / index.html diganti).
  var API_URL = String(window.KARUNIA_API_URL || '');

  var TIMEOUT_MS = 45000; // Apps Script yang baru "bangun" bisa butuh belasan detik
  var RETRY = { // jumlah ulang otomatis bila jaringan putus / timeout (fungsi ini aman diulang)
    login: 1, loginInfo: 2, bootstrap: 2, getLaporan: 2, getLaporanMurid: 2, getForm: 2, getRekap: 2, listSiswa: 2, listUsers: 2,
    saveForm: 1, saveDraft: 1, discardDraft: 1, clearShift: 1, saveShift: 1
  };

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function once(fn, args) {
    if (!API_URL || API_URL.indexOf('http') !== 0) return Promise.reject(new Error('Alamat server belum diisi. Isi alamat Web App (/exec) di config.js.'));
    var ctl = typeof AbortController === 'function' ? new AbortController() : null, timer = ctl ? setTimeout(function () { ctl.abort(); }, TIMEOUT_MS) : 0;
    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // "simple request": tanpa preflight CORS
      body: JSON.stringify({ fn: fn, args: args }),
      credentials: 'omit', redirect: 'follow', cache: 'no-store',
      signal: ctl ? ctl.signal : undefined
    }).then(function (res) {
      return res.text().then(function (txt) {
        var data;
        try { data = JSON.parse(txt); } catch (e) { var er = new Error('Server tidak mengembalikan data. Pastikan alamat Web App benar dan aksesnya "Anyone".'); er.retry = true; throw er; }
        return data;
      });
    }).catch(function (e) {
      var er = new Error(e && e.retry ? e.message : (e && e.name === 'AbortError' ? 'Server lama menjawab. Coba lagi.' : 'Koneksi bermasalah. Periksa internet lalu coba lagi.'));
      er.retry = true; throw er;
    }).then(function (d) { clearTimeout(timer); return d; }, function (e) { clearTimeout(timer); throw e; });
  }

  function call(fn, args) {
    var left = RETRY[fn] || 0, n = 0;
    function go() {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.reject(new Error('Tidak ada koneksi internet.'));
      return once(fn, args).catch(function (e) {
        if (e && e.retry && left-- > 0) return wait(700 * (++n)).then(go);
        throw e;
      });
    }
    return go();
  }

  function runner(ok, fail) {
    return new Proxy({}, {
      get: function (_, name) {
        if (name === 'withSuccessHandler') return function (f) { return runner(f, fail); };
        if (name === 'withFailureHandler') return function (f) { return runner(ok, f); };
        if (typeof name !== 'string' || name === 'then') return undefined;
        return function () {
          var args = Array.prototype.slice.call(arguments);
          call(String(name), args).then(function (r) { if (ok) ok(r); }, function (e) { if (fail) fail({ message: (e && e.message) || 'Koneksi bermasalah.' }); });
        };
      }
    });
  }

  window.google = { script: { run: runner(null, null) } };
})();
