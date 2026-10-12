/* Service worker — يعمل دون إنترنت:
   · ملفات الموقع والبيانات: الشبكة أولاً (مهلة قصيرة) ثم النسخة المحفوظة
   · الخطوط: من الكاش فوراً وتُحدَّث في الخلفية */
const VERSION = 'botrm-v20';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const NETWORK_TIMEOUT = 3000;
const SHELL = [
  './', 'index.html', 'config.js', 'core.js', 'manifest.webmanifest', 'data.json',
  'css/tokens.css', 'css/base.css', 'css/scene.css', 'css/search.css', 'css/card.css', 'css/browse.css', 'css/admin.css', 'css/polish.css', 'css/extras.css', 'css/admin2.css',
  'js/main.js', 'js/lib/dom.js', 'js/lib/storage.js', 'js/lib/text.js', 'js/lib/labels.js', 'js/lib/icons.js', 'js/lib/haptic.js',
  'js/data/store.js', 'js/data/analytics.js', 'js/data/idb.js', 'js/data/history.js', 'js/lib/mark.js', 'js/lib/art.js', 'js/data/sync.js', 'js/ui/card.js', 'js/ui/fields.js', 'js/ui/effects.js', 'js/ui/home.js', 'js/ui/search.js', 'js/ui/theme.js', 'js/ui/browse.js', 'js/ui/exportImage.js', 'js/ui/broadcast.js', 'js/ui/swipe.js', 'js/ui/multi.js', 'js/ui/settings.js', 'js/ui/preview.js', 'js/ui/adminExtra.js', 'js/ui/adminUI.js', 'js/ui/adminOverview.js', 'js/ui/admin.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/seal.png', 'icons/favicon.png',
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

const cacheable = (res) => res && (res.ok || res.type === 'opaque');

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await Promise.race([
      fetch(req, { cache: 'no-cache' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT)),
    ]);
    if (cacheable(res)) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req, { ignoreSearch: true }))
      || (req.mode === 'navigate' ? await cache.match('index.html') : undefined)
      || Response.error();
  }
}

/** data.json: يُعرض من الكاش فوراً ويُحدَّث بالخلفية؛ مع ?fresh=1 يُجلب من الشبكة أولاً */
async function dataRequest(url) {
  const cache = await caches.open(VERSION);
  const key = url.origin + url.pathname;
  const refresh = () => fetch(key, { cache: 'no-cache' }).then((res) => { if (res.ok) cache.put(key, res.clone()); return res; });
  if (url.searchParams.has('fresh')) {
    try { return await Promise.race([refresh(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))]); }
    catch { return (await cache.match(key)) || Response.error(); }
  }
  const cached = await cache.match(key);
  if (cached) return cached;                     // التحديث يطلبه التطبيق صراحةً (?fresh=1) بعد فحص الإصدار الخفيف
  return refresh();
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(req);
  const update = fetch(req).then((res) => { if (cacheable(res)) cache.put(req, res.clone()); return res; }).catch(() => cached);
  return cached || update;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (FONT_HOSTS.includes(url.hostname)) { e.respondWith(staleWhileRevalidate(req)); return; }
  if (url.origin !== location.origin) return;           // خدمات خارجية: لا نتدخل
  if (url.pathname.startsWith('/api/')) return;         // واجهات الخادم دائماً من الشبكة
  if (url.pathname.endsWith('/data.json')) { e.respondWith(dataRequest(url)); return; }
  e.respondWith(networkFirst(req));
});
