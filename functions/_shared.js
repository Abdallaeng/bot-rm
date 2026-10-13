/** أدوات مشتركة لدوال Cloudflare Pages */
export const ADMIN_HASH = '47772dfefd02ba53e544691dfc9ac1f62148991ff2b4573d5109e6b8bd0508d7';

export const sha256 = async (text) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, '0')).join('');

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

/* ---------- جلسات الإدارة: توقيع HMAC بسرّ يُولَّد مرة واحدة ويُحفظ في KV ---------- */
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
export const SESSION_HOURS = 12;   // الافتراضي؛ يمكن تغييره من تحكم «مدة جلسة الإدارة»

/* ---------- ذاكرة داخل العملية (isolate): تقلّل قراءات KV المتكررة ---------- */
const MEM = new Map();
/** يعيد قيمة محفوظة لمدة ttl ثانية، وإلا ينفّذ fn ويحفظ نتيجتها (حتى null) */
export async function memo(key, ttl, fn) {
  const hit = MEM.get(key);
  if (hit && hit.exp > Date.now()) return hit.v;             // نخزّن الوعد نفسه: مئة طلب متزامن = قراءة واحدة
  const v = Promise.resolve().then(fn);
  MEM.set(key, { v, exp: Date.now() + ttl * 1000 });
  v.catch(() => MEM.delete(key));
  if (MEM.size > 200) for (const k of MEM.keys()) { if (MEM.get(k).exp < Date.now()) MEM.delete(k); }
  return v;
}
export const forget = (key) => MEM.delete(key);

