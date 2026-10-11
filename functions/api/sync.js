/** GET /api/sync — طلب واحد خفيف يجمع إصدار البيانات والإعلان الحالي: { updated, b }.
 *  يُخزَّن في كاش الحافة 60 ثانية، فمهما كثر المستخدمون لا يُقرأ KV أكثر من مرة في الدقيقة لكل منطقة. */
import { json, getVersion, edgeCached } from '../_shared.js';

export async function onRequestGet(ctx) {
  const { env } = ctx;
  return edgeCached(ctx, '/__sync', 60, async () => {
    const v = await getVersion(ctx);
    const b = env.DATA ? await env.DATA.get('broadcast', 'json') : null;
    return json({ updated: v.stored > v.fixed ? v.stored : v.fixed, b: b && (!b.expires || b.expires > Date.now()) ? b : null });
  });
}
