/** أدوات مشتركة لدوال Cloudflare Pages */
export const ADMIN_HASH = '47772dfefd02ba53e544691dfc9ac1f62148991ff2b4573d5109e6b8bd0508d7';

export const sha256 = async (text) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, '0')).join('');

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

/** التحقق من ترويسة x-admin = "المستخدم:كلمة المرور" */
export async function authed(request) {
  const [user = '', ...rest] = (request.headers.get('x-admin') || '').split(':');
  return (await sha256(`${user.trim().toLowerCase()}:${rest.join(':')}`)) === ADMIN_HASH;
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
