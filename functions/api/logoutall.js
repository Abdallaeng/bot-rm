/** POST /api/logoutall — ينهي كل جلسات الإدارة المفتوحة (بما فيها الحالية) دون تغيير كلمة المرور. */
import { authed, json, forget, audit } from '../_shared.js';

export async function onRequestPost({ request, env }) {
  if (!env.DATA) return json({ error: 'not-configured' }, 501);
  if (!(await authed(request, env))) return json({ error: 'unauthorized' }, 401);
  await audit(env, request, 'security', 'إنهاء كل جلسات الإدارة');
  await env.DATA.put('pwv', String(Date.now() + 1));
  forget('pwv');
  return json({ ok: true });
}
