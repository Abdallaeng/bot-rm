/** GET /api/dataver — إصدار البيانات الحالي فقط (بضعة بايتات). يُخزَّن في كاش الحافة دقيقة فلا يصل KV إلا نادراً. */
import { json, getVersion } from '../_shared.js';

export async function onRequestGet(ctx) {
  const v = await getVersion(ctx);
  return json({ updated: v.stored > v.fixed ? v.stored : v.fixed });
}
