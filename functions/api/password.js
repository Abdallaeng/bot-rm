/** POST /api/password { old, next } — تغيير كلمة مرور الإدارة (اسم المستخدم admin). يُبطل كل الجلسات السابقة. */
import { authed, sha256, json, currentHash, forget } from '../_shared.js';

export async function onRequestPost({ request, env }) {
  if (!env.DATA) return json({ error: 'not-configured' }, 501);
  if (!(await authed(request, env))) return json({ error: 'unauthorized' }, 401);
  let body; try { body = await request.json(); } catch { return json({ error: 'bad-json' }, 400); }
  const next = String(body.next || '');
  if (next.length < 8 || !/\d/.test(next) || !/\D/.test(next)) return json({ error: 'weak', hint: '8 أحرف على الأقل مع أرقام وحروف' }, 400);
  if ((await sha256(`admin:${String(body.old || '')}`)) !== (await currentHash(env))) return json({ error: 'wrong-old' }, 403);
  await env.DATA.put('adminhash', await sha256(`admin:${next}`));
  await env.DATA.put('pwv', String(Date.now() + 1));
  forget('adminhash'); forget('pwv');
  return json({ ok: true });
}
