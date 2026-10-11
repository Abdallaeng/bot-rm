/** GET  /api/broadcast  — الإعلان الحالي للجميع (أو null)
 *  POST /api/broadcast  — للإدارة: { action:'set', text, level:'info|warn|alert', hours? } أو { action:'clear' } */
import { authed, json, edgeCached, purgeEdge, forget } from '../_shared.js';

const PURGE = ['/__bcast', '/__sync'];
const LEVELS = ['info', 'warn', 'alert'];

export async function onRequestGet(ctx) {
  const { env } = ctx;
  if (!env.DATA) return json({ b: null });
  return edgeCached(ctx, '/__bcast', 60, async () => json({ b: await env.DATA.get('broadcast', 'json') }));
}

export async function onRequestPost({ request, env }) {
  if (!env.DATA) return json({ error: 'not-configured' }, 501);
  if (!(await authed(request, env))) return json({ error: 'unauthorized' }, 401);
  forget('broadcast');
  let body; try { body = await request.json(); } catch { return json({ error: 'bad-json' }, 400); }

  if (body.action === 'clear') { await env.DATA.delete('broadcast'); await purgeEdge(request, PURGE); return json({ ok: true }); }
  const text = String(body.text || '').trim().slice(0, 400);
  if (!text) return json({ error: 'empty' }, 400);
  const level = LEVELS.includes(body.level) ? body.level : 'info';
  const hours = Math.min(24 * 30, Math.max(0, +body.hours || 0));
  const b = { id: Date.now().toString(36), text, level, created: Date.now(), expires: hours ? Date.now() + hours * 3600e3 : 0 };
  await env.DATA.put('broadcast', JSON.stringify(b), hours ? { expirationTtl: Math.max(60, hours * 3600) } : undefined);
  const hist = ((await env.DATA.get('bhist', 'json')) || []);
  hist.unshift(b);
  await env.DATA.put('bhist', JSON.stringify(hist.slice(0, 15)));
  await purgeEdge(request, PURGE);
  return json({ ok: true, b });
}

