/** أدوات مشتركة لدوال Cloudflare Pages */
export const ADMIN_HASH = '47772dfefd02ba53e544691dfc9ac1f62148991ff2b4573d5109e6b8bd0508d7';

export const sha256 = async (text) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, '0')).join('');

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

/* ---------- جلسات الإدارة: توقيع HMAC بسرّ يُولَّد مرة واحدة ويُحفظ في KV ---------- */
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
export const SESSION_HOURS = 12;

async function secretKey(env) {
  let secret = await env.DATA.get('secret');
  if (!secret) { secret = b64u(crypto.getRandomValues(new Uint8Array(32))); await env.DATA.put('secret', secret); }
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

/** هاش كلمة المرور الحالية: المخزّن في KV بعد تغييرها، وإلا الافتراضي */
export async function currentHash(env) { return (await env.DATA.get('adminhash')) || ADMIN_HASH; }

export async function signToken(env, user) {
  const payload = b64u(new TextEncoder().encode(JSON.stringify({ u: user, iat: Date.now(), exp: Date.now() + SESSION_HOURS * 3600e3 })));
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
    const pwv = Number(await env.DATA.get('pwv')) || 0;       // تغيير كلمة المرور يُبطل الجلسات السابقة
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
