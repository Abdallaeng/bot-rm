/* Service worker: الشبكة أولاً (يصل التحديث فوراً) مع كاش احتياطي للعمل دون اتصال */
const VERSION = 'botrm-v6';
const SHELL = [
  './', 'index.html', 'config.js', 'core.js', 'manifest.webmanifest',
  'css/tokens.css', 'css/base.css', 'css/scene.css', 'css/search.css', 'css/card.css', 'css/admin.css',
  'js/main.js', 'js/lib/dom.js', 'js/lib/storage.js', 'js/lib/text.js', 'js/lib/labels.js',
  'js/data/store.js', 'js/data/analytics.js', 'js/ui/card.js', 'js/ui/effects.js', 'js/ui/home.js', 'js/ui/search.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/seal.png', 'data.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;           // العدّاد وGitHub والخطوط: لا نتدخل
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; })
      .catch(() => caches.match(req, { ignoreSearch: true })),
  );
});
