/** صفحة المدير (manager.html): دخول مستقل عن الإدارة.
 *  POST /api/mgr { user, pass } → { token, exp } — رمز بدور «مدير» لا يصلح لأي عملية إدارة.
 *  GET  /api/mgr — يتحقق من الرمز (Bearer) ويعيد { ok } (لا يقرأ KV إلا السرّ المخزّن في الذاكرة).
 *  كلمة المرور لا تُخزَّن نصاً: PBKDF2-SHA256 (100 ألف دورة) مع ملح. غيّرها بتوليد قيمة جديدة وتحديث الثابتين. */
import { json, signToken, checkToken, audit } from '../_shared.js';

const SALT = 'cd7be5d809027ac03768fbe383914620';
const HASH = 'd5fb6296ed2ae4eb049a4201fb48f306676b5315825ea219281bbc38d2029321';
const USER = 'عمر';
const HOURS = 8, WINDOW = 900, MAX_FAILS = 5;

const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (s) => Uint8Array.from(s.match(/../g), (h) => parseInt(h, 16));
async function derive(text) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(text), 'PBKDF2', false, ['deriveBits']);
  return hex(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(SALT), iterations: 100000 }, key, 256)));
}
const same = (a, b) => { let d = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return d === 0; };

export async function onRequestGet({ request, env }) {
  return json({ ok: (await checkToken(request, env)) === 'm' });
}

export async function onRequestPost({ request, env }) {
  if (!env.DATA) return json({ error: 'not-configured' }, 501);
  const ip = request.headers.get('cf-connecting-ip') || 'x';
  const rlKey = `rlm:${ip}`;
  const fails = Number(await env.DATA.get(rlKey)) || 0;
  if (fails >= MAX_FAILS) return json({ error: 'locked', retryMin: Math.ceil(WINDOW / 60) }, 429);
  let body; try { body = await request.json(); } catch { return json({ error: 'bad-json' }, 400); }
  const user = String(body.user || '').trim(), pass = String(body.pass || '');
  const ok = same(await derive(`${user}:${pass}`), HASH) && user === USER;
  if (!ok) {
    await env.DATA.put(rlKey, String(fails + 1), { expirationTtl: WINDOW });
    return json({ error: 'bad-credentials', left: MAX_FAILS - fails - 1 }, 401);
  }
  if (fails) await env.DATA.delete(rlKey);
  await audit(env, request, 'login', 'دخول المدير إلى صفحة التقارير');
  return json({ token: await signToken(env, 'mgr', HOURS, 'm'), exp: Date.now() + HOURS * 3600e3 });
}
