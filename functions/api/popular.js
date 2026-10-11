/** GET /api/popular — أكثر المواقع بحثاً آخر 7 أيام (عام، يُخزَّن مؤقتاً 10 دقائق). */
import { json, dayKey } from '../_shared.js';

export async function onRequestGet({ env }) {
  if (!env.DATA) return json({ top: [] });
  const keys = Array.from({ length: 7 }, (_, i) => dayKey(Date.now() - i * 86400e3));
  const aggs = await Promise.all(keys.map((d) => env.DATA.get(`agg:${d}`, 'json')));
  const m = {};
  aggs.forEach((a) => Object.entries(a?.top || {}).forEach(([q, n]) => { if (/^\d{1,6}$/.test(q)) m[q] = (m[q] || 0) + n; }));
  const top = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([q]) => q);
  const res = json({ top });
  res.headers.set('cache-control', 'public, max-age=600');
  return res;
}
