// Service worker: menyimpan tampilan aplikasi di HP supaya terbuka cepat (dan tampilan tetap terbuka walau sinyal jelek)
// Data laporan TIDAK disimpan di sini: semua panggilan ke server (POST) langsung ke jaringan.
// Setiap kali index.html / shim.js diganti, naikkan nomor versi di bawah ini (otomatis oleh tools/build_pwa.js).
const C = 'karunia-v2026-10-21.25';
const SHELL = ['./', 'index.html', 'manifest.json', 'config.js', 'shim.js', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(SHELL.map(u => new Request(u, {cache: 'reload'})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return; // simpan / baca data (POST ke Apps Script) tidak lewat cache
  if (u.origin !== location.origin && !/(googleapis|gstatic|cloudflare)\.com$/.test(u.hostname)) return;
  e.respondWith((async () => {
    const c = await caches.open(C), hit = await c.match(r, {ignoreSearch: true});
    const net = fetch(r).then(res => { if (res.ok || res.type === 'opaque') c.put(r.url.split('?')[0], res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || (r.mode === 'navigate' ? await c.match('./') : Response.error());
  })());
});
