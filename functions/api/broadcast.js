/** GET  /api/broadcast  — الإعلان الحالي للجميع (أو null)
 *  POST /api/broadcast  — للإدارة: { action:'set', text, level:'info|warn|alert', hours? } أو { action:'clear' } */
import { authed, json } from '../_shared.js';

const LEVELS = ['info', 'warn', 'alert'];

export async function onRequestGet({ env }) {
  if (!env.DATA) return json({ b: null });
  return json({ b: await env.DATA.get('broadcast', 'json') });
}

export async function onRequestPost({ request, env }) {
  if (!env.DATA) return json({ error: 'not-configured' }, 501);
  if (!(await authed(request))) return json({ error: 'unauthorized' }, 401);
  let body; try { body = await request.json(); } catch { return json({ error: 'bad-json' }, 400); }

  if (body.action === 'clear') { await env.DATA.delete('broadcast'); return json({ ok: true }); }
  const text = String(body.text || '').trim().slice(0, 400);
  if (!text) return json({ error: 'empty' }, 400);
  const level = LEVELS.includes(body.level) ? body.level : 'info';
  const hours = Math.min(24 * 30, Math.max(0, +body.hours || 0));
  const b = { id: Date.now().toString(36), text, level, created: Date.now(), expires: hours ? Date.now() + hours * 3600e3 : 0 };
  await env.DATA.put('broadcast', JSON.stringify(b), hours ? { expirationTtl: Math.max(60, hours * 3600) } : undefined);
  const hist = ((await env.DATA.get('bhist', 'json')) || []);
  hist.unshift(b);
  await env.DATA.put('bhist', JSON.stringify(hist.slice(0, 15)));
  return json({ ok: true, b });
}

