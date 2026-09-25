// Service worker: makes the page installable and loadable with no internet (the robot link is Bluetooth).
// Network first, so a push to Pages shows up on the next load; the cache is only the offline fallback.
// Bump VERSION when the SHELL list changes.
const VERSION = 'quadpod-v2';
const SHELL = [
  './', 'index.html', 'style.css', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/app.js', 'js/ble.js', 'js/catalog.js', 'js/poses.js', 'js/protocol.js', 'js/ui.js',
  'js/tabs/drive.js', 'js/tabs/pose.js', 'js/tabs/actions.js', 'js/tabs/console.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req)
    .then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    })
    .catch(() => caches.match(req, { ignoreSearch: true })));
});
