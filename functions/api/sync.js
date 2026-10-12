/** GET /api/sync — طلب واحد خفيف يجمع إصدار البيانات والإعلان الحالي: { updated, b }.
 *  يُخزَّن في كاش الحافة 20 ثانية، فمهما كثر المستخدمون لا يُقرأ KV أكثر من 3 مرات في الدقيقة لكل منطقة. */
import { json, getVersion, edgeCached, memo } from '../_shared.js';

export async function onRequestGet(ctx) {
  const { env } = ctx;
  return edgeCached(ctx, '/__sync', 20, async () => {
    const v = await getVersion(ctx);
    const b = env.DATA ? await memo('bcast', 5, () => env.DATA.get('broadcast', 'json')) : null;
    return json({ updated: v.stored > v.fixed ? v.stored : v.fixed, b: b && (!b.expires || b.expires > Date.now()) ? b : null });
  });
}
