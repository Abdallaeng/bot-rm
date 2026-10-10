/** POST /api/track — يستقبل دفعة أحداث بحث من الأجهزة ويجمّعها يومياً في KV.
 *  الجسم: { d: معرّف الجهاز, e: [[وقت_ms, نص_البحث, وُجد(1/0)], ...] } */
import { json, dayKey, hourOf, clean, bump } from '../_shared.js';

const AGG_TTL = 90 * 86400, MAX_EVENTS = 50, MAX_BODY = 20_000;

export async function onRequestPost({ request, env }) {
  if (!env.DATA) return json({ error: 'not-configured' }, 501);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: 'too-large' }, 413);
  let body; try { body = JSON.parse(raw); } catch { return json({ error: 'bad-json' }, 400); }
  const dev = String(body.d || '').replace(/[^\w-]/g, '').slice(0, 12);
  const now = Date.now();
  const events = (Array.isArray(body.e) ? body.e : []).slice(0, MAX_EVENTS)
    .map(([t, q, f]) => ({ t: Math.min(now, Math.max(now - 2 * 86400e3, +t || now)), q: clean(q), f: f ? 1 : 0 }))
    .filter((x) => x.q);
  if (!events.length || !dev) return json({ ok: true, n: 0 });

  const byDay = {};
  events.forEach((x) => (byDay[dayKey(x.t)] ||= []).push(x));
  for (const [day, list] of Object.entries(byDay)) {
    const key = `agg:${day}`;
    const agg = (await env.DATA.get(key, 'json')) || { s: 0, m: 0, u: {}, h: Array(24).fill(0), top: {}, miss: {} };
    list.forEach((x) => {
      agg.s++; agg.h[hourOf(x.t)]++;
      if (x.f) bump(agg.top, x.q, 300); else { agg.m++; bump(agg.miss, x.q, 150); }
    });
    if (Object.keys(agg.u).length < 3000) agg.u[dev] = 1;
    await env.DATA.put(key, JSON.stringify(agg), { expirationTtl: AGG_TTL });
  }

  const recent = (await env.DATA.get('recent', 'json')) || [];
  const merged = events.map((x) => [x.t, x.q, x.f, dev.slice(0, 4)]).concat(recent).sort((a, b) => b[0] - a[0]).slice(0, 60);
  await env.DATA.put('recent', JSON.stringify(merged), { expirationTtl: AGG_TTL });
  return json({ ok: true, n: events.length });
}
