/** تحكمات المنصة (50 تحكماً من لوحة الإدارة) — وثيقة واحدة في KV بمفتاح `ctl`: { v, c, fd, fa }
 *  c = القيم المختلفة عن الافتراضي فقط · fd/fa = رمزا «إجبار تنزيل البيانات» و«إجبار تحديث التطبيق».
 *  GET  /api/controls — عام (كاش الحافة 20 ث)؛ الأجهزة تجلبه فقط عند تغيّر رقم الإصدار tv في /api/sync.
 *  POST /api/controls — للإدارة: { c: {...} } أو { action: 'forceData' | 'forceApp' } */
import { authed, json, edgeCached, purgeEdge, getCtl, forget, audit } from '../_shared.js';
import { cleanControls, CONTROLS } from '../../js/data/controlsSchema.js';

export async function onRequestGet(ctx) {
  const { env } = ctx;
  if (!env.DATA) return json({ v: 0, c: {}, fd: 0, fa: 0 });
  return edgeCached(ctx, '/__ctl', 20, async () => json(await getCtl(env)));
}

export async function onRequestPost({ request, env }) {
  if (!env.DATA) return json({ error: 'not-configured' }, 501);
  if (!(await authed(request, env))) return json({ error: 'unauthorized' }, 401);
  let body; try { body = await request.json(); } catch { return json({ error: 'bad-json' }, 400); }
  const prev = await getCtl(env);
  const doc = { v: Date.now(), c: prev.c, fd: prev.fd || 0, fa: prev.fa || 0 };
  let what;
  if (body.action === 'forceData' || body.action === 'forceApp') {
    if (body.action === 'forceData') doc.fd = Date.now(); else doc.fa = Date.now();
    what = CONTROLS.find((c) => c.k === body.action)?.label || body.action;
  } else {
    doc.c = cleanControls(body.c);
    const keys = new Set([...Object.keys(prev.c), ...Object.keys(doc.c)]);
    const changed = [...keys].filter((k) => JSON.stringify(prev.c[k]) !== JSON.stringify(doc.c[k])).map((k) => CONTROLS.find((c) => c.k === k)?.label || k);
    what = changed.length ? `تعديل التحكمات (${changed.length}): ${changed.slice(0, 4).join('، ')}${changed.length > 4 ? '…' : ''}` : 'حفظ التحكمات (بلا تغيير)';
  }
  await env.DATA.put('ctl', JSON.stringify(doc));
  forget('ctl');
  await audit(env, request, 'publish', body.action ? `تنفيذ: ${what}` : what);
  await purgeEdge(request, ['/__ctl', '/__sync']);
  return json({ ok: true, ...doc });
}
