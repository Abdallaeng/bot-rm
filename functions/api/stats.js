/** GET /api/stats?days=14 — تقارير الاستخدام لكل المستخدمين (للإدارة فقط). */
import { authed, json, dayKey } from '../_shared.js';

export async function onRequestGet({ request, env }) {
  if (!env.DATA) return json({ error: 'not-configured' }, 501);
  if (!(await authed(request, env))) return json({ error: 'unauthorized' }, 401);
  const days = Math.min(30, Math.max(1, +new URL(request.url).searchParams.get('days') || 14));
  const keys = Array.from({ length: days }, (_, i) => dayKey(Date.now() - (days - 1 - i) * 86400e3));
  const [aggs, recent, bc] = await Promise.all([
    Promise.all(keys.map((d) => env.DATA.get(`agg:${d}`, 'json'))),
    env.DATA.get('recent', 'json'),
    env.DATA.get('broadcast', 'json'),
  ]);
  const top = (m) => Object.entries(m || {}).sort((a, b) => b[1] - a[1]).slice(0, 20);
  return json({
    days: keys.map((d, i) => {
      const a = aggs[i];
      return { day: d, s: a?.s || 0, m: a?.m || 0, u: a ? Object.keys(a.u).length : 0, h: a?.h || Array(24).fill(0), top: top(a?.top), miss: top(a?.miss) };
    }),
    recent: recent || [],
    broadcast: bc,
    now: Date.now(),
  });
}
