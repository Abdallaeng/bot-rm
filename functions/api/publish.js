/** POST /api/publish — نشر ملف البيانات (المشفّر مسبقاً في المتصفح) لكل المستخدمين.
 *  يتطلب ترويسة x-admin = "اسم المستخدم:كلمة المرور"، ويُخزَّن في KV بالاسم DATA. */
import { ADMIN_HASH, sha256, json } from '../_shared.js';

const MAX_BYTES = 8_000_000;

export async function onRequestPost({ request, env }) {
  if (!env.DATA) return json({ error: 'not-configured' }, 501);

  const [user = '', ...rest] = (request.headers.get('x-admin') || '').split(':');
  if ((await sha256(`${user.trim().toLowerCase()}:${rest.join(':')}`)) !== ADMIN_HASH) return json({ error: 'unauthorized' }, 401);

  const text = await request.text();
  if (text.length > MAX_BYTES) return json({ error: 'too-large' }, 413);

  let packet;
  try { packet = JSON.parse(text); } catch { return json({ error: 'bad-json' }, 400); }
  const valid = packet && packet.v === 1 && typeof packet.updated === 'string' && typeof packet.ct === 'string' && typeof packet.iv === 'string' && typeof packet.salt === 'string' && packet.count > 0;
  if (!valid) return json({ error: 'bad-packet' }, 400);

  await env.DATA.put('packet', text);
  return json({ ok: true, count: packet.count, updated: packet.updated });
}
