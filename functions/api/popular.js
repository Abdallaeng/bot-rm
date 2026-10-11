/** GET /api/popular — أكثر المواقع بحثاً آخر 7 أيام (عام، يُخزَّن مؤقتاً 10 دقائق). */
import { json, dayKey, getAgg, edgeCached } from '../_shared.js';

export async function onRequestGet(ctx) {
  const { env } = ctx;
  if (!env.DATA) return json({ top: [] });
  return edgeCached(ctx, '/__popular', 900, () => compute(env), 'public, max-age=900');
}

async function compute(env) {
  const keys = Array.from({ length: 7 }, (_, i) => dayKey(Date.now() - i * 86400e3));
  const aggs = await Promise.all(keys.map((d) => getAgg(env, d)));
  const m = {};
  aggs.forEach((a) => Object.entries(a?.top || {}).forEach(([q, n]) => { if (/^\d{1,6}$/.test(q)) m[q] = (m[q] || 0) + n; }));
  const top = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([q]) => q);
  return json({ top });
}
