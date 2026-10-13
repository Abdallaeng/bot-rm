/** تصحيحات العرض (تُدار من لوحة الإدارة وتُطبَّق عند كل المستخدمين فوراً دون إعادة رفع الإكسل).
 *  GET  /api/corrections — القائمة { v, list } (عامة، من كاش الحافة)
 *  POST /api/corrections — للإدارة: { list:[{id, field, value, until?, note?}] } يستبدل القائمة كاملة
 *  field: مفتاح من الصف الرئيسي (nm, st, cl…) أو x.<مفتاح> للحقول الإضافية؛ value فارغة = إخفاء الحقل. */
import { authed, json, edgeCached, purgeEdge, forget, getCorr, audit } from '../_shared.js';

const MAX = 100;
const FIELDS = new Set(['nm', 'st', 'cl', 'mn', 'mp', 'inv', 'own', 'sev', 'io', 'gov', 'ven', 'sub', 't2', 'cm', 'x.tower', 'x.cabType', 'x.cabModel', 'x.asp', 'x.siteStatus', 'x.city', 'x.subRegion', 'x.region', 'x.siteAddr', 'x.btsAddr']);

export async function onRequestGet(ctx) {
  const { env } = ctx;
  if (!env.DATA) return json({ v: 0, list: [] });
  return edgeCached(ctx, '/__corr', 20, async () => json(await getCorr(env)));
}

export async function onRequestPost({ request, env }) {
  if (!env.DATA) return json({ error: 'not-configured' }, 501);
  if (!(await authed(request, env))) return json({ error: 'unauthorized' }, 401);
  let body; try { body = await request.json(); } catch { return json({ error: 'bad-json' }, 400); }
  const list = (Array.isArray(body.list) ? body.list : []).slice(0, MAX).map((x) => ({
    id: String(x.id || '').replace(/\D/g, '').slice(0, 8),
    field: String(x.field || ''),
    value: String(x.value ?? '').trim().slice(0, 300),
    until: /^\d{4}-\d{2}-\d{2}$/.test(x.until || '') ? x.until : '',
    note: String(x.note || '').trim().slice(0, 80),
  })).filter((x) => x.id && FIELDS.has(x.field));
  const prev = await getCorr(env);
  const doc = { v: Date.now(), list };
  await env.DATA.put('corr', JSON.stringify(doc));
  forget('corr');
  await audit(env, request, 'publish', `تعديل التصحيحات: ${list.length} تصحيح (كان ${prev.list.length})`);
  await purgeEdge(request, ['/__corr', '/__sync']);
  return json({ ok: true, ...doc });
}