/** السرّ لا يتغيّر أبداً: يُقرأ مرة واحدة ويبقى المفتاح المستورد في الذاكرة */
let KEY;
async function secretKey(env) {
  if (KEY) return KEY;
  let secret = await env.DATA.get('secret');
  if (!secret) { secret = b64u(crypto.getRandomValues(new Uint8Array(32))); await env.DATA.put('secret', secret); }
  return (KEY = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']));
}

/** هاش كلمة المرور الحالية: المخزّن في KV بعد تغييرها، وإلا الافتراضي (يُحفظ 30 ثانية في الذاكرة) */
export const currentHash = (env) => memo('adminhash', 30, async () => (await env.DATA.get('adminhash')) || ADMIN_HASH);

/* ---------- كاش حافة Cloudflare (caches.default): يخدم الطلبات العامة دون لمس KV ---------- */
const edgeCache = () => globalThis.caches?.default;
const synthetic = (request, path) => new Request(new URL(path, request.url).href);

/** يخدم الاستجابة من كاش الحافة لمدة ttl ثانية؛ وإلا ينفّذ produce() ويخزّن نتيجته.
 *  keyPath: مفتاح اصطناعي (يمكن أن يتضمن الإصدار). clientCache: ترويسة cache-control للمتصفح. */
export async function edgeCached({ request, waitUntil }, keyPath, ttl, produce, clientCache = 'no-cache') {
  const cache = edgeCache();
  const key = synthetic(request, keyPath);
  if (cache) {
    const hit = await cache.match(key);
    if (hit) { const r = new Response(hit.body, hit); r.headers.set('cache-control', clientCache); return r; }
  }
  const res = await produce();
  if (!res || !res.ok) return res;
  res.headers.set('cache-control', clientCache);
  if (cache) {
    const copy = res.clone();
    copy.headers.set('cache-control', `public, max-age=${ttl}`);
    const job = cache.put(key, copy).catch(() => {});
    if (waitUntil) waitUntil(job); else await job;
  }
  return res;
}
/** يمسح مفاتيح الكاش في هذه المنطقة بعد النشر/البث ليرى المدير التغيير فوراً */
export async function purgeEdge(request, paths) {
  const cache = edgeCache();
  if (cache) await Promise.all(paths.map((p) => cache.delete(synthetic(request, p)).catch(() => {})));
}

/** إصدار البيانات الحالي {stored, fixed}: يُحسب مرة كل 20 ثانية لكل منطقة بدل كل طلب */
export async function getVersion(ctx) {
  const { request, env } = ctx;
  const res = await edgeCached(ctx, '/__ver', 20, async () => {
    let stored = '', fixed = '';
    if (env.DATA) { try { stored = String(JSON.parse((await memo('pmeta', 5, () => env.DATA.get('pmeta'))) || '{}').updated || ''); } catch { /* */ } }
    try { fixed = String((await (await env.ASSETS.fetch(new URL('/data.json', request.url))).json()).updated || ''); } catch { /* */ }
    return json({ stored, fixed });
  });
  return res.json();
}

/** تجميع يوم واحد: الأيام القديمة (أكثر من 3 أيام) لا تتغيّر فتُحفظ في الذاكرة للأبد */
export async function getAgg(env, day) {
  const old = day < dayKey(Date.now() - 3 * 86400e3);
  return memo(`agg:${day}`, old ? 86400 : 20, () => env.DATA.get(`agg:${day}`, 'json'));
}
export const dropAgg = (day) => forget(`agg:${day}`);
/** تحكمات المنصة { v, c, fd, fa } — تُقرأ كل 5 ثوانٍ كحد أقصى لكل عملية */
export const getCtl = (env) => memo('ctl', 5, async () => { const d = (await env.DATA.get('ctl', 'json')) || {}; return { v: d.v || 0, c: d.c || {}, fd: d.fd || 0, fa: d.fa || 0 }; });

/** تصحيحات العرض { v: إصدار, list } — تُقرأ كل 5 ثوانٍ كحد أقصى لكل عملية */
export const getCorr = (env) => memo('corr', 5, async () => (await env.DATA.get('corr', 'json')) || { v: 0, list: [] });

export async function signToken(env, user, hours = SESSION_HOURS) {
  const payload = b64u(new TextEncoder().encode(JSON.stringify({ u: user, iat: Date.now(), exp: Date.now() + hours * 3600e3 })));
  const sig = await crypto.subtle.sign('HMAC', await secretKey(env), new TextEncoder().encode(payload));
  return `${payload}.${b64u(sig)}`;
}

/** يتحقق من «Authorization: Bearer <token>» */
export async function authed(request, env) {
  if (!env.DATA) return false;
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  try {
    if (!(await crypto.subtle.verify('HMAC', await secretKey(env), unb64u(sig), new TextEncoder().encode(payload)))) return false;
    const { exp, iat } = JSON.parse(new TextDecoder().decode(unb64u(payload)));
    const pwv = await memo('pwv', 30, async () => Number(await env.DATA.get('pwv')) || 0);       // تغيير كلمة المرور يُبطل الجلسات السابقة
    return exp > Date.now() && iat >= pwv;
  } catch { return false; }
}

/** يوم بتوقيت بغداد (UTC+3) بصيغة YYYYMMDD */
export const dayKey = (t = Date.now()) => new Date(t + 3 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '');
export const hourOf = (t) => new Date(t + 3 * 3600e3).getUTCHours();
export const clean = (q) => String(q || '').replace(/[^\w\u0600-\u06FF\s.\-]/g, '').trim().slice(0, 40);

/** يضيف عدّاداً إلى خريطة مع حدّ أقصى لعدد المفاتيح (يحذف الأضعف) */
export function bump(map, key, cap) {
  map[key] = (map[key] || 0) + 1;
  const keys = Object.keys(map);
  if (keys.length > cap) { keys.sort((a, b) => map[a] - map[b]); delete map[keys[0]]; }
}

/* ---------- سجل عمليات الإدارة (آخر 200 عملية): الدخول، النشر، التعديل، الاستعادة، البث، الأمان ---------- */
const MAX_AUDIT = 200;
const browserOf = (ua = '') => {
  const b = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'متصفح';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return [b, os].filter(Boolean).join(' · ');
};
/** يسجّل عملية إدارية: type مفتاح قصير، text وصف عربي. لا يُفشل العملية الأصلية إن تعذّر التسجيل. */
export async function audit(env, request, type, text, ok = true) {
  try {
    const cf = request.cf || {};
    const entry = {
      t: Date.now(), type, text: String(text).slice(0, 200), ok,
      ip: (request.headers.get('cf-connecting-ip') || '').slice(0, 45),
      where: [cf.city, cf.country].filter(Boolean).join('، '),
      dev: browserOf(request.headers.get('user-agent') || ''),
    };
    const log = (await env.DATA.get('audit', 'json')) || [];
    log.unshift(entry);
    await env.DATA.put('audit', JSON.stringify(log.slice(0, MAX_AUDIT)));
  } catch { /* السجل اختياري */ }
}
