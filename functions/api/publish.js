/** POST /api/publish — نشر ملف البيانات (المشفّر مسبقاً في المتصفح) لكل المستخدمين.
 *  يتطلب جلسة إدارة (Authorization: Bearer) ويُخزَّن في KV بالاسم DATA. */
import { authed, json, purgeEdge } from '../_shared.js';

const MAX_BYTES = 8_000_000;

export async function onRequestPost({ request, env }) {
  if (!env.DATA) return json({ error: 'not-configured' }, 501);

  if (!(await authed(request, env))) return json({ error: 'unauthorized' }, 401);

  const text = await request.text();
  if (text.length > MAX_BYTES) return json({ error: 'too-large' }, 413);

  let packet;
  try { packet = JSON.parse(text); } catch { return json({ error: 'bad-json' }, 400); }
  const valid = packet && packet.v === 1 && typeof packet.updated === 'string' && typeof packet.ct === 'string' && typeof packet.iv === 'string' && typeof packet.salt === 'string' && packet.count > 0;
  if (!valid) return json({ error: 'bad-packet' }, 400);

  await env.DATA.put('packet', text);
  await env.DATA.put('pmeta', JSON.stringify({ updated: packet.updated }));

  // سجل النسخ: نحتفظ بآخر 8 نسخ كاملة للتراجع عند الخطأ
  let meta = {}; try { meta = JSON.parse(decodeURIComponent(request.headers.get('x-meta') || '%7B%7D')); } catch { /* اختياري */ }
  const id = Date.now().toString(36);
  await env.DATA.put(`ver:${id}`, text);
  const log = (await env.DATA.get('vlog', 'json')) || [];
  log.unshift({ id, ts: Date.now(), count: packet.count, updated: packet.updated, add: +meta.add || 0, chg: +meta.chg || 0, rem: +meta.rem || 0, name: String(meta.name || '').slice(0, 80) });
  for (const old of log.splice(8)) await env.DATA.delete(`ver:${old.id}`);
  await env.DATA.put('vlog', JSON.stringify(log));
  await purgeEdge(request, ['/__ver', '/__sync']);
  return json({ ok: true, count: packet.count, updated: packet.updated });
}
